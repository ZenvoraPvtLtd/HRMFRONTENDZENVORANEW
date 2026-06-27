import os
from datetime import datetime, timedelta
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, Query
from jose import JWTError, jwt

from app.core.database import (
    attendance_collection,
    db,
    employees_collection,
    employees_list_collection,
    users_collection,
)

router = APIRouter(prefix="/api/manager/attendance", tags=["manager-attendance"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
LATE_AFTER_HOUR = 10
LATE_AFTER_MINUTE = 15


def _collection(handle: Any, name: str):
    if handle is not None:
        return handle
    if db is None:
        return None
    return db[name]


def _parse_actor(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        return {}

    try:
        token = authorization.split(" ", 1)[1]
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


def _date_list(start: str, end: str) -> list[str]:
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        today = datetime.now().date()
        return [today.isoformat()]

    if end_date < start_date:
        start_date, end_date = end_date, start_date

    max_days = 31
    dates = []
    current = start_date
    while current <= end_date and len(dates) < max_days:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def _employee_id(doc: dict) -> str:
    return str(
        doc.get("employeeId")
        or doc.get("employee_id")
        or doc.get("userId")
        or doc.get("id")
        or doc.get("_id")
        or doc.get("email")
        or ""
    ).strip()


def _employee_name(doc: dict, fallback: str) -> str:
    return str(
        doc.get("employee_name")
        or doc.get("name")
        or doc.get("fullName")
        or doc.get("email")
        or fallback
        or "Unnamed Employee"
    )


def _normalize_role(role: str) -> str:
    cleaned = str(role or "").strip().lower()
    if cleaned in {"admin", "superadmin"}:
        return "Admin"
    if cleaned == "hr" or "hr" in cleaned:
        return "HR"
    if cleaned in {"manager", "team manager"}:
        return "Manager"
    if cleaned == "candidate":
        return "Candidate"
    return "Employee"


def _employee_role(doc: dict) -> str:
    raw = doc.get("role") or doc.get("jobTitle") or doc.get("designation")
    if raw:
        return _normalize_role(str(raw))
    return "Employee"


def _manager_matches(doc: dict, manager_id: str) -> bool:
    if not manager_id:
        return True

    possible = {
        str(doc.get("manager_id") or ""),
        str(doc.get("managerId") or ""),
        str(doc.get("manager") or ""),
        str(doc.get("assignedManagerId") or ""),
    }
    return manager_id in possible


def _merge_employee(target: dict[str, dict], doc: dict, manager_id: str) -> None:
    if not _manager_matches(doc, manager_id):
        return

    role = str(doc.get("role") or "").strip().lower()
    if role == "candidate":
        return

    employee_id = _employee_id(doc)
    if not employee_id:
        return

    existing = target.get(employee_id, {})
    doc_role = _employee_role(doc)
    existing_role = existing.get("role")
    if existing_role and _normalize_role(existing_role) != "Employee":
        resolved_role = existing_role
    elif doc_role != "Employee":
        resolved_role = doc_role
    else:
        resolved_role = existing_role or doc_role

    target[employee_id] = {
        "employeeId": employee_id,
        "name": existing.get("name") or _employee_name(doc, employee_id),
        "role": resolved_role,
        "department": existing.get("department") or doc.get("department") or "Unassigned",
        "shift": existing.get("shift") or doc.get("shift") or "10:00 AM - 07:00 PM",
        "workMode": existing.get("workMode") or doc.get("workMode") or doc.get("mode") or "On-site",
        "email": existing.get("email") or doc.get("email") or "",
    }


def _load_employees(manager_id: str, attendance_docs: list[dict]) -> dict[str, dict]:
    employees: dict[str, dict] = {}
    projection = {"password": 0, "face_encoding": 0}
    sources = (
        (_collection(users_collection, "users"), "fullName"),
        (_collection(employees_list_collection, "employees_list"), "name"),
        (_collection(employees_collection, "employees"), "employee_name"),
    )

    for collection, sort_field in sources:
        if collection is None:
            continue
        for doc in collection.find({}, projection).sort(sort_field, 1):
            _merge_employee(employees, doc, manager_id)

    for doc in attendance_docs:
        _merge_employee(employees, doc, "")

    if manager_id and not employees:
        return _load_employees("", attendance_docs)

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


def _status_for_record(date_value: str, record: Optional[dict]) -> str:
    if not record:
        return "Absent"

    raw_status = str(record.get("attendanceStatus") or record.get("status") or "").strip().lower()
    if raw_status in {"absent", "leave", "holiday"}:
        return raw_status.title()

    check_in = _parse_time(date_value, record.get("check_in_time") or record.get("checkInTime") or record.get("clockIn"))
    if not check_in:
        return "Present"

    late_at = check_in.replace(hour=LATE_AFTER_HOUR, minute=LATE_AFTER_MINUTE, second=0, microsecond=0)
    return "Late" if check_in > late_at else "On Time"


def _clock_value(record: Optional[dict], *keys: str) -> str:
    if not record:
        return "Absent"
    for key in keys:
        value = record.get(key)
        if value:
            return str(value)
    return "--"


@router.get("")
def list_manager_attendance(
    start: str = Query(...),
    end: Optional[str] = Query(None),
    status: str = Query("All"),
    member: str = Query("All Team Members"),
    search: str = Query(""),
    authorization: Optional[str] = Header(None),
):
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        return {"data": [], "summary": {"total": 0, "checkedIn": 0, "active": 0}, "message": "Database offline"}

    dates = _date_list(start, end or start)
    docs = list(attendance.find({"date": {"$gte": dates[0], "$lte": dates[-1]}}))
    actor = _parse_actor(authorization)
    actor_id = str(actor.get("sub") or "")
    manager_id = actor_id if str(actor.get("role") or "").lower() == "manager" else ""
    employees = _load_employees(manager_id, docs)
    rows = []
    for record in docs:
        employee_id = _employee_id(record)
        date_value = str(record.get("date") or "")
        if not employee_id or not date_value:
            continue

        employee = employees.get(employee_id) or {
            "employeeId": employee_id,
            "name": _employee_name(record, employee_id),
            "role": _employee_role(record),
            "department": record.get("department") or "Unassigned",
            "shift": record.get("shift") or "10:00 AM - 07:00 PM",
            "workMode": record.get("workMode") or record.get("mode") or "On-site",
            "email": record.get("email") or "",
        }

        row_status = _status_for_record(date_value, record)
        rows.append(
            {
                "id": str(record.get("_id") or f"{employee_id}:{date_value}"),
                "employeeId": employee_id,
                "name": employee["name"],
                "role": employee["role"],
                "department": employee["department"],
                "shift": record.get("shift") or employee["shift"],
                "workMode": record.get("workMode") or record.get("mode") or employee["workMode"],
                "status": row_status,
                "clockIn": _clock_value(record, "check_in_time", "checkInTime", "clockIn"),
                "clockOut": _clock_value(record, "check_out_time", "checkOutTime", "clockOut"),
                "date": date_value,
            }
        )

    query = search.strip().lower()
    if query:
        rows = [
            row for row in rows
            if query in " ".join(str(row.get(key) or "") for key in ("name", "role", "department", "status", "employeeId")).lower()
        ]

    if member != "All Team Members":
        rows = [row for row in rows if row["name"] == member or row["employeeId"] == member]

    if status != "All":
        rows = [row for row in rows if row["status"] == status]

    rows.sort(key=lambda item: (item["date"], item["name"].lower()))

    member_options = {
        row["employeeId"]: {"id": row["employeeId"], "name": row["name"]}
        for row in rows
    }

    return {
        "data": rows,
        "members": sorted(member_options.values(), key=lambda item: item["name"].lower()),
        "summary": {
            "total": len(rows),
            "checkedIn": sum(1 for row in rows if row["clockIn"] != "Absent"),
            "active": sum(1 for row in rows if row["status"] in {"On Time", "Late", "Present"}),
        },
    }
