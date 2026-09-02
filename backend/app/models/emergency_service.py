import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Float, Boolean, DateTime, Enum as SQLEnum, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, GUID, TimestampMixin


class ServiceType(str, enum.Enum):
    POLICE_STATION = "POLICE_STATION"
    POLICE_BOX = "POLICE_BOX"
    FIRE_SERVICE = "FIRE_SERVICE"
    EMERGENCY_SERVICE = "EMERGENCY_SERVICE"
    OTHER = "OTHER"


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    PENDING_REVIEW = "PENDING_REVIEW"


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
    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        index=True,
    )
    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
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
        default=VerificationStatus.VERIFIED,
        index=True,
    )
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_emergency_services_lat_lng", "latitude", "longitude"),
        Index("ix_emergency_services_type_active", "service_type", "is_active"),
        Index("ix_emergency_services_district_area", "district", "area"),
    )

    def __repr__(self) -> str:
        return f"<EmergencyService(id={self.id}, name='{self.name}', type='{self.service_type}', district='{self.district}')>"
