from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.jwt_auth import SECRET_KEY, ALGORITHM, TokenPayload
from app.core.database import db

security = HTTPBearer()


def _normalize_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip().lower()


def get_user_from_db(user_id: str) -> Optional[dict]:
    if db is None:
        return None
    if not ObjectId.is_valid(user_id):
        return None
    return db["users"].find_one({"_id": ObjectId(user_id)})


async def require_active_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenPayload:
    """Dependency that validates JWT and enforces that user status != Suspended."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
                )

        # Enforce suspension block
        user = get_user_from_db(str(user_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        if _normalize_status(user.get("status")) == "suspended":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended.")

        return TokenPayload(sub=str(user_id), role=payload.get("role"))

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
