import enum
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Float,
    Integer,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class AlertStatus(str, enum.Enum):
    ALERT_PENDING = "ALERT_PENDING"
    ALERT_ACTIVE = "ALERT_ACTIVE"
    FOUND = "FOUND"
    EXPIRED = "EXPIRED"
    CLOSED = "CLOSED"


class SightingStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUEST_MORE_INFO = "REQUEST_MORE_INFO"


class MissingPersonProfile(Base, TimestampMixin):
    __tablename__ = "missing_person_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("reports.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )
    name_bn: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )
    age: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    approximate_age: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    gender: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    photo_url: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True,
    )
    height: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    clothing: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    clothing_bn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    identifying_features: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    identifying_features_bn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    last_seen_location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    last_seen_location_bn: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    last_seen_latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    last_seen_longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    last_seen_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    contact_information: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    reporting_authority: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Relationships
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="missing_person_profile",
        lazy="selectin",
    )


class MissingPersonAlert(Base, TimestampMixin):
    __tablename__ = "missing_person_alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("reports.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    status: Mapped[AlertStatus] = mapped_column(
        SQLEnum(
            AlertStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=AlertStatus.ALERT_PENDING,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    alert_radius_km: Mapped[float] = mapped_column(
        Float,
        default=10.0,
        nullable=False,
    )
    alert_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    activated_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    activation_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    found_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    found_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    found_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="missing_person_alert",
        lazy="selectin",
    )
    activated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[activated_by_admin_id],
        lazy="selectin",
    )
    found_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[found_by_admin_id],
        lazy="selectin",
    )
    sightings: Mapped[List["MissingPersonSighting"]] = relationship(
        "MissingPersonSighting",
        back_populates="alert",
        cascade="all, delete-orphan",
        order_by="MissingPersonSighting.created_at.desc()",
        lazy="selectin",
    )
    deliveries: Mapped[List["AlertNotificationDelivery"]] = relationship(
        "AlertNotificationDelivery",
        back_populates="alert",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_missing_person_alerts_status_active", "status", "is_active"),
    )


class MissingPersonSighting(Base, TimestampMixin):
    __tablename__ = "missing_person_sightings"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("missing_person_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approximate_location: Mapped[str] = mapped_column(
        String(255),
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
    sighting_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sighting_time: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    clothing: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    direction: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    additional_information: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    photo_url: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True,
    )
    status: Mapped[SightingStatus] = mapped_column(
        SQLEnum(
            SightingStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=SightingStatus.PENDING,
        nullable=False,
        index=True,
    )
    reviewed_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    alert: Mapped["MissingPersonAlert"] = relationship(
        "MissingPersonAlert",
        back_populates="sightings",
        lazy="selectin",
    )
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewed_by_admin_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_missing_person_sightings_alert_status", "alert_id", "status"),
    )


class UserNotificationPreference(Base, TimestampMixin):
    __tablename__ = "user_notification_preferences"

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
    missing_person_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    nearby_safety_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    last_known_latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    last_known_longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    last_location_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notification_preference",
        lazy="selectin",
    )


class AlertNotificationDelivery(Base):
    __tablename__ = "alert_notification_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("missing_person_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    delivered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(
        String(50),
        default="IN_APP",
        nullable=False,
    )

    # Relationships
    alert: Mapped["MissingPersonAlert"] = relationship(
        "MissingPersonAlert",
        back_populates="deliveries",
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("alert_id", "user_id", name="uq_alert_user_delivery"),
        Index("ix_alert_deliveries_user_alert", "user_id", "alert_id"),
    )
