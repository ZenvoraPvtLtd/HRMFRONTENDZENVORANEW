from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Optional

import pytz
from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from app.core.database import (
    attendance_collection,
    db,
    employees_collection as attendance_employees_collection,
    employees_list_collection,
    hr_actions_collection,
    leave_balances_collection,
    leaves_collection,
    users_collection,
)

router = APIRouter(prefix="/api/hr-actions", tags=["hr-actions"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = "HS256"
HR_ROLES = {"admin", "hr"}
IST = pytz.timezone("Asia/Kolkata")

MANAGER_PENDING = "manager_pending"
MANAGER_APPROVED = "manager_approved"
MANAGER_REJECTED = "manager_rejected"
APPROVED = "approved"
REJECTED = "rejected"
PENDING_LEAVE_STATUSES = {MANAGER_PENDING, MANAGER_APPROVED, "Pending", "pending"}
ATTENDANCE_STATUSES = {
    "present": "Present",
    "absent": "Absent",
    "late": "Late",
    "on leave": "On Leave",
    "remote": "Remote",
}
EMPLOYEE_STATUSES = {
    "active": "Active",
    "inactive": "Inactive",
    "on leave": "On Leave",
    "remote": "Remote",
}

_indexes_ready = False


class AttendanceMarkRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: Optional[str] = None
    status: str = "Present"
    check_in_time: Optional[str] = Field(default=None, alias="checkInTime")
    check_out_time: Optional[str] = Field(default=None, alias="checkOutTime")
    shift: Optional[str] = None
    note: Optional[str] = None


class LeaveBalanceAdjustment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    year: Optional[int] = Field(default=None, ge=2000, le=2100)
    earned: Optional[float] = Field(default=None, ge=0)
    used: Optional[float] = Field(default=None, ge=0)
    remaining: Optional[float] = Field(default=None, ge=0)
    earned_delta: Optional[float] = Field(default=None, alias="earnedDelta")
    used_delta: Optional[float] = Field(default=None, alias="usedDelta")
    remaining_delta: Optional[float] = Field(default=None, alias="remainingDelta")
    reason: str = Field(..., min_length=3)


class ReviewScheduleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    review_date: str = Field(alias="reviewDate")
    review_type: str = Field(default="Performance Review", alias="reviewType")
    notes: Optional[str] = None


class EmployeeStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class LeaveStatusAction(BaseModel):
    status: str
    comment: Optional[str] = None


def _collection(handle: Any, name: str):
    if handle is not None:
        return handle
    if db is None:
        return None
    return db[name]


def _require_collection(handle: Any, name: str):
    collection = _collection(handle, name)
    if collection is None:
        raise HTTPException(status_code=503, detail="Database offline")
    return collection


def _ensure_indexes() -> None:
    global _indexes_ready
    if _indexes_ready:
        return

    actions = _collection(hr_actions_collection, "hr_actions")
    balances = _collection(leave_balances_collection, "leave_balances")

    try:
        if actions is not None:
            actions.create_index([("employee_id", 1), ("createdAt", -1)])
            actions.create_index([("action_type", 1), ("createdAt", -1)])
        if balances is not None:
            balances.create_index([("employee_id", 1), ("year", 1)])
    except Exception as exc:
        print(f"[HR_ACTIONS] index creation skipped: {exc}")

    _indexes_ready = True


def _parse_token(authorization: Optional[str]) -> dict:
    if not isinstance(authorization, str) or not authorization.startswith("Bearer "):
        return {}

    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


def _require_hr_actor(
    authorization: Optional[str],
    x_user_id: Optional[str],
    x_user_name: Optional[str],
    x_user_role: Optional[str],
) -> dict:
    payload = _parse_token(authorization)
    header_role = x_user_role if isinstance(x_user_role, str) else ""
    header_user_id = x_user_id if isinstance(x_user_id, str) else ""
    header_user_name = x_user_name if isinstance(x_user_name, str) else ""
    role = str(payload.get("role") or header_role or "").strip().lower()

    if role not in HR_ROLES:
        raise HTTPException(status_code=403, detail="HR/Admin access required")

    return {
        "id": str(payload.get("sub") or header_user_id or ""),
        "name": header_user_name or payload.get("name") or payload.get("fullName") or "",
        "role": role,
    }


def _utc_iso() -> str:
    return datetime.utcnow().isoformat()


def _today_iso() -> str:
    return datetime.now(IST).date().isoformat()


def _current_time_label() -> str:
    return datetime.now(IST).strftime("%I:%M:%S %p")


def _normalize_date(value: Optional[str]) -> str:
    if not isinstance(value, str) or not value:
        return _today_iso()

    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")
    return value


def _normalize_attendance_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized not in ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of Present, Absent, Late, On Leave, or Remote",
        )
    return ATTENDANCE_STATUSES[normalized]


def _normalize_employee_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized not in EMPLOYEE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of Active, Inactive, On Leave, or Remote",
        )
    return EMPLOYEE_STATUSES[normalized]


