import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Float, Boolean, DateTime, Enum as SQLEnum, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class ServiceType(str, enum.Enum):
    POLICE_STATION = "POLICE_STATION"
    POLICE_BOX = "POLICE_BOX"
    FIRE_SERVICE = "FIRE_SERVICE"
    EMERGENCY_SERVICE = "EMERGENCY_SERVICE"
    OTHER = "OTHER"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    OUTDATED = "OUTDATED"
    INACTIVE = "INACTIVE"
    # Backwards compatibility alias
    PENDING_REVIEW = "PENDING_REVIEW"


class SourceCategory(str, enum.Enum):
    OFFICIAL_GOVERNMENT = "OFFICIAL_GOVERNMENT"
    OFFICIAL_POLICE = "OFFICIAL_POLICE"
    OFFICIAL_FIRE_SERVICE = "OFFICIAL_FIRE_SERVICE"
    OFFICIAL_EMERGENCY_SERVICE = "OFFICIAL_EMERGENCY_SERVICE"
    ADMIN_VERIFIED = "ADMIN_VERIFIED"
    OTHER = "OTHER"


class EmergencyService(Base, TimestampMixin):
    __tablename__ = "emergency_services"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    name_bn: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    service_type: Mapped[ServiceType] = mapped_column(
        SQLEnum(ServiceType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    division: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    district: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    area: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    address_bn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    alternate_phone: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )
    source: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Official Bangladesh Police Directory",
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=VerificationStatus.UNVERIFIED,
        index=True,
    )
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    verified_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    verification_notes_internal: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # Relationships
    verification_audits: Mapped[List["SafetyServiceVerificationAudit"]] = relationship(
        "SafetyServiceVerificationAudit",
        back_populates="service",
        cascade="all, delete-orphan",
        order_by="desc(SafetyServiceVerificationAudit.created_at)",
        lazy="selectin",
    )
    verified_by_admin: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verified_by_admin_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_emergency_services_lat_lng", "latitude", "longitude"),
        Index("ix_emergency_services_type_active", "service_type", "is_active"),
        Index("ix_emergency_services_district_area", "district", "area"),
        Index("ix_emergency_services_status_active", "verification_status", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<EmergencyService(id={self.id}, name='{self.name}', type='{self.service_type}', status='{self.verification_status}')>"


class SafetyServiceVerificationAudit(Base):
    __tablename__ = "safety_service_verification_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("emergency_services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    previous_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    new_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    changed_fields: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="JSON formatted string describing changed attributes",
    )
    verification_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    service: Mapped["EmergencyService"] = relationship(
        "EmergencyService",
        back_populates="verification_audits",
        lazy="selectin",
    )
    admin: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[admin_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_safety_audits_service_created", "service_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<SafetyServiceVerificationAudit(id={self.id}, service_id={self.service_id}, {self.previous_status}->{self.new_status})>"
