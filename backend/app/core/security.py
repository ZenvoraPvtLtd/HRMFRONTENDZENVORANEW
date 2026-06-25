from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Optional

import jwt

from .config import get_settings


settings = get_settings()


def sign_access_token(user_id: str, role: str) -> str:
    exp_minutes = settings["ACCESS_TOKEN_EXPIRE"]
    # Preserve JS behavior via "expiresIn" strings like "15m".
    # For now, we parse only the common suffixes.
    exp = _parse_expires_in(exp_minutes)
    payload = {"id": user_id, "role": role, "exp": dt.datetime.utcnow() + exp}
    return jwt.encode(payload, settings["JWT_ACCESS_SECRET"], algorithm="HS256")  # type: ignore[arg-type]


def sign_refresh_token(user_id: str) -> str:
    exp_days = settings["REFRESH_TOKEN_EXPIRE"]
    exp = _parse_expires_in(exp_days)
    payload = {"id": user_id, "exp": dt.datetime.utcnow() + exp}
    return jwt.encode(payload, settings["JWT_REFRESH_SECRET"], algorithm="HS256")  # type: ignore[arg-type]


def verify_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(
        token,
        settings["JWT_ACCESS_SECRET"],
        algorithms=["HS256"],
    )  # type: ignore[arg-type]


def verify_refresh_token(token: str) -> Dict[str, Any]:
    return jwt.decode(
        token,
        settings["JWT_REFRESH_SECRET"],
        algorithms=["HS256"],
    )  # type: ignore[arg-type]


def _parse_expires_in(expires_in: Optional[str]) -> dt.timedelta:
    # Accept values like "15m", "7d", etc.
    if not expires_in:
        return dt.timedelta(minutes=15)
    s = expires_in.strip().lower()
    if s.endswith("m"):
        return dt.timedelta(minutes=int(s[:-1]))
    if s.endswith("h"):
        return dt.timedelta(hours=int(s[:-1]))
    if s.endswith("d"):
        return dt.timedelta(days=int(s[:-1]))
    # Fallback: treat as minutes.
    return dt.timedelta(minutes=int(s))