def _object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value) if ObjectId.is_valid(value) else None
    except Exception:
        return None


def _employee_lookup_query(employee_ref: str) -> dict:
    value = employee_ref.strip()
    clauses: list[dict] = []
    oid = _object_id(value)

    if oid is not None:
        clauses.append({"_id": oid})

    clauses.extend(
        [
            {"id": value},
            {"employee_id": value},
            {"email": value.lower()},
            {"email": value},
        ]
    )
    return {"$or": clauses}


def _employee_search_query(search: Optional[str]) -> dict:
    if not isinstance(search, str) or not search.strip():
        return {}

    pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
    return {
        "$or": [
            {"id": pattern},
            {"employee_id": pattern},
            {"name": pattern},
            {"employee_name": pattern},
            {"fullName": pattern},
            {"email": pattern},
            {"phoneNumber": pattern},
            {"phone_number": pattern},
            {"department": pattern},
            {"manager": pattern},
            {"jobTitle": pattern},
            {"job_title": pattern},
            {"role": pattern},
            {"status": pattern},
        ]
    }


def _serialize_employee(employee: dict) -> dict:
    oid = str(employee.get("_id", ""))
    employee_id = str(employee.get("employee_id") or employee.get("id") or oid)
    role = str(employee.get("role") or employee.get("user_role") or "Employee")
    name = (
        employee.get("name")
        or employee.get("employee_name")
        or employee.get("fullName")
        or employee.get("email")
        or employee_id
        or "Unnamed Employee"
    )

    return {
        "id": employee_id,
        "_id": oid,
        "employee_id": employee_id,
        "name": name,
        "email": employee.get("email", ""),
        "phoneNumber": employee.get("phoneNumber") or employee.get("phone_number") or "",
        "department": employee.get("department") or "Unassigned",
        "manager": employee.get("manager") or "",
        "jobTitle": employee.get("jobTitle") or employee.get("job_title") or role,
        "role": role,
        "status": employee.get("status") or "Active",
        "productivity": employee.get("productivity", 0),
        "joinDate": employee.get("joinDate") or employee.get("join_date") or "",
        "createdAt": employee.get("createdAt") or employee.get("created_at") or "",
    }


def _employee_profile_sources() -> list[tuple[Any, str, str]]:
    return [
        (_collection(employees_list_collection, "employees_list"), "employees_list", "name"),
        (_collection(attendance_employees_collection, "employees"), "employees", "employee_name"),
        (_collection(users_collection, "users"), "users", "fullName"),
    ]


def _employee_activity_sources() -> list[tuple[Any, str, str]]:
    return [
        (_collection(leaves_collection, "leaves"), "leaves", "applied_date"),
        (_collection(attendance_collection, "attendance_logs"), "attendance_logs", "date"),
        (_collection(leave_balances_collection, "leave_balances"), "leave_balances", "updatedAt"),
        (_collection(hr_actions_collection, "hr_actions"), "hr_actions", "createdAt"),
    ]


def _employee_from_activity(doc: dict) -> Optional[dict]:
    employee_id = str(doc.get("employee_id") or doc.get("id") or "").strip()
    employee_name = (
        doc.get("employee_name")
        or doc.get("name")
        or doc.get("fullName")
        or employee_id
    )

    if not employee_id and not employee_name:
        return None

    return {
        "id": employee_id or employee_name,
        "employee_id": employee_id or employee_name,
        "name": employee_name,
        "email": doc.get("email", ""),
        "phoneNumber": doc.get("phoneNumber") or doc.get("phone_number") or "",
        "department": doc.get("department") or "Unassigned",
        "manager": doc.get("manager") or "",
        "jobTitle": doc.get("jobTitle") or doc.get("job_title") or "Employee",
        "role": doc.get("role") or "Employee",
        "status": doc.get("status") if doc.get("status") in EMPLOYEE_STATUSES.values() else "Active",
        "productivity": doc.get("productivity", 0),
        "joinDate": doc.get("joinDate") or doc.get("join_date") or "",
        "createdAt": doc.get("createdAt") or doc.get("created_at") or doc.get("applied_date") or "",
    }


