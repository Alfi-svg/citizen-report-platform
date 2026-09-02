import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, GUID


class ReportMedia(Base):
    __tablename__ = "report_media"

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
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    caption: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    report: Mapped["Report"] = relationship(
        "Report",
        back_populates="media",
    )

    def __repr__(self) -> str:
        return f"<ReportMedia(id={self.id}, report_id={self.report_id}, file_name='{self.file_name}')>"
