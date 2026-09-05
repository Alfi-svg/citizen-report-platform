import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.device import DevicePlatform


class DeviceRegisterRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=512, description="FCM or push device token")
    platform: DevicePlatform = Field(default=DevicePlatform.ANDROID, description="Device platform")
    device_name: Optional[str] = Field(None, max_length=100, description="Optional device model or name")


class DeviceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    token: str
    platform: DevicePlatform
    device_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
