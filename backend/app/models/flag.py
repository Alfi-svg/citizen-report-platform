import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, Index, Enum as SQLEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class FlagTargetType(str, enum.Enum):
    REPORT = "REPORT"
    COMMENT = "COMMENT"


class FlagStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    DISMISSED = "DISMISSED"
    ACTION_TAKEN = "ACTION_TAKEN"


class ReportFlagReason(str, enum.Enum):
    FALSE_OR_MISLEADING = "FALSE_OR_MISLEADING"
    SPAM = "SPAM"
    DUPLICATE = "DUPLICATE"
    PRIVACY_CONCERN = "PRIVACY_CONCERN"
    HARASSMENT_OR_ABUSE = "HARASSMENT_OR_ABUSE"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    OTHER = "OTHER"


class CommentFlagReason(str, enum.Enum):
    SPAM = "SPAM"
    HARASSMENT_OR_ABUSE = "HARASSMENT_OR_ABUSE"
    HATEFUL_OR_OFFENSIVE = "HATEFUL_OR_OFFENSIVE"
    PERSONAL_INFORMATION = "PERSONAL_INFORMATION"
    THREATENING_CONTENT = "THREATENING_CONTENT"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    OTHER = "OTHER"


class ContentFlag(Base, TimestampMixin):
    __tablename__ = "content_flags"

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
    target_type: Mapped[FlagTargetType] = mapped_column(
        SQLEnum(FlagTargetType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
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
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[FlagStatus] = mapped_column(
        SQLEnum(FlagStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=FlagStatus.PENDING,
        nullable=False,
        index=True,
    )
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
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
    flagger: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy="selectin",
    )
    report: Mapped[Optional["Report"]] = relationship(
        "Report",
        back_populates="flags",
        lazy="selectin",
    )
    comment: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_flags_target_status", "target_type", "status"),
        Index("ix_flags_report_user_reason", "report_id", "user_id", "reason"),
        Index("ix_flags_comment_user_reason", "comment_id", "user_id", "reason"),
    )

    def __repr__(self) -> str:
        return f"<ContentFlag(id={self.id}, target_type='{self.target_type}', reason='{self.reason}', status='{self.status}')>"