def _employee_seen_keys(employee: dict) -> set[str]:
    keys: set[str] = set()
    for key in ("_id", "id", "employee_id", "email"):
        value = employee.get(key)
        if value:
            keys.add(str(value).strip().lower())
    return {key for key in keys if key}


def _employee_matches_search(employee: dict, search: Optional[str]) -> bool:
    if not isinstance(search, str) or not search.strip():
        return True

    query = search.strip().lower()
    haystack = " ".join(
        str(employee.get(key) or "")
        for key in (
            "id",
            "employee_id",
            "name",
            "email",
            "phoneNumber",
            "department",
            "manager",
            "jobTitle",
            "role",
            "status",
        )
    ).lower()
    return query in haystack


def _append_employee(
    employees: list[dict],
    seen: set[str],
    raw_employee: dict,
    search: Optional[str],
    limit: int,
) -> None:
    employee = _serialize_employee(raw_employee)
    if employee["role"].strip().lower() == "candidate":
        return
    if not _employee_matches_search(employee, search):
        return

    keys = _employee_seen_keys(employee)
    if keys and seen.intersection(keys):
        return

    employees.append(employee)
    seen.update(keys)


def _list_saved_employees(search: Optional[str], limit: int) -> list[dict]:
    employees: list[dict] = []
    seen: set[str] = set()
    projection = {"face_encoding": 0, "password": 0}
    query = _employee_search_query(search)

    for collection, _, sort_field in _employee_profile_sources():
        if collection is None:
            continue

        docs = list(collection.find(query, projection).sort(sort_field, 1).limit(limit * 2))
        for doc in docs:
            _append_employee(employees, seen, doc, search, limit)
            if len(employees) >= limit:
                return employees

    activity_query = query if query else {}
    for collection, _, sort_field in _employee_activity_sources():
        if collection is None:
            continue

        docs = list(collection.find(activity_query, projection).sort(sort_field, -1).limit(max(limit * 4, 50)))
        for doc in docs:
            activity_employee = _employee_from_activity(doc)
            if not activity_employee:
                continue
            _append_employee(employees, seen, activity_employee, search, limit)
            if len(employees) >= limit:
                return employees

    return employees


def _find_activity_employee(employee_ref: str) -> Optional[dict]:
    value = employee_ref.strip()
    if not value:
        return None

    name_pattern = {"$regex": f"^{re.escape(value)}$", "$options": "i"}
    lookup = {
        "$or": [
            {"id": value},
            {"employee_id": value},
            {"employee_id": value.lower()},
            {"email": value.lower()},
            {"employee_name": name_pattern},
            {"name": name_pattern},
        ]
    }

    for collection, _, sort_field in _employee_activity_sources():
        if collection is None:
            continue
        doc = collection.find_one(lookup, {"face_encoding": 0, "password": 0}, sort=[(sort_field, -1)])
        if not doc:
            continue
        employee = _employee_from_activity(doc)
        if employee:
            return _serialize_employee(employee)

    return None


def _find_employee(employee_ref: str) -> dict:
    query = _employee_lookup_query(employee_ref)
    projection = {"face_encoding": 0}

    for collection, _, sort_field in _employee_profile_sources():
        if collection is None:
            continue
        employee = collection.find_one(query, {**projection, "password": 0}, sort=[(sort_field, 1)])
        if employee:
            return _serialize_employee(employee)

    activity_employee = _find_activity_employee(employee_ref)
    if activity_employee:
        return activity_employee

    raise HTTPException(status_code=404, detail="Employee not found")


def _persist_employee_status(employee: dict, status: str) -> dict:
    now = _utc_iso()
    refs = [employee.get("_id"), employee.get("id"), employee.get("employee_id"), employee.get("email")]

    for collection in (
        _collection(employees_list_collection, "employees_list"),
        _collection(attendance_employees_collection, "employees"),
        _collection(users_collection, "users"),
    ):
        if collection is None:
            continue

        for ref in refs:
            if not ref:
                continue

            updated = collection.find_one_and_update(
                _employee_lookup_query(str(ref)),
                {"$set": {"status": status, "updatedAt": now}},
                return_document=ReturnDocument.AFTER,
                projection={"face_encoding": 0},
            )
            if updated:
                return _serialize_employee(updated)

    return {**employee, "status": status}


