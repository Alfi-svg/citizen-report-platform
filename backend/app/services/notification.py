import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification, NotificationType
from app.models.report import Report


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    report_id: Optional[uuid.UUID] = None,
    comment_id: Optional[uuid.UUID] = None,
) -> Optional[Notification]:
    """
    Creates an in-app notification for a specific user transactionally.
    """
    if not user_id:
        return None

    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        report_id=report_id,
        comment_id=comment_id,
    )
    db.add(notification)
    return notification


async def notify_report_owner(
    db: AsyncSession,
    report: Report,
    notification_type: NotificationType,
    title: str,
    message: str,
) -> Optional[Notification]:
    """
    Convenience helper to notify the owner of an incident report.
    If report has no owner (e.g. system seed), it safely no-ops.
    """
    if not report.user_id:
        return None

    return await create_notification(
        db=db,
        user_id=report.user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        report_id=report.id,
    )
