import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)
