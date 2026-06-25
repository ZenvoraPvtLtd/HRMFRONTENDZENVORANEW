import os
import re
import secrets
import smtplib
import socket
import random
import string
from datetime import datetime, timedelta
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import urlparse

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv

_BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_BACKEND_ENV, override=True)

from app.core.database import db, users_collection
from app.core.jwt_auth import get_current_user, TokenPayload
from app.core.smtp import get_smtp_settings

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_ACCESS_SECRET") or os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

FRONTEND_PORT = os.getenv("FRONTEND_PORT", "5173")
FRONTEND_LOGIN_URL = os.getenv("FRONTEND_LOGIN_URL", "").strip()

otp_store = {}


def _smtp_settings() -> dict:
    return get_smtp_settings()


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def send_email_otp(to_email: str, otp: str):
    try:
        smtp = _smtp_settings()
        if not smtp["user"] or not smtp["password"]:
            print(f"[OTP] Email not configured. OTP for {to_email}: {otp}")
            return True

        msg = MIMEMultipart()
        msg["From"] = smtp["from_addr"]
        msg["To"] = to_email
        msg["Subject"] = "Zenvora HR - Password Reset OTP"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
                <p style="color: #666; font-size: 16px;">You requested to reset your password. Use the following OTP code:</p>
                <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">{otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.starttls()
            server.login(smtp["user"], smtp["password"])
            server.send_message(msg)

        return True
    except Exception as e:
        print(f"[OTP] Email send failed: {e}")
        return False


class RegisterRequest(BaseModel):
    fullName: str
    email: str
    phoneNumber: str
    role: str
    password: str = ""
    employeeId: Optional[str] = None
    manager_id: Optional[str] = None
    inviteSource: Optional[str] = None
    loginUrl: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class ResetPasswordRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str
    confirmPassword: str


class InviteRequest(BaseModel):
    email: str
    role: str
    department: Optional[str] = "General"
    accessPermissions: list = []
    inviteSource: Optional[str] = None
    loginUrl: Optional[str] = None


class CompleteRegistrationRequest(BaseModel):
    token: str
    username: str
    fullName: str
    password: str


class ResendInviteRequest(BaseModel):
    email: str


@router.get("/managers")
async def list_managers():
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    managers = list(users_collection.find({"role": "manager"}, {"_id": 1, "fullName": 1, "email": 1}))
    return {"data": [{"id": str(m["_id"]), "name": m.get("fullName", ""), "email": m.get("email", "")} for m in managers]}


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def normalize_auth_role(role: str) -> str:
    cleaned = str(role or "").strip().lower()
    if cleaned in {"admin", "superadmin"}:
        return "admin"
    if cleaned == "hr" or "hr" in cleaned:
        return "hr"
    if cleaned in {"manager", "team manager"}:
        return "manager"
    if cleaned == "candidate":
        return "candidate"
    return "employee"


