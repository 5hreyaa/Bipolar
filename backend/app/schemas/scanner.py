from typing import Dict

from pydantic import BaseModel, ConfigDict

from app.models.snack import SnackCategory


class ScannerPredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    predicted_category: SnackCategory
    confidence: float
    low_confidence: bool
    scores: Dict[str, float]
    image_url: str
    model_name: str
    limitations: str


class ScannerInfoResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_name: str
    categories: list[str]
    low_confidence_threshold: float
    limitations: str

