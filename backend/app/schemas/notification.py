import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    report_id: Optional[uuid.UUID] = None
    comment_id: Optional[uuid.UUID] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    model_config = ConfigDict(from_attributes=True)


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPagination(BaseModel):
    items: List[NotificationResponse]
    total: int
    limit: int
    offset: int
