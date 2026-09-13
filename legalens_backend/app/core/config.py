"""
app/core/config.py
------------------
Loads environment variables and provides a centralized config object.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings loaded from .env"""
    
    # Server
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured.")

    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # n8n service authentication
    N8N_SHARED_SECRET: str = os.getenv(
        "N8N_SHARED_SECRET",
        "",
    )
    if not N8N_SHARED_SECRET:
        raise RuntimeError("N8N_SHARED_SECRET is not configured.")

    # n8n Pipeline webhook — backend triggers entity extraction by
    # POSTing here. Soft-optional (warns, doesn't crash startup) since
    # this is still being wired up; the trigger itself checks it.
    N8N_PIPELINE_WEBHOOK_URL: str = os.getenv("N8N_PIPELINE_WEBHOOK_URL", "")
    if not N8N_PIPELINE_WEBHOOK_URL:
        print("⚠️  N8N_PIPELINE_WEBHOOK_URL is not configured — entity extraction triggers will be skipped.")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")


    # Supabase Storage
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_BUCKET_NAME: str = os.getenv(
        "SUPABASE_BUCKET_NAME",
        "LegalLens_Backend"
    )
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured.")

    if not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")
    
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

# Singleton instance
settings = Settings()
