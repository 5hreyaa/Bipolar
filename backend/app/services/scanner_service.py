import logging
import threading
from typing import Dict, Tuple

from fastapi import status
from PIL import Image

from app.exceptions import AppException
from app.models.snack import SnackCategory

logger = logging.getLogger(__name__)

MODEL_NAME = "openai/clip-vit-base-patch32"
LOW_CONFIDENCE_THRESHOLD = 0.40
MODEL_LIMITATIONS = (
    "Uses pretrained zero-shot vision-language classification (openai/clip-vit-base-patch32). "
    "It predicts broad pantry categories (Sweet, Savoury, Drink, Healthy-ish) only and cannot "
    "reliably identify exact snack brands, flavours, or product names. Always verify before saving."
)

CATEGORY_PROMPTS: Dict[SnackCategory, str] = {
    SnackCategory.SWEET: (
        "a photo of sweet packaged snacks, chocolate bar, cookies, biscuits, wafers, or candy"
    ),
    SnackCategory.SAVOURY: (
        "a photo of savoury snacks, potato chips, crisps, crackers, popcorn, pretzels, or salted namkeen"
    ),
    SnackCategory.DRINK: (
        "a photo of a beverage drink, juice carton, soda can, water bottle, iced coffee, or tea"
    ),
    SnackCategory.HEALTHY_ISH: (
        "a photo of healthy snacks, fresh fruit, almonds, roasted nuts, yogurt, oats, granola, or protein bar"
    ),
}


class SmartSnackScanner:
    """Lazy-loaded Hugging Face CLIP classifier for predicting pantry snack categories."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._processor = None

    def _ensure_loaded(self) -> Tuple[object, object]:
        if self._model is not None and self._processor is not None:
            return self._model, self._processor

        with self._lock:
            if self._model is not None and self._processor is not None:
                return self._model, self._processor
            try:
                from transformers import CLIPModel, CLIPProcessor

                logger.info("Loading pretrained Hugging Face model: %s", MODEL_NAME)
                processor = CLIPProcessor.from_pretrained(MODEL_NAME)
                model = CLIPModel.from_pretrained(MODEL_NAME)
                model.eval()
                self._processor = processor
                self._model = model
                return self._model, self._processor
            except Exception as exc:
                logger.exception("Failed to load CLIP model %s", MODEL_NAME)
                raise AppException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    code="SCANNER_UNAVAILABLE",
                    message=(
                        f"Smart Snack Scanner model could not be loaded ({exc}). "
                        "You can still add snacks manually."
                    ),
                )

    def predict_category(self, pil_image: Image.Image) -> Dict[str, object]:
        """Classify a Pillow image into one of the four snack categories."""
        model, processor = self._ensure_loaded()

        try:
            import torch

            rgb_image = pil_image.convert("RGB")
            rgb_image.thumbnail((512, 512))

            categories = list(CATEGORY_PROMPTS.keys())
            prompts = [CATEGORY_PROMPTS[cat] for cat in categories]

            inputs = processor(
                text=prompts,
                images=rgb_image,
                return_tensors="pt",
                padding=True,
            )

            with torch.no_grad():
                outputs = model(**inputs)
                probs = outputs.logits_per_image.softmax(dim=1).squeeze(0).tolist()

            scores = {
                cat.value: round(float(prob), 4)
                for cat, prob in zip(categories, probs)
            }
            ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
            best_category, best_confidence = ranked[0]
            second_confidence = ranked[1][1] if len(ranked) > 1 else 0.0

            low_confidence = (
                best_confidence < LOW_CONFIDENCE_THRESHOLD
                or (best_confidence - second_confidence) < 0.08
            )

            return {
                "predicted_category": SnackCategory(best_category),
                "confidence": round(best_confidence, 4),
                "low_confidence": low_confidence,
                "scores": scores,
                "model_name": MODEL_NAME,
                "limitations": MODEL_LIMITATIONS,
            }
        except AppException:
            raise
        except Exception as exc:
            logger.exception("Smart Snack Scanner inference error")
            raise AppException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="SCANNER_INFERENCE_ERROR",
                message=f"Failed to classify image ({exc}). Please select a category manually.",
            )


scanner = SmartSnackScanner()

