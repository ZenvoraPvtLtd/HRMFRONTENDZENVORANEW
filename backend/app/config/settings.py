# app/config/settings.py

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_CALLBACK_URL: Optional[str] = None

    # Accept both FRONTEND_URL and FRONTEND_PORT variations
    FRONTEND_URL: Optional[str] = "http://localhost:5173"

    SECRET_KEY: Optional[str] = "default-secret-key-change-in-production"

    # Accept MONGODB_URL, MONGO_URI, or MONGODB_URI
    MONGODB_URL: Optional[str] = None
    MONGO_URI: Optional[str] = None
    MONGODB_URI: Optional[str] = None

    @property
    def mongo_connection_string(self) -> Optional[str]:
        return self.MONGODB_URL or self.MONGO_URI or self.MONGODB_URI

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
