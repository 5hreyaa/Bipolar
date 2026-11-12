import io
from pathlib import Path
from typing import Tuple
import uuid

from fastapi import UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.exceptions import AppException

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
FORMAT_TO_EXT = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
}

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_ROOT = BASE_DIR / "uploads"
SNACK_UPLOADS_DIR = UPLOADS_ROOT / "snacks"
DEMO_UPLOADS_DIR = UPLOADS_ROOT / "demo"


def ensure_upload_dirs() -> None:
    SNACK_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    DEMO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


async def read_and_validate_image(file: UploadFile) -> Tuple[bytes, Image.Image, str, str]:
    """Read an uploaded file, enforce size & MIME checks, and verify image integrity via Pillow."""
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise AppException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="UNSUPPORTED_IMAGE_TYPE",
            message="Unsupported file type. Please upload a JPEG, PNG, or WEBP image.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise AppException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="EMPTY_IMAGE",
            message="Uploaded image file is empty.",
        )

    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise AppException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            code="IMAGE_TOO_LARGE",
            message="Image exceeds the 5 MB maximum upload size.",
        )

    try:
        with Image.open(io.BytesIO(raw_bytes)) as img_verify:
            img_format = img_verify.format
            img_verify.verify()
    except (UnidentifiedImageError, Exception):
        raise AppException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="INVALID_IMAGE",
            message="The uploaded file could not be decoded as a valid image.",
        )

    if img_format not in FORMAT_TO_EXT:
        raise AppException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="UNSUPPORTED_IMAGE_FORMAT",
            message="Only JPEG, PNG, and WEBP image formats are supported.",
        )

    ext, canonical_mime = FORMAT_TO_EXT[img_format]
    with Image.open(io.BytesIO(raw_bytes)) as img:
        normalized = ImageOps.exif_transpose(img)
        if normalized.mode not in ("RGB", "RGBA"):
            normalized = normalized.convert("RGB")
        elif ext == "jpg" and normalized.mode == "RGBA":
            normalized = normalized.convert("RGB")
        # Copy into memory so file handle closes cleanly
        pil_image = normalized.copy()

    return raw_bytes, pil_image, ext, canonical_mime


def save_validated_image(pil_image: Image.Image, ext: str) -> Tuple[str, str, int]:
    """Re-encode and save validated image under a UUID filename to prevent traversal or payload smuggling."""
    ensure_upload_dirs()
    filename = f"{uuid.uuid4().hex}.{ext}"
    dest = SNACK_UPLOADS_DIR / filename

    save_format = "JPEG" if ext == "jpg" else ext.upper()
    save_kwargs = {"quality": 88, "optimize": True} if save_format in ("JPEG", "WEBP") else {"optimize": True}

    image_to_save = pil_image
    if save_format == "JPEG" and image_to_save.mode != "RGB":
        image_to_save = image_to_save.convert("RGB")

    image_to_save.save(dest, format=save_format, **save_kwargs)
    size_bytes = dest.stat().st_size
    return f"/uploads/snacks/{filename}", filename, size_bytes

