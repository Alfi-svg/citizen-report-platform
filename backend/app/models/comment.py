import enum
import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class CommentStatus(str, enum.Enum):
    VISIBLE = "VISIBLE"
    HIDDEN = "HIDDEN"
    REMOVED = "REMOVED"


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

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
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[CommentStatus] = mapped_column(
        SQLEnum(CommentStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=CommentStatus.VISIBLE,
        nullable=False,
        index=True,
    )

    # Relationships with async-safe lazy loading
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="comments",
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="comments",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_comments_report_created", "report_id", "created_at"),
        Index("ix_comments_report_status", "report_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Comment(id={self.id}, report_id={self.report_id}, user_id={self.user_id}, status='{self.status}')>"
