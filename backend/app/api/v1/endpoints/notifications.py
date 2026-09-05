import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.device import UserDevice
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
    NotificationUnreadCountResponse,
    NotificationPagination,
)
from app.schemas.device import DeviceRegisterRequest, DeviceResponse
from app.services.push_notification import (
    register_or_update_device,
    deactivate_device_token,
)

router = APIRouter()


@router.get(
    "",
    response_model=NotificationPagination,
    status_code=status.HTTP_200_OK,
    summary="List paginated in-app notifications for authenticated user",
)
async def list_user_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = [Notification.user_id == current_user.id]
    if unread_only:
        conditions.append(Notification.read_at.is_(None))

    where_clause = and_(*conditions)

    # Count
    count_stmt = select(func.count(Notification.id)).where(where_clause)
    total = await db.scalar(count_stmt) or 0

    # Fetch
    stmt = (
        select(Notification)
        .where(where_clause)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    notifications = result.scalars().all()

    return NotificationPagination(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get unread notifications count for authenticated user",
)
async def get_unread_notification_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    )
    unread_count = await db.scalar(stmt) or 0
    return NotificationUnreadCountResponse(unread_count=unread_count)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a specific notification as read",
)
async def mark_notification_as_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)

    return NotificationResponse.model_validate(notification)


@router.patch(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all unread notifications as read for authenticated user",
)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.execute(stmt)
    await db.commit()

    return {"message": "All notifications marked as read."}


@router.post(
    "/devices",
    response_model=DeviceResponse,
    status_code=status.HTTP_200_OK,
    summary="Register or update device push notification token",
)
async def register_device(
    payload: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    device = await register_or_update_device(
        db=db,
        user_id=current_user.id,
        token=payload.token,
        platform=payload.platform.value if hasattr(payload.platform, "value") else str(payload.platform),
        device_name=payload.device_name,
    )
    return DeviceResponse.model_validate(device)


@router.delete(
    "/devices/{token}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate device push notification token on logout",
)
async def unregister_device(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    success = await deactivate_device_token(
        db=db,
        token=token,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device token not found or already inactive.",
        )
    return {"message": "Device token deactivated successfully."}


@router.get(
    "/devices",
    response_model=list[DeviceResponse],
    status_code=status.HTTP_200_OK,
    summary="List active registered devices for current user",
)
async def list_user_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(UserDevice).where(
        UserDevice.user_id == current_user.id,
        UserDevice.is_active.is_(True),
    ).order_by(UserDevice.created_at.desc())
    result = await db.execute(stmt)
    devices = result.scalars().all()
    return [DeviceResponse.model_validate(d) for d in devices]

