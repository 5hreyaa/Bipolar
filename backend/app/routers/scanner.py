from fastapi import APIRouter, Depends, File, UploadFile

from app.dependencies import require_admin
from app.models.snack import SnackCategory
from app.models.user import User
from app.schemas.scanner import ScannerInfoResponse, ScannerPredictResponse
from app.services.image_service import read_and_validate_image, save_validated_image
from app.services.scanner_service import (
    LOW_CONFIDENCE_THRESHOLD,
    MODEL_LIMITATIONS,
    MODEL_NAME,
    scanner,
)

router = APIRouter(prefix="/scanner", tags=["Smart Snack Scanner"])


@router.get("/info", response_model=ScannerInfoResponse)
def get_scanner_info(
    admin_user: User = Depends(require_admin),
) -> ScannerInfoResponse:
    """Return metadata and limitations for the Smart Snack Scanner CV module."""
    return ScannerInfoResponse(
        model_name=MODEL_NAME,
        categories=[cat.value for cat in SnackCategory],
        low_confidence_threshold=LOW_CONFIDENCE_THRESHOLD,
        limitations=MODEL_LIMITATIONS,
    )


@router.post("/predict", response_model=ScannerPredictResponse)
async def predict_snack_category(
    file: UploadFile = File(...),
    admin_user: User = Depends(require_admin),
) -> ScannerPredictResponse:
    """Validate an uploaded snack image, classify its category via CLIP, and return preview URL.

    Does NOT create or modify any snack records in PostgreSQL; the admin must explicitly confirm.
    """
    _, pil_image, ext, _ = await read_and_validate_image(file)
    prediction = scanner.predict_category(pil_image)
    image_url, _, _ = save_validated_image(pil_image, ext)

    return ScannerPredictResponse(
        predicted_category=prediction["predicted_category"],  # type: ignore[arg-type]
        confidence=prediction["confidence"],  # type: ignore[arg-type]
        low_confidence=prediction["low_confidence"],  # type: ignore[arg-type]
        scores=prediction["scores"],  # type: ignore[arg-type]
        image_url=image_url,
        model_name=prediction["model_name"],  # type: ignore[arg-type]
        limitations=prediction["limitations"],  # type: ignore[arg-type]
    )

