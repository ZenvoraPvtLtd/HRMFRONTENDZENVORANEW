import os
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.core.database import leave_balances_collection as leave_balances_col
from app.core.database import leaves_collection as leaves_col
from app.core.database import users_collection as users_col

try:
    from app.services.notifications import create_notification as _create_notif
except Exception:
    _create_notif = None  # type: ignore


def _notify_employee(employee_id: str, title: str, message: str, type_: str):
    if _create_notif:
        try:
            _create_notif(title, message, type_, recipient_id=employee_id)
        except Exception:
            pass
    # notifications handled above; WhatsApp service availability checked separately
    if whatsapp_service:
        try:
            whatsapp_service.queue_message(recipient_name=employee_id, phone=None, notification_type=type_, template_data={})
        except Exception:
            pass


try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/leaves", tags=["leaves"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = "HS256"

if leaves_col is not None:
    try:
        leaves_col.create_index([("employee_id", 1), ("applied_date", -1)])
    except Exception:
        pass
from pymongo import MongoClient

router = APIRouter(prefix="/api/leaves", tags=["leaves"])

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")
SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = "HS256"

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    _db = _client[DATABASE_NAME]
    leaves_col = _db["leaves"]
    leave_balances_col = _db["leave_balances"]
    users_col = _db["users"]
    leaves_col.create_index([("employee_id", 1), ("applied_date", -1)])
except Exception as e:
    print(f"[LEAVES] MongoDB connection failed: {e}")
    leaves_col = None
    leave_balances_col = None
    users_col = None

MANAGER_PENDING = "manager_pending"
MANAGER_APPROVED = "manager_approved"
MANAGER_REJECTED = "manager_rejected"
APPROVED = "approved"
REJECTED = "rejected"


class LeaveCreate(BaseModel):
    leave_type: str = Field(..., min_length=2)
    duration_type: str = Field(..., min_length=2)
    leave_date: str
    days: float = Field(..., gt=0)
    reason: str = Field(..., min_length=3)


class LeaveUpdate(BaseModel):
    leave_type: Optional[str] = None
    duration_type: Optional[str] = None
    leave_date: Optional[str] = None
    days: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None


class LeaveStatusUpdate(BaseModel):
    status: str
    comment: Optional[str] = None


