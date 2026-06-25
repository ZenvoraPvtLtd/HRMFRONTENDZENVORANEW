from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.core.database import (
    attendance_collection,
    db,
    employees_collection,
    employees_list_collection,
    timesheet_approvals_collection,
    users_collection,
)

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = "HS256"
HR_ROLES = {"hr", "admin", "manager"}
APPROVAL_STATUSES = {"Submitted", "Pending", "Approved", "Rejected"}

_indexes_ready = False


class TimesheetStatusUpdate(BaseModel):
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

    try:
        attendance = _collection(attendance_collection, "attendance_logs")
        approvals = _collection(timesheet_approvals_collection, "timesheet_approvals")
        if attendance is not None:
            attendance.create_index([("employee_id", 1), ("date", 1)])
        if approvals is not None:
            approvals.create_index([("employee_id", 1), ("year", 1), ("month", 1)], unique=True)
            approvals.create_index([("status", 1), ("updatedAt", -1)])
    except Exception as exc:
        print(f"[TIMESHEETS] index creation skipped: {exc}")

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
    role = str(payload.get("role") or x_user_role or "").strip().lower()
    if role not in HR_ROLES:
        raise HTTPException(status_code=403, detail="HR/Admin access required")

    return {
        "id": str(payload.get("sub") or x_user_id or ""),
        "name": str(x_user_name or payload.get("name") or payload.get("fullName") or ""),
        "role": role,
    }


def _utc_iso() -> str:
    return datetime.utcnow().isoformat()


def _month_name(month: int) -> str:
    return datetime(2000, month, 1).strftime("%B")


def _month_range(year: int, month: int) -> tuple[str, str]:
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"
    return start, end


def _normalize_status(status: str) -> str:
    cleaned = status.strip().lower().replace("_", " ")
    mapping = {
        "submitted": "Submitted",
        "pending": "Pending",
        "approved": "Approved",
        "approve": "Approved",
        "rejected": "Rejected",
        "reject": "Rejected",
    }
    if cleaned not in mapping:
        raise HTTPException(
            status_code=400,
            detail="Status must be Submitted, Pending, Approved, or Rejected",
        )
    return mapping[cleaned]


def _employee_id(doc: dict) -> str:
    return str(
        doc.get("employeeId")
        or doc.get("employee_id")
        or doc.get("id")
        or doc.get("_id")
        or doc.get("email")
        or ""
    ).strip()


def _employee_name(doc: dict, fallback_id: str) -> str:
    return str(
        doc.get("employee_name")
        or doc.get("name")
        or doc.get("fullName")
        or doc.get("email")
        or fallback_id
        or "Unnamed Employee"
    )


def _serialize_employee(doc: dict) -> dict:
    employee_id = _employee_id(doc)
    name = (
        doc.get("employee_name")        # from attendance_logs
        or doc.get("fullName")          # from users collection
        or doc.get("name")              # fallback
        or doc.get("email")
        or employee_id
        or "Unnamed Employee"
    )
    department = (
        doc.get("department")
        or doc.get("dept")
        or None                         # keep None so merge can fill it in
    )
    return {
        "employeeId": employee_id,
        "employee": str(name),
        "email": str(doc.get("email") or ""),
        "department": str(department) if department else "",
    }


def _merge_employee(target: dict[str, dict], doc: dict) -> None:
    employee = _serialize_employee(doc)
    employee_id = employee["employeeId"]
    if not employee_id:
        return

    existing = target.get(employee_id, {})
    target[employee_id] = {
        "employeeId": employee_id,
        "employee": existing.get("employee") or employee["employee"],
        "email": existing.get("email") or employee["email"],
        "department": existing.get("department") or employee["department"],
    }


def _load_employees(attendance_docs: list[dict]) -> dict[str, dict]:
    employees: dict[str, dict] = {}
    projection = {"password": 0, "face_encoding": 0}

    for collection, sort_field in (
        (_collection(users_collection, "users"), "fullName"),
        (_collection(employees_list_collection, "employees_list"), "name"),
        (_collection(employees_collection, "employees"), "employee_name"),
    ):
        if collection is None:
            continue
        for doc in collection.find({}, projection).sort(sort_field, 1):
            if str(doc.get("role", "")).strip().lower() == "candidate":
                continue
            _merge_employee(employees, doc)

    for doc in attendance_docs:
        _merge_employee(employees, doc)

    return employees


