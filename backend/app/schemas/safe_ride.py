from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int
    label: str


class HelmetVerificationRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPEG/PNG camera frame")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HelmetVerificationResponse(BaseModel):
    status: str = Field(
        ...,
        description="VERIFIED | HELMET_NOT_DETECTED | HELMET_NOT_WORN | PERSON_NOT_DETECTED | UNCERTAIN | ERROR"
    )
    is_verified: bool
    person_detected: bool
    helmet_detected: bool
    helmet_worn: bool
    confidence: float = Field(..., ge=0.0, le=1.0)
    message_en: str
    message_bn: str
    verification_token: Optional[str] = None
    expires_at: Optional[str] = None
    bounding_boxes: List[BoundingBox] = []


class StartSafeRideRequest(BaseModel):
    verification_token: str
    destination_text: Optional[str] = None
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None


class StartSafeRideResponse(BaseModel):
    ride_id: str
    status: str
    helmet_verified: bool
    started_at: str
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None
    destination_text: Optional[str] = None


class StopSafeRideRequest(BaseModel):
    ride_id: str
    end_latitude: Optional[float] = None
    end_longitude: Optional[float] = None


class StopSafeRideResponse(BaseModel):
    ride_id: str
    status: str
    duration_seconds: int
    message: str