def _employee_identifiers(employee: dict) -> list[str]:
    identifiers: list[str] = []
    for key in ("employee_id", "id", "_id", "email"):
        value = employee.get(key)
        if value and str(value) not in identifiers:
            identifiers.append(str(value))
    return identifiers or [employee["id"]]


def _serialize_leave(leave: dict) -> dict:
    internal_status = leave.get("status", MANAGER_PENDING)
    if internal_status in {MANAGER_PENDING, MANAGER_APPROVED, "Pending", "pending"}:
        status = "Pending"
    elif internal_status in {APPROVED, "Approved", "approved"}:
        status = "Approved"
    else:
        status = "Rejected"

    return {
        "id": str(leave["_id"]),
        "employee_id": leave.get("employee_id", ""),
        "employee_name": leave.get("employee_name", ""),
        "department": leave.get("department", ""),
        "leave_type": leave.get("leave_type", ""),
        "duration_type": leave.get("duration_type", ""),
        "leave_date": leave.get("leave_date", ""),
        "days": leave.get("days", 0),
        "reason": leave.get("reason", ""),
        "status": status,
        "internal_status": internal_status,
        "applied_date": leave.get("applied_date", ""),
        "manager_reviewed_at": leave.get("manager_reviewed_at"),
        "hr_reviewed_at": leave.get("hr_reviewed_at"),
    }


def _serialize_balance(balance: Optional[dict], employee_id: str, year: int) -> dict:
    if not balance:
        return {
            "employee_id": employee_id,
            "year": year,
            "earned": 0.0,
            "used": 0.0,
            "remaining": 0.0,
            "exists": False,
        }

    source = balance or {}
    earned = float(source.get("earned", 0.0) or 0)
    used = float(source.get("used", 0.0) or 0)
    remaining = source.get("remaining")
    if remaining is None:
        remaining = max(earned - used, 0.0)

    response = {
        "employee_id": source.get("employee_id", employee_id),
        "year": source.get("year", year),
        "earned": earned,
        "used": used,
        "remaining": float(remaining or 0),
        "exists": True,
    }

    if source.get("_id"):
        response["id"] = str(source["_id"])
    return response


def _serialize_attendance(attendance: Optional[dict], target_date: str) -> dict:
    if not attendance:
        return {
            "date": target_date,
            "value": "Not Marked",
            "status": "Pending",
            "detail": f"No attendance marked for {target_date}",
            "record": None,
        }

    record = {key: value for key, value in attendance.items() if key != "_id"}
    record["id"] = str(attendance["_id"])
    status = attendance.get("status") or "Present"
    check_in = attendance.get("check_in_time") or attendance.get("checkInTime")
    detail = f"Marked at {check_in}" if check_in else f"{status} on {target_date}"

    return {
        "date": attendance.get("date", target_date),
        "value": status,
        "status": "Completed",
        "detail": detail,
        "record": record,
    }


def _serialize_action(action: dict) -> dict:
    return {
        "id": str(action.get("_id") or ""),
        "employee_id": action.get("employee_id", ""),
        "employee_name": action.get("employee_name", ""),
        "action_type": action.get("action_type", ""),
        "status": action.get("status", ""),
        "details": action.get("details", {}),
        "createdAt": action.get("createdAt", ""),
        "createdBy": action.get("createdBy", {}),
    }


def _find_attendance(employee: dict, target_date: str) -> Optional[dict]:
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        return None

    identifiers = _employee_identifiers(employee)
    record = attendance.find_one({"employee_id": {"$in": identifiers}, "date": target_date})
    if record:
        return record

    return attendance.find_one(
        {
            "employee_name": employee.get("name"),
            "date": target_date,
        }
    )


def _find_balance(employee: dict, year: int) -> Optional[dict]:
    balances = _collection(leave_balances_collection, "leave_balances")
    if balances is None:
        return None

    return balances.find_one({"employee_id": {"$in": _employee_identifiers(employee)}, "year": year})


