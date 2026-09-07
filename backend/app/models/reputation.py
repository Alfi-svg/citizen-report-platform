import enum
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserReputation(Base, TimestampMixin):
    __tablename__ = "user_reputations"

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
    trust_score: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )
    impact_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    verified_reports_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    missing_person_contributions_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    verified_blood_donations_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    helpful_verifications_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    help_rating_sum: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    help_rating_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        lazy="selectin",
    )
    transactions: Mapped[List["ImpactPointTransaction"]] = relationship(
        "ImpactPointTransaction",
        back_populates="reputation",
        cascade="all, delete-orphan",
        order_by="ImpactPointTransaction.created_at.desc()",
        lazy="selectin",
    )
    trust_history: Mapped[List["TrustScoreHistory"]] = relationship(
        "TrustScoreHistory",
        back_populates="reputation",
        cascade="all, delete-orphan",
        order_by="TrustScoreHistory.created_at.desc()",
        lazy="selectin",
    )

    @property
    def help_rating(self) -> float:
        if self.help_rating_count > 0:
            return round(self.help_rating_sum / self.help_rating_count, 1)
        return 0.0

    @property
    def trust_level(self) -> str:
        score = self.trust_score
        if score <= 20:
            return "Very Low"
        elif score <= 40:
            return "Low"
        elif score <= 60:
            return "Fair"
        elif score <= 80:
            return "Good"
        else:
            return "High"

    @property
    def trust_description(self) -> str:
        level = self.trust_level
        if level == "High":
            return "High reliability based on previous verified contributions."
        elif level == "Good":
            return "Good reliability based on verified community activity."
        elif level == "Fair":
            return "Fair reliability with regular participation history."
        elif level == "Low":
            return "Low reliability based on unverified reports."
        else:
            return "Very low reliability due to disputed submissions."

    @property
    def badge(self) -> str:
        pts = self.impact_points
        if pts >= 1000:
            return "Nirapotta Champion"
        elif pts >= 500:
            return "Community Guardian"
        elif pts >= 200:
            return "Trusted Contributor"
        elif pts >= 50:
            return "Active Helper"
        else:
            return "New Contributor"

    def __repr__(self) -> str:
        return f"<UserReputation(user_id={self.user_id}, trust_score={self.trust_score}, impact_points={self.impact_points})>"


class ImpactPointTransaction(Base):
    __tablename__ = "impact_point_transactions"

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
    reputation_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("user_reputations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    action_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    reference_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    reputation: Mapped["UserReputation"] = relationship(
        "UserReputation",
        back_populates="transactions",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<ImpactPointTransaction(user_id={self.user_id}, points={self.points}, action_type='{self.action_type}')>"


class TrustScoreHistory(Base):
    __tablename__ = "trust_score_history"

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
    reputation_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("user_reputations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    new_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    change: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    reference_type: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    reputation: Mapped["UserReputation"] = relationship(
        "UserReputation",
        back_populates="trust_history",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<TrustScoreHistory(user_id={self.user_id}, change={self.change}, new_score={self.new_score})>"
