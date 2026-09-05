import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, Index, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class DevicePlatform(str, enum.Enum):
    ANDROID = "ANDROID"
    IOS = "IOS"
    WEB = "WEB"


class UserDevice(Base, TimestampMixin):
    __tablename__ = "user_devices"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        index=True,
        nullable=False,
    )
    platform: Mapped[DevicePlatform] = mapped_column(
        SQLEnum(
            DevicePlatform,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=DevicePlatform.ANDROID,
        nullable=False,
        index=True,
    )
    device_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="devices",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_user_devices_user_active", "user_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<UserDevice(id={self.id}, user_id={self.user_id}, platform='{self.platform}', active={self.is_active})>"
