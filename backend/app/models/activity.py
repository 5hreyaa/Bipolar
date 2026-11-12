from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ActivityAction(str, Enum):
    CONSUME = "consume"
    RESTOCK = "restock"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    snack_id: Mapped[int | None] = mapped_column(
        ForeignKey("snacks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    snack_name: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    user = relationship("User", back_populates="activities")
    snack = relationship("Snack", back_populates="activities")

