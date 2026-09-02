import uuid
from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Float, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID, TimestampMixin


class IncidentCluster(Base, TimestampMixin):
    __tablename__ = "incident_clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    title_bn: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    summary_bn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    approximate_latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    approximate_longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    area: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    created_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    category: Mapped[Optional["Category"]] = relationship(
        "Category",
        lazy="selectin",
    )
    members: Mapped[List["IncidentClusterMember"]] = relationship(
        "IncidentClusterMember",
        back_populates="cluster",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_clusters_active_created", "is_active", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<IncidentCluster(id={self.id}, title='{self.title}', is_active={self.is_active})>"


class IncidentClusterMember(Base, TimestampMixin):
    __tablename__ = "incident_cluster_members"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("incident_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(
        String(50),
        default="SIMILAR_INCIDENT",
        nullable=False,
    )
    similarity_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    added_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    cluster: Mapped["IncidentCluster"] = relationship(
        "IncidentCluster",
        back_populates="members",
        lazy="selectin",
    )
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="cluster_memberships",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("cluster_id", "report_id", name="uq_cluster_member_report"),
        Index("ix_cluster_members_cluster", "cluster_id"),
        Index("ix_cluster_members_report", "report_id"),
    )

    def __repr__(self) -> str:
        return f"<IncidentClusterMember(cluster_id={self.cluster_id}, report_id={self.report_id}, type='{self.relationship_type}')>"
