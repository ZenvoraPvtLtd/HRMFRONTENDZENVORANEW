from datetime import datetime
from typing import Optional
from bson import ObjectId, errors as bson_errors
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError

from app.core.database import db
from app.attendance.role_checker import admin_only

router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto"
)

# Collections
def get_users_col():
    return db["users"] if db is not None else None

def get_settings_col():
    return db["system_settings"] if db is not None else None

def get_logs_col():
    return db["system_logs"] if db is not None else None


# Schemas
class AdminUserCreate(BaseModel):
    fullName: str
    email: str
    phoneNumber: str
    role: str
    password: str
    status: Optional[str] = "Active"

class AdminUserUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phoneNumber: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

class SystemSettingsPayload(BaseModel):
    companyName: str
    shiftStart: str
    shiftEnd: str
    gracePeriodMinutes: int
    openaiApiKey: Optional[str] = ""
    geminiApiKey: Optional[str] = ""
    whatsappToken: Optional[str] = ""
    whatsappPhoneId: Optional[str] = ""
    smtpHost: Optional[str] = ""
    smtpPort: Optional[int] = 587
    smtpUser: Optional[str] = ""
    smtpPassword: Optional[str] = ""


# Helper: generate a simple employee ID for admin-created users
def _generate_employee_id(role: str, name: str = "") -> str:
    """Generate a unique employeeId prefix-based ID."""
    import re
    role_lower = str(role or "").strip().lower()
    name_code = re.sub(r"[^A-Za-z0-9]", "", str(name or "")).upper()[:4] or "USER"

    prefix_map = {
        "admin": "ADM",
        "hr": f"HR{name_code}",
        "manager": "MGR",
        "candidate": "CND",
    }
    prefix = prefix_map.get(role_lower, "EMP")

    col = get_users_col()
    highest = 0
    if col is not None:
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
        for u in col.find(
            {"employeeId": {"$regex": f"^{prefix}\\d+$", "$options": "i"}},
            {"employeeId": 1},
        ):
            m = pattern.match(str(u.get("employeeId") or ""))
            if m:
                highest = max(highest, int(m.group(1)))

    return f"{prefix}{(highest + 1):04d}"


# Helper: Log admin actions
def log_action(admin_user: dict, action: str, details: str):
    col = get_logs_col()
    if col is not None:
        try:
            col.insert_one({
                "timestamp": datetime.utcnow().isoformat(),
                "adminId": str(admin_user.get("_id", "")),
                "adminEmail": admin_user.get("email", ""),
                "action": action,
                "details": details,
            })
        except Exception:
            pass  # Audit log failure must never break the main operation


# --- Endpoints ---

@router.get("/metrics")
def get_metrics(admin: dict = Depends(admin_only)):
    users_col = get_users_col()
    logs_col = get_logs_col()

    if users_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    total_users = users_col.count_documents({})
    active_users = users_col.count_documents({"status": {"$ne": "Suspended"}})
    suspended_users = users_col.count_documents({"status": "Suspended"})

    role_counts = {
        "admin": users_col.count_documents({"role": "admin"}),
        "hr": users_col.count_documents({"role": "hr"}),
        "manager": users_col.count_documents({"role": "manager"}),
        "employee": users_col.count_documents({"role": "employee"}),
        "candidate": users_col.count_documents({"role": "candidate"}),
    }

    recent_logs_count = logs_col.count_documents({}) if logs_col is not None else 0

    settings_col = get_settings_col()
    settings = settings_col.find_one({}) if settings_col is not None else None

    integrations_status = {
        "gemini": bool(settings.get("geminiApiKey")) if settings else False,
        "whatsapp": bool(settings.get("whatsappToken")) if settings else False,
        "smtp": bool(settings.get("smtpUser")) if settings else False,
    }

    return {
        "dbConnected": True,
        "totalUsers": total_users,
        "activeUsers": active_users,
        "suspendedUsers": suspended_users,
        "roles": role_counts,
        "auditLogsCount": recent_logs_count,
        "integrations": integrations_status,
    }


@router.get("/users")
def list_users(admin: dict = Depends(admin_only)):
    col = get_users_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    users = []
    for u in col.find({}).sort("createdAt", -1):
        users.append({
            "id": str(u["_id"]),
            "fullName": u.get("fullName") or u.get("name") or "",
            "email": u.get("email", ""),
            "phoneNumber": u.get("phoneNumber", ""),
            "role": u.get("role", ""),
            "status": u.get("status", "Active"),
            "createdAt": u.get("createdAt", ""),
        })
    return users


