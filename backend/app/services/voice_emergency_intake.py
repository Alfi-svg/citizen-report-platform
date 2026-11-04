"""
Nirapotta AI — Phase E: Voice & Audio Emergency Intake Service

Handles speech-to-text transcript processing for emergency incidents and blood requests.
Ensures zero-audio retention on disk (transient in-memory processing),
preserves human confirmation before report creation, and enforces emergency safety rules.
"""

from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai_features import (
    EmergencyAssistantRequest,
    EmergencyAssistantResponse,
    VoiceEmergencyIntakeRequest,
    VoiceEmergencyIntakeResponse,
)
from app.services.emergency_assistant import process_emergency_assistant_chat


async def process_voice_emergency_intake(
    db: AsyncSession,
    request: VoiceEmergencyIntakeRequest,
) -> VoiceEmergencyIntakeResponse:
    """
    Processes a citizen-reviewed speech transcript into a structured emergency report draft.

    Safety & Privacy Guarantees:
    1. Transient Processing: Audio streams are processed transiently in the client; no audio files
       or raw voice recordings are stored on server disk or database.
    2. Input Validation: Empty or whitespace-only transcripts are rejected with HTTP 400.
    3. Transcript Edit Tracking: Tracks whether the citizen edited the recognized transcript before submission.
    4. Emergency Dispatcher Notice: Explicitly reminds citizens that Nirapotta AI is not an emergency dispatcher;
       for immediate danger, users are instructed to dial National Emergency 999 directly.
    5. Reuses Phase A Emergency Assistant: Ensures 100% consistent incident extraction, category matching,
       blood request parsing, and confirmation token generation.
    """
    clean_transcript = request.transcript.strip() if request.transcript else ""
    if not clean_transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voice transcript cannot be empty. Please speak clearly or enter your report text.",
        )

    # Detect if citizen made manual corrections to the raw transcript
    clean_raw = request.raw_transcript.strip() if request.raw_transcript else None
    was_edited = bool(clean_raw and clean_raw != clean_transcript)

    # Prepare standard EmergencyAssistantRequest to leverage battle-tested Phase A logic
    emg_request = EmergencyAssistantRequest(
        message=clean_transcript,
        history=request.history,
        conversation_id=request.conversation_id,
        current_latitude=request.current_latitude,
        current_longitude=request.current_longitude,
        current_location_text=request.current_location_text,
        lang=request.lang or "en",
    )

    # Process through the core emergency assistant
    emg_resp: EmergencyAssistantResponse = await process_emergency_assistant_chat(
        db=db,
        request=emg_request,
    )

    # Prepare a concise speech synthesis hint for browser TTS read-aloud
    speech_hint_parts = [emg_resp.reply]
    if emg_resp.follow_up_question:
        speech_hint_parts.append(emg_resp.follow_up_question)
    speech_synthesis_hint = " ".join(speech_hint_parts)

    return VoiceEmergencyIntakeResponse(
        reply=emg_resp.reply,
        follow_up_question=emg_resp.follow_up_question,
        missing_fields=emg_resp.missing_fields,
        is_ready_for_review=emg_resp.is_ready_for_review,
        emergency_type=emg_resp.emergency_type,
        extracted_fields=emg_resp.extracted_fields,
        draft_report=emg_resp.draft_report,
        draft_blood_request=emg_resp.draft_blood_request,
        action_plan_summary=emg_resp.action_plan_summary,
        emergency_notice=emg_resp.emergency_notice,
        conversation_id=emg_resp.conversation_id,
        confirmation_token=emg_resp.confirmation_token,
        input_mode="voice",
        transcript=clean_transcript,
        raw_transcript=clean_raw,
        audio_duration_seconds=request.audio_duration_seconds,
        was_edited=was_edited,
        audio_retention_policy="TRANSIENT_PROCESSED_NOT_STORED",
        speech_synthesis_hint=speech_synthesis_hint,
    )
