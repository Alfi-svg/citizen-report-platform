import enum
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Float, Boolean, DateTime, Integer, Enum as SQLEnum, Index, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class EmergencyStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class DeliveryStatus(str, enum.Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    PENDING_SMS_GATEWAY = "PENDING_SMS_GATEWAY"


class TrustedContact(Base, TimestampMixin):
    __tablename__ = "trusted_contacts"

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
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    relationship: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Other",
    )
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationship
    user: Mapped["User"] = sa_relationship(
        "User",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_trusted_contacts_user_order", "user_id", "display_order"),
    )

    def __repr__(self) -> str:
        return f"<TrustedContact(id={self.id}, user_id={self.user_id}, name='{self.name}', phone='{self.phone}')>"


class GuardSettings(Base, TimestampMixin):
    __tablename__ = "guard_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    alerts_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    share_location: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    custom_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationship
    user: Mapped["User"] = sa_relationship(
        "User",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<GuardSettings(user_id={self.user_id}, alerts_enabled={self.alerts_enabled}, share_location={self.share_location})>"


class EmergencySession(Base):
    __tablename__ = "emergency_sessions"

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
    status: Mapped[EmergencyStatus] = mapped_column(
        SQLEnum(
            EmergencyStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=EmergencyStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    location_address: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    location_shared: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_test: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    recipients: Mapped[List["EmergencyAlertRecipient"]] = sa_relationship(
        "EmergencyAlertRecipient",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    user: Mapped["User"] = sa_relationship(
        "User",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_emergency_sessions_user_status", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<EmergencySession(id={self.id}, user_id={self.user_id}, status='{self.status}', is_test={self.is_test})>"


class EmergencyAlertRecipient(Base):
    __tablename__ = "emergency_alert_recipients"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("emergency_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trusted_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("trusted_contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    recipient_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    recipient_phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        SQLEnum(
            DeliveryStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=DeliveryStatus.SENT,
        nullable=False,
    )
    delivery_notes: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationship
    session: Mapped["EmergencySession"] = sa_relationship(
        "EmergencySession",
        back_populates="recipients",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<EmergencyAlertRecipient(id={self.id}, name='{self.recipient_name}', status='{self.delivery_status}')>"
