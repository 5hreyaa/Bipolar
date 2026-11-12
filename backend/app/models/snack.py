from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SnackCategory(str, Enum):
    SWEET = "sweet"
    SAVOURY = "savoury"
    DRINK = "drink"
    HEALTHY_ISH = "healthy-ish"


class SnackStatus(str, Enum):
    STOCKED = "stocked"
    RUNNING_LOW = "running_low"
    GONE = "gone"


class Snack(Base):
    __tablename__ = "snacks"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_snacks_quantity_non_negative"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_snacks_threshold_non_negative"),
        CheckConstraint("price IS NULL OR price >= 0", name="ck_snacks_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    votes = relationship("Vote", back_populates="snack", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="snack")

    @property
    def status(self) -> str:
        """Calculate snack stock status dynamically from quantity and threshold."""
        if self.quantity <= 0:
            return SnackStatus.GONE.value
        if self.quantity <= self.low_stock_threshold:
            return SnackStatus.RUNNING_LOW.value
        return SnackStatus.STOCKED.value