def _parse_token(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


def _fmt(leave: dict) -> dict:
    internal_status = leave.get("status", MANAGER_PENDING)
    if internal_status == MANAGER_PENDING:
        frontend_status = "Pending"
    elif internal_status == MANAGER_APPROVED:
        frontend_status = "Under HR Review"
    elif internal_status == MANAGER_REJECTED:
        frontend_status = "Rejected"
    elif internal_status == APPROVED:
        frontend_status = "Approved"
    else:
        frontend_status = "Rejected"

    return {
        "id": str(leave["_id"]),
        "employee_id": leave.get("employee_id", ""),
        "employee_name": leave.get("employee_name", ""),
        "leave_type": leave.get("leave_type", ""),
        "duration_type": leave.get("duration_type", ""),
        "leave_date": leave.get("leave_date", ""),
        "days": leave.get("days", 0),
        "reason": leave.get("reason", ""),
        "status": frontend_status,
        "internal_status": internal_status,
        "applied_date": leave.get("applied_date", ""),
        "manager_reviewed_at": leave.get("manager_reviewed_at"),
        "hr_reviewed_at": leave.get("hr_reviewed_at"),
        "manager_comment": leave.get("manager_comment"),
        "hr_comment": leave.get("hr_comment"),
    }


def _db_check():
    if leaves_col is None or leave_balances_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_leave_notification(leave: dict, status: str):
    """Send WhatsApp notification for leave status update"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    employee_name = leave.get("employee_name", "Employee")
    phone = leave.get("phone")
    
    if not phone:
        return
    
    if status == APPROVED:
        status_text = "approved"
        template_type = "leave_approval"
    elif status == REJECTED:
        status_text = "rejected"
        template_type = "leave_approval"
    else:
        return
    
    try:
        whatsapp_service.queue_message(
            recipient_name=employee_name,
            phone=phone,
            notification_type=template_type,
            template_data={
                "leave_dates": leave.get("leave_date", ""),
                "status": status_text,
                "notes": leave.get("hr_comment", "Your leave request has been reviewed.")
            }
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue leave notification: {e}")


@router.post("/")
async def create_leave(
    body: LeaveCreate,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"
    employee_name = x_user_name or "Employee"

    manager_id = None
    if users_col is not None:
        try:
            emp_user = users_col.find_one({"_id": ObjectId(employee_id)}) if len(employee_id) == 24 else None
            if emp_user is None:
                emp_user = users_col.find_one({"email": employee_id})
            if emp_user:
                manager_id = emp_user.get("manager_id")
        except Exception:
            pass

    doc = {
        "employee_id": employee_id,
        "employee_name": employee_name,
        "leave_type": body.leave_type,
        "duration_type": body.duration_type,
        "leave_date": body.leave_date,
        "days": body.days,
        "reason": body.reason,
        "status": MANAGER_PENDING,
        "applied_date": datetime.utcnow().isoformat(),
        "manager_reviewed_at": None,
        "hr_reviewed_at": None,
        "manager_comment": None,
        "hr_comment": None,
    }
    result = leaves_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _fmt(doc)


@router.get("/my")
async def get_my_leaves(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"
    docs = list(leaves_col.find({"employee_id": employee_id}).sort("applied_date", -1).limit(limit))
    return {"data": [_fmt(d) for d in docs]}


@router.get("/balances")
async def get_all_leave_balances(
    year: Optional[int] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    """HR/Admin: get leave balances for all employees."""
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    target_year = year or datetime.utcnow().year
    docs = list(leave_balances_col.find({"year": target_year}))

    # Also pull from users so employees with no balance record still appear
    all_employees: list[dict] = []
    if users_col is not None:
        all_employees = list(
            users_col.find(
                {"role": {"$nin": ["candidate"]}},
                {"_id": 1, "email": 1, "fullName": 1, "name": 1, "department": 1},
            )
        )

    balance_by_emp: dict[str, dict] = {
        d["employee_id"]: d for d in docs if d.get("employee_id")
    }

    results = []
    seen: set[str] = set()
    for emp in all_employees:
        emp_id = str(emp["_id"])
        if emp_id in seen:
            continue
        seen.add(emp_id)
        bal = balance_by_emp.get(emp_id)
        earned_default = round(datetime.utcnow().month * 1.5, 1)
        print("bal =", bal)
        results.append({
            "id": emp_id,
            "employee_id": emp_id,
            "employee_name": emp.get("fullName") or emp.get("name") or emp.get("email") or emp_id,
            "department": emp.get("department") or "Unassigned",
            "year": target_year,
            "earned": bal.get("earned", earned_default) if bal else earned_default,
            "used": bal.get("used", 0.0) if bal else 0.0,
            "remaining": bal.get("remaining", earned_default) if bal else earned_default,
        })
    

    # Also include balances that exist but employee record not in users collection
    for emp_id, bal in balance_by_emp.items():
        if emp_id not in seen:
            results.append({
                "id": emp_id,
                "employee_id": emp_id,
                "employee_name": bal.get("employee_name") or emp_id,
                "department": bal.get("department") or "Unassigned",
                "year": target_year,
                "earned": bal.get("earned", 0.0),
                "used": bal.get("used", 0.0),
                "remaining": bal.get("remaining", 0.0),
            })

    return {"data": results}


@router.post("/balances")
async def create_leave_balance(
    body: dict,
    year: Optional[int] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    target_year = year or datetime.utcnow().year
    emp_id = body.get("employee_id", "")
    if not emp_id:
        raise HTTPException(status_code=400, detail="employee_id required")

    earned_default = round(datetime.utcnow().month * 1.5, 1)
    doc = {
        "employee_id": emp_id,
        "employee_name": body.get("employee_name", ""),
        "department": body.get("department", ""),
        "year": target_year,
        "earned": float(body.get("earned", earned_default)),
        "used": float(body.get("used", 0.0)),
        "remaining": float(body.get("remaining", earned_default)),
    }
    leave_balances_col.update_one(
        {"employee_id": emp_id, "year": target_year},
        {"$set": doc},
        upsert=True,
    )
    return {**doc, "id": emp_id}


@router.patch("/balances/{employee_id}")
async def update_employee_balance(
    employee_id: str,
    body: dict,
    year: Optional[int] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    target_year = year or datetime.utcnow().year
    updates: dict = {}
    if "earned" in body:
        updates["earned"] = float(body["earned"])
    if "used" in body:
        updates["used"] = float(body["used"])
    if updates:
        earned = updates.get("earned")
        used = updates.get("used")
        if earned is not None and used is not None:
            updates["remaining"] = round(earned - used, 1)

    leave_balances_col.update_one(
        {"employee_id": employee_id, "year": target_year},
        {"$set": updates},
        upsert=True,
    )
    doc = leave_balances_col.find_one({"employee_id": employee_id, "year": target_year}) or {}
    return {
        "id": employee_id,
        "employee_id": employee_id,
        "employee_name": doc.get("employee_name", ""),
        "department": doc.get("department", ""),
        "year": target_year,
        "earned": doc.get("earned", 0.0),
        "used": doc.get("used", 0.0),
        "remaining": doc.get("remaining", 0.0),
    }


@router.post("/balances/reset-year")
async def reset_year_balances(
    year: Optional[int] = None,
    earned: float = 18.0,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    target_year = year or datetime.utcnow().year
    leave_balances_col.update_many(
        {"year": target_year},
        {"$set": {"earned": earned, "used": 0.0, "remaining": earned}},
    )
    return {"message": f"Reset all leave balances for {target_year}. Earned={earned}, Used=0"}



async def get_my_balance(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"
    year = datetime.utcnow().year

    bal = leave_balances_col.find_one({"employee_id": employee_id, "year": year})
    if not bal:
        earned_so_far = round(datetime.utcnow().month * 1.5, 1)
        bal = {
            "employee_id": employee_id,
            "year": year,
            "earned": earned_so_far,
            "used": 0.0,
            "remaining": earned_so_far,
        }
        leave_balances_col.insert_one(bal)

    return {
        "employee_id": bal["employee_id"],
        "year": bal["year"],
        "earned": bal["earned"],
        "used": bal["used"],
        "remaining": bal["remaining"],
    }


@router.put("/{leave_id}")
async def update_leave(
    leave_id: str,
    body: LeaveUpdate,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"

    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid leave ID")

    leave = leaves_col.find_one({"_id": oid, "employee_id": employee_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.get("status") != MANAGER_PENDING:
        raise HTTPException(status_code=400, detail="Only pending leaves can be edited")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    leaves_col.update_one({"_id": oid}, {"$set": updates})
    return _fmt({**leave, **updates})


@router.delete("/{leave_id}")
async def delete_leave(
    leave_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"

    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid leave ID")

    leave = leaves_col.find_one({"_id": oid, "employee_id": employee_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.get("status") != MANAGER_PENDING:
        raise HTTPException(status_code=400, detail="Only pending leaves can be deleted")

    leaves_col.delete_one({"_id": oid})
    return {"message": "Deleted"}


@router.get("/manager")
async def get_manager_leaves(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("manager", "hr", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    manager_sub = payload.get("sub")
    if manager_sub:
        query = {
            "status": {"$in": [MANAGER_PENDING, MANAGER_APPROVED, MANAGER_REJECTED]},
            "$or": [{"manager_id": manager_sub}, {"manager_id": None}, {"manager_id": {"$exists": False}}],
        }
    else:
        query = {"status": {"$in": [MANAGER_PENDING, MANAGER_APPROVED, MANAGER_REJECTED]}}

    docs = list(leaves_col.find(query).sort("applied_date", -1).limit(limit))
    return {"data": [_fmt(d) for d in docs]}


@router.patch("/{leave_id}/manager-status")
async def manager_update_status(
    leave_id: str,
    body: LeaveStatusUpdate,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("manager", "hr", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    if body.status not in (MANAGER_APPROVED, MANAGER_REJECTED):
        raise HTTPException(status_code=400, detail="Status must be 'manager_approved' or 'manager_rejected'")

    manager_comment = (body.comment or "").strip()
    if len(manager_comment) < 3:
        raise HTTPException(status_code=400, detail="Manager reason is required")

    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid leave ID")

    leave = leaves_col.find_one({"_id": oid})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.get("status") != MANAGER_PENDING:
        raise HTTPException(status_code=400, detail="Leave is not in manager_pending state")

    updates = {
        "status": body.status,
        "manager_reviewed_at": datetime.utcnow().isoformat(),
        "manager_comment": manager_comment,
    }
    leaves_col.update_one({"_id": oid}, {"$set": updates})

    employee_id = leave.get("employee_id", "")
    leave_type = leave.get("leave_type", "Leave")
    if body.status == MANAGER_APPROVED:
        _notify_employee(
            employee_id,
            "Leave Under HR Review",
            f'Your {leave_type} request has been approved by manager and is now under HR review.',
            "leave_status_updated",
        )
    elif body.status == MANAGER_REJECTED:
        reason = f' Reason: {manager_comment}' if manager_comment else ''
        _notify_employee(
            employee_id,
            "Leave Request Rejected",
            f'Your {leave_type} request has been rejected by manager.{reason}',
            "leave_status_updated",
        )

    return _fmt({**leave, **updates})


@router.get("/")
async def get_hr_leaves(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    docs = list(
        leaves_col.find({"status": {"$in": [MANAGER_PENDING, MANAGER_APPROVED, MANAGER_REJECTED, APPROVED, REJECTED]}})
        .sort("applied_date", -1)
        .limit(limit)
    )
    return {"data": [_fmt(d) for d in docs]}


@router.patch("/{leave_id}/status")
async def hr_update_status(
    leave_id: str,
    body: LeaveStatusUpdate,
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    role = payload.get("role") or x_user_role or ""
    if role not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    if body.status not in (APPROVED, REJECTED):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid leave ID")

    leave = leaves_col.find_one({"_id": oid})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.get("status") != MANAGER_APPROVED:
        raise HTTPException(status_code=400, detail="Only manager-approved leaves can be reviewed by HR")

    updates = {
        "status": body.status,
        "hr_reviewed_at": datetime.utcnow().isoformat(),
        "hr_comment": body.comment,
    }
    leaves_col.update_one({"_id": oid}, {"$set": updates})

    employee_id = leave.get("employee_id", "")
    leave_type = leave.get("leave_type", "Leave")

    if body.status == APPROVED:
        year = datetime.utcnow().year
        leave_balances_col.update_one(
            {"employee_id": leave["employee_id"], "year": year},
            {"$inc": {"used": leave.get("days", 0), "remaining": -leave.get("days", 0)}},
            upsert=True,
        )
        _notify_employee(
            employee_id,
            "Leave Request Approved",
            f'Your {leave_type} request has been approved by HR.',
            "leave_approved",
        )
    elif body.status == REJECTED:
        comment = leave.get("hr_comment") or ""
        reason = f' Reason: {comment}' if comment else ''
        _notify_employee(
            employee_id,
            "Leave Request Rejected",
            f'Your {leave_type} request has been rejected by HR.{reason}',
            "leave_rejected",
        )

    # Send WhatsApp notification
    updated_leave = {**leave, **updates}
    _send_leave_notification(updated_leave, body.status)

    return _fmt(updated_leave)

    return _fmt({**leave, **updates})


@router.get("/balance/my")
async def get_my_balance(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    _db_check()
    payload = _parse_token(authorization)
    employee_id = payload.get("sub") or x_user_id or "unknown"
    year = datetime.utcnow().year

    bal = leave_balances_col.find_one({"employee_id": employee_id, "year": year})
    if not bal:
        earned_so_far = round(datetime.utcnow().month * 1.5, 1)
        bal = {
            "employee_id": employee_id,
            "year": year,
            "earned": earned_so_far,
            "used": 0.0,
            "remaining": earned_so_far,
        }
        leave_balances_col.insert_one(bal)

    return {
        "employee_id": bal["employee_id"],
        "year": bal["year"],
        "earned": bal["earned"],
        "used": bal["used"],
        "remaining": bal["remaining"],
    }
