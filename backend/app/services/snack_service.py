from datetime import datetime, timezone
import math
from typing import Dict, List, Optional, Tuple

from sqlalchemy import asc, case, desc, func, or_, select, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppException
from app.models.activity import Activity, ActivityAction
from app.models.snack import Snack, SnackCategory, SnackStatus
from app.models.user import User
from app.models.vote import Vote
from app.schemas.snack import (
    ConsumeResponse,
    RestockResponse,
    SnackCreate,
    SnackListResponse,
    SnackOut,
    SnackSummaryResponse,
    SnackUpdate,
    VoteResponse,
)


def _get_vote_stats(db: Session, snack_ids: List[int], user_id: int) -> Tuple[Dict[int, int], set[int]]:
    """Fetch vote counts and current user's voted snack IDs in two bulk queries."""
    if not snack_ids:
        return {}, set()

    counts_rows = db.execute(
        select(Vote.snack_id, func.count(Vote.id))
        .where(Vote.snack_id.in_(snack_ids))
        .group_by(Vote.snack_id)
    ).all()
    vote_counts = {row[0]: int(row[1]) for row in counts_rows}

    user_votes_rows = db.execute(
        select(Vote.snack_id)
        .where(Vote.snack_id.in_(snack_ids), Vote.user_id == user_id)
    ).scalars().all()
    voted_ids = set(user_votes_rows)
    return vote_counts, voted_ids


def _to_snack_out(snack: Snack, vote_count: int, has_voted: bool) -> SnackOut:
    return SnackOut(
        id=snack.id,
        name=snack.name,
        brand=snack.brand,
        category=snack.category,
        quantity=snack.quantity,
        low_stock_threshold=snack.low_stock_threshold,
        image_url=snack.image_url,
        price=float(snack.price) if snack.price is not None else None,
        status=SnackStatus(snack.status),
        vote_count=vote_count,
        has_voted=has_voted,
        created_at=snack.created_at,
        updated_at=snack.updated_at,
    )


def enrich_snacks(db: Session, snacks: List[Snack], user_id: int) -> List[SnackOut]:
    snack_ids = [s.id for s in snacks]
    vote_counts, voted_ids = _get_vote_stats(db, snack_ids, user_id)
    return [
        _to_snack_out(s, vote_counts.get(s.id, 0), s.id in voted_ids)
        for s in snacks
    ]


def list_snacks(
    db: Session,
    user_id: int,
    search: Optional[str] = None,
    category: Optional[SnackCategory] = None,
    status_filter: Optional[SnackStatus] = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    per_page: int = 12,
) -> SnackListResponse:
    vote_subq = (
        select(Vote.snack_id, func.count(Vote.id).label("vote_count"))
        .group_by(Vote.snack_id)
        .subquery()
    )
    vote_count_col = func.coalesce(vote_subq.c.vote_count, 0)

    query = select(Snack, vote_count_col.label("vote_count")).outerjoin(
        vote_subq, Snack.id == vote_subq.c.snack_id
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(Snack.name.ilike(term), Snack.brand.ilike(term))
        )

    if category is not None:
        query = query.where(Snack.category == category.value)

    if status_filter is not None:
        if status_filter == SnackStatus.GONE:
            query = query.where(Snack.quantity == 0)
        elif status_filter == SnackStatus.RUNNING_LOW:
            query = query.where(Snack.quantity >= 1, Snack.quantity <= Snack.low_stock_threshold)
        elif status_filter == SnackStatus.STOCKED:
            query = query.where(Snack.quantity > Snack.low_stock_threshold)

    count_query = select(func.count()).select_from(query.subquery())
    total = int(db.execute(count_query).scalar_one() or 0)

    order_fn = desc if sort_order.lower() == "desc" else asc
    if sort_by == "quantity":
        query = query.order_by(order_fn(Snack.quantity), Snack.name.asc())
    elif sort_by == "votes":
        query = query.order_by(order_fn(vote_count_col), Snack.name.asc())
    elif sort_by == "created_at":
        query = query.order_by(order_fn(Snack.created_at), Snack.id.asc())
    else:
        query = query.order_by(order_fn(Snack.name), Snack.id.asc())

    offset = (page - 1) * per_page
    rows = db.execute(query.offset(offset).limit(per_page)).all()

    snacks = [row[0] for row in rows]
    snack_ids = [s.id for s in snacks]
    _, voted_ids = _get_vote_stats(db, snack_ids, user_id)

    items = [
        _to_snack_out(row[0], int(row[1] or 0), row[0].id in voted_ids)
        for row in rows
    ]
    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return SnackListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


