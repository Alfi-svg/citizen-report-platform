import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Index,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin
from app.models.emergency_service import VerificationStatus
from app.models.blood import BloodGroup

if TYPE_CHECKING:
    from app.models.user import User


class BloodInventoryStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    UNKNOWN = "UNKNOWN"


class Hospital(Base, TimestampMixin):
    __tablename__ = "hospitals"

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
    blood_bank_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
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
    emergency_phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    alternate_phone: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=VerificationStatus.VERIFIED,
        nullable=False,
        index=True,
    )
    has_blood_bank: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # Relationships
    blood_inventories: Mapped[List["BloodInventory"]] = relationship(
        "BloodInventory",
        back_populates="hospital",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BloodInventory.blood_group",
    )
    inventory_audits: Mapped[List["HospitalInventoryAudit"]] = relationship(
        "HospitalInventoryAudit",
        back_populates="hospital",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="desc(HospitalInventoryAudit.created_at)",
    )

    __table_args__ = (
        Index("ix_hospitals_district_area", "district", "area"),
        Index("ix_hospitals_lat_lng", "latitude", "longitude"),
        Index("ix_hospitals_status_active", "verification_status", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Hospital(id={self.id}, name='{self.name}', district='{self.district}', status='{self.verification_status}')>"


class BloodInventory(Base, TimestampMixin):
    __tablename__ = "blood_inventories"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    available_units: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    availability_status: Mapped[BloodInventoryStatus] = mapped_column(
        SQLEnum(BloodInventoryStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=BloodInventoryStatus.UNKNOWN,
        nullable=False,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship(
        "Hospital",
        back_populates="blood_inventories",
        lazy="selectin",
    )
    updater: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("hospital_id", "blood_group", name="uq_hospital_blood_group"),
        Index("ix_blood_inventories_group_status", "blood_group", "availability_status"),
    )

    def __repr__(self) -> str:
        return f"<BloodInventory(hospital_id={self.hospital_id}, group='{self.blood_group}', units={self.available_units}, status='{self.availability_status}')>"


class HospitalInventoryAudit(Base):
    __tablename__ = "hospital_inventory_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    previous_units: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    new_units: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    previous_status: Mapped[Optional[BloodInventoryStatus]] = mapped_column(
        SQLEnum(BloodInventoryStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    new_status: Mapped[BloodInventoryStatus] = mapped_column(
        SQLEnum(BloodInventoryStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    hospital: Mapped["Hospital"] = relationship(
        "Hospital",
        back_populates="inventory_audits",
        lazy="selectin",
    )
    updater: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<HospitalInventoryAudit(hospital_id={self.hospital_id}, group='{self.blood_group}', {self.previous_units}->{self.new_units})>"
