import enum
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Index, UniqueConstraint, Enum as SQLEnum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID


class ReactionType(str, enum.Enum):
    SUPPORT = "SUPPORT"
    IMPORTANT = "IMPORTANT"


class Reaction(Base):
    __tablename__ = "reactions"

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
    reaction_type: Mapped[ReactionType] = mapped_column(
        SQLEnum(ReactionType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="reactions",
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="reactions",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("report_id", "user_id", "reaction_type", name="uq_report_user_reaction"),
        Index("ix_reactions_report_type", "report_id", "reaction_type"),
    )

    def __repr__(self) -> str:
        return f"<Reaction(id={self.id}, report_id={self.report_id}, user_id={self.user_id}, type='{self.reaction_type}')>"
