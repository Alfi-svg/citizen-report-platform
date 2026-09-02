import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, Index, DateTime, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class NotificationType(str, enum.Enum):
    REPORT_SUBMITTED = "REPORT_SUBMITTED"
    REPORT_UNDER_REVIEW = "REPORT_UNDER_REVIEW"
    REPORT_APPROVED = "REPORT_APPROVED"
    REPORT_REJECTED = "REPORT_REJECTED"
    REPORT_NEEDS_MORE_INFORMATION = "REPORT_NEEDS_MORE_INFORMATION"
    REPORT_ARCHIVED = "REPORT_ARCHIVED"
    COMMENT_MODERATED = "COMMENT_MODERATED"
    FLAG_REVIEWED = "FLAG_REVIEWED"
    MISSING_PERSON_ALERT = "MISSING_PERSON_ALERT"
    MISSING_PERSON_SIGHTING_REVIEWED = "MISSING_PERSON_SIGHTING_REVIEWED"
    MISSING_PERSON_FOUND = "MISSING_PERSON_FOUND"


class Notification(Base):
    __tablename__ = "notifications"

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
    type: Mapped[NotificationType] = mapped_column(
        SQLEnum(
            NotificationType,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    report_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    comment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notifications",
        lazy="selectin",
    )
    report: Mapped[Optional["Report"]] = relationship(
        "Report",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_read", "user_id", "read_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type='{self.type}', read={self.read_at is not None})>"
