from supabase import create_client, Client
from storage3.types import FileOptions

from app.core.config import settings


class SupabaseStorage:
    """Handles secure access to LegalLens files in Supabase Storage."""

    def __init__(self):
        if not settings.SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL is not configured")

        if not settings.SUPABASE_SECRET_KEY:
            raise RuntimeError("SUPABASE_SECRET_KEY is not configured")

        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SECRET_KEY,
        )

        self.bucket_name = settings.SUPABASE_BUCKET_NAME

    def upload_file(
        self,
        storage_key: str,
        file_bytes: bytes,
        content_type: str,
    ):
        """Upload a file to Supabase Storage."""

        file_options: FileOptions = {
            "content-type": content_type,
            "upsert": "false",
        }

        response = self.client.storage.from_(
            self.bucket_name
        ).upload(
            storage_key,
            file_bytes,
            file_options,
        )

        return response

    def download_file(self, storage_key: str) -> bytes:
        """Download a file from Supabase Storage."""

        return self.client.storage.from_(
            self.bucket_name
        ).download(storage_key)

    def file_exists(self, storage_key: str) -> bool:
        """Check whether a file exists in Supabase Storage."""

        try:
            self.client.storage.from_(
                self.bucket_name
            ).download(storage_key)

            return True

        except Exception:
            return False