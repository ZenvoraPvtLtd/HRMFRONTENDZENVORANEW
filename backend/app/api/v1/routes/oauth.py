from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Any, Dict, Optional

_BACKEND_ENV = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(_BACKEND_ENV, override=True)

import requests
from bson import ObjectId
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from ....core.config import get_settings
from ....core.errors import ApiException
from ....core.security import sign_access_token, sign_refresh_token
from ....db.database import get_collection, is_mongo_ready


settings = get_settings()
router = APIRouter(prefix="/api/oauth")


def _redirect_to_frontend(frontend_url: str, path: str) -> RedirectResponse:
    return RedirectResponse(url=f"{frontend_url}{path}")


def _frontend_base() -> str:
    return settings.get("FRONTEND_URL") or "http://localhost:3000"


def _require_oauth_config(provider: str) -> None:
    prefix = provider.upper()
    is_configured = (
        os.getenv(f"{prefix}_CLIENT_ID")
        and os.getenv(f"{prefix}_CLIENT_SECRET")
        and os.getenv(f"{prefix}_CALLBACK_URL")
    )
    if not is_configured:
        raise ApiException(
            status_code=503,
            payload={"success": False, "message": f"{provider} OAuth is not configured on this server"},
        )


def _decode_jwt_unverified(token: str) -> Dict[str, Any]:
    # For OIDC id_token: header.payload.signature
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload_b64 = parts[1]
    payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
    raw = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
    return json.loads(raw.decode("utf-8"))


def _find_or_create_oauth_user(
    *,
    name: str,
    email: str,
    provider: str,
    provider_id_field: str,
    provider_id: str,
) -> Dict[str, Any]:
    users = get_collection("users")
    email_lc = email.strip().lower()
    user = users.find_one({"email": email_lc})
    if not user:
        doc: Dict[str, Any] = {
            "name": name,
            "email": email_lc,
            "provider": provider,
            "role": "candidate",
            provider_id_field: provider_id,
        }
        inserted = users.insert_one(doc)
        doc["_id"] = inserted.inserted_id
        return doc
    return user


@router.get("/google")
def google_oauth_start(request: Request, origin: Optional[str] = None):
    _require_oauth_config("google")
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    callback_url = os.getenv("GOOGLE_CALLBACK_URL", "")

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "profile email",
        "access_type": "offline",
        "prompt": "consent",
    }
    if origin:
        params["state"] = origin
    # RedirectResponse expects full URL
    r = requests.Request("GET", auth_url, params=params).prepare()
    return RedirectResponse(url=r.url)


@router.get("/google/callback")
def google_oauth_callback(request: Request):
    _require_oauth_config("google")
    if not is_mongo_ready():
        # Keep behavior consistent with other /api endpoints.
        raise ApiException(
            status_code=503,
            payload={"success": False, "message": "Database is not connected. Please check MONGO_URI/MONGODB_URI and MongoDB network access."},
        )

    state = request.query_params.get("state")
    frontend_url = state if state else _frontend_base()
    code = request.query_params.get("code")
    if not code:
        return _redirect_to_frontend(frontend_url, "/login?error=authentication_failed")

    try:
        token_url = "https://oauth2.googleapis.com/token"
        client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        callback_url = os.getenv("GOOGLE_CALLBACK_URL", "")

        resp = requests.post(
            token_url,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": callback_url,
                "grant_type": "authorization_code",
            },
            timeout=60,
        )
        data = resp.json()

        id_token = data.get("id_token") or ""
        decoded = _decode_jwt_unverified(id_token) if id_token else {}
        email = decoded.get("email") or ""
        name = decoded.get("name") or ""
        google_id = decoded.get("sub") or ""

        if not email:
            return _redirect_to_frontend(frontend_url, "/login?error=oauth_failed")

        user = _find_or_create_oauth_user(
            name=name or email.split("@")[0],
            email=email,
            provider="google",
            provider_id_field="googleId",
            provider_id=google_id,
        )

        access_token = sign_access_token(str(user["_id"]), str(user.get("role", "candidate")))
        refresh_token = sign_refresh_token(str(user["_id"]))

        callback_url = f"/oauth/callback?accessToken={encodeURIComponent(access_token) if False else access_token}&refreshToken={refresh_token}"
        # Build redirect using plain encoding to match Express
        from urllib.parse import quote

        full = f"{frontend_url}/oauth/callback?accessToken={quote(access_token)}&refreshToken={quote(refresh_token)}"
        return RedirectResponse(url=full)
    except Exception:
        return _redirect_to_frontend(frontend_url, "/login?error=oauth_failed")


@router.get("/microsoft")
def microsoft_oauth_start(request: Request):
    _require_oauth_config("microsoft")
    client_id = os.getenv("MICROSOFT_CLIENT_ID", "")
    callback_url = os.getenv("MICROSOFT_CALLBACK_URL", "")

    auth_url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid profile email",
    }
    r = requests.Request("GET", auth_url, params=params).prepare()
    return RedirectResponse(url=r.url)


@router.get("/microsoft/callback")
def microsoft_oauth_callback(request: Request):
    _require_oauth_config("microsoft")
    frontend_url = _frontend_base()
    code = request.query_params.get("code")
    if not code:
        return _redirect_to_frontend(frontend_url, "/login?error=authentication_failed")

    try:
        token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        client_id = os.getenv("MICROSOFT_CLIENT_ID", "")
        client_secret = os.getenv("MICROSOFT_CLIENT_SECRET", "")
        callback_url = os.getenv("MICROSOFT_CALLBACK_URL", "")

        resp = requests.post(
            token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": callback_url,
                "grant_type": "authorization_code",
            },
            timeout=60,
        )
        data = resp.json()

        id_token = data.get("id_token") or ""
        decoded = _decode_jwt_unverified(id_token) if id_token else {}

        email = decoded.get("preferred_username") or decoded.get("email") or ""
        name = decoded.get("name") or email.split("@")[0] if email else ""
        microsoft_id = decoded.get("sub") or ""

        if not email:
            return _redirect_to_frontend(frontend_url, "/login?error=oauth_failed")

        user = _find_or_create_oauth_user(
            name=name or email.split("@")[0],
            email=email,
            provider="microsoft",
            provider_id_field="microsoftId",
            provider_id=microsoft_id,
        )

        access_token = sign_access_token(str(user["_id"]), str(user.get("role", "candidate")))
        refresh_token = sign_refresh_token(str(user["_id"]))

        from urllib.parse import quote

        full = f"{frontend_url}/oauth/callback?accessToken={quote(access_token)}&refreshToken={quote(refresh_token)}"
        return RedirectResponse(url=full)
    except Exception:
        return _redirect_to_frontend(frontend_url, "/login?error=oauth_failed")