@router.post("/users")
def create_user(payload: AdminUserCreate, admin: dict = Depends(admin_only)):
    col = get_users_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    # Normalise inputs
    email_clean = payload.email.lower().strip()
    full_name = payload.fullName.strip()
    role = payload.role.strip().lower()
    status = payload.status or "Active"

    # Validate password length
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check duplicate email before attempting insert
    if col.find_one({"email": email_clean}):
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    hashed = pwd_context.hash(payload.password)
    now = datetime.utcnow().isoformat()
    employee_id = _generate_employee_id(role, full_name)

    new_user = {
        "fullName": full_name,
        "name": full_name,
        "email": email_clean,
        "phoneNumber": payload.phoneNumber.strip(),
        "role": role,
        "password": hashed,
        "status": status,
        "createdAt": now,
        "employeeId": employee_id,
    }

    try:
        result = col.insert_one(new_user)
    except DuplicateKeyError:
        # Race condition: another request inserted the same email between our
        # find_one check and the insert — return a clean 400, not a 500.
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(exc)}")

    # Also create / update the employees_list record so this user appears
    # in HR employee views and dashboard queries.
    try:
        if db is not None:
            emp_col = db["employees_list"]
            existing_emp = emp_col.find_one({"email": email_clean})
            emp_doc = {
                "name": full_name,
                "fullName": full_name,
                "email": email_clean,
                "department": "",
                "role": role,
                "employeeId": employee_id,
                "productivity": 0,
                "status": status,
                "phoneNumber": payload.phoneNumber.strip(),
                "joinDate": now,
                "createdAt": now,
                "userId": str(result.inserted_id),
            }
            if existing_emp:
                emp_col.update_one({"_id": existing_emp["_id"]}, {"$set": emp_doc})
            else:
                emp_col.insert_one(emp_doc)
    except Exception:
        pass  # employees_list sync failure must not roll back the user creation

    log_action(admin, "CREATE_USER", f"Created user {email_clean} with role {role} (ID: {employee_id})")

    return {
        "message": "User created successfully",
        "userId": str(result.inserted_id),
        "employeeId": employee_id,
    }


@router.put("/users/{user_id}")
def update_user(user_id: str, payload: AdminUserUpdate, admin: dict = Depends(admin_only)):
    col = get_users_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    # Validate ObjectId
    try:
        oid = ObjectId(user_id)
    except (bson_errors.InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = col.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}
    if payload.fullName is not None:
        update_data["fullName"] = payload.fullName.strip()
        update_data["name"] = payload.fullName.strip()
    if payload.email is not None:
        email_clean = payload.email.lower().strip()
        dup = col.find_one({"email": email_clean, "_id": {"$ne": oid}})
        if dup:
            raise HTTPException(status_code=400, detail="Email is already in use by another account")
        update_data["email"] = email_clean
    if payload.phoneNumber is not None:
        update_data["phoneNumber"] = payload.phoneNumber.strip()
    if payload.role is not None:
        update_data["role"] = payload.role.strip().lower()
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.password is not None and payload.password.strip() != "":
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        update_data["password"] = pwd_context.hash(payload.password)

    if not update_data:
        return {"message": "No changes made"}

    try:
        col.update_one({"_id": oid}, {"$set": update_data})
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email is already in use by another account")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(exc)}")

    # Sync non-password fields to employees_list too
    try:
        if db is not None:
            sync = {k: v for k, v in update_data.items() if k != "password"}
            if sync:
                db["employees_list"].update_one(
                    {"userId": user_id},
                    {"$set": sync},
                )
    except Exception:
        pass

    log_action(admin, "UPDATE_USER", f"Updated user {user.get('email')} — fields: {list(update_data.keys())}")

    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(admin_only)):
    col = get_users_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    try:
        oid = ObjectId(user_id)
    except (bson_errors.InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = col.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    col.delete_one({"_id": oid})

    # Clean up employees_list entry as well
    try:
        if db is not None:
            db["employees_list"].delete_one({"userId": user_id})
    except Exception:
        pass

    log_action(admin, "DELETE_USER", f"Deleted user {user.get('email')}")

    return {"message": "User deleted successfully"}


@router.get("/settings")
def get_settings(admin: dict = Depends(admin_only)):
    col = get_settings_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    settings = col.find_one({})
    if not settings:
        return {
            "companyName": "Zenvora Pvt Ltd",
            "shiftStart": "09:00",
            "shiftEnd": "18:00",
            "gracePeriodMinutes": 15,
            "openaiApiKey": "",
            "geminiApiKey": "",
            "whatsappToken": "",
            "whatsappPhoneId": "",
            "smtpHost": "",
            "smtpPort": 587,
            "smtpUser": "",
            "smtpPassword": "",
        }

    settings["id"] = str(settings["_id"])
    del settings["_id"]
    return settings


@router.put("/settings")
def save_settings(payload: SystemSettingsPayload, admin: dict = Depends(admin_only)):
    col = get_settings_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    data = payload.model_dump()
    existing = col.find_one({})

    if existing:
        col.update_one({"_id": existing["_id"]}, {"$set": data})
    else:
        col.insert_one(data)

    log_action(admin, "UPDATE_SETTINGS", "Updated global system configurations & API integrations")

    return {"message": "Settings saved successfully"}


@router.get("/logs")
def list_logs(admin: dict = Depends(admin_only)):
    col = get_logs_col()
    if col is None:
        return []

    logs = []
    for log in col.find({}).sort("timestamp", -1).limit(100):
        logs.append({
            "id": str(log["_id"]),
            "timestamp": log.get("timestamp", ""),
            "adminEmail": log.get("adminEmail", ""),
            "action": log.get("action", ""),
            "details": log.get("details", ""),
        })
    return logs

