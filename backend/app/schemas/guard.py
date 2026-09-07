import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.guard import EmergencyStatus, DeliveryStatus


class TrustedContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=50)
    relationship: str = Field(default="Other", max_length=50)
    is_confirmed: bool = Field(default=False)
    display_order: int = Field(default=0, ge=0)


class TrustedContactCreate(TrustedContactBase):
    pass


class TrustedContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=50)
    relationship: Optional[str] = Field(None, max_length=50)
    is_confirmed: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)


class TrustedContactResponse(TrustedContactBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GuardSettingsUpdate(BaseModel):
    alerts_enabled: Optional[bool] = None
    share_location: Optional[bool] = None
    custom_message: Optional[str] = Field(None, max_length=500)


class GuardSettingsResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    alerts_enabled: bool
    share_location: bool
    custom_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmergencyAlertRecipientResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    trusted_contact_id: Optional[uuid.UUID] = None
    recipient_name: str
    recipient_phone: str
    delivery_status: DeliveryStatus
    delivery_notes: Optional[str] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmergencySessionStartRequest(BaseModel):
    message: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = Field(None, max_length=255)
    share_location: Optional[bool] = None
    is_test: bool = False


class EmergencySessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: EmergencyStatus
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    location_shared: bool
    is_test: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    recipients: List[EmergencyAlertRecipientResponse] = []

    model_config = ConfigDict(from_attributes=True)


class EmergencyHistoryItem(BaseModel):
    id: uuid.UUID
    status: EmergencyStatus
    message: str
    location_shared: bool
    is_test: bool
    recipient_count: int
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmergencyHistoryResponse(BaseModel):
    items: List[EmergencyHistoryItem]
    total: int
