import math
from typing import Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.activity import Activity, ActivityAction
from app.schemas.activity import ActivityListResponse, ActivityOut


def list_activities(
    db: Session,
    page: int = 1,
    per_page: int = 15,
    snack_id: Optional[int] = None,
    action: Optional[ActivityAction] = None,
) -> ActivityListResponse:
    query = select(Activity).options(joinedload(Activity.user))

    if snack_id is not None:
        query = query.where(Activity.snack_id == snack_id)
    if action is not None:
        query = query.where(Activity.action == action.value)

    count_subq = select(Activity.id)
    if snack_id is not None:
        count_subq = count_subq.where(Activity.snack_id == snack_id)
    if action is not None:
        count_subq = count_subq.where(Activity.action == action.value)

    total = int(db.execute(select(func.count()).select_from(count_subq.subquery())).scalar_one() or 0)

    offset = (page - 1) * per_page
    activities = db.execute(
        query.order_by(desc(Activity.created_at), desc(Activity.id))
        .offset(offset)
        .limit(per_page)
    ).scalars().all()

    items = [
        ActivityOut(
            id=act.id,
            user_id=act.user_id,
            user_name=act.user.name if act.user else "Deleted User",
            user_email=act.user.email if act.user else None,
            snack_id=act.snack_id,
            snack_name=act.snack_name,
            action=act.action,
            amount=act.amount,
            created_at=act.created_at,
        )
        for act in activities
    ]
    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return ActivityListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )

