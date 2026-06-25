from __future__ import annotations

import os
import smtplib
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"


def reload_backend_env() -> None:
    """Always load backend/.env so SMTP changes apply without stale cached values."""
    load_dotenv(_BACKEND_ENV, override=True)


def get_smtp_settings() -> dict:
    reload_backend_env()
    user = (os.getenv("SMTP_USER") or os.getenv("EMAIL_USER") or "").strip()
    password = (os.getenv("SMTP_PASS") or os.getenv("EMAIL_PASS") or "").strip().replace(" ", "")
    from_addr = (os.getenv("SMTP_FROM") or user or "noreply@zenvora.com").strip()
    return {
        "enabled": os.getenv("SMTP_ENABLED", "false").strip().lower() == "true",
        "host": (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip(),
        "port": int((os.getenv("SMTP_PORT") or "587").strip()),
        "user": user,
        "password": password,
        "from_addr": from_addr,
    }


def verify_smtp_login() -> tuple[bool, str | None]:
    smtp = get_smtp_settings()
    if not smtp["enabled"]:
        return False, "SMTP_ENABLED is false"
    if not smtp["user"] or not smtp["password"]:
        return False, "SMTP_USER or SMTP_PASS missing"
    try:
        with smtplib.SMTP(smtp["host"], smtp["port"], timeout=20) as server:
            server.starttls()
            server.login(smtp["user"], smtp["password"])
        return True, None
    except Exception as exc:
        return False, str(exc)