def _pending_leaves(employee: dict, limit: int = 10) -> list[dict]:
    leaves = _collection(leaves_collection, "leaves")
    if leaves is None:
        return []

    docs = (
        leaves.find(
            {
                "employee_id": {"$in": _employee_identifiers(employee)},
                "status": {"$in": list(PENDING_LEAVE_STATUSES)},
            }
        )
        .sort("applied_date", -1)
        .limit(limit)
    )
    return [_serialize_leave(doc) for doc in docs]


def _recent_actions(employee: dict, limit: int = 10) -> list[dict]:
    actions = _collection(hr_actions_collection, "hr_actions")
    if actions is None:
        return []

    docs = (
        actions.find({"employee_id": {"$in": _employee_identifiers(employee)}})
        .sort("createdAt", -1)
        .limit(limit)
    )
    return [_serialize_action(doc) for doc in docs]


def _record_action(employee: dict, actor: dict, action_type: str, status: str, details: dict) -> dict:
    actions = _require_collection(hr_actions_collection, "hr_actions")
    doc = {
        "employee_id": employee["employee_id"],
        "employee_ref": employee.get("_id"),
        "employee_name": employee.get("name", ""),
        "action_type": action_type,
        "status": status,
        "details": details,
        "createdAt": _utc_iso(),
        "createdBy": actor,
    }
    result = actions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_action(doc)


def _normalize_leave_action_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized in {"approved", "approve"}:
        return APPROVED
    if normalized in {"rejected", "reject"}:
        return REJECTED
    raise HTTPException(status_code=400, detail="Status must be approved or rejected")


def _leave_year(leave: dict) -> int:
    leave_date = str(leave.get("leave_date") or "")
    try:
        return datetime.strptime(leave_date, "%Y-%m-%d").year
    except ValueError:
        return datetime.utcnow().year


def _employee_for_leave(leave: dict) -> dict:
    employee_ref = str(leave.get("employee_id") or "").strip()
    if employee_ref:
        try:
            return _find_employee(employee_ref)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    employee = _employee_from_activity(leave)
    if employee:
        return _serialize_employee(employee)

    raise HTTPException(status_code=404, detail="Employee not found for leave request")


