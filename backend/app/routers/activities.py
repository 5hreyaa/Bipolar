from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.activity import ActivityAction
from app.models.user import User
from app.schemas.activity import ActivityListResponse
from app.services import activity_service

router = APIRouter(prefix="/activities", tags=["Activities"])


@router.get("", response_model=ActivityListResponse)
def list_activities(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=15, ge=1, le=100),
    snack_id: Optional[int] = Query(default=None, ge=1),
    action: Optional[ActivityAction] = Query(default=None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> ActivityListResponse:
    """List paginated pantry activities (admin only)."""
    return activity_service.list_activities(
        db=db,
        page=page,
        per_page=per_page,
        snack_id=snack_id,
        action=action,
    )