def _name_code(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", str(name or "")).upper()
    return (cleaned[:4] or "USER")


def _employee_id_prefix(role: str, name: str = "") -> str:
    auth_role = normalize_auth_role(role)
    if auth_role == "hr":
        return f"HR{_name_code(name)}"
    if auth_role == "manager":
        return "MGR"
    if auth_role == "admin":
        return "ADM"
    return "EMP"


def _employee_id_exists(employee_id: str) -> bool:
    if users_collection is not None and users_collection.find_one({"employeeId": employee_id}):
        return True

    if db is not None:
        existing_employee = db["employees_list"].find_one({"employeeId": employee_id})
        if existing_employee:
            return True

    return False


def generate_employee_id(role: str, name: str = "") -> str:
    prefix = _employee_id_prefix(role, name)
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    highest = 0

    if users_collection is not None:
        for user in users_collection.find(
            {"employeeId": {"$regex": f"^{prefix}\\d+$", "$options": "i"}},
            {"employeeId": 1},
        ):
            match = pattern.match(str(user.get("employeeId") or ""))
            if match:
                highest = max(highest, int(match.group(1)))

    if db is not None:
        for employee in db["employees_list"].find(
            {"employeeId": {"$regex": f"^{prefix}\\d+$", "$options": "i"}},
            {"employeeId": 1},
        ):
            match = pattern.match(str(employee.get("employeeId") or ""))
            if match:
                highest = max(highest, int(match.group(1)))

    next_number = highest + 1
    while True:
        employee_id = f"{prefix}{next_number:04d}"
        if not _employee_id_exists(employee_id):
            return employee_id
        next_number += 1


def ensure_user_employee_id(user: dict) -> dict:
    existing_id = str(user.get("employeeId") or user.get("employee_id") or "").strip()
    auth_role = normalize_auth_role(user.get("role", ""))
    if auth_role == "candidate":
        return user

    user_name = user.get("fullName") or user.get("name") or ""
    expected_prefix = _employee_id_prefix(auth_role, user_name)
    should_replace_id = auth_role == "hr" and (
        not existing_id or not re.match(rf"^{re.escape(expected_prefix)}\d+$", existing_id, re.IGNORECASE)
    )

    if existing_id and not should_replace_id:
        if user.get("employeeId") != existing_id:
            user["employeeId"] = existing_id
        return user

    employee_id = generate_employee_id(auth_role, user_name)
    user["employeeId"] = employee_id

    if users_collection is not None and user.get("_id"):
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"employeeId": employee_id}},
        )

    if db is not None:
        employee_filter = {"email": str(user.get("email", "")).lower().strip()}
        if user.get("_id"):
            employee_filter = {
                "$or": [
                    {"userId": str(user["_id"])},
                    {"email": str(user.get("email", "")).lower().strip()},
                ]
            }
        db["employees_list"].update_one(
            employee_filter,
            {"$set": {"employeeId": employee_id}},
        )

    return user


def build_user_response(user: dict, token: str) -> dict:
    user = ensure_user_employee_id(user)
    raw_role = user.get("role", "")
    auth_role = normalize_auth_role(raw_role)
    return {
        "accessToken": token,
        "user": {
            "id": str(user["_id"]),
            "_id": str(user["_id"]),
            "name": user.get("fullName", ""),
            "fullName": user.get("fullName", ""),
            "employeeId": user.get("employeeId") or user.get("employee_id") or "",
            "email": user.get("email", ""),
            "role": auth_role,
            "jobTitle": raw_role,
            "phoneNumber": user.get("phoneNumber", ""),
            "createdAt": user.get("createdAt", ""),
        },
    }


def generate_temporary_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def verify_user_password(plain_password: str, user: dict) -> bool:
    password = str(plain_password or "").strip()
    stored = user.get("password")
    if not password or not stored:
        return False

    try:
        if pwd_context.verify(password, stored):
            return True
    except (ValueError, TypeError):
        pass

    # Legacy plain-text passwords from older records.
    if stored == password:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": pwd_context.hash(password)}},
        )
        return True

    return False


def _is_local_host(hostname: str) -> bool:
    cleaned = (hostname or "").strip().lower()
    return cleaned in {"localhost", "127.0.0.1", "::1", "0.0.0.0"} or cleaned == ""


def _get_lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def _normalize_login_url(url: str) -> str:
    cleaned = url.strip()
    if not cleaned:
        return ""
    if not cleaned.startswith(("http://", "https://")):
        cleaned = f"http://{cleaned}"
    login_path = cleaned if cleaned.endswith("/login") else f"{cleaned.rstrip('/')}/login"
    if "invite=1" not in login_path:
        separator = "&" if "?" in login_path else "?"
        login_path = f"{login_path}{separator}invite=1"
    return login_path


def resolve_invite_login_url(requested: Optional[str] = None) -> str:
    candidate = _normalize_login_url(requested or "")
    if candidate:
        parsed = urlparse(candidate)
        if not _is_local_host(parsed.hostname or ""):
            return candidate

    env_url = _normalize_login_url(FRONTEND_LOGIN_URL)
    if env_url:
        parsed = urlparse(env_url)
        if not _is_local_host(parsed.hostname or ""):
            return env_url

    lan_ip = _get_lan_ip()
    if not _is_local_host(lan_ip):
        return _normalize_login_url(f"http://{lan_ip}:{FRONTEND_PORT}/login")

    return candidate or env_url or _normalize_login_url(f"http://localhost:{FRONTEND_PORT}/login")