def _apply_approved_leave_balance(employee: dict, leave: dict, actor: dict) -> dict:
    balances = _require_collection(leave_balances_collection, "leave_balances")
    year = _leave_year(leave)
    days = float(leave.get("days", 0) or 0)
    existing = _find_balance(employee, year)
    current = _serialize_balance(existing, employee["employee_id"], year)
    updated = {
        "earned": current["earned"],
        "used": round(current["used"] + days, 2),
        "remaining": round(max(current["remaining"] - days, 0.0), 2),
    }
    persisted_employee_id = (
        existing.get("employee_id")
        if existing
        else leave.get("employee_id") or employee["employee_id"]
    )
    now = _utc_iso()
    query = {"_id": existing["_id"]} if existing else {"employee_id": persisted_employee_id, "year": year}
    balance = balances.find_one_and_update(
        query,
        {
            "$set": {
                "employee_id": persisted_employee_id,
                "year": year,
                **updated,
                "updatedAt": now,
                "updatedBy": actor,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_balance(balance, employee["employee_id"], year)


def _build_employee_summary(employee: dict, target_date: str) -> dict:
    year = int(target_date[:4])
    attendance = _serialize_attendance(_find_attendance(employee, target_date), target_date)
    balance = _serialize_balance(_find_balance(employee, year), employee["employee_id"], year)
    leaves = _pending_leaves(employee)
    actions = _recent_actions(employee)

    return {
        "employee": employee,
        "cards": {
            "attendance": {
                "title": "Attendance",
                "value": attendance["value"],
                "detail": attendance["detail"],
                "status": attendance["status"],
            },
            "leaveBalance": {
                "title": "Leave Balance",
                "value": f"{balance['remaining']:g} days" if balance["exists"] else "Not Set",
                "detail": (
                    f"Earned {balance['earned']:g}, Used {balance['used']:g}"
                    if balance["exists"]
                    else f"No leave balance record for {year}"
                ),
                "status": "In Progress" if balance["exists"] else "Pending",
            },
            "pendingRequests": {
                "title": "Pending Requests",
                "value": str(len(leaves)),
                "detail": "Leave requests awaiting review" if leaves else "No pending requests",
                "status": "Pending" if leaves else "Completed",
            },
        },
        "attendance": attendance,
        "leaveBalance": balance,
        "pendingRequests": {
            "count": len(leaves),
            "leaves": leaves,
            "profileUpdates": [],
        },
        "availableActions": [
            {
                "key": "update_status",
                "label": "Update Status",
                "method": "PATCH",
                "endpoint": f"/api/hr-actions/employees/{employee['id']}/status",
                "enabled": True,
            },
            {
                "key": "approve_leave",
                "label": "Approve Leave",
                "method": "PATCH",
                "endpoint": "/api/hr-actions/leaves/{leave_id}/status",
                "enabled": any(leave["internal_status"] == MANAGER_APPROVED for leave in leaves),
            },
            {
                "key": "adjust_leave_balance",
                "label": "Adjust Leave Balance",
                "method": "PATCH",
                "endpoint": f"/api/hr-actions/employees/{employee['id']}/leave-balance",
                "enabled": True,
            },
            {
                "key": "mark_attendance",
                "label": "Mark Attendance",
                "method": "POST",
                "endpoint": f"/api/hr-actions/employees/{employee['id']}/attendance",
                "enabled": True,
            },
            {
                "key": "schedule_review",
                "label": "Schedule Review",
                "method": "POST",
                "endpoint": f"/api/hr-actions/employees/{employee['id']}/reviews",
                "enabled": True,
            },
        ],
        "recentActions": actions,
    }


@router.get("/employees")
def list_hr_action_employees(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    if db is None:
        raise HTTPException(status_code=503, detail="Database offline")

    data = _list_saved_employees(search, limit)
    return {"success": True, "count": len(data), "data": data}


@router.get("/employees/{employee_id}")
def get_hr_action_employee_summary(
    employee_id: str,
    date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    return {"success": True, **_build_employee_summary(employee, _normalize_date(date))}


@router.get("/employees/{employee_id}/actions")
def get_employee_hr_actions(
    employee_id: str,
    limit: int = Query(default=25, ge=1, le=100),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    return {"success": True, "data": _recent_actions(employee, limit)}


@router.patch("/leaves/{leave_id}/status")
def update_leave_from_hr_actions(
    leave_id: str,
    body: LeaveStatusAction,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    leaves = _require_collection(leaves_collection, "leaves")
    oid = _object_id(leave_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid leave ID")

    leave = leaves.find_one({"_id": oid})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    current_status = str(leave.get("status") or MANAGER_PENDING)
    if current_status != MANAGER_APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Only manager-approved leaves can be reviewed by HR",
        )

    next_status = _normalize_leave_action_status(body.status)
    now = _utc_iso()
    # Require a non-empty comment from HR
    if not body.comment or not body.comment.strip():
        raise HTTPException(status_code=400, detail="HR comment is required")

    updates = {
        "status": next_status,
        "hr_reviewed_at": now,
        "hr_comment": body.comment.strip(),
    }
    updated_leave = leaves.find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    employee = _employee_for_leave(updated_leave or {**leave, **updates})
    balance = None

    if next_status == APPROVED:
        balance = _apply_approved_leave_balance(employee, leave, actor)

    action = _record_action(
        employee,
        actor,
        "approve_leave" if next_status == APPROVED else "reject_leave",
        "completed",
        {
            "leave_id": leave_id,
            "status": next_status,
            "comment": body.comment.strip() if body.comment else None,
            "days": leave.get("days", 0),
            "leave_date": leave.get("leave_date", ""),
            "leave_type": leave.get("leave_type", ""),
            "leaveBalance": balance,
        },
    )

    return {
        "success": True,
        "message": "Leave approved" if next_status == APPROVED else "Leave rejected",
        "leave": _serialize_leave(updated_leave or {**leave, **updates}),
        "leaveBalance": balance,
        "action": action,
        "summary": _build_employee_summary(employee, _today_iso()),
    }


@router.patch("/employees/{employee_id}/status")
def update_employee_status(
    employee_id: str,
    body: EmployeeStatusUpdate,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    status = _normalize_employee_status(body.status)
    updated_employee = _persist_employee_status(employee, status)
    action = _record_action(
        updated_employee,
        actor,
        "update_status",
        "completed",
        {
            "previousStatus": employee.get("status"),
            "status": status,
            "reason": body.reason.strip() if body.reason else None,
        },
    )

    return {
        "success": True,
        "message": "Employee status updated",
        "employee": updated_employee,
        "action": action,
        "summary": _build_employee_summary(updated_employee, _today_iso()),
    }


@router.post("/employees/{employee_id}/attendance")
def mark_employee_attendance(
    employee_id: str,
    body: AttendanceMarkRequest,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    attendance = _require_collection(attendance_collection, "attendance_logs")
    target_date = _normalize_date(body.date)
    status = _normalize_attendance_status(body.status)

    update = {
        "employee_id": employee["employee_id"],
        "employee_name": employee["name"],
        "department": employee.get("department", ""),
        "date": target_date,
        "status": status,
        "shift": body.shift or "Manual",
        "updatedAt": _utc_iso(),
        "updatedBy": actor,
        "source": "hr_actions",
    }

    if status in {"Present", "Late", "Remote"}:
        update["check_in_time"] = body.check_in_time or _current_time_label()
    elif body.check_in_time:
        update["check_in_time"] = body.check_in_time

    if body.check_out_time:
        update["check_out_time"] = body.check_out_time
        update["check_out_status"] = "Checked Out"

    if body.note:
        update["hr_note"] = body.note.strip()

    existing = _find_attendance(employee, target_date)
    query = {"_id": existing["_id"]} if existing else {"employee_id": employee["employee_id"], "date": target_date}
    record = attendance.find_one_and_update(
        query,
        {
            "$set": update,
            "$setOnInsert": {"createdAt": _utc_iso()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    action = _record_action(
        employee,
        actor,
        "mark_attendance",
        "completed",
        {
            "date": target_date,
            "status": status,
            "attendance_id": str(record["_id"]),
            "note": body.note,
        },
    )

    return {
        "success": True,
        "message": "Attendance updated",
        "attendance": _serialize_attendance(record, target_date)["record"],
        "action": action,
        "summary": _build_employee_summary(employee, target_date),
    }


@router.patch("/employees/{employee_id}/leave-balance")
def adjust_employee_leave_balance(
    employee_id: str,
    body: LeaveBalanceAdjustment,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    balances = _require_collection(leave_balances_collection, "leave_balances")
    year = body.year or datetime.utcnow().year
    existing = _find_balance(employee, year)
    current = _serialize_balance(existing, employee["employee_id"], year)
    updated = {
        "earned": current["earned"],
        "used": current["used"],
        "remaining": current["remaining"],
    }

    has_change = False
    for key in ("earned", "used", "remaining"):
        value = getattr(body, key)
        if value is not None:
            updated[key] = float(value)
            has_change = True

    delta_map = {
        "earned": body.earned_delta,
        "used": body.used_delta,
        "remaining": body.remaining_delta,
    }
    for key, delta in delta_map.items():
        if delta is not None:
            updated[key] = updated[key] + float(delta)
            has_change = True

    if not has_change:
        raise HTTPException(status_code=400, detail="Provide at least one leave balance change")

    if body.remaining is None and body.remaining_delta is None and (
        body.earned is not None
        or body.used is not None
        or body.earned_delta is not None
        or body.used_delta is not None
    ):
        updated["remaining"] = updated["earned"] - updated["used"]

    for key in updated:
        updated[key] = round(max(updated[key], 0.0), 2)

    now = _utc_iso()
    persisted_employee_id = existing.get("employee_id") if existing else employee["employee_id"]
    query = {"_id": existing["_id"]} if existing else {"employee_id": persisted_employee_id, "year": year}
    balance = balances.find_one_and_update(
        query,
        {
            "$set": {
                "employee_id": persisted_employee_id,
                "year": year,
                **updated,
                "updatedAt": now,
                "updatedBy": actor,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    action = _record_action(
        employee,
        actor,
        "adjust_leave_balance",
        "completed",
        {
            "year": year,
            "reason": body.reason.strip(),
            "before": current,
            "after": _serialize_balance(balance, employee["employee_id"], year),
        },
    )

    return {
        "success": True,
        "message": "Leave balance updated",
        "leaveBalance": _serialize_balance(balance, employee["employee_id"], year),
        "action": action,
    }


@router.post("/employees/{employee_id}/reviews")
def schedule_employee_review(
    employee_id: str,
    body: ReviewScheduleRequest,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(employee_id)
    review_date = _normalize_date(body.review_date)
    action = _record_action(
        employee,
        actor,
        "schedule_review",
        "scheduled",
        {
            "reviewDate": review_date,
            "reviewType": body.review_type.strip() or "Performance Review",
            "notes": body.notes.strip() if body.notes else None,
        },
    )

    return {"success": True, "message": "Review scheduled", "action": action}
