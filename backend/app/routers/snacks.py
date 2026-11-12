from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.snack import SnackCategory, SnackStatus
from app.models.user import User
from app.schemas.snack import (
    ConsumeResponse,
    ImageUploadResponse,
    RestockResponse,
    SnackConsumeRequest,
    SnackCreate,
    SnackListResponse,
    SnackOut,
    SnackRestockRequest,
    SnackSummaryResponse,
    SnackUpdate,
    VoteResponse,
)
from app.services import snack_service
from app.services.image_service import read_and_validate_image, save_validated_image
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/snacks", tags=["Snacks"])


@router.post("/upload-image", response_model=ImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_snack_image(
    file: UploadFile = File(...),
    admin_user: User = Depends(require_admin),
) -> ImageUploadResponse:
    """Securely validate and store a product image uploaded by an admin."""
    _, pil_image, ext, canonical_mime = await read_and_validate_image(file)
    image_url, filename, size_bytes = save_validated_image(pil_image, ext)
    return ImageUploadResponse(
        image_url=image_url,
        filename=filename,
        content_type=canonical_mime,
        size_bytes=size_bytes,
    )


@router.get("/summary", response_model=SnackSummaryResponse)
def get_snacks_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnackSummaryResponse:
    """Return pantry inventory summary metrics and Snack of the Week."""
    return snack_service.get_snacks_summary(db, current_user.id)


@router.get("", response_model=SnackListResponse)
def list_snacks(
    search: Optional[str] = Query(default=None, max_length=100),
    category: Optional[SnackCategory] = Query(default=None),
    snack_status: Optional[SnackStatus] = Query(default=None, alias="status"),
    sort_by: Literal["name", "quantity", "votes", "created_at"] = Query(default="name"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnackListResponse:
    """Search, filter, sort, and paginate pantry snacks."""
    return snack_service.list_snacks(
        db=db,
        user_id=current_user.id,
        search=search,
        category=category,
        status_filter=snack_status,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )


@router.get("/{snack_id}", response_model=SnackOut)
def get_snack(
    snack_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnackOut:
    """Fetch detailed information for a single snack."""
    return snack_service.get_snack_by_id(db, snack_id, current_user.id)


@router.post("", response_model=SnackOut, status_code=status.HTTP_201_CREATED)
def create_snack(
    payload: SnackCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> SnackOut:
    """Create a new snack in the pantry (admin only)."""
    snack_out = snack_service.create_snack(db, payload, admin_user)
    ws_manager.broadcast_from_sync(
        "snack_created",
        {"snack": snack_out.model_dump(mode="json")},
    )
    return snack_out


@router.patch("/{snack_id}", response_model=SnackOut)
def update_snack(
    snack_id: int,
    payload: SnackUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> SnackOut:
    """Update snack metadata or threshold (admin only)."""
    snack_out = snack_service.update_snack(db, snack_id, payload, admin_user)
    ws_manager.broadcast_from_sync(
        "snack_updated",
        {"snack": snack_out.model_dump(mode="json")},
    )
    return snack_out


@router.delete("/{snack_id}")
def delete_snack(
    snack_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> dict:
    """Delete a snack from the pantry (admin only)."""
    deleted_name = snack_service.delete_snack(db, snack_id, admin_user)
    ws_manager.broadcast_from_sync(
        "snack_deleted",
        {"snack_id": snack_id, "snack_name": deleted_name},
    )
    return {"message": f"Snack '{deleted_name}' deleted.", "deleted_id": snack_id}


@router.post("/{snack_id}/consume", response_model=ConsumeResponse)
def consume_snack(
    snack_id: int,
    payload: SnackConsumeRequest = Body(default_factory=SnackConsumeRequest),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConsumeResponse:
    """Atomically consume snack stock and log activity."""
    result = snack_service.consume_snack(db, snack_id, payload.amount, current_user)
    ws_manager.broadcast_from_sync(
        "stock_updated",
        {
            "snack_id": result.snack.id,
            "quantity": result.remaining_quantity,
            "status": result.snack.status.value,
            "action": "consume",
            "amount": result.consumed_amount,
            "user_name": current_user.name,
            "snack_name": result.snack.name,
        },
    )
    return result


@router.post("/{snack_id}/restock", response_model=RestockResponse)
def restock_snack(
    snack_id: int,
    payload: SnackRestockRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> RestockResponse:
    """Atomically restock snack inventory and log activity (admin only)."""
    result = snack_service.restock_snack(db, snack_id, payload.amount, admin_user)
    ws_manager.broadcast_from_sync(
        "stock_updated",
        {
            "snack_id": result.snack.id,
            "quantity": result.new_quantity,
            "status": result.snack.status.value,
            "action": "restock",
            "amount": result.restocked_amount,
            "user_name": admin_user.name,
            "snack_name": result.snack.name,
        },
    )
    return result


@router.post("/{snack_id}/vote", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
def vote_snack(
    snack_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoteResponse:
    """Cast a vote for a snack (one vote per user per snack)."""
    result = snack_service.vote_snack(db, snack_id, current_user)
    ws_manager.broadcast_from_sync(
        "vote_updated",
        {
            "snack_id": result.snack_id,
            "vote_count": result.vote_count,
            "user_id": current_user.id,
        },
    )
    return result


@router.delete("/{snack_id}/vote", response_model=VoteResponse)
def unvote_snack(
    snack_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoteResponse:
    """Remove the current user's vote from a snack."""
    result = snack_service.unvote_snack(db, snack_id, current_user)
    ws_manager.broadcast_from_sync(
        "vote_updated",
        {
            "snack_id": result.snack_id,
            "vote_count": result.vote_count,
            "user_id": current_user.id,
        },
    )
    return result