def get_snack_by_id(db: Session, snack_id: int, user_id: int) -> SnackOut:
    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
    if snack is None:
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")
    return enrich_snacks(db, [snack], user_id)[0]


def get_snacks_summary(db: Session, user_id: int) -> SnackSummaryResponse:
    agg = db.execute(
        select(
            func.count(Snack.id),
            func.coalesce(
                func.sum(case((Snack.quantity > Snack.low_stock_threshold, 1), else_=0)), 0
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Snack.quantity >= 1) & (Snack.quantity <= Snack.low_stock_threshold),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((Snack.quantity == 0, 1), else_=0)), 0),
            func.coalesce(func.sum(Snack.quantity), 0),
        )
    ).one()

    total_votes = int(db.execute(select(func.count(Vote.id))).scalar_one() or 0)

    # Deterministic Snack of the Week: highest votes, then alphabetical name, then lowest id
    vote_subq = (
        select(Vote.snack_id, func.count(Vote.id).label("vote_count"))
        .group_by(Vote.snack_id)
        .subquery()
    )
    vote_count_col = func.coalesce(vote_subq.c.vote_count, 0)
    top_row = db.execute(
        select(Snack, vote_count_col.label("vote_count"))
        .outerjoin(vote_subq, Snack.id == vote_subq.c.snack_id)
        .order_by(desc(vote_count_col), asc(Snack.name), asc(Snack.id))
        .limit(1)
    ).first()

    snack_of_the_week: Optional[SnackOut] = None
    if top_row is not None:
        top_snack, top_votes = top_row[0], int(top_row[1] or 0)
        _, voted_ids = _get_vote_stats(db, [top_snack.id], user_id)
        snack_of_the_week = _to_snack_out(top_snack, top_votes, top_snack.id in voted_ids)

    return SnackSummaryResponse(
        total_snacks=int(agg[0] or 0),
        stocked_count=int(agg[1] or 0),
        running_low_count=int(agg[2] or 0),
        gone_count=int(agg[3] or 0),
        total_units=int(agg[4] or 0),
        total_votes=total_votes,
        snack_of_the_week=snack_of_the_week,
    )


def create_snack(db: Session, payload: SnackCreate, admin_user: User) -> SnackOut:
    existing = db.execute(
        select(Snack).where(func.lower(Snack.name) == payload.name.lower())
    ).scalar_one_or_none()
    if existing is not None:
        raise AppException(
            409,
            "SNACK_ALREADY_EXISTS",
            f"A snack named '{existing.name}' already exists.",
        )

    snack = Snack(
        name=payload.name,
        brand=payload.brand,
        category=payload.category.value,
        quantity=payload.quantity,
        low_stock_threshold=payload.low_stock_threshold,
        image_url=payload.image_url,
        price=payload.price,
    )
    db.add(snack)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppException(
            409,
            "SNACK_ALREADY_EXISTS",
            f"A snack named '{payload.name}' already exists.",
        )

    activity = Activity(
        user_id=admin_user.id,
        snack_id=snack.id,
        snack_name=snack.name,
        action=ActivityAction.CREATE.value,
        amount=snack.quantity,
    )
    db.add(activity)
    db.commit()
    db.refresh(snack)
    return _to_snack_out(snack, vote_count=0, has_voted=False)


def update_snack(db: Session, snack_id: int, payload: SnackUpdate, admin_user: User) -> SnackOut:
    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
    if snack is None:
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")

    if payload.name is not None and payload.name.lower() != snack.name.lower():
        conflict = db.execute(
            select(Snack).where(
                func.lower(Snack.name) == payload.name.lower(),
                Snack.id != snack_id,
            )
        ).scalar_one_or_none()
        if conflict is not None:
            raise AppException(
                409,
                "SNACK_ALREADY_EXISTS",
                f"Another snack named '{conflict.name}' already exists.",
            )
        snack.name = payload.name

    if "brand" in payload.model_fields_set:
        snack.brand = payload.brand
    if payload.category is not None:
        snack.category = payload.category.value
    if payload.quantity is not None:
        snack.quantity = payload.quantity
    if payload.low_stock_threshold is not None:
        snack.low_stock_threshold = payload.low_stock_threshold
    if "image_url" in payload.model_fields_set:
        snack.image_url = payload.image_url
    if "price" in payload.model_fields_set:
        snack.price = payload.price

    snack.updated_at = datetime.now(timezone.utc)

    activity = Activity(
        user_id=admin_user.id,
        snack_id=snack.id,
        snack_name=snack.name,
        action=ActivityAction.UPDATE.value,
        amount=snack.quantity,
    )
    db.add(activity)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppException(
            409,
            "SNACK_ALREADY_EXISTS",
            f"Another snack named '{payload.name}' already exists.",
        )

    db.refresh(snack)
    return enrich_snacks(db, [snack], admin_user.id)[0]


