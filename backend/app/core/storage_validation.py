import os
import re
import uuid
import hashlib
from typing import Tuple
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

# Allowed media formats and MIME classifications
ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg": ("image", [".jpg", ".jpeg"], settings.MAX_IMAGE_SIZE_BYTES),
    "image/png": ("image", [".png"], settings.MAX_IMAGE_SIZE_BYTES),
    "image/webp": ("image", [".webp"], settings.MAX_IMAGE_SIZE_BYTES),
    # Videos
    "video/mp4": ("video", [".mp4"], settings.MAX_VIDEO_SIZE_BYTES),
    "video/webm": ("video", [".webm"], settings.MAX_VIDEO_SIZE_BYTES),
    "video/quicktime": ("video", [".mov"], settings.MAX_VIDEO_SIZE_BYTES),
    # Documents
    "application/pdf": ("document", [".pdf"], settings.MAX_DOCUMENT_SIZE_BYTES),
    "text/plain": ("document", [".txt"], settings.MAX_DOCUMENT_SIZE_BYTES),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        "document",
        [".docx"],
        settings.MAX_DOCUMENT_SIZE_BYTES,
    ),
}

# Dangerous / executable extensions strictly rejected regardless of MIME type
FORBIDDEN_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".zsh", ".js", ".jsx", ".ts", ".tsx",
    ".php", ".py", ".rb", ".pl", ".cgi", ".bin", ".vbs", ".msi", ".jar", ".com",
    ".scr", ".dll", ".so", ".dylib", ".phtml", ".html", ".htm", ".svg"
}

MAGIC_BYTE_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "application/pdf": [b"%PDF-"],
    "video/mp4": [b"\x00\x00\x00", b"ftyp"],
    "video/webm": [b"\x1a\x45\xdf\xa3"],
    "video/quicktime": [b"\x00\x00\x00", b"moov", b"mdat"],
}


def sanitize_filename(filename: str) -> str:
    """Removes path traversals, control characters, and unsafe characters from original filename."""
    base = os.path.basename(filename)
    # Remove null bytes and non-printable characters
    base = re.sub(r"[^\w\s.-]", "_", base)
    return base[:250] or "attachment"


def get_media_type_from_mime(mime_type: str) -> str:
    """Returns 'image', 'video', or 'document' for a given MIME type."""
    if mime_type in ALLOWED_MIME_TYPES:
        return ALLOWED_MIME_TYPES[mime_type][0]
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    return "document"


async def validate_upload_file(file: UploadFile) -> Tuple[bytes, str, str, str]:
    """
    Validates the uploaded file for:
    1. Dangerous extensions
    2. MIME type whitelist
    3. File size limits
    4. Magic byte signature verification
    Returns: (file_bytes, safe_filename, normalized_mime, media_type)
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename.",
        )

    safe_filename = sanitize_filename(file.filename)
    _, ext = os.path.splitext(safe_filename.lower())

    if ext in FORBIDDEN_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security rejection: Executable or script file extension '{ext}' is prohibited.",
        )

    # Read file content safely in memory/chunks
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file cannot be empty (0 bytes).",
        )

    # Detect MIME type (prefer content_type if valid, or infer from extension)
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    
    # Fallback to extension matching if browser sent generic application/octet-stream
    if content_type not in ALLOWED_MIME_TYPES:
        found_mime = None
        for mime, (_, exts, _) in ALLOWED_MIME_TYPES.items():
            if ext in exts:
                found_mime = mime
                break
        if found_mime:
            content_type = found_mime

    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{content_type}'. Allowed types: JPEG, PNG, WebP, MP4, WebM, MOV, PDF, TXT, DOCX.",
        )

    media_type, allowed_exts, max_size = ALLOWED_MIME_TYPES[content_type]

    # Verify extension matches MIME
    if ext and ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' does not match detected MIME type '{content_type}'.",
        )

    # Verify file size limit
    if file_size > max_size:
        max_mb = max_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {max_mb:.0f} MB for {media_type} files.",
        )

    # Verify magic byte signatures where available
    if content_type in MAGIC_BYTE_SIGNATURES:
        signatures = MAGIC_BYTE_SIGNATURES[content_type]
        header = file_bytes[:32]
        if not any(sig in header for sig in signatures):
            # Special check for WebP (RIFF...WEBP)
            if content_type == "image/webp" and b"WEBP" in file_bytes[:16]:
                pass
            # Special check for MP4/MOV ftyp
            elif content_type in ("video/mp4", "video/quicktime") and (b"ftyp" in file_bytes[:32] or b"moov" in file_bytes[:64]):
                pass
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File header signature does not match declared file format.",
                )

    return file_bytes, safe_filename, content_type, media_type


def generate_storage_path(report_id: uuid.UUID, safe_filename: str) -> str:
    """Generates structured cloud storage key: reports/{report_id}/{unique_uuid}{extension}."""
    _, ext = os.path.splitext(safe_filename.lower())
    if not ext:
        ext = ".bin"
    unique_key = uuid.uuid4().hex
    return f"reports/{report_id}/{unique_key}{ext}"


def compute_sha256(file_bytes: bytes) -> str:
    """Computes SHA-256 hash for file integrity."""
    return hashlib.sha256(file_bytes).hexdigest()
