from __future__ import annotations

import datetime as dt
import random
import re
import smtplib
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError, field_validator

from ....core.config import get_settings
from ....core.errors import ApiException
from ....core.security import sign_access_token, sign_refresh_token, verify_access_token, verify_refresh_token
from ....db.database import get_collection, is_mongo_ready


settings = get_settings()

router = APIRouter(prefix="/api/auth")


PHONE_RE = re.compile(r"^\d{10}$")
FULL_NAME_RE = re.compile(r"^[A-Za-z]+(?:\\s[A-Za-z]+)*$")
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[\\W_]).+$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _require_db_ready() -> None:
    mongo_uri = settings.get("MONGO_URI") or settings.get("MONGODB_URI")
    if not mongo_uri:
        raise ApiException(
            status_code=503,
            payload={
                "success": False,
                "message": "MONGO_URI is missing. Add it to backend/.env and restart the server.",
            },
        )
    if not is_mongo_ready():
        raise ApiException(
            status_code=503,
            payload={
                "success": False,
                "message": "Database is not connected. Please check MONGO_URI/MONGODB_URI and MongoDB network access.",
            },
        )


def _mongo_db_error() -> ApiException:
    return ApiException(
        status_code=503,
        payload={
            "success": False,
            "message": "Cannot reach MongoDB Atlas. In Atlas → Network Access, allow your IP (or 0.0.0.0/0 for dev), then restart backend.",
        },
    )


def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # Match Express error payload exactly.
        raise ApiException(status_code=401, payload={"message": "No token provided"})
    return auth_header.split(" ", 1)[1].strip()


def get_current_user(request: Request) -> Dict[str, Any]:
    token = _extract_bearer_token(request)
    try:
        decoded = verify_access_token(token)
        return decoded
    except Exception:
        raise ApiException(status_code=401, payload={"message": "Invalid or expired token"})


def authorize_roles(user: Dict[str, Any], *roles: str) -> None:
    if not user or "role" not in user or str(user["role"]) not in roles:
        raise ApiException(status_code=403, payload={"message": "Access denied"})


def _objectid_to_str(value: Any) -> str:
    if isinstance(value, ObjectId):
        return str(value)
    return str(value)


def _sanitize_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc = dict(doc)
    doc.pop("password", None)
    # Convert ObjectId to string for frontend parity.
    if "_id" in doc:
        doc["_id"] = _objectid_to_str(doc["_id"])
    # Node also returns `user._id` and other fields; keep keys as-is.
    return doc


class RegisterBody(BaseModel):
    fullName: str
    email: str
    password: str
    role: str = "employee"
    phoneNumber: str

    @field_validator("fullName")
    @classmethod
    def _v_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Full name must be at least 3 characters")
        if len(v) > 50:
            raise ValueError("Full name must not exceed 50 characters")
        if not FULL_NAME_RE.match(v):
            raise ValueError("Full name should contain only letters")
        return v

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _v_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 20:
            raise ValueError("Password must not exceed 20 characters")
        return v

    @field_validator("phoneNumber")
    @classmethod
    def _v_phone(cls, v: str) -> str:
        v = str(v).strip()
        if not PHONE_RE.match(v):
            raise ValueError("Phone number must be exactly 10 digits")
        return v

    @field_validator("role")
    @classmethod
    def _v_role(cls, v: str) -> str:
        allowed = {"hr", "employee", "candidate"}
        if v not in allowed:
            raise ValueError("Invalid role")
        return v


