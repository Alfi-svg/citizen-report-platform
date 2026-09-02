import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Index, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.user import User


class ModerationAction(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    STARTED_REVIEW = "STARTED_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUESTED_INFORMATION = "REQUESTED_INFORMATION"
    ARCHIVED = "ARCHIVED"


class ModerationRecord(Base, TimestampMixin):
    __tablename__ = "moderation_records"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[ModerationAction] = mapped_column(
        SQLEnum(ModerationAction, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    user_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="User-facing message or explanation visible to the reporter.",
    )
    internal_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Private notes visible strictly to authorized administrators.",
    )

    # Relationships
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="moderation_records",
        lazy="selectin",
    )
    admin: Mapped[Optional["User"]] = relationship(
        "User",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_moderation_records_report_created", "report_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ModerationRecord(id={self.id}, report_id={self.report_id}, action='{self.action}', admin_id={self.admin_id})>"