def _origin_from_request(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip()
    if origin:
        return origin

    referer = (request.headers.get("referer") or "").strip()
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"

    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    if host:
        hostname = host.split(":")[0]
        if not _is_local_host(hostname):
            return f"http://{host}"

    return ""


def send_invite_email(email: str, password: str, full_name: str, login_url: Optional[str] = None):
    """Send invite email with credentials (sync function for background task)."""
    smtp = _smtp_settings()
    if not smtp["enabled"] or not all([smtp["host"], smtp["user"], smtp["password"]]):
        return False, "SMTP is not configured (check SMTP_ENABLED, SMTP_USER, SMTP_PASS in .env)"

    try:
        subject = "Welcome to Zenvora HR Platform - Your Login Credentials"
        body = f"""Hello {full_name},

Welcome to Zenvora HR Platform!

Your account has been created. Use the credentials below to log in:

Email: {email}
Temporary Password: {password}

Please log in and change your password immediately for security.

Login URL: {login_url or resolve_invite_login_url()}

Best regards,
Zenvora HR Team
"""
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp["from_addr"]
        msg["To"] = email
        msg.attach(MIMEText(body, "plain"))
        
        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.starttls()
            server.login(smtp["user"], smtp["password"])
            server.sendmail(smtp["from_addr"], email, msg.as_string())
        
        print(f"[AUTH] Invite email sent to {email}")
        return True, None
    except Exception as e:
        print(f"[AUTH] Failed to send invite email to {email}: {e}")
        return False, str(e)


def send_registration_invite_email(email: str, invite_token: str, role: str, base_url: Optional[str] = None):
    """Send invite email with registration link for employee to complete their profile."""
    smtp = _smtp_settings()
    if not smtp["enabled"] or not all([smtp["host"], smtp["user"], smtp["password"]]):
        return False, "SMTP is not configured (check SMTP_ENABLED, SMTP_USER, SMTP_PASS in .env)"

    try:
        env_url = os.getenv("FRONTEND_URL") or os.getenv("CLIENT_URL")
        frontend_base = (base_url or env_url or "http://localhost:3000").rstrip("/")
        if ("localhost" in frontend_base or "127.0.0.1" in frontend_base) and env_url:
            frontend_base = env_url.rstrip("/")
            
        # Determine registration link. Use a Google Form for localhost environments to avoid broken localhost URLs.
        if "localhost" in frontend_base or "127.0.0.1" in frontend_base:
            # GOOGLE_FORM_URL can be set in .env; fallback to a placeholder example.
            register_url = os.getenv("GOOGLE_FORM_URL") or "https://forms.gle/example-form"
        else:
            register_url = f"{frontend_base}/register?token={invite_token}"
        role_display = {"admin": "Admin", "manager": "Manager", "hr": "HR", "employee": "Employee"}.get(role.lower(), role)
        
        subject = "You're Invited to Join Zenvora HR Platform"
        plain_body = f"""Welcome to Zenvora HR!\n\nYou've been invited to join as {role_display}.\n\nComplete your registration (username, full name, password) using this link:\n{register_url}\n\nThis invite link expires in 7 days.\n\nIf you did not expect this email, please ignore it.\n\nZenvora HR Team\n"""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style=\"font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;\">
            <div style=\"max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);\">
                <h2 style=\"color: #333; margin-bottom: 20px;\">Welcome to Zenvora HR!</h2>
                <p style=\"color: #666; font-size: 16px; line-height: 1.6;\">
                    You've been invited to join the Zenvora HR Platform as <strong>{role_display}</strong>.
                </p>
                <p style=\"color: #666; font-size: 16px; line-height: 1.6;\">
                    Click the button below to complete your registration by setting up your username, full name, and password.
                </p>
                <div style=\"text-align: center; margin: 30px 0;\">
                    <a href=\"{register_url}\" style=\"display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;\">
                        Complete Registration
                    </a>
                </div>
                <p style=\"color: #999; font-size: 14px;\">
                    If the button doesn't work, copy and paste this link into your browser:<br/>
                    <a href=\"{register_url}\" style=\"color: #3b82f6;\">{register_url}</a>
                </p>
                <hr style=\"border: none; border-top: 1px solid #eee; margin: 30px 0;\"/>
                <p style=\"color: #999; font-size: 12px;\">
                    This invite link expires in 7 days. If you did not expect this email, please ignore it.
                </p>
            </div>
        </body>
        </html>
        """

        role_display = {"admin": "Admin", "manager": "Manager", "hr": "HR", "employee": "Employee"}.get(role.lower(), role)
        
        subject = "You're Invited to Join Zenvora HR Platform"
        plain_body = f"""Welcome to Zenvora HR!

You've been invited to join as {role_display}.

Complete your registration (username, full name, password) using this link:
{register_url}

This invite link expires in 7 days.

If you did not expect this email, please ignore it.

Zenvora HR Team
"""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-bottom: 20px;">Welcome to Zenvora HR!</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    You've been invited to join the Zenvora HR Platform as <strong>{role_display}</strong>.
                </p>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Click the button below to complete your registration by setting up your username, full name, and password.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{register_url}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                        Complete Registration
                    </a>
                </div>
                <p style="color: #999; font-size: 14px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="{register_url}" style="color: #3b82f6;">{register_url}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    This invite link expires in 7 days. If you did not expect this email, please ignore it.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp["from_addr"]
        msg["To"] = email
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.starttls()
            server.login(smtp["user"], smtp["password"])
            server.sendmail(smtp["from_addr"], email, msg.as_string())
        
        print(f"[AUTH] Registration invite email sent to {email}")
        return True, None
    except Exception as e:
        print(f"[AUTH] Failed to send registration invite email to {email}: {e}")
        return False, str(e)


def _resolve_register_base_url(request: Request, login_url: Optional[str] = None) -> str:
    env_url = os.getenv("FRONTEND_URL") or os.getenv("CLIENT_URL")

    if login_url:
        parsed_login = urlparse(login_url.strip())
        if parsed_login.scheme and parsed_login.netloc:
            resolved = f"{parsed_login.scheme}://{parsed_login.netloc}".rstrip("/")
            if ("localhost" in resolved or "127.0.0.1" in resolved) and env_url:
                return env_url.rstrip("/")
            return resolved

    origin = _origin_from_request(request)
    if origin:
        resolved = origin.rstrip("/")
        if ("localhost" in resolved or "127.0.0.1" in resolved) and env_url:
            return env_url.rstrip("/")
        return resolved

    return (env_url or "http://localhost:3000").rstrip("/")


def _build_register_url(base_url: Optional[str], invite_token: str) -> str:
    frontend_base = (base_url or os.getenv("FRONTEND_URL") or os.getenv("CLIENT_URL") or "http://localhost:3000").rstrip("/")
    return f"{frontend_base}/register?token={invite_token}"


def _save_pending_invite(
    email: str,
    role: str,
    department: Optional[str],
    access_permissions: list,
) -> tuple[str, str]:
    """Create or refresh a pending invite. Reuses a valid token so older email links still work."""
    invites_col = db["employee_invites"]
    now = datetime.utcnow()
    normalized_role = normalize_auth_role(role)
    dept = department or "General"
    permissions = access_permissions or []

    existing = invites_col.find_one({"email": email, "status": "pending"})
    if existing:
        expires_at = datetime.fromisoformat(existing["expiresAt"])
        if now <= expires_at:
            invite_token = existing["inviteToken"]
            invites_col.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "role": normalized_role,
                        "department": dept,
                        "accessPermissions": permissions,
                    }
                },
            )
            return invite_token, existing["expiresAt"]

    invite_token = secrets.token_urlsafe(32)
    expires = now + timedelta(days=7)
    invite_doc = {
        "email": email,
        "role": normalized_role,
        "department": dept,
        "accessPermissions": permissions,
        "inviteToken": invite_token,
        "status": "pending",
        "createdAt": now.isoformat(),
        "expiresAt": expires.isoformat(),
    }

    if existing:
        invites_col.update_one({"_id": existing["_id"]}, {"$set": invite_doc})
    else:
        invites_col.insert_one(invite_doc)

    return invite_token, expires.isoformat()


@router.post("/invite")
async def invite_employee(body: InviteRequest, request: Request):
    """HR sends an invite to an employee. Employee receives email to complete registration."""
    if users_collection is None or db is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    email = body.email.lower().strip()
    
    # Check if user already exists
    existing = users_collection.find_one({"email": email})
    if existing:
        return JSONResponse(status_code=409, content={"message": "Email already registered"})

    invite_token, _expires_at = _save_pending_invite(
        email,
        body.role,
        body.department,
        body.accessPermissions or [],
    )
    
    # Also create a placeholder employee record
    emp_col = db["employees_list"]
    existing_emp = emp_col.find_one({"email": email})
    if not existing_emp:
        now = datetime.utcnow()
        emp_doc = {
            "name": "Pending Registration",
            "fullName": "",
            "email": email,
            "department": body.department or "General",
            "role": normalize_auth_role(body.role),
            "employeeId": "",
            "productivity": 0,
            "status": "Pending",
            "phoneNumber": "",
            "joinDate": "",
            "createdAt": now.isoformat(),
            "accessPermissions": body.accessPermissions or [],
        }
        emp_col.insert_one(emp_doc)
    
    base_url = _resolve_register_base_url(request, body.loginUrl)
    register_url = _build_register_url(base_url, invite_token)
    invite_email_sent, email_error = send_registration_invite_email(
        email, invite_token, body.role, base_url
    )
    
    return {
        "success": True,
        "message": "Invite sent successfully" if invite_email_sent else "Invite created, but email could not be sent",
        "inviteEmailSent": invite_email_sent,
        "emailError": email_error,
        "email": email,
        "registerUrl": register_url,
    }


@router.post("/complete-registration")
async def complete_registration(body: CompleteRegistrationRequest):
    """Employee completes their registration after receiving invite."""
    if users_collection is None or db is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    # Find and validate invite
    invites_col = db["employee_invites"]
    invite = invites_col.find_one({"inviteToken": body.token, "status": "pending"})
    
    if not invite:
        return JSONResponse(status_code=400, content={"message": "Invalid or expired invite token"})
    
    # Check expiry
    expires_at = datetime.fromisoformat(invite["expiresAt"])
    if datetime.utcnow() > expires_at:
        invites_col.update_one({"_id": invite["_id"]}, {"$set": {"status": "expired"}})
        return JSONResponse(status_code=400, content={"message": "Invite has expired. Please request a new invite."})
    
    # Check if username is taken
    existing_username = users_collection.find_one({"username": body.username.lower().strip()})
    if existing_username:
        return JSONResponse(status_code=409, content={"message": "Username already taken"})
    
    email = invite["email"]
    role = invite["role"]
    department = invite.get("department", "General")
    access_permissions = invite.get("accessPermissions", [])
    
    # Check if email already registered
    existing_email = users_collection.find_one({"email": email})
    if existing_email:
        return JSONResponse(status_code=409, content={"message": "Email already registered"})
    
    # Create user
    hashed = pwd_context.hash(body.password)
    now = datetime.utcnow().isoformat()
    employee_id = generate_employee_id(role, body.fullName)
    
    new_user = {
        "username": body.username.lower().strip(),
        "fullName": body.fullName.strip(),
        "name": body.fullName.strip(),
        "email": email,
        "phoneNumber": "",
        "role": role,
        "password": hashed,
        "createdAt": now,
        "employeeId": employee_id,
        "department": department,
        "accessPermissions": access_permissions,
    }
    
    result = users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    
    # Update employee record
    emp_col = db["employees_list"]
    emp_col.update_one(
        {"email": email},
        {"$set": {
            "name": body.fullName.strip(),
            "fullName": body.fullName.strip(),
            "employeeId": employee_id,
            "status": "Active",
            "joinDate": now,
            "userId": str(result.inserted_id),
        }}
    )
    
    # Mark invite as completed
    invites_col.update_one({"_id": invite["_id"]}, {"$set": {"status": "completed", "completedAt": now}})
    
    # Generate token
    token = create_access_token({"sub": str(result.inserted_id), "role": role})
    
    return {
        "success": True,
        "message": "Registration completed successfully",
        "accessToken": token,
        "user": {
            "id": str(new_user["_id"]),
            "username": new_user["username"],
            "fullName": new_user["fullName"],
            "email": new_user["email"],
            "role": role,
            "employeeId": employee_id,
        }
    }


@router.get("/invite/{token}")
async def get_invite_info(token: str):
    """Get invite info for the registration page."""
    if db is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    
    invites_col = db["employee_invites"]
    invite = invites_col.find_one({"inviteToken": token})
    
    if not invite:
        return JSONResponse(
            status_code=404,
            content={
                "message": "This invite link is invalid or was replaced by a newer invite. Open the latest invite email, or ask HR to resend the invite.",
            },
        )

    if invite.get("status") == "completed":
        return JSONResponse(
            status_code=400,
            content={"message": "This invite was already used. Please sign in with your account."},
        )

    if invite.get("status") != "pending":
        return JSONResponse(
            status_code=400,
            content={"message": "This invite is no longer active. Ask HR to send a new invite."},
        )
    
    # Check expiry
    expires_at = datetime.fromisoformat(invite["expiresAt"])
    if datetime.utcnow() > expires_at:
        invites_col.update_one({"_id": invite["_id"]}, {"$set": {"status": "expired"}})
        return JSONResponse(status_code=400, content={"message": "Invite has expired. Please ask HR to resend a new invite."})
    
    return {
        "valid": True,
        "email": invite["email"],
        "role": invite["role"],
        "department": invite.get("department", ""),
    }


@router.post("/resend-invite")
async def resend_invite(body: ResendInviteRequest, request: Request):
    """Resend invite email to an employee."""
    if db is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    
    email = body.email.lower().strip()
    invites_col = db["employee_invites"]
    
    # Find existing invite
    invite = invites_col.find_one({"email": email, "status": "pending"})
    
    if not invite:
        # Create new invite if none exists
        return JSONResponse(status_code=404, content={"message": "No pending invite found for this email"})
    
    # Check if expired and regenerate token if needed
    expires_at = datetime.fromisoformat(invite["expiresAt"])
    if datetime.utcnow() > expires_at:
        # Generate new token
        new_token = secrets.token_urlsafe(32)
        new_expires = datetime.utcnow() + timedelta(days=7)
        invites_col.update_one(
            {"_id": invite["_id"]},
            {"$set": {"inviteToken": new_token, "expiresAt": new_expires.isoformat()}}
        )
        invite["inviteToken"] = new_token
    
    request_origin = _origin_from_request(request)
    base_url = request_origin or None
    register_url = _build_register_url(base_url, invite["inviteToken"])
    invite_email_sent, email_error = send_registration_invite_email(
        email, invite["inviteToken"], invite["role"], base_url
    )
    
    return {
        "success": True,
        "message": "Invite resent successfully" if invite_email_sent else "Invite exists, but email could not be sent",
        "inviteEmailSent": invite_email_sent,
        "emailError": email_error,
        "registerUrl": register_url,
    }


# ── Register ─────────────────────────────────────────────────
@router.post("/register")
async def register(body: RegisterRequest, request: Request):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    email = body.email.lower().strip()
    existing = users_collection.find_one({"email": email})
    if existing:
        return JSONResponse(status_code=409, content={"message": "Email already registered"})
        
    if getattr(body, "phoneNumber", None):
        existing_phone = users_collection.find_one({"phoneNumber": body.phoneNumber})
        if existing_phone:
            return JSONResponse(status_code=409, content={"message": "Phone number already registered"})

    if body.inviteSource == "hr_employee_invite":
        plain_password = generate_temporary_password()
    else:
        plain_password = str(body.password or "").strip()
        if not plain_password:
            return JSONResponse(status_code=400, content={"message": "Password is required"})

    hashed = pwd_context.hash(plain_password)
    now = datetime.utcnow().isoformat()
    employee_id = body.employeeId.strip() if body.employeeId else ""
    if normalize_auth_role(body.role) == "hr":
        employee_id = generate_employee_id(body.role, body.fullName)
    elif not employee_id and normalize_auth_role(body.role) != "candidate":
        employee_id = generate_employee_id(body.role, body.fullName)

    new_user = {
        "fullName": body.fullName.strip(),
        "name": body.fullName.strip(),
        "email": email,
        "phoneNumber": body.phoneNumber,
        "role": body.role,
        "password": hashed,
        "createdAt": now,
        "employeeId": employee_id or None,
        "manager_id": body.manager_id or None,
    }

    result = users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    # Also create an employee record so the HR employee list shows invited employees.
    try:
        if db is not None and body.inviteSource == "hr_employee_invite":
            emp_col = db["employees_list"]
            emp_doc = {
                "name": new_user.get("fullName", ""),
                "fullName": new_user.get("fullName", ""),
                "email": new_user.get("email", ""),
                "department": "",
                "role": new_user.get("role", ""),
                "employeeId": new_user.get("employeeId"),
                "productivity": 0,
                "status": "Active",
                "phoneNumber": new_user.get("phoneNumber", ""),
                "joinDate": now,
                "createdAt": now,
                "userId": str(result.inserted_id),
            }

            # avoid duplicate employee entries for same email
            existing_emp = emp_col.find_one({"email": emp_doc["email"]})
            if not existing_emp:
                emp_col.insert_one(emp_doc)
    except Exception as e:
        print(f"[AUTH] failed to insert employee record: {e}")

    request_origin = _origin_from_request(request)
    requested_login_url = (body.loginUrl or "").strip()
    if not requested_login_url and request_origin:
        requested_login_url = f"{request_origin.rstrip('/')}/login"

    resolved_login_url = resolve_invite_login_url(requested_login_url or None)
    invite_email_sent, email_error = send_invite_email(
        new_user.get("email", ""),
        plain_password,
        new_user.get("fullName", ""),
        resolved_login_url,
    )
    token = create_access_token({"sub": str(result.inserted_id), "role": normalize_auth_role(body.role)})
    response = build_user_response(new_user, token)
    response["inviteEmailSent"] = invite_email_sent
    response["emailError"] = email_error
    if body.inviteSource == "hr_employee_invite":
        response["temporaryPassword"] = plain_password
        response["inviteLoginUrl"] = resolved_login_url
    response["message"] = "Employee invited and email sent" if invite_email_sent else "Employee invited, but email could not be sent"
    return response


@router.post("/login")
async def login(body: LoginRequest):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    user = users_collection.find_one({"email": body.email.lower().strip()})
    if not user:
        return JSONResponse(status_code=401, content={"message": "Invalid email or password"})

    if not verify_user_password(body.password, user):
        return JSONResponse(status_code=401, content={"message": "Invalid email or password"})
    # Check if employee is suspended
    try:
        if db is not None:
            emp_col = db["employees_list"]
            emp = emp_col.find_one({"email": user.get("email", "")})
            if emp and emp.get("status") == "Suspended":
                return JSONResponse(status_code=403, content={"message": "Account suspended. Please contact HR."})
    except Exception as e:
        print(f"[AUTH] failed to check employee suspension: {e}")
    token = create_access_token({"sub": str(user["_id"]), "role": normalize_auth_role(user.get("role", ""))})
    return build_user_response(user, token)


@router.post("/refresh-token")
async def refresh_token(authorization: str = Header(None)):
    """Refresh access token using existing valid token"""
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create new access token
        new_token = create_access_token({
            "sub": str(user["_id"]),
            "role": normalize_auth_role(user.get("role", ""))
        })
        return {"accessToken": new_token}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.get("/me")
async def get_me(authorization: str = Header(None)):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "success": True,
            "user": build_user_response(user, token)["user"],
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.get("/team-users")
async def get_team_users():
    if users_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    users = list(users_collection.find({}, {"password": 0, "face_encoding": 0}))
    data = []
    for user in users:
        role = normalize_auth_role(user.get("role", ""))
        if role == "candidate":
            continue
        data.append({
            "id": str(user.get("_id", "")),
            "name": user.get("fullName") or user.get("name") or user.get("email") or "User",
            "fullName": user.get("fullName") or user.get("name") or "",
            "email": user.get("email", ""),
            "role": role,
            "employeeId": user.get("employeeId") or user.get("employee_id") or "",
        })

    data.sort(key=lambda item: str(item.get("name", "")).lower())
    return {"success": True, "data": data}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    email = body.email.lower().strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return {"message": "If an account exists with this email, an OTP has been sent."}

    otp = generate_otp()
    expires = datetime.utcnow() + timedelta(minutes=10)

    otp_store[email] = {
        "otp": otp,
        "expires": expires,
        "attempts": 0
    }

    sent = send_email_otp(email, otp)

    if sent:
        return {"message": "OTP sent to your email. Valid for 10 minutes."}
    else:
        return {"message": "OTP generated. Email service unavailable. Check server logs for OTP."}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    email = body.email.lower().strip()
    otp = body.otp.strip()

    if email not in otp_store:
        return JSONResponse(status_code=400, content={"message": "No OTP found. Please request a new one."})

    otp_data = otp_store[email]

    if datetime.utcnow() > otp_data["expires"]:
        del otp_store[email]
        return JSONResponse(status_code=400, content={"message": "OTP expired. Please request a new one."})

    if otp_data["attempts"] >= 5:
        del otp_store[email]
        return JSONResponse(status_code=400, content={"message": "Too many attempts. Please request a new OTP."})

    if otp_data["otp"] != otp:
        otp_store[email]["attempts"] += 1
        return JSONResponse(status_code=400, content={"message": "Invalid OTP."})

    otp_store[email]["verified"] = True

    return {"message": "OTP verified successfully."}


@router.put("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    email = body.email.lower().strip()

    if email not in otp_store:
        return JSONResponse(status_code=400, content={"message": "Please verify OTP first."})

    if not otp_store[email].get("verified"):
        return JSONResponse(status_code=400, content={"message": "Please verify OTP first."})

    user = users_collection.find_one({"email": email})
    if not user:
        return JSONResponse(status_code=404, content={"message": "User not found."})

    hashed = pwd_context.hash(body.password)

    users_collection.update_one(
        {"email": email},
        {"$set": {"password": hashed}}
    )

    del otp_store[email]

    return {"message": "Password reset successfully. Please login with your new password."}


def validate_password_strength(password: str) -> Optional[str]:
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character"
    return None


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, current_user: TokenPayload = Depends(get_current_user)):
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    if body.newPassword != body.confirmPassword:
        return JSONResponse(status_code=400, content={"message": "New password and confirm password do not match"})

    strength_error = validate_password_strength(body.newPassword)
    if strength_error:
        return JSONResponse(status_code=400, content={"message": strength_error})

    user = None
    if ObjectId.is_valid(current_user.sub):
        user = users_collection.find_one({"_id": ObjectId(current_user.sub)})
    if not user:
        user = users_collection.find_one({"email": current_user.sub.lower()})

    if not user:
        return JSONResponse(status_code=404, content={"message": "User not found"})

    if not verify_user_password(body.currentPassword, user):
        return JSONResponse(status_code=400, content={"message": "Current password is incorrect"})

    hashed = pwd_context.hash(body.newPassword)
    users_collection.update_one({"_id": user["_id"]}, {"$set": {"password": hashed}})

    return {"message": "Password updated successfully"}
    return {"message": "Password reset successfully. Please login with your new password."}
