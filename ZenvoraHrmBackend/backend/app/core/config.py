from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_BACKEND_ENV, override=False)

BASE_DIR = Path(__file__).resolve().parents[2]
APP_DIR = BASE_DIR / "app"
UPLOAD_DIR = BASE_DIR / "uploads"
LOG_DIR = BASE_DIR / "logs"
AI_DIR = APP_DIR / "ai"
CORE_DIR = APP_DIR / "core"

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://zenvora-hrm.vercel.app",
    "https://zenvora-hrm.onrender.com",
    "https://hrmfrontendzenvoranew-kuhe-nu.vercel.app",
]

# Allow any local/LAN IP so frontend works when the network address changes.
# NOTE: "*" (wildcard) must NOT be used when allow_credentials=True — browsers
# block credentialed requests to wildcard origins (CORS spec). The regex below
# covers all localhost ports AND any private LAN IP (192.168.x.x, 10.x.x.x, etc.)
# so the app still works on any local network without hardcoding the IP.
CORS_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"|([a-z0-9-]+\.)?vercel\.app"
    r")(:\d+)?$"
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.getenv(name)
    if v is None or v == "":
        return default
    return v


@lru_cache(maxsize=1)
def get_settings() -> dict[str, Optional[str]]:
    return {
        "FRONTEND_URL": _env("FRONTEND_URL", "http://localhost:3000"),
        "MONGO_URI": _env("MONGO_URI", _env("MONGODB_URI", None)),
        "DATABASE_NAME": _env("DATABASE_NAME", "Zenvora-HRM"),
        "PORT": _env("PORT", "8000"),
        "JWT_ACCESS_SECRET": _env("JWT_ACCESS_SECRET", _env("JWT_SECRET", None)),
        "JWT_REFRESH_SECRET": _env("JWT_REFRESH_SECRET", _env("JWT_SECRET", None)),
        "ACCESS_TOKEN_EXPIRE": _env("ACCESS_TOKEN_EXPIRE", "15m"),
        "REFRESH_TOKEN_EXPIRE": _env("REFRESH_TOKEN_EXPIRE", "7d"),
        "FASTAPI_BASE_URL": _env("FASTAPI_BASE_URL", "http://localhost:8000"),
        "EMAIL_USER": _env("EMAIL_USER", None),
        "EMAIL_PASS": _env("EMAIL_PASS", None),
        "TWILIO_ACCOUNT_SID": _env("TWILIO_ACCOUNT_SID", None),
        "TWILIO_AUTH_TOKEN": _env("TWILIO_AUTH_TOKEN", None),
        "TWILIO_FROM_NUMBER": _env("TWILIO_FROM_NUMBER", None),
        "ADMIN_EMAIL": _env("ADMIN_EMAIL", None),
        "ADMIN_PASSWORD": _env("ADMIN_PASSWORD", None),
        "ADMIN_NAME": _env("ADMIN_NAME", "Admin"),
        "ADMIN_REMOVE_EMAILS": _env("ADMIN_REMOVE_EMAILS", None),
    }
