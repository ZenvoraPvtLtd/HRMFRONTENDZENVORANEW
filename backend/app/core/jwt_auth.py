import os
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from bson import ObjectId

load_dotenv()

from app.core.database import users_collection

SECRET_KEY = os.getenv("JWT_ACCESS_SECRET") or os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str
    role: Optional[str] = None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
        )

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        if users_collection is not None:
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account Deleted by Admin.",
                )
            
            user_status = user.get("status")
            if user_status == "Deleted":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account Deleted by Admin.",
                )
            if user_status == "Suspended":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your Account is Suspended by Admin.",
                )

        return TokenPayload(sub=str(user_id), role=payload.get("role"))
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )

def require_roles(allowed_roles: list[str]):
    """Dependency that ensures the user's role is in the allowed_roles list."""
    def role_checker(current_user: TokenPayload = Depends(get_current_user)):
        if not current_user.role or current_user.role.lower() not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for your role",
            )
        return current_user
    return role_checker

def exclude_roles(disallowed_roles: list[str]):
    """Dependency that ensures the user's role is NOT in the disallowed_roles list."""
    def role_checker(current_user: TokenPayload = Depends(get_current_user)):
        if current_user.role and current_user.role.lower() in [r.lower() for r in disallowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for your role",
            )
        return current_user
    return role_checker
