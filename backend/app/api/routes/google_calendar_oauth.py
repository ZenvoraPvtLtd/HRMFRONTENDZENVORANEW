from __future__ import annotations

import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional
from urllib.parse import urlencode

_BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_BACKEND_ENV, override=True)

import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse

logger = logging.getLogger("google_calendar_oauth")
router = APIRouter(prefix="/api/google", tags=["google"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_CALLBACK_URL = os.getenv(
    "GOOGLE_CALENDAR_CALLBACK_URL",
    "http://localhost:8000/api/google/callback",
).strip()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REFRESH_TOKEN_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    ".google_refresh_token",
)

# The redirect URI must match the one configured in Google Cloud Console.
# For local development, use:
#   http://localhost:8000/api/google/callback
# After a successful first-time authorization, copy the returned refresh token
# into backend/.env as:
#   GOOGLE_REFRESH_TOKEN=your_refresh_token_here


def _ensure_google_credentials() -> tuple[str, str, str]:
    from dotenv import load_dotenv
    load_dotenv(_BACKEND_ENV, override=True)
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    callback_url = os.getenv(
        "GOOGLE_CALENDAR_CALLBACK_URL",
        "http://localhost:8000/api/google/callback",
    ).strip()
    
    if not client_id or not client_secret:
        raise RuntimeError(
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in backend environment."
        )
    return client_id, client_secret, callback_url


@router.get("/status")
async def google_oauth_status():
    """Check if Google Calendar OAuth is configured and working."""
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
    callback_url = os.getenv("GOOGLE_CALENDAR_CALLBACK_URL", "http://localhost:8000/api/google/callback").strip()

    has_credentials = bool(client_id and client_secret)
    has_refresh_token = bool(refresh_token)
    
    if has_credentials and has_refresh_token:
        # Test if we can actually get an access token
        try:
            payload = {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
            response = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=10)
            token_ok = response.status_code == 200
            token_error = None if token_ok else response.json().get("error_description", response.text[:100])
        except Exception as exc:
            token_ok = False
            token_error = str(exc)
    else:
        token_ok = False
        token_error = None

    return {
        "configured": has_credentials,
        "authorized": has_credentials and has_refresh_token and token_ok,
        "has_client_credentials": has_credentials,
        "has_refresh_token": has_refresh_token,
        "token_valid": token_ok,
        "token_error": token_error,
        "callback_url": callback_url,
        "authorize_url": f"http://localhost:8000/api/google/login",
        "next_step": (
            "✅ Google Calendar is ready — Meet links will be auto-generated"
            if has_credentials and has_refresh_token and token_ok
            else "❌ Visit /api/google/login to authorize Google Calendar access"
            if has_credentials and not has_refresh_token
            else "❌ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env"
        ),
    }


@router.get("/login")
async def google_login():
    """Redirect user to the Google OAuth consent screen for Calendar access."""
    try:
        client_id, client_secret, callback_url = _ensure_google_credentials()

        params = {
            "client_id": client_id,
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar",
            "access_type": "offline",
            "prompt": "consent",
        }
        url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
        return RedirectResponse(url=url)
    except Exception as exc:
        logger.exception("Failed to create Google login redirect URL.")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/callback")
async def google_callback(code: Optional[str] = Query(None)):
    """Exchange authorization code for tokens and return the refresh_token."""
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    try:
        client_id, client_secret, callback_url = _ensure_google_credentials()

        payload = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        }
        response = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=30)

        if response.status_code != 200:
            logger.error("Google token exchange failed: %s", response.text)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Google token exchange failed",
                    "details": response.text,
                },
            )

        tokens = response.json()
        refresh_token = tokens.get("refresh_token")

        if refresh_token:
            try:
                with open(REFRESH_TOKEN_FILE, "w", encoding="utf-8") as f:
                    f.write(refresh_token.strip())
                logger.info("Saved Google refresh token to %s", REFRESH_TOKEN_FILE)
            except Exception as exc:
                logger.exception("Failed to save Google refresh token to file.")

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "refresh_token": refresh_token,
                "message": "Copy the returned refresh_token into backend/.env as GOOGLE_REFRESH_TOKEN=...",
                "token_data": tokens,
                "saved_file": REFRESH_TOKEN_FILE if refresh_token else None,
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error in Google callback.")
        raise HTTPException(status_code=500, detail=str(exc))
