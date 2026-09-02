import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, computed_field


class ReportMediaBase(BaseModel):
    file_name: str
    mime_type: str
    file_size: int
    storage_path: str
    caption: Optional[str] = None


class ReportMediaCreate(ReportMediaBase):
    pass


class ReportMediaResponse(ReportMediaBase):
    id: uuid.UUID
    report_id: uuid.UUID
    created_at: datetime

    @computed_field
    @property
    def media_type(self) -> str:
        """Returns normalized category: 'image', 'video', or 'document'."""
        if self.mime_type.startswith("image/"):
            return "image"
        if self.mime_type.startswith("video/"):
            return "video"
        return "document"

    @computed_field
    @property
    def download_url(self) -> str:
        """Authorized endpoint URL for streaming / viewing this evidence file."""
        return f"/api/v1/reports/{self.report_id}/media/{self.id}"

    model_config = ConfigDict(from_attributes=True)