def delete_snack(db: Session, snack_id: int, admin_user: User) -> str:
    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
    if snack is None:
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")

    snack_name = snack.name
    snack_qty = snack.quantity

    # Record deletion activity with snack_id=None so audit log survives deletion
    activity = Activity(
        user_id=admin_user.id,
        snack_id=None,
        snack_name=snack_name,
        action=ActivityAction.DELETE.value,
        amount=snack_qty,
    )
    db.add(activity)
    db.delete(snack)
    db.commit()
    return snack_name


def consume_snack(db: Session, snack_id: int, amount: int, user: User) -> ConsumeResponse:
    """Atomically decrement snack stock and record consumption in a single transaction."""
    user_id = user.id
    # End any implicit read-only transaction from auth dependency before starting atomic write
    db.commit()

    now = datetime.now(timezone.utc)
    stmt = (
        update(Snack)
        .where(Snack.id == snack_id, Snack.quantity >= amount)
        .values(
            quantity=Snack.quantity - amount,
            updated_at=now,
        )
        .returning(Snack.quantity, Snack.name)
    )
    result_row = db.execute(stmt).first()

    if result_row is None:
        db.rollback()
        existing = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
        if existing is None:
            raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")
        raise AppException(
            409,
            "INSUFFICIENT_STOCK",
            f"Insufficient stock for '{existing.name}'. Requested {amount}, but only {existing.quantity} available.",
        )

    remaining_qty, snack_name = int(result_row[0]), str(result_row[1])

    activity = Activity(
        user_id=user_id,
        snack_id=snack_id,
        snack_name=snack_name,
        action=ActivityAction.CONSUME.value,
        amount=amount,
    )
    db.add(activity)
    db.commit()

    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one()
    snack_out = enrich_snacks(db, [snack], user_id)[0]
    return ConsumeResponse(
        snack=snack_out,
        consumed_amount=amount,
        remaining_quantity=remaining_qty,
    )


def restock_snack(db: Session, snack_id: int, amount: int, admin_user: User) -> RestockResponse:
    """Atomically increment snack stock and record restock activity in a single transaction."""
    admin_id = admin_user.id
    db.commit()

    now = datetime.now(timezone.utc)
    stmt = (
        update(Snack)
        .where(Snack.id == snack_id)
        .values(
            quantity=Snack.quantity + amount,
            updated_at=now,
        )
        .returning(Snack.quantity, Snack.name)
    )
    result_row = db.execute(stmt).first()

    if result_row is None:
        db.rollback()
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")

    new_qty, snack_name = int(result_row[0]), str(result_row[1])

    activity = Activity(
        user_id=admin_id,
        snack_id=snack_id,
        snack_name=snack_name,
        action=ActivityAction.RESTOCK.value,
        amount=amount,
    )
    db.add(activity)
    db.commit()

    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one()
    snack_out = enrich_snacks(db, [snack], admin_id)[0]
    return RestockResponse(
        snack=snack_out,
        restocked_amount=amount,
        new_quantity=new_qty,
    )


def vote_snack(db: Session, snack_id: int, user: User) -> VoteResponse:
    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
    if snack is None:
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")

    vote = Vote(user_id=user.id, snack_id=snack_id)
    db.add(vote)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppException(
            409,
            "ALREADY_VOTED",
            f"You have already voted for '{snack.name}'.",
        )

    vote_count = int(
        db.execute(select(func.count(Vote.id)).where(Vote.snack_id == snack_id)).scalar_one() or 0
    )
    return VoteResponse(snack_id=snack_id, vote_count=vote_count, has_voted=True)


def unvote_snack(db: Session, snack_id: int, user: User) -> VoteResponse:
    snack = db.execute(select(Snack).where(Snack.id == snack_id)).scalar_one_or_none()
    if snack is None:
        raise AppException(404, "SNACK_NOT_FOUND", f"Snack with id {snack_id} was not found.")

    result = db.execute(
        delete(Vote).where(Vote.user_id == user.id, Vote.snack_id == snack_id)
    )
    if result.rowcount == 0:
        db.rollback()
        raise AppException(
            404,
            "VOTE_NOT_FOUND",
            f"You have not voted for '{snack.name}'.",
        )

    db.commit()
    vote_count = int(
        db.execute(select(func.count(Vote.id)).where(Vote.snack_id == snack_id)).scalar_one() or 0
    )
    return VoteResponse(snack_id=snack_id, vote_count=vote_count, has_voted=False)

