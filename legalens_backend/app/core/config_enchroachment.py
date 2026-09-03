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
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback_secret_key_do_not_use_in_production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/nyayalens_db")
    
    # Storage
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./app/storage")
    
    # AI Models (future)
    SPACY_MODEL: str = "en_core_web_sm"
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

# Singleton instance
settings = Settings()

# Ensure storage directory exists
os.makedirs(settings.STORAGE_PATH, exist_ok=True)