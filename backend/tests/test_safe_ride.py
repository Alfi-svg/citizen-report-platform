import base64
import time
from datetime import datetime, timezone, timedelta
import cv2
import numpy as np
import pytest
from httpx import AsyncClient

from app.services.helmet_detection import helmet_service


def _create_synthetic_image(mode: str) -> str:
    """Creates a base64 encoded test image for different verification test scenarios."""
    if mode == "blank":
        # Background scene without human or face
        img = np.random.randint(80, 160, (400, 400, 3), dtype=np.uint8)
    elif mode == "dark":
        # Pitch black
        img = np.zeros((400, 400, 3), dtype=np.uint8)
    elif mode == "person_with_helmet":
        img = np.ones((400, 400, 3), dtype=np.uint8) * 230
        # 1. Torso/Shoulders
        cv2.rectangle(img, (100, 220), (300, 390), (40, 40, 180), -1)
        # 2. Face (skin tone)
        cv2.ellipse(img, (200, 150), (45, 55), 0, 0, 360, (120, 160, 210), -1)
        # 3. Helmet Dome (glossy yellow shell covering top of cranium/forehead)
        cv2.ellipse(img, (200, 110), (60, 50), 0, 180, 360, (0, 215, 255), -1)
        cv2.line(img, (140, 112), (260, 112), (20, 20, 20), 4)
    elif mode == "helmet_in_hand":
        img = np.ones((400, 400, 3), dtype=np.uint8) * 230
        # Torso
        cv2.rectangle(img, (100, 220), (300, 390), (40, 40, 180), -1)
        # Face (bare head, no helmet)
        cv2.ellipse(img, (200, 150), (45, 55), 0, 0, 360, (120, 160, 210), -1)
        # Helmet located in lower right quadrant (held in hand)
        cv2.ellipse(img, (340, 310), (40, 38), 0, 0, 360, (0, 215, 255), -1)
    elif mode == "person_without_helmet":
        img = np.ones((400, 400, 3), dtype=np.uint8) * 230
        # Torso and head/face only - no helmet anywhere in frame
        cv2.rectangle(img, (100, 220), (300, 390), (40, 40, 180), -1)
        cv2.ellipse(img, (200, 150), (45, 55), 0, 0, 360, (120, 160, 210), -1)
    elif mode == "solid_white_empty":
        # Blank canvas without any human silhouette or face
        img = np.ones((400, 400, 3), dtype=np.uint8) * 200
    else:
        img = np.ones((400, 400, 3), dtype=np.uint8) * 128

    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")


@pytest.mark.asyncio
async def test_verify_helmet_person_not_detected(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("blank")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PERSON_NOT_DETECTED"
    assert data["is_verified"] is False
    assert data["verification_token"] is None


@pytest.mark.asyncio
async def test_verify_helmet_uncertain_low_light(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("dark")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UNCERTAIN"
    assert data["is_verified"] is False


@pytest.mark.asyncio
async def test_verify_helmet_held_in_hand(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("helmet_in_hand")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HELMET_NOT_WORN"
    assert data["is_verified"] is False
    assert data["verification_token"] is None


@pytest.mark.asyncio
async def test_verify_helmet_worn_success_lifecycle(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("person_with_helmet")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is True
    assert data["status"] == "VERIFIED"
    token = data["verification_token"]
    assert token is not None
    assert len(token) > 20
    assert data["expires_at"] is not None

    # Start Safe Ride with this token
    start_res = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={
            "verification_token": token,
            "destination_text": "Farmgate, Dhaka",
            "start_latitude": 23.75,
            "start_longitude": 90.38
        }
    )
    assert start_res.status_code == 200
    start_data = start_res.json()
    ride_id = start_data["ride_id"]
    assert ride_id.startswith("ride_")
    assert start_data["status"] == "ACTIVE"
    assert start_data["helmet_verified"] is True

    # Token cannot be re-used
    dup_res = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={"verification_token": token}
    )
    assert dup_res.status_code == 400

    # Stop Safe Ride
    stop_res = await async_client.post(
        "/api/v1/safety/safe-ride/stop",
        json={"ride_id": ride_id}
    )
    assert stop_res.status_code == 200
    stop_data = stop_res.json()
    assert stop_data["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_start_safe_ride_blocks_unverified(async_client: AsyncClient):
    res = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={"verification_token": "fake_unverified_token_12345"}
    )
    assert res.status_code == 400
    assert "Invalid or expired" in res.json()["detail"]


@pytest.mark.asyncio
async def test_start_safe_ride_blocks_missing_or_empty_token(async_client: AsyncClient):
    # 1. Empty token string -> 403 Forbidden
    res_empty = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={"verification_token": ""}
    )
    assert res_empty.status_code == 403
    assert "token is required" in res_empty.json()["detail"].lower()

    # 2. Missing field in body -> 422 Unprocessable Entity
    res_missing = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={}
    )
    assert res_missing.status_code in (400, 422)


@pytest.mark.asyncio
async def test_verify_helmet_invalid_base64_payload(async_client: AsyncClient):
    # Malformed base64
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": "not_a_valid_base64_image_data!@#$%^&*()"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is False
    assert data["status"] == "ERROR"
    assert data["verification_token"] is None


@pytest.mark.asyncio
async def test_verification_token_expiration(async_client: AsyncClient):
    # Inject expired token
    expired_token = "test_expired_token_abc"
    helmet_service._verified_tokens[expired_token] = {
        "user_id": None,
        "confidence": 0.95,
        "expires_at": datetime.now(timezone.utc) - timedelta(seconds=10),
        "consumed": False,
    }

    res = await async_client.post(
        "/api/v1/safety/safe-ride/start",
        json={"verification_token": expired_token}
    )
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_verify_helmet_person_detected_without_helmet(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("person_without_helmet")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HELMET_NOT_DETECTED"
    assert data["is_verified"] is False
    assert data["person_detected"] is True
    assert data["helmet_detected"] is False
    assert data["verification_token"] is None


@pytest.mark.asyncio
async def test_verify_helmet_solid_white_empty_frame(async_client: AsyncClient):
    img_b64 = _create_synthetic_image("solid_white_empty")
    res = await async_client.post(
        "/api/v1/safety/safe-ride/verify-helmet",
        json={"image_base64": img_b64}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PERSON_NOT_DETECTED"
    assert data["is_verified"] is False
    assert data["person_detected"] is False
    assert data["verification_token"] is None

