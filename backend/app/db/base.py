"""Import all models here for Alembic and metadata auto-detection."""
from app.models.base import Base, GUID, TimestampMixin
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia

__all__ = [
    "Base",
    "GUID",
    "TimestampMixin",
    "User",
    "UserRole",
    "Category",
    "Report",
    "ReportStatus",
    "ReportMedia",
]
