from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.snack import SnackCategory, SnackStatus


def _clean_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _validate_image_url(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_optional_str(value)
    if cleaned is None:
        return None
    if not (
        cleaned.startswith("/")
        or cleaned.startswith("http://")
        or cleaned.startswith("https://")
    ):
        raise ValueError("Image URL must be a relative upload path or an http(s) URL")
    return cleaned


class SnackCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    brand: Optional[str] = Field(default=None, max_length=100)
    category: SnackCategory
    quantity: int = Field(default=0, ge=0, le=100000)
    low_stock_threshold: int = Field(default=5, ge=0, le=10000)
    image_url: Optional[str] = Field(default=None, max_length=500)
    price: Optional[float] = Field(default=None, ge=0, le=100000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Snack name cannot be blank")
        return cleaned

    @field_validator("brand")
    @classmethod
    def strip_brand(cls, v: Optional[str]) -> Optional[str]:
        return _clean_optional_str(v)

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_image_url(v)


class SnackUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    brand: Optional[str] = Field(default=None, max_length=100)
    category: Optional[SnackCategory] = None
    quantity: Optional[int] = Field(default=None, ge=0, le=100000)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0, le=10000)
    image_url: Optional[str] = Field(default=None, max_length=500)
    price: Optional[float] = Field(default=None, ge=0, le=100000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Snack name cannot be blank")
        return cleaned

    @field_validator("brand")
    @classmethod
    def strip_brand(cls, v: Optional[str]) -> Optional[str]:
        return _clean_optional_str(v)

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_image_url(v)


class SnackConsumeRequest(BaseModel):
    amount: int = Field(default=1, ge=1, le=100, description="Number of units to consume")


class SnackRestockRequest(BaseModel):
    amount: int = Field(..., ge=1, le=10000, description="Number of units to add to stock")


class SnackOut(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    category: str
    quantity: int
    low_stock_threshold: int
    image_url: Optional[str] = None
    price: Optional[float] = None
    status: SnackStatus
    vote_count: int = 0
    has_voted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ImageUploadResponse(BaseModel):
    image_url: str
    filename: str
    content_type: str
    size_bytes: int


class SnackListResponse(BaseModel):
    items: List[SnackOut]
    total: int
    page: int
    per_page: int
    total_pages: int


class SnackSummaryResponse(BaseModel):
    total_snacks: int
    stocked_count: int
    running_low_count: int
    gone_count: int
    total_units: int
    total_votes: int
    snack_of_the_week: Optional[SnackOut] = None


class ConsumeResponse(BaseModel):
    snack: SnackOut
    consumed_amount: int
    remaining_quantity: int


class RestockResponse(BaseModel):
    snack: SnackOut
    restocked_amount: int
    new_quantity: int


class VoteResponse(BaseModel):
    snack_id: int
    vote_count: int
    has_voted: bool

