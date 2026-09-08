import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.guard import (
    TrustedContact,
    GuardSettings,
    EmergencySession,
    EmergencyAlertRecipient,
    EmergencyStatus,
    DeliveryStatus,
)
from app.models.notification import NotificationType
from app.schemas.guard import (
    TrustedContactCreate,
    TrustedContactUpdate,
    GuardSettingsUpdate,
    EmergencySessionStartRequest,
    EmergencyHistoryItem,
)
from app.services.notification import create_notification


def sanitize_phone_number(phone: str) -> str:
    """
    Strips non-digits except a leading '+'.
    """
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    return cleaned


async def get_user_contacts(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> List[TrustedContact]:
    stmt = (
        select(TrustedContact)
        .where(TrustedContact.user_id == user_id)
        .order_by(TrustedContact.display_order.asc(), TrustedContact.created_at.asc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_trusted_contact(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: TrustedContactCreate,
) -> TrustedContact:
    # 1. Enforce max 5 contacts limit
    count_stmt = (
        select(func.count())
        .select_from(TrustedContact)
        .where(TrustedContact.user_id == user_id)
    )
    count_res = await db.execute(count_stmt)
    total_contacts = count_res.scalar() or 0

    if total_contacts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 5 trusted contacts allowed per user.",
        )

    clean_phone = sanitize_phone_number(data.phone)
    if len(clean_phone) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid phone number format.",
        )

    contact = TrustedContact(
        user_id=user_id,
        name=data.name.strip(),
        phone=clean_phone,
        relationship=data.relationship.strip() if data.relationship else "Other",
        is_confirmed=data.is_confirmed,
        display_order=data.display_order if data.display_order is not None else total_contacts,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def update_trusted_contact(
    db: AsyncSession,
    user_id: uuid.UUID,
    contact_id: uuid.UUID,
    data: TrustedContactUpdate,
) -> TrustedContact:
    stmt = select(TrustedContact).where(
        TrustedContact.id == contact_id,
        TrustedContact.user_id == user_id,
    )
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trusted contact not found.",
        )

    if data.name is not None:
        contact.name = data.name.strip()
    if data.phone is not None:
        clean_phone = sanitize_phone_number(data.phone)
        if len(clean_phone) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid phone number format.",
            )
        contact.phone = clean_phone
    if data.relationship is not None:
        contact.relationship = data.relationship.strip()
    if data.is_confirmed is not None:
        contact.is_confirmed = data.is_confirmed
    if data.display_order is not None:
        contact.display_order = data.display_order

    await db.commit()
    await db.refresh(contact)
    return contact


async def delete_trusted_contact(
    db: AsyncSession,
    user_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> bool:
    stmt = select(TrustedContact).where(
        TrustedContact.id == contact_id,
        TrustedContact.user_id == user_id,
    )
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trusted contact not found.",
        )

    await db.delete(contact)
    await db.commit()
    return True


async def reorder_contacts(
    db: AsyncSession,
    user_id: uuid.UUID,
    contact_ids: List[uuid.UUID],
) -> List[TrustedContact]:
    contacts = await get_user_contacts(db, user_id)
    contact_map = {c.id: c for c in contacts}

    for order, cid in enumerate(contact_ids):
        if cid in contact_map:
            contact_map[cid].display_order = order

    await db.commit()
    return await get_user_contacts(db, user_id)


async def get_or_create_guard_settings(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> GuardSettings:
    stmt = select(GuardSettings).where(GuardSettings.user_id == user_id)
    res = await db.execute(stmt)
    settings_obj = res.scalar_one_or_none()

    if not settings_obj:
        settings_obj = GuardSettings(
            user_id=user_id,
            alerts_enabled=True,
            share_location=False,
            custom_message="I need help. Please contact me as soon as possible.",
        )
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)

    return settings_obj


async def update_guard_settings(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: GuardSettingsUpdate,
) -> GuardSettings:
    settings_obj = await get_or_create_guard_settings(db, user_id)

    if data.alerts_enabled is not None:
        settings_obj.alerts_enabled = data.alerts_enabled
    if data.share_location is not None:
        settings_obj.share_location = data.share_location
    if data.custom_message is not None:
        settings_obj.custom_message = data.custom_message.strip()

    await db.commit()
    await db.refresh(settings_obj)
    return settings_obj


