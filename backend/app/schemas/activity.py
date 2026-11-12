from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ActivityOut(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    snack_id: Optional[int]
    snack_name: str
    action: str
    amount: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityListResponse(BaseModel):
    items: List[ActivityOut]
    total: int
    page: int
    per_page: int
    total_pages: int

