import os
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode
from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, RedirectResponse
from jose import jwt
from dotenv import load_dotenv
import requests

from app.core.database import users_collection

_BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_BACKEND_ENV, override=True)

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

# ── JWT config ──────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_ACCESS_SECRET") or os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# ── Google OAuth config ──────────────────────────────────────
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo"


def get_google_oauth_settings() -> dict:
    """Load and return Google OAuth settings from .env file at runtime."""
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if not os.path.exists(env_path):
        env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(env_path, override=True)
    return {
        "client_id": (os.getenv("GOOGLE_CLIENT_ID") or "").strip(),
        "client_secret": (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip(),
        "callback_url": (os.getenv("GOOGLE_CALLBACK_URL") or "http://localhost:8000/api/oauth/google/callback").strip(),
    }


# ── Helpers ─────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def build_user_response(user: dict, token: str) -> dict:
    return {
        "accessToken": token,
        "user": {
            "id": str(user["_id"]),
            "_id": str(user["_id"]),
            "name": user.get("fullName", user.get("name", "")),
            "fullName": user.get("fullName", user.get("name", "")),
            "email": user.get("email", ""),
            "role": user.get("role", "user"),
            "phoneNumber": user.get("phoneNumber", ""),
            "googleId": user.get("googleId", ""),
            "createdAt": user.get("createdAt", ""),
        },
    }


# ── Google OAuth Endpoints ──────────────────────────────────
@router.get("/google")
async def google_oauth_redirect(origin: Optional[str] = Query(None)):
    """Redirect to Google OAuth login page"""
    settings = get_google_oauth_settings()
    client_id = settings["client_id"]
    client_secret = settings["client_secret"]
    callback_url = settings["callback_url"]
    
    if not client_id or not client_secret:
        return JSONResponse(
            status_code=500,
            content={"error": "Google OAuth not configured"}
        )
    
    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    if origin:
        params["state"] = origin
    
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_oauth_callback(code: str = Query(...), state: Optional[str] = None):
    """Handle Google OAuth callback"""
    
    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "No authorization code provided"}
        )
    
    settings = get_google_oauth_settings()
    client_id = settings["client_id"]
    client_secret = settings["client_secret"]
    callback_url = settings["callback_url"]
    
    try:
        # Exchange code for tokens
        token_data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        }
        
        token_response = requests.post(GOOGLE_TOKEN_URL, data=token_data)
        token_response.raise_for_status()
        tokens = token_response.json()
        
        # Get user info
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        userinfo_response = requests.get(GOOGLE_USERINFO_URL, headers=headers)
        userinfo_response.raise_for_status()
        userinfo = userinfo_response.json()
        
        # Find or create user
        if users_collection is None:
            return JSONResponse(
                status_code=503,
                content={"error": "Database offline"}
            )
        
        email = userinfo.get("email", "").lower().strip()
        google_id = userinfo.get("id", "")
        
        # Look for existing user by email or googleId
        user = users_collection.find_one({
            "$or": [
                {"email": email},
                {"googleId": google_id}
            ]
        })
        
        if user:
            # Update existing user with Google info
            users_collection.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "googleId": google_id,
                        "name": userinfo.get("name", user.get("name", "")),
                        "fullName": userinfo.get("name", user.get("fullName", "")),
                        "picture": userinfo.get("picture", user.get("picture", "")),
                        "lastLogin": datetime.utcnow().isoformat(),
                    }
                }
            )
            user = users_collection.find_one({"_id": user["_id"]})
        else:
            # Create new user from Google info
            now = datetime.utcnow().isoformat()
            new_user = {
                "googleId": google_id,
                "email": email,
                "fullName": userinfo.get("name", ""),
                "name": userinfo.get("name", ""),
                "picture": userinfo.get("picture", ""),
                "role": "employee",  # Default role for OAuth users
                "phoneNumber": "",
                "createdAt": now,
                "lastLogin": now,
                "oauthProvider": "google",
            }
            result = users_collection.insert_one(new_user)
            new_user["_id"] = result.inserted_id
            user = new_user
        
        # ── Suspended user block (OAuth) ─────────────────────
        status_val = user.get("status")
        if status_val is not None and str(status_val).strip().lower() == "suspended":
            return JSONResponse(
                status_code=403,
                content={"message": "Your account has been suspended. Please contact the administrator."},
            )

        # Normalize role for token consistency
        from app.api.routes.auth import normalize_auth_role
        normalized_role = normalize_auth_role(user.get("role", "employee"))

        # Create JWT token
        token = create_access_token({
            "sub": str(user["_id"]),
            "role": normalized_role,
            "email": email,
        })

        
        # Redirect to frontend with token
        # The frontend can handle the redirect and store the token
        frontend_url = state if state else os.getenv("CLIENT_URL", "http://localhost:5173")
        
        # URL encode the token for safe transmission
        from urllib.parse import quote
        redirect_url = f"{frontend_url}/oauth/callback?accessToken={quote(token)}"
        
        return RedirectResponse(url=redirect_url)
        
    except requests.exceptions.RequestException as e:
        print(f"[OAUTH] Token exchange failed: {e}")
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to exchange authorization code"}
        )
    except Exception as e:
        print(f"[OAUTH] Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
