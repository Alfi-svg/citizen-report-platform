import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.guard import (
    TrustedContactCreate,
    TrustedContactUpdate,
    TrustedContactResponse,
    GuardSettingsUpdate,
    GuardSettingsResponse,
    EmergencySessionStartRequest,
    EmergencySessionResponse,
    EmergencyHistoryResponse,
)
from app.services import guard as guard_service

router = APIRouter()


# ==============================================================================
# 1. TRUSTED CONTACTS
# ==============================================================================

@router.get("/contacts", response_model=List[TrustedContactResponse])
async def list_trusted_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List the authenticated user's private trusted contacts (ordered by display order).
    """
    contacts = await guard_service.get_user_contacts(db, current_user.id)
    return contacts


@router.post(
    "/contacts",
    response_model=TrustedContactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_trusted_contact(
    data: TrustedContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a trusted emergency contact (max 5 per user).
    """
    contact = await guard_service.create_trusted_contact(db, current_user.id, data)
    return contact


@router.put("/contacts/{contact_id}", response_model=TrustedContactResponse)
async def update_trusted_contact(
    contact_id: uuid.UUID,
    data: TrustedContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update details for a specific trusted contact (IDOR protected).
    """
    contact = await guard_service.update_trusted_contact(db, current_user.id, contact_id, data)
    return contact


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trusted_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a trusted contact.
    """
    await guard_service.delete_trusted_contact(db, current_user.id, contact_id)
    return None


@router.put("/contacts/reorder", response_model=List[TrustedContactResponse])
async def reorder_trusted_contacts(
    contact_ids: List[uuid.UUID],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reorder trusted contacts for priority alerting.
    """
    contacts = await guard_service.reorder_contacts(db, current_user.id, contact_ids)
    return contacts


# ==============================================================================
# 2. GUARD SETTINGS
# ==============================================================================

@router.get("/settings", response_model=GuardSettingsResponse)
async def get_guard_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve user's Nirapotta Guard preferences.
    """
    return await guard_service.get_or_create_guard_settings(db, current_user.id)


@router.put("/settings", response_model=GuardSettingsResponse)
async def update_guard_settings(
    data: GuardSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update Nirapotta Guard preferences (e.g. share location, custom emergency message).
    """
    return await guard_service.update_guard_settings(db, current_user.id, data)


# ==============================================================================
# 3. EMERGENCY SESSIONS
# ==============================================================================

@router.get("/session/active", response_model=Optional[EmergencySessionResponse])
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get ongoing active emergency session, if one is currently active.
    """
    return await guard_service.get_active_emergency_session(db, current_user.id)


@router.post(
    "/session/start",
    response_model=EmergencySessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_emergency_session(
    data: EmergencySessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dispatch an emergency alert or test alert to trusted contacts.
    """
    return await guard_service.start_emergency_session(db, current_user, data)


@router.post(
    "/session/{session_id}/resolve",
    response_model=EmergencySessionResponse,
)
async def resolve_emergency_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark active emergency as resolved ('I\'m Safe').
    """
    return await guard_service.resolve_emergency_session(db, current_user, session_id)


@router.post(
    "/session/{session_id}/cancel",
    response_model=EmergencySessionResponse,
)
async def cancel_emergency_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel an emergency session.
    """
    return await guard_service.cancel_emergency_session(db, current_user, session_id)


@router.get("/history", response_model=EmergencyHistoryResponse)
async def get_emergency_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Private emergency alert history for the authenticated user.
    """
    items, total = await guard_service.get_emergency_history(
        db, current_user.id, limit=limit, offset=offset
    )
    return EmergencyHistoryResponse(items=items, total=total)