async def get_active_emergency_session(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Optional[EmergencySession]:
    stmt = (
        select(EmergencySession)
        .where(
            EmergencySession.user_id == user_id,
            EmergencySession.status == EmergencyStatus.ACTIVE,
        )
        .order_by(EmergencySession.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().first()


async def start_emergency_session(
    db: AsyncSession,
    user: User,
    data: EmergencySessionStartRequest,
) -> EmergencySession:
    # 1. Anti-abuse: Check if user already has an active emergency session
    existing_active = await get_active_emergency_session(db, user.id)
    if existing_active:
        return existing_active

    # 2. Cooldown check: prevent automated rapid spam (10s minimum between sessions)
    recent_stmt = (
        select(EmergencySession)
        .where(EmergencySession.user_id == user.id)
        .order_by(EmergencySession.created_at.desc())
        .limit(1)
    )
    recent_res = await db.execute(recent_stmt)
    last_session = recent_res.scalar_one_or_none()
    now_utc = datetime.now(timezone.utc)

    if last_session and last_session.created_at:
        # Check delta — normalize to UTC if naive (SQLite / legacy rows)
        last_created = last_session.created_at
        if last_created.tzinfo is None:
            last_created = last_created.replace(tzinfo=timezone.utc)
        delta = (now_utc - last_created).total_seconds()
        if delta < 10.0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a few moments before triggering another emergency alert.",
            )

    # 3. Retrieve settings
    settings_obj = await get_or_create_guard_settings(db, user.id)
    if not settings_obj.alerts_enabled and not data.is_test:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nirapotta Guard emergency alerts are currently disabled in your Guard Settings.",
        )

    # 4. Determine location sharing & privacy approximation (~110m 3-decimal fuzzing)
    should_share_location = (
        data.share_location
        if data.share_location is not None
        else settings_obj.share_location
    )

    fuzzed_lat: Optional[float] = None
    fuzzed_lng: Optional[float] = None
    if should_share_location and data.latitude is not None and data.longitude is not None:
        fuzzed_lat = round(data.latitude, 3)
        fuzzed_lng = round(data.longitude, 3)

    # 5. Resolve message
    default_msg = (
        settings_obj.custom_message
        or "I need help. Please contact me as soon as possible."
    )
    final_message = data.message.strip() if data.message else default_msg
    if data.is_test:
        final_message = f"[TEST ALERT] {final_message}"

    # 6. Create session
    session = EmergencySession(
        user_id=user.id,
        status=EmergencyStatus.ACTIVE,
        message=final_message,
        latitude=fuzzed_lat,
        longitude=fuzzed_lng,
        location_address=data.location_address.strip() if data.location_address else None,
        location_shared=bool(fuzzed_lat is not None and fuzzed_lng is not None),
        is_test=data.is_test,
    )
    db.add(session)
    await db.flush()

    # 7. Fetch user's trusted contacts
    contacts = await get_user_contacts(db, user.id)
    # Prefer confirmed contacts, or fall back to all contacts if none confirmed
    active_contacts = [c for c in contacts if c.is_confirmed] or contacts

    # 8. Create recipient delivery entries and dispatch notifications
    user_display = user.full_name or user.username

    for contact in active_contacts:
        recipient = EmergencyAlertRecipient(
            session_id=session.id,
            trusted_contact_id=contact.id,
            recipient_name=contact.name,
            recipient_phone=contact.phone,
            delivery_status=DeliveryStatus.SENT,
            delivery_notes=None,
        )
        db.add(recipient)
        await db.flush()

        # Check if this contact matches a registered user in Nirapotta
        matched_user = None
        # Try matching by phone in user email / username or if phone is stored
        user_match_stmt = select(User).where(
            User.username == contact.phone,
        )
        match_res = await db.execute(user_match_stmt)
        matched_user = match_res.scalar_one_or_none()

        if matched_user:
            # Deliver real in-app and push notification
            n_type = (
                NotificationType.EMERGENCY_TEST
                if data.is_test
                else NotificationType.EMERGENCY_ALERT
            )
            n_title = (
                f"🧪 [TEST ALERT] From {user_display}"
                if data.is_test
                else f"🚨 EMERGENCY ALERT: {user_display} needs help!"
            )
            loc_text = (
                f" (Approx. Location: {fuzzed_lat}, {fuzzed_lng})"
                if fuzzed_lat and fuzzed_lng
                else ""
            )
            n_msg = f"{final_message}{loc_text}"

            await create_notification(
                db=db,
                user_id=matched_user.id,
                notification_type=n_type,
                title=n_title,
                message=n_msg,
            )
            recipient.delivery_status = DeliveryStatus.DELIVERED
            recipient.delivered_at = datetime.now(timezone.utc)
            recipient.delivery_notes = "Delivered via Nirapotta in-app & push notification"
        else:
            # Phone-only contact without active app account
            recipient.delivery_status = DeliveryStatus.PENDING_SMS_GATEWAY
            recipient.delivery_notes = "Awaiting external SMS gateway dispatch"

    await db.commit()
    await db.refresh(session)
    return session


async def resolve_emergency_session(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
) -> EmergencySession:
    stmt = select(EmergencySession).where(
        EmergencySession.id == session_id,
        EmergencySession.user_id == user.id,
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency session not found.",
        )

    if session.status != EmergencyStatus.RESOLVED:
        session.status = EmergencyStatus.RESOLVED
        session.resolved_at = datetime.now(timezone.utc)

        # Notify recipients that user is safe
        user_display = user.full_name or user.username
        safe_title = f"🟢 I'M SAFE: {user_display} is now safe"
        safe_msg = f"{user_display} has resolved the emergency alert and marked themselves safe."

        for r in session.recipients:
            user_match_stmt = select(User).where(User.username == r.recipient_phone)
            match_res = await db.execute(user_match_stmt)
            matched_user = match_res.scalar_one_or_none()
            if matched_user:
                await create_notification(
                    db=db,
                    user_id=matched_user.id,
                    notification_type=NotificationType.EMERGENCY_SAFE,
                    title=safe_title,
                    message=safe_msg,
                )

        await db.commit()
        await db.refresh(session)

    return session


async def cancel_emergency_session(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
) -> EmergencySession:
    stmt = select(EmergencySession).where(
        EmergencySession.id == session_id,
        EmergencySession.user_id == user.id,
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency session not found.",
        )

    session.status = EmergencyStatus.CANCELLED
    session.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


async def get_emergency_history(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[EmergencyHistoryItem], int]:
    count_stmt = (
        select(func.count())
        .select_from(EmergencySession)
        .where(EmergencySession.user_id == user_id)
    )
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    stmt = (
        select(EmergencySession)
        .where(EmergencySession.user_id == user_id)
        .order_by(EmergencySession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    sessions = list(res.scalars().all())

    items = [
        EmergencyHistoryItem(
            id=s.id,
            status=s.status,
            message=s.message,
            location_shared=s.location_shared,
            is_test=s.is_test,
            recipient_count=len(s.recipients) if s.recipients else 0,
            created_at=s.created_at,
            resolved_at=s.resolved_at,
        )
        for s in sessions
    ]

    return items, total
