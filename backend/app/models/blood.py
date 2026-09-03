import enum
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Enum as SQLEnum, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class BloodUrgency(str, enum.Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"


class BloodRequestStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESPONDED = "RESPONDED"
    FULFILLED = "FULFILLED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class DonorAvailability(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class ResponseStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    COMPLETED = "COMPLETED"


class BloodFlagStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    DISMISSED = "DISMISSED"


class BloodRequest(Base, TimestampMixin):
    __tablename__ = "blood_requests"

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
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    units_required: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    hospital_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    hospital_area: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    district: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    required_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    required_time: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    urgency: Mapped[BloodUrgency] = mapped_column(
        SQLEnum(BloodUrgency, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=BloodUrgency.URGENT,
        nullable=False,
        index=True,
    )
    status: Mapped[BloodRequestStatus] = mapped_column(
        SQLEnum(BloodRequestStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=BloodRequestStatus.OPEN,
        nullable=False,
        index=True,
    )
    contact_name: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    contact_method: Mapped[str] = mapped_column(
        String(50),
        default="PHONE",
        nullable=False,
    )
    additional_information: Mapped[Optional[str]] = mapped_column(
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
    user: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )
    responses: Mapped[List["BloodRequestResponse"]] = relationship(
        "BloodRequestResponse",
        back_populates="request",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BloodRequestResponse.created_at.desc()",
    )
    flags: Mapped[List["BloodRequestFlag"]] = relationship(
        "BloodRequestFlag",
        back_populates="request",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_blood_requests_group_dist_status", "blood_group", "district", "status"),
        Index("ix_blood_requests_status_urgency", "status", "urgency"),
    )

    def __repr__(self) -> str:
        return f"<BloodRequest(id={self.id}, blood_group='{self.blood_group}', district='{self.district}', status='{self.status}')>"


class BloodDonorProfile(Base, TimestampMixin):
    __tablename__ = "blood_donor_profiles"

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
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    district: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    area: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    availability_status: Mapped[DonorAvailability] = mapped_column(
        SQLEnum(DonorAvailability, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=DonorAvailability.AVAILABLE,
        nullable=False,
        index=True,
    )
    last_donation_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    preferred_contact_method: Mapped[str] = mapped_column(
        String(50),
        default="IN_APP",
        nullable=False,
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    additional_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_blood_donors_group_dist_avail", "blood_group", "district", "availability_status"),
    )

    def __repr__(self) -> str:
        return f"<BloodDonorProfile(user_id={self.user_id}, blood_group='{self.blood_group}', avail='{self.availability_status}')>"


class BloodRequestResponse(Base, TimestampMixin):
    __tablename__ = "blood_request_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("blood_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    donor_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    status: Mapped[ResponseStatus] = mapped_column(
        SQLEnum(ResponseStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=ResponseStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Relationships
    request: Mapped["BloodRequest"] = relationship(
        "BloodRequest",
        back_populates="responses",
        lazy="selectin",
    )
    donor: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<BloodRequestResponse(id={self.id}, request_id={self.request_id}, donor_id={self.donor_user_id}, status='{self.status}')>"


class BloodRequestFlag(Base, TimestampMixin):
    __tablename__ = "blood_request_flags"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("blood_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[BloodFlagStatus] = mapped_column(
        SQLEnum(BloodFlagStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=BloodFlagStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Relationships
    request: Mapped["BloodRequest"] = relationship(
        "BloodRequest",
        back_populates="flags",
        lazy="selectin",
    )
    reporter: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<BloodRequestFlag(id={self.id}, request_id={self.request_id}, status='{self.status}')>"