class LoginBody(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _v_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password is required")
        return v


class ForgotPasswordBody(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v


class ResetPasswordBody(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter valid email")
        return v

    @field_validator("password")
    @classmethod
    def _v_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 20:
            raise ValueError("Password must not exceed 20 characters")
        if not PASSWORD_RE.match(v):
            raise ValueError("Password must contain uppercase, lowercase and special character")
        return v


def _pydantic_validation_to_zod_issues(err: ValidationError) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    for e in err.errors():
        loc = e.get("loc", [])
        field = str(loc[0]) if loc else "body"
        issues.append({"field": field, "message": e.get("msg", "Validation error")})
    return issues


@router.post("/register")
def register(body: Dict[str, Any]):
    _require_db_ready()
    try:
        validated = RegisterBody(**body)
    except ValidationError as e:
        raise ApiException(status_code=400, payload={"success": False, "errors": _pydantic_validation_to_zod_issues(e)})

    full_name = validated.fullName.strip()
    email = str(validated.email).strip().lower()
    # Normalize whitespace to match typical Express behavior (and avoid bcrypt mismatch).
    password = str(validated.password).strip()
    role = str(validated.role)
    phone_number = str(validated.phoneNumber)

    users = get_collection("users")

    existing = users.find_one({"email": email})
    if existing:
        raise ApiException(status_code=400, payload={"success": False, "message": "User already exists with this email"})
        
    if phone_number:
        existing_phone = users.find_one({"phoneNumber": phone_number})
        if existing_phone:
            raise ApiException(status_code=400, payload={"success": False, "message": "User already exists with this phone number"})

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")
    user_doc = {
        "name": full_name,
        "email": email,
        "phoneNumber": phone_number,
        "password": hashed,
        "role": role,
        "provider": "local",
        "resetPasswordOtp": None,
        "resetPasswordOtpExpire": None,
        "isOtpVerified": False,
    }
    inserted = users.insert_one(user_doc)
    user_doc["_id"] = inserted.inserted_id

    access_token = sign_access_token(str(user_doc["_id"]), user_doc["role"])
    refresh_token = sign_refresh_token(str(user_doc["_id"]))

    response = JSONResponse(status_code=201, content={"success": True, "accessToken": access_token, "user": _sanitize_user(user_doc)})
    response.set_cookie(
        "refreshToken",
        refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )
    return response


@router.post("/login")
def login(body: Dict[str, Any], response: Response):
    _require_db_ready()
    try:
        validated = LoginBody(**body)
    except ValidationError as e:
        raise ApiException(status_code=400, payload={"success": False, "errors": _pydantic_validation_to_zod_issues(e)})

    email = str(validated.email).strip().lower()
    password = str(validated.password)

    users = get_collection("users")
    try:
        user = users.find_one({"email": email})
    except Exception:
        raise _mongo_db_error()

    if not user or not user.get("password"):
        raise ApiException(status_code=400, payload={"success": False, "message": "Invalid email or password"})

    try:
        ok = bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8"))
    except Exception:
        ok = False

    if not ok:
        raise ApiException(status_code=400, payload={"success": False, "message": "Invalid email or password"})

    role = str(user.get("role", "employee"))
    user_role = "hr" if role == "admin" else role

    access_token = sign_access_token(str(user["_id"]), user_role)
    refresh_token = sign_refresh_token(str(user["_id"]))

    user_out = _sanitize_user(user)
    user_out["role"] = user_role

    resp = JSONResponse(
        status_code=200,
        content={"success": True, "accessToken": access_token, "user": user_out},
    )
    resp.set_cookie(
        "refreshToken",
        refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )
    return resp


def _require_refresh_cookie(request: Request) -> str:
    token = request.cookies.get("refreshToken")
    if not token:
        raise ApiException(status_code=401, payload={"message": "No refresh token"})
    return token


@router.post("/refresh-token")
def refresh_token(request: Request):
    _require_db_ready()
    token = _require_refresh_cookie(request)
    try:
        decoded = verify_refresh_token(token)
        user_id = str(decoded.get("id"))
    except Exception:
        raise ApiException(status_code=401, payload={"message": "Invalid or expired refresh token"})

    users = get_collection("users")
    user = users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ApiException(status_code=401, payload={"message": "User not found"})

    role = str(user.get("role", "employee"))
    user_role = "hr" if role == "admin" else role
    access_token = sign_access_token(user_id, user_role)
    return {"accessToken": access_token}


@router.get("/me")
def get_me(request: Request):
    _require_db_ready()
    user_decoded = get_current_user(request)
    user_id = str(user_decoded.get("id"))

    users = get_collection("users")
    user = users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ApiException(status_code=404, payload={"success": False, "message": "User not found"})

    user_out = _sanitize_user(user)
    if str(user_out.get("role")) == "admin":
        user_out["role"] = "hr"

    return {"success": True, "user": user_out}


@router.put("/me")
def update_me(request: Request, body: Dict[str, Any]):
    _require_db_ready()
    user_decoded = get_current_user(request)
    user_id = str(user_decoded.get("id"))

    forbidden = {"password", "role", "resetPasswordToken", "resetPasswordExpire"}
    updates = {k: v for k, v in body.items() if k not in forbidden}

    users = get_collection("users")
    result = users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise ApiException(status_code=404, payload={"success": False, "message": "User not found"})

    user = users.find_one({"_id": ObjectId(user_id)})
    user_out = _sanitize_user(user or {})
    if str(user_out.get("role")) == "admin":
        user_out["role"] = "hr"

    return {"success": True, "user": user_out}


@router.get("/admin")
def welcome_admin(request: Request):
    _require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "admin")
    return {"message": "Welcome Admin"}


@router.get("/hr")
def welcome_hr(request: Request):
    _require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "hr")
    return {"message": "Welcome HR"}


@router.get("/employee")
def welcome_employee(request: Request):
    _require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "employee")
    return {"message": "Welcome Employee"}


