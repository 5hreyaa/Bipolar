import io
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import AppException
from app.models.activity import Activity
from app.models.snack import Snack
from app.services.image_service import UPLOADS_ROOT
from app.services.scanner_service import MODEL_LIMITATIONS, MODEL_NAME


def _make_test_image_bytes(fmt: str = "PNG", color: tuple[int, int, int] = (34, 139, 94)) -> bytes:
    img = Image.new("RGB", (120, 120), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _cleanup_uploaded_url(image_url: str | None) -> None:
    if not image_url or not image_url.startswith("/uploads/"):
        return
    rel = image_url.removeprefix("/uploads/").lstrip("/")
    target = UPLOADS_ROOT / rel
    if target.exists() and target.is_file():
        target.unlink()


def test_snack_brand_image_price_and_search(
    client: TestClient,
    admin_headers: dict[str, str],
    member_headers: dict[str, str],
) -> None:
    create_res = client.post(
        "/snacks",
        headers=admin_headers,
        json={
            "name": "Dark Fantasy Choco Fills",
            "brand": "Sunfeast",
            "category": "sweet",
            "quantity": 18,
            "low_stock_threshold": 5,
            "image_url": "/uploads/demo/oreo-creme-biscuits.jpg",
            "price": 1.25,
        },
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["brand"] == "Sunfeast"
    assert created["image_url"] == "/uploads/demo/oreo-creme-biscuits.jpg"
    assert created["price"] == 1.25

    search_res = client.get("/snacks?search=Sunfeast", headers=member_headers)
    assert search_res.status_code == 200
    items = search_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == created["id"]

    patch_res = client.patch(
        f"/snacks/{created['id']}",
        headers=admin_headers,
        json={"brand": "ITC Sunfeast", "price": 1.50},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["brand"] == "ITC Sunfeast"
    assert patch_res.json()["price"] == 1.50


def test_upload_image_rbac_validation_and_serving(
    client: TestClient,
    admin_headers: dict[str, str],
    member_headers: dict[str, str],
) -> None:
    img_bytes = _make_test_image_bytes("JPEG")

    member_res = client.post(
        "/snacks/upload-image",
        headers=member_headers,
        files={"file": ("snack.jpg", img_bytes, "image/jpeg")},
    )
    assert member_res.status_code == 403

    bad_type_res = client.post(
        "/snacks/upload-image",
        headers=admin_headers,
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert bad_type_res.status_code == 422
    assert bad_type_res.json()["error"]["code"] == "UNSUPPORTED_IMAGE_TYPE"

    corrupt_res = client.post(
        "/snacks/upload-image",
        headers=admin_headers,
        files={"file": ("fake.jpg", b"not-real-jpeg-bytes", "image/jpeg")},
    )
    assert corrupt_res.status_code == 422
    assert corrupt_res.json()["error"]["code"] == "INVALID_IMAGE"

    uploaded_url = None
    try:
        ok_res = client.post(
            "/snacks/upload-image",
            headers=admin_headers,
            files={"file": ("snack.jpg", img_bytes, "image/jpeg")},
        )
        assert ok_res.status_code == 201
        body = ok_res.json()
        uploaded_url = body["image_url"]
        assert uploaded_url.startswith("/uploads/snacks/")
        assert body["content_type"] == "image/jpeg"
        assert body["size_bytes"] > 0

        static_res = client.get(uploaded_url)
        assert static_res.status_code == 200
        assert static_res.headers["content-type"].startswith("image/jpeg")
    finally:
        _cleanup_uploaded_url(uploaded_url)


def test_scanner_info_and_predict_does_not_autosave(
    client: TestClient,
    db_session: Session,
    admin_headers: dict[str, str],
    member_headers: dict[str, str],
) -> None:
    member_info = client.get("/scanner/info", headers=member_headers)
    assert member_info.status_code == 403

    admin_info = client.get("/scanner/info", headers=admin_headers)
    assert admin_info.status_code == 200
    info_data = admin_info.json()
    assert info_data["model_name"] == MODEL_NAME
    assert set(info_data["categories"]) == {"sweet", "savoury", "drink", "healthy-ish"}

    img_bytes = _make_test_image_bytes("PNG")
    member_predict = client.post(
        "/scanner/predict",
        headers=member_headers,
        files={"file": ("chip.png", img_bytes, "image/png")},
    )
    assert member_predict.status_code == 403

    invalid_predict = client.post(
        "/scanner/predict",
        headers=admin_headers,
        files={"file": ("bad.png", b"broken-png", "image/png")},
    )
    assert invalid_predict.status_code == 422

    mock_prediction = {
        "predicted_category": "savoury",
        "confidence": 0.34,
        "low_confidence": True,
        "scores": {
            "sweet": 0.25,
            "savoury": 0.34,
            "drink": 0.20,
            "healthy-ish": 0.21,
        },
        "model_name": MODEL_NAME,
        "limitations": MODEL_LIMITATIONS,
    }

    uploaded_url = None
    try:
        with patch("app.routers.scanner.scanner.predict_category", return_value=mock_prediction):
            pred_res = client.post(
                "/scanner/predict",
                headers=admin_headers,
                files={"file": ("lays.png", img_bytes, "image/png")},
            )
        assert pred_res.status_code == 200
        pred_data = pred_res.json()
        assert pred_data["predicted_category"] == "savoury"
        assert pred_data["confidence"] == 0.34
        assert pred_data["low_confidence"] is True
        uploaded_url = pred_data["image_url"]
        assert uploaded_url.startswith("/uploads/snacks/")

        # Unconfirmed scan must NOT mutate snacks or activities tables
        assert db_session.execute(select(Snack)).scalars().all() == []
        assert db_session.execute(select(Activity)).scalars().all() == []

        # Explicit admin confirmation creates the snack reusing the scanned image
        confirm_res = client.post(
            "/snacks",
            headers=admin_headers,
            json={
                "name": "Lay's Classic Salted",
                "brand": "Lay's",
                "category": "savoury",
                "quantity": 12,
                "low_stock_threshold": 5,
                "image_url": uploaded_url,
            },
        )
        assert confirm_res.status_code == 201
        assert confirm_res.json()["image_url"] == uploaded_url
    finally:
        _cleanup_uploaded_url(uploaded_url)


def test_manual_creation_works_when_scanner_unavailable(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    img_bytes = _make_test_image_bytes("PNG")
    with patch(
        "app.routers.scanner.scanner.predict_category",
        side_effect=AppException(
            status_code=503,
            code="SCANNER_MODEL_UNAVAILABLE",
            message="Model failed to load.",
        ),
    ):
        pred_res = client.post(
            "/scanner/predict",
            headers=admin_headers,
            files={"file": ("snack.png", img_bytes, "image/png")},
        )
    assert pred_res.status_code == 503
    assert pred_res.json()["error"]["code"] == "SCANNER_MODEL_UNAVAILABLE"

    manual_res = client.post(
        "/snacks",
        headers=admin_headers,
        json={
            "name": "Manual Fallback Crackers",
            "brand": "Britannia",
            "category": "savoury",
            "quantity": 10,
            "low_stock_threshold": 5,
        },
    )
    assert manual_res.status_code == 201

