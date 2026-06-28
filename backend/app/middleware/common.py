from __future__ import annotations

import os
from typing import Any, Dict
from pathlib import Path

from fastapi import Request
from dotenv import load_dotenv

from ..core.errors import ApiException
from ..db.database import is_mongo_ready

# Load the same .env the auth routes use
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_BACKEND_ENV, override=True)

# Use the SAME secret & algorithm the login endpoint uses to sign tokens
_JWT_SECRET = os.getenv("JWT_ACCESS_SECRET") or os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
_JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def require_db_ready() -> None:
    if not is_mongo_ready():
        raise ApiException(
            status_code=503,
            payload={
                "success": False,
                "message": "Database is not connected. Please check MONGO_URI/MONGODB_URI and MongoDB network access.",
            },
        )


def get_current_user(request: Request) -> Dict[str, Any]:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ApiException(status_code=401, payload={"message": "No token provided"})
    token = auth_header.split(" ", 1)[1].strip()
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        # Normalize: auth routes put user id under "sub", some under "id"
        if "sub" in payload and "id" not in payload:
            payload["id"] = payload["sub"]
        if "id" in payload and "role" in payload:
            # Enforce suspension: check current DB status so old tokens cannot bypass it
            try:
                from bson import ObjectId
                from app.core.database import db
                user_id = str(payload.get("id") or payload.get("sub", ""))
                if db is not None and user_id and ObjectId.is_valid(user_id):
                    user = db["users"].find_one({"_id": ObjectId(user_id)}, {"status": 1})
                    if user and str(user.get("status", "")).strip().lower() == "suspended":
                        raise ApiException(
                            status_code=403,
                            payload={"message": "Your Account is Suspended by Admin."},
                        )
            except ApiException:
                raise
            except Exception:
                pass  # DB errors don't revoke valid tokens; suspension check is best-effort
            return payload
        raise ValueError("Token missing required fields")
    except ApiException:
        raise
    except Exception:
        raise ApiException(status_code=401, payload={"message": "Invalid or expired token"})


def authorize_roles(user: Dict[str, Any], *roles: str) -> None:
    user_role = str(user.get("role", ""))
    if not user_role or user_role not in roles:
        raise ApiException(status_code=403, payload={"message": "Access denied"})