@router.post("/forgot-password")
def forgot_password(body: Dict[str, Any]):
    _require_db_ready()
    try:
        validated = ForgotPasswordBody(**body)
    except ValidationError as e:
        raise ApiException(status_code=400, payload={"success": False, "errors": _pydantic_validation_to_zod_issues(e)})

    email = str(validated.email).strip().lower()
    users = get_collection("users")
    user = users.find_one({"email": email})
    if not user:
        raise ApiException(status_code=404, payload={"success": False, "message": "User not found"})

    otp = str(random.randint(100000, 999999))
    hashed_otp = bcrypt.hashpw(otp.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")
    expires = dt.datetime.utcnow() + dt.timedelta(minutes=5)

    users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "resetPasswordOtp": hashed_otp,
                "resetPasswordOtpExpire": expires,
                "isOtpVerified": False,
            }
        },
    )

    # Best-effort email sending to preserve existing workflow.
    try:
        smtp_user = settings["EMAIL_USER"]
        smtp_pass = settings["EMAIL_PASS"]
        if not smtp_user or not smtp_pass:
            raise RuntimeError("Email credentials not configured")

        msg = MIMEText(
            f"<h2>Password Reset OTP</h2><h1>{otp}</h1><p>This OTP will expire in 5 minutes.</p>",
            "html",
        )
        msg["Subject"] = "OTP Verification"
        msg["From"] = smtp_user
        msg["To"] = str(user.get("email"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [str(user.get("email"))], msg.as_string())
    except Exception:
        # Match controller behavior: 500 with generic error.
        raise ApiException(status_code=500, payload={"success": False, "message": "Something went wrong"})

    return {"success": True, "message": "OTP sent successfully"}


@router.post("/verify-otp")
def verify_otp(body: Dict[str, Any]):
    _require_db_ready()
    # Node implementation does not use schema validation here; preserve behavior.
    email = str(body.get("email", "")).strip().lower()
    otp = str(body.get("otp", "")).strip()

    users = get_collection("users")
    user = users.find_one({"email": email})
    if not user:
        raise ApiException(status_code=404, payload={"success": False, "message": "User not found"})

    if not user.get("resetPasswordOtp") or not user.get("resetPasswordOtpExpire"):
        raise ApiException(status_code=400, payload={"success": False, "message": "OTP not found"})

    exp = user["resetPasswordOtpExpire"]
    # handle date stored by python/pymongo
    if isinstance(exp, str):
        exp_dt = dt.datetime.fromisoformat(exp)
    else:
        exp_dt = exp

    if exp_dt < dt.datetime.utcnow():
        raise ApiException(status_code=400, payload={"success": False, "message": "OTP expired"})

    try:
        ok = bcrypt.checkpw(otp.encode("utf-8"), str(user["resetPasswordOtp"]).encode("utf-8"))
    except Exception:
        ok = False

    if not ok:
        raise ApiException(status_code=400, payload={"success": False, "message": "Invalid OTP"})

    users.update_one({"_id": user["_id"]}, {"$set": {"isOtpVerified": True}})
    return {"success": True, "message": "OTP verified successfully"}


@router.put("/reset-password")
def reset_password(body: Dict[str, Any]):
    _require_db_ready()
    try:
        validated = ResetPasswordBody(**body)
    except ValidationError as e:
        raise ApiException(status_code=400, payload={"success": False, "errors": _pydantic_validation_to_zod_issues(e)})

    email = str(validated.email).strip().lower()
    password = str(validated.password)

    users = get_collection("users")
    user = users.find_one({"email": email})
    if not user:
        raise ApiException(status_code=404, payload={"success": False, "message": "User not found"})

    if not user.get("isOtpVerified"):
        raise ApiException(status_code=400, payload={"success": False, "message": "OTP verification required"})

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")

    users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hashed,
                "isOtpVerified": False,
                "resetPasswordOtp": None,
                "resetPasswordOtpExpire": None,
            }
        },
    )

    return {"success": True, "message": "Password reset successfully"}


@router.get("/team-users")
def team_users(request: Request):
    _require_db_ready()
    get_current_user(request)
    users = get_collection("users")
    try:
        docs = list(users.find({}, {"name": 1, "email": 1, "role": 1}).sort("name", 1))
    except Exception:
        raise _mongo_db_error()

    data = []
    for doc in docs:
        role = str(doc.get("role", "employee"))
        if role == "admin":
            role = "hr"
        data.append(
            {
                "_id": str(doc["_id"]),
                "name": doc.get("name") or doc.get("email") or "User",
                "email": doc.get("email") or "",
                "role": role,
            }
        )
    return {"success": True, "data": data}