def _parse_time(date_value: str, value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not value.strip():
        return None

    text = value.strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%I:%M:%S %p", "%I:%M %p", "%H:%M:%S", "%H:%M"):
        try:
            if fmt.startswith("%Y"):
                return datetime.strptime(text[:19], fmt)
            parsed = datetime.strptime(text, fmt)
            base = datetime.strptime(date_value, "%Y-%m-%d")
            return base.replace(hour=parsed.hour, minute=parsed.minute, second=parsed.second)
        except ValueError:
            continue
    return None


def _number_hours(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None

    text = value.strip().lower().replace("hours", "h").replace("hrs", "h")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        pass

    hours = 0.0
    for part in text.split():
        try:
            if part.endswith("h"):
                hours += float(part[:-1])
            elif part.endswith("m"):
                hours += float(part[:-1]) / 60
        except ValueError:
            continue
    return hours if hours else None


def _attendance_hours(doc: dict) -> float:
    for key in ("hours", "total_hours", "totalHours", "work_hours", "worked_hours", "duration"):
        value = _number_hours(doc.get(key))
        if value is not None:
            return max(value, 0.0)

    date_value = str(doc.get("date") or "")
    check_in = _parse_time(date_value, doc.get("check_in_time") or doc.get("checkInTime"))
    check_out = _parse_time(date_value, doc.get("check_out_time") or doc.get("checkOutTime"))
    if not check_in or not check_out:
        return 0.0

    delta = (check_out - check_in).total_seconds() / 3600
    return round(max(delta, 0.0), 2)


def _load_approvals(year: int, month: int) -> dict[str, dict]:
    approvals = _collection(timesheet_approvals_collection, "timesheet_approvals")
    if approvals is None:
        return {}

    docs = approvals.find({"year": year, "month": month})
    return {str(doc.get("employee_id")): doc for doc in docs if doc.get("employee_id")}


def _build_records(year: int, month: int) -> list[dict]:
    attendance = _require_collection(attendance_collection, "attendance_logs")
    start, end = _month_range(year, month)
    attendance_docs = list(attendance.find({"date": {"$gte": start, "$lt": end}}))
    employees = _load_employees(attendance_docs)
    approvals = _load_approvals(year, month)

    by_employee: dict[str, dict] = {}
    for doc in attendance_docs:
        employee_id = _employee_id(doc)
        if not employee_id:
            continue

        row = by_employee.setdefault(
            employee_id,
            {
                "employeeId": employee_id,
                "hours": 0.0,
                "attendanceCount": 0,
                "dates": [],
            },
        )
        row["hours"] += _attendance_hours(doc)
        row["attendanceCount"] += 1
        if doc.get("date"):
            row["dates"].append(doc["date"])
        _merge_employee(employees, doc)

    records: list[dict] = []
    for employee_id, employee in employees.items():
        timesheet = by_employee.get(employee_id)
        approval = approvals.get(employee_id)
        has_submission = bool(timesheet and timesheet["attendanceCount"] > 0)
        status = approval.get("status") if approval else None
        if not status:
            status = "Submitted" if has_submission else "Not Submitted"

        records.append(
            {
                "id": f"{employee_id}:{year}:{month:02d}",
                "employeeId": employee_id,
                "employee": employee["employee"],
                "email": employee["email"],
                "department": employee["department"],
                "month": _month_name(month),
                "monthNumber": month,
                "year": str(year),
                "status": status,
                "submitted": has_submission,
                "hours": round((timesheet or {}).get("hours", 0.0), 2),
                "attendanceCount": (timesheet or {}).get("attendanceCount", 0),
                "dates": sorted((timesheet or {}).get("dates", [])),
                "approvalComment": approval.get("comment") if approval else None,
                "reviewedAt": approval.get("updatedAt") if approval else None,
                "reviewedBy": approval.get("updatedBy") if approval else None,
            }
        )

    records.sort(key=lambda item: (item["employee"].lower(), item["employeeId"]))
    # Only return employees who actually have attendance records
    return [r for r in records if r["submitted"] or r["status"] not in ("Not Submitted",)]


def _matches(record: dict, search: Optional[str], department: Optional[str], status: Optional[str], submitted_only: bool) -> bool:
    if submitted_only and not record["submitted"]:
        return False
    if department and department != "All Departments" and record["department"] != department:
        return False
    if status and status != "All Status" and record["status"] != status:
        return False

    if isinstance(search, str) and search.strip():
        query = search.strip().lower()
        haystack = " ".join(
            str(record.get(key) or "")
            for key in ("employee", "email", "employeeId", "department", "status")
        ).lower()
        return query in haystack

    return True


def _summary(records: list[dict]) -> dict:
    return {
        "total": len(records),
        "submitted": sum(1 for record in records if record["submitted"]),
        "notSubmitted": sum(1 for record in records if not record["submitted"]),
        "pending": sum(1 for record in records if record["status"] == "Pending"),
        "approved": sum(1 for record in records if record["status"] == "Approved"),
        "rejected": sum(1 for record in records if record["status"] == "Rejected"),
    }


@router.get("/approvals")
def list_timesheet_approvals(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    search: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    submitted_only: bool = Query(default=True),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    records = _build_records(year, month)
    filtered = [
        record
        for record in records
        if _matches(record, search, department, status, submitted_only)
    ]
    departments = sorted({record["department"] for record in records if record["department"]})

    return {
        "success": True,
        "month": month,
        "monthName": _month_name(month),
        "year": year,
        "summary": _summary(records),
        "departments": departments,
        "data": filtered,
    }


@router.patch("/approvals/{employee_id}/status")
def update_timesheet_status(
    employee_id: str,
    body: TimesheetStatusUpdate,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    records = _build_records(year, month)
    record = next((item for item in records if item["employeeId"] == employee_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Timesheet record not found")
    if not record["submitted"]:
        raise HTTPException(status_code=400, detail="Cannot update a timesheet that was not submitted")

    status = _normalize_status(body.status)
    approvals = _require_collection(timesheet_approvals_collection, "timesheet_approvals")
    now = _utc_iso()
    approval = approvals.find_one_and_update(
        {"employee_id": employee_id, "year": year, "month": month},
        {
            "$set": {
                "employee_id": employee_id,
                "employee_name": record["employee"],
                "email": record["email"],
                "department": record["department"],
                "year": year,
                "month": month,
                "status": status,
                "comment": body.comment.strip() if body.comment else None,
                "hours": record["hours"],
                "attendanceCount": record["attendanceCount"],
                "updatedAt": now,
                "updatedBy": actor,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    updated = {**record, "status": approval["status"], "approvalComment": approval.get("comment"), "reviewedAt": approval.get("updatedAt"), "reviewedBy": approval.get("updatedBy")}
    return {
        "success": True,
        "message": f"Timesheet {status.lower()}",
        "data": updated,
    }
