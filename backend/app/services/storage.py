import os
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional
from app.core.config import settings


class BaseStorageService(ABC):
    """Abstract interface for cloud-compatible object storage providers."""

    @abstractmethod
    async def upload_file(
        self, file_content: bytes, storage_path: str, content_type: str
    ) -> str:
        """Uploads file bytes to storage path and returns the resolved key."""
        pass

    @abstractmethod
    async def delete_file(self, storage_path: str) -> bool:
        """Deletes file from storage."""
        pass

    @abstractmethod
    async def get_file_content(self, storage_path: str) -> Optional[bytes]:
        """Retrieves file bytes from storage."""
        pass

    @abstractmethod
    async def get_file_stream(
        self, storage_path: str, chunk_size: int = 65536
    ) -> AsyncGenerator[bytes, None]:
        """Streams file bytes in chunks."""
        pass


class LocalStorageService(BaseStorageService):
    """
    Local filesystem storage provider for local development, testing, and isolated environments.
    Stores files securely under the configured root directory without exposing path traversal.
    """

    def __init__(self, root_dir: Optional[str] = None):
        self.root_dir = os.path.abspath(root_dir or settings.STORAGE_LOCAL_ROOT)
        os.makedirs(self.root_dir, exist_ok=True)

    def _resolve_path(self, storage_path: str) -> str:
        clean_path = storage_path.lstrip("/\\")
        full_path = os.path.abspath(os.path.join(self.root_dir, clean_path))
        if not full_path.startswith(self.root_dir):
            raise ValueError(f"Security exception: Path traversal attempt detected: {storage_path}")
        return full_path

    def _write_sync(self, full_path: str, file_content: bytes) -> None:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_content)

    def _read_sync(self, full_path: str) -> Optional[bytes]:
        if not os.path.exists(full_path):
            return None
        with open(full_path, "rb") as f:
            return f.read()

    def _delete_sync(self, full_path: str) -> bool:
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                return True
            except Exception:
                return False
        return False

    async def upload_file(
        self, file_content: bytes, storage_path: str, content_type: str
    ) -> str:
        full_path = self._resolve_path(storage_path)
        await asyncio.to_thread(self._write_sync, full_path, file_content)
        return storage_path

    async def delete_file(self, storage_path: str) -> bool:
        try:
            full_path = self._resolve_path(storage_path)
            return await asyncio.to_thread(self._delete_sync, full_path)
        except Exception:
            return False

    async def get_file_content(self, storage_path: str) -> Optional[bytes]:
        full_path = self._resolve_path(storage_path)
        return await asyncio.to_thread(self._read_sync, full_path)

    async def get_file_stream(
        self, storage_path: str, chunk_size: int = 65536
    ) -> AsyncGenerator[bytes, None]:
        content = await self.get_file_content(storage_path)
        if content:
            for i in range(0, len(content), chunk_size):
                yield content[i : i + chunk_size]


class S3StorageService(BaseStorageService):
    """
    Cloudflare R2 / AWS S3 / MinIO compatible object storage provider.
    """

    def __init__(self):
        self.bucket = settings.STORAGE_BUCKET
        self.endpoint_url = settings.STORAGE_ENDPOINT
        self.access_key = settings.STORAGE_ACCESS_KEY
        self.secret_key = settings.STORAGE_SECRET_KEY
        self.region = settings.STORAGE_REGION

    async def upload_file(
        self, file_content: bytes, storage_path: str, content_type: str
    ) -> str:
        if not self.access_key or not self.secret_key:
            return await LocalStorageService().upload_file(file_content, storage_path, content_type)

        try:
            import boto3
            session = boto3.session.Session()
            client = session.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
            client.put_object(
                Bucket=self.bucket,
                Key=storage_path,
                Body=file_content,
                ContentType=content_type,
            )
            return storage_path
        except Exception:
            return await LocalStorageService().upload_file(file_content, storage_path, content_type)

    async def delete_file(self, storage_path: str) -> bool:
        if not self.access_key or not self.secret_key:
            return await LocalStorageService().delete_file(storage_path)
        try:
            import boto3
            session = boto3.session.Session()
            client = session.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
            client.delete_object(Bucket=self.bucket, Key=storage_path)
            return True
        except Exception:
            return False

    async def get_file_content(self, storage_path: str) -> Optional[bytes]:
        if not self.access_key or not self.secret_key:
            return await LocalStorageService().get_file_content(storage_path)
        try:
            import boto3
            session = boto3.session.Session()
            client = session.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
            response = client.get_object(Bucket=self.bucket, Key=storage_path)
            return response["Body"].read()
        except Exception:
            return None

    async def get_file_stream(
        self, storage_path: str, chunk_size: int = 65536
    ) -> AsyncGenerator[bytes, None]:
        content = await self.get_file_content(storage_path)
        if content:
            for i in range(0, len(content), chunk_size):
                yield content[i : i + chunk_size]


def get_storage_service() -> BaseStorageService:
    """Factory dependency returning the active storage backend."""
    if settings.STORAGE_BACKEND.lower() == "s3":
        return S3StorageService()
    return LocalStorageService()
