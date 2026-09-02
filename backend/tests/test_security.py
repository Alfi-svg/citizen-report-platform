import uuid
from datetime import timedelta
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_password_hashing():
    plain = "SuperSecretPassword123!"
    hashed = get_password_hash(plain)

    # Hash must not equal plain password
    assert hashed != plain
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Correct password verifies
    assert verify_password(plain, hashed) is True

    # Incorrect password fails
    assert verify_password("WrongPassword123!", hashed) is False


def test_jwt_token_flow():
    user_id = uuid.uuid4()
    role = "USER"

    token = create_access_token(subject=user_id, role=role)
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["role"] == role
    assert payload["type"] == "access"


def test_jwt_expired_token():
    user_id = uuid.uuid4()
    # Expired token in the past
    token = create_access_token(
        subject=user_id,
        role="USER",
        expires_delta=timedelta(seconds=-10),
    )
    payload = decode_access_token(token)
    assert payload is None


def test_jwt_tampered_token():
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="USER")
    tampered_token = token[:-5] + "XXXXX"
    payload = decode_access_token(tampered_token)
    assert payload is None
