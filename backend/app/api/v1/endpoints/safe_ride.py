from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.safe_ride import (
    HelmetVerificationRequest,
    HelmetVerificationResponse,
    StartSafeRideRequest,
    StartSafeRideResponse,
    StopSafeRideRequest,
    StopSafeRideResponse,
)
from app.services.helmet_detection import helmet_service

router = APIRouter()


@router.post(
    "/verify-helmet",
    response_model=HelmetVerificationResponse,
    summary="Verify helmet wearing compliance via OpenCV Computer Vision",
)
async def verify_helmet(payload: HelmetVerificationRequest):
    """
    Analyzes an uploaded video/camera frame to verify that:
    1. A person is present in the frame.
    2. A helmet is detected.
    3. The helmet is properly worn atop the cranial region.
    Returns a cryptographically signed verification token valid for 120 seconds upon success.
    """
    if not payload.image_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_base64 is required"
        )

    res = helmet_service.verify_helmet(payload.image_base64)
    return res


@router.post(
    "/start",
    response_model=StartSafeRideResponse,
    summary="Start a Safe Ride session (Requires valid verified helmet token)",
)
async def start_safe_ride(payload: StartSafeRideRequest):
    """
    Starts an active Safe Ride session.
    Fails with 403 Forbidden if helmet verification token is missing, expired, or invalid.
    """
    if not payload.verification_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Helmet verification token is required to start a Safe Ride."
        )

    try:
        response = helmet_service.start_ride(
            verification_token=payload.verification_token,
            destination_text=payload.destination_text,
            start_lat=payload.start_latitude,
            start_lng=payload.start_longitude,
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/stop",
    response_model=StopSafeRideResponse,
    summary="Stop an active Safe Ride session",
)
async def stop_safe_ride(payload: StopSafeRideRequest):
    """Stops an active safe ride session and releases resources."""
    if not payload.ride_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ride_id is required"
        )

    response = helmet_service.stop_ride(
        ride_id=payload.ride_id,
        end_lat=payload.end_latitude,
        end_lng=payload.end_longitude,
    )
    return response


@router.get(
    "/active/{ride_id}",
    summary="Check status of a safe ride",
)
async def get_active_ride(ride_id: str):
    ride = helmet_service.get_active_ride(ride_id)
    if not ride:
        return {"has_active_ride": False, "ride": None}
    return {"has_active_ride": True, "ride": ride}
