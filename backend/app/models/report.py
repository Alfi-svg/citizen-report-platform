import enum
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Float, DateTime, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_MORE_INFORMATION = "NEEDS_MORE_INFORMATION"
    ARCHIVED = "ARCHIVED"


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    location_text: Mapped[str] = mapped_column(
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
    incident_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=ReportStatus.DRAFT,
        nullable=False,
        index=True,
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships with selectin loading for async safety
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="reports",
        lazy="selectin",
    )
    category: Mapped["Category"] = relationship(
        "Category",
        back_populates="reports",
        lazy="selectin",
    )
    media: Mapped[List["ReportMedia"]] = relationship(
        "ReportMedia",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_reports_status_created_at", "status", "created_at"),
        Index("ix_reports_category_status", "category_id", "status"),
        Index("ix_reports_user_status", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, title='{self.title[:30]}...', status='{self.status}', anonymous={self.is_anonymous})>"
