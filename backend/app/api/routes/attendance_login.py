from fastapi import (
    APIRouter,
    Form,
    HTTPException
)

import bcrypt

from app.core.jwt_auth import create_access_token

router = APIRouter()

# ============================================================
# DEMO USERS  (hashed with bcrypt, password: "password123")
# ============================================================

def _hash(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12))


# Pre-hashed at startup — these are real bcrypt hashes for "password123"
_DEFAULT_PASSWORD = "password123"
users_db = {
    "admin@zenvora.com": {
        "password_hash": bcrypt.hashpw(_DEFAULT_PASSWORD.encode(), bcrypt.gensalt(12)),
        "role": "admin",
    },
    "hr@zenvora.com": {
        "password_hash": bcrypt.hashpw(_DEFAULT_PASSWORD.encode(), bcrypt.gensalt(12)),
        "role": "hr",
    },
    "employee@zenvora.com": {
        "password_hash": bcrypt.hashpw(_DEFAULT_PASSWORD.encode(), bcrypt.gensalt(12)),
        "role": "employee",
    },
}


def _verify(plain: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed)


# ============================================================
# LOGIN API
# ============================================================

@router.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
):
    user = users_db.get(username)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid Username")

    if not _verify(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid Password")

    token = create_access_token({"sub": username, "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
    }
