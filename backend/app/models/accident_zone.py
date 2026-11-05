import enum
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    DateTime,
    Enum as SQLEnum,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, GUID, TimestampMixin
from app.models.emergency_service import VerificationStatus


class RoadRiskLevel(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class AccidentZone(Base, TimestampMixin):
    """
    Documented accident-prone roads, intersections, and corridor blackspots in Bangladesh.
    Strictly grounded in reliable published datasets (ARI BUET, BRTA, Highway Police, RSF).
    """
    __tablename__ = "accident_zones"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
    )

    zone_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    zone_name_bn: Mapped[Optional[str]] = mapped_column(
        String(250),
        nullable=True,
    )

    road_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    district: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    division: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    radius_meters: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=600,
    )

    accident_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    observation_period: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )

    data_source: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
    )

    source_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )

    verification_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, name="verificationstatus"),
        nullable=False,
        default=VerificationStatus.VERIFIED,
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="HIGH",
        index=True,
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    description_bn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_accident_zones_coords", "latitude", "longitude"),
        Index("ix_accident_zones_dist_risk", "district", "risk_level"),
    )
