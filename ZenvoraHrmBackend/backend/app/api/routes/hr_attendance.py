from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

import pytz
from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ReturnDocument

from app.core.database import (
    attendance_collection,
    db,
    employees_collection,
    employees_list_collection,
    hr_actions_collection,
    users_collection,
)

router = APIRouter(prefix="/api/hr/attendance", tags=["hr-attendance"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
HR_ROLES = {"admin", "hr"}
IST = pytz.timezone("Asia/Kolkata")

ATTENDANCE_STATUSES = {
    "present": "Present",
    "absent": "Absent",
    "late": "Late",
    "on leave": "On Leave",
    "remote": "Remote",
}
WORK_MODES = {"on-site", "remote", "hybrid"}
TIME_PATTERN = re.compile(
    r"^(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?|\d{2}:\d{2}(?::\d{2})?)$",
    re.IGNORECASE,
)
LATE_AFTER_HOUR = 10
LATE_AFTER_MINUTE = 15

_indexes_ready = False


class AttendanceCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    employee_id: str = Field(..., min_length=1, max_length=120)
    date: str = Field(..., min_length=10, max_length=10)
    status: str = Field(default="Present", min_length=1, max_length=40)
    check_in_time: Optional[str] = Field(default=None, alias="checkInTime", max_length=32)
    check_out_time: Optional[str] = Field(default=None, alias="checkOutTime", max_length=32)
    shift: Optional[str] = Field(default=None, max_length=80)
    work_mode: Optional[str] = Field(default="On-site", alias="workMode", max_length=40)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Date must be in YYYY-MM-DD format") from exc
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ATTENDANCE_STATUSES:
            raise ValueError("Status must be Present, Absent, Late, On Leave, or Remote")
        return ATTENDANCE_STATUSES[normalized]

    @field_validator("check_in_time", "check_out_time")
    @classmethod
    def validate_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        cleaned = str(value).strip()
        if not TIME_PATTERN.match(cleaned):
            raise ValueError("Time must be HH:MM, HH:MM:SS, or 12-hour format with AM/PM")
        return cleaned

    @field_validator("work_mode")
    @classmethod
    def validate_work_mode(cls, value: Optional[str]) -> str:
        cleaned = str(value or "On-site").strip()
        normalized = cleaned.lower().replace("_", "-")
        if normalized not in WORK_MODES:
            raise ValueError("Work mode must be On-site, Remote, or Hybrid")
        return {"on-site": "On-site", "remote": "Remote", "hybrid": "Hybrid"}[normalized]

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_times(self) -> "AttendanceCreateRequest":
        if self.check_in_time and self.check_out_time:
            check_in = _parse_time(self.date, self.check_in_time)
            check_out = _parse_time(self.date, self.check_out_time)
            if check_in and check_out and check_out <= check_in:
                raise ValueError("Check-out time must be after check-in time")
        return self


class AttendanceUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: Optional[str] = Field(default=None, min_length=10, max_length=10)
    status: Optional[str] = Field(default=None, min_length=1, max_length=40)
    check_in_time: Optional[str] = Field(default=None, alias="checkInTime", max_length=32)
    check_out_time: Optional[str] = Field(default=None, alias="checkOutTime", max_length=32)
    shift: Optional[str] = Field(default=None, max_length=80)
    work_mode: Optional[str] = Field(default=None, alias="workMode", max_length=40)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("Date must be in YYYY-MM-DD format") from exc
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ATTENDANCE_STATUSES:
            raise ValueError("Status must be Present, Absent, Late, On Leave, or Remote")
        return ATTENDANCE_STATUSES[normalized]

    @field_validator("check_in_time", "check_out_time")
    @classmethod
    def validate_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        cleaned = str(value).strip()
        if not TIME_PATTERN.match(cleaned):
            raise ValueError("Time must be HH:MM, HH:MM:SS, or 12-hour format with AM/PM")
        return cleaned

    @field_validator("work_mode")
    @classmethod
    def validate_work_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower().replace("_", "-")
        if normalized not in WORK_MODES:
            raise ValueError("Work mode must be On-site, Remote, or Hybrid")
        return {"on-site": "On-site", "remote": "Remote", "hybrid": "Hybrid"}[normalized]

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


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

    attendance = _collection(attendance_collection, "attendance_logs")
    try:
        if attendance is not None:
            attendance.create_index([("employee_id", 1), ("date", 1)], unique=False)
            attendance.create_index([("date", 1)])
    except Exception as exc:
        print(f"[HR_ATTENDANCE] index creation skipped: {exc}")

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
        "name": x_user_name or payload.get("name") or payload.get("fullName") or "",
        "role": role,
    }


def _utc_iso() -> str:
    return datetime.utcnow().isoformat()


def _today_iso() -> str:
    return datetime.now(IST).date().isoformat()


def _current_time_label() -> str:
    return datetime.now(IST).strftime("%I:%M:%S %p")


def _object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value) if ObjectId.is_valid(value) else None
    except Exception:
        return None


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


def _employee_name(doc: dict, fallback: str = "") -> str:
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
    return "Employee"


def _employee_role(doc: dict) -> str:
    raw = doc.get("role") or doc.get("jobTitle") or doc.get("designation")
    return _normalize_role(str(raw)) if raw else "Employee"


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


def _find_employee(employee_ref: str) -> dict:
    projection = {"password": 0, "face_encoding": 0}
    for collection in (
        _collection(employees_list_collection, "employees_list"),
        _collection(employees_collection, "employees"),
        _collection(users_collection, "users"),
    ):
        if collection is None:
            continue
        doc = collection.find_one(_employee_lookup_query(employee_ref), projection)
        if doc:
            employee_id = _employee_id(doc)
            return {
                "employee_id": employee_id,
                "name": _employee_name(doc, employee_id),
                "email": doc.get("email") or "",
                "department": doc.get("department") or "Unassigned",
                "role": _employee_role(doc),
                "shift": doc.get("shift") or "10:00 AM - 07:00 PM",
                "workMode": doc.get("workMode") or doc.get("mode") or "On-site",
            }

    raise HTTPException(status_code=404, detail="Employee not found")


def _load_all_employees() -> dict[str, dict]:
    employees: dict[str, dict] = {}
    projection = {"password": 0, "face_encoding": 0}

    for collection in (
        _collection(users_collection, "users"),
        _collection(employees_list_collection, "employees_list"),
        _collection(employees_collection, "employees"),
    ):
        if collection is None:
            continue
        for doc in collection.find({}, projection):
            role = str(doc.get("role") or "").strip().lower()
            if role == "candidate":
                continue

            employee_id = _employee_id(doc)
            if not employee_id:
                continue

            existing = employees.get(employee_id, {})
            employees[employee_id] = {
                "employeeId": employee_id,
                "name": existing.get("name") or _employee_name(doc, employee_id),
                "email": existing.get("email") or doc.get("email") or "",
                "department": existing.get("department") or doc.get("department") or "Unassigned",
                "role": existing.get("role") or _employee_role(doc),
                "shift": existing.get("shift") or doc.get("shift") or "10:00 AM - 07:00 PM",
                "workMode": existing.get("workMode") or doc.get("workMode") or doc.get("mode") or "On-site",
            }

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

    raw_status = str(record.get("attendanceStatus") or record.get("status") or "").strip()
    if raw_status in ATTENDANCE_STATUSES.values():
        return raw_status

    normalized = raw_status.lower()
    if normalized in ATTENDANCE_STATUSES:
        return ATTENDANCE_STATUSES[normalized]

    check_in = _parse_time(date_value, record.get("check_in_time") or record.get("checkInTime") or record.get("clockIn"))
    if not check_in:
        return "Present"

    late_at = check_in.replace(hour=LATE_AFTER_HOUR, minute=LATE_AFTER_MINUTE, second=0, microsecond=0)
    return "Late" if check_in > late_at else "Present"


def _clock_value(record: Optional[dict], *keys: str) -> str:
    if not record:
        return "--"
    for key in keys:
        value = record.get(key)
        if value:
            return str(value)
    return "--"


def _serialize_record(record: Optional[dict], employee: Optional[dict] = None, date_value: Optional[str] = None) -> dict:
    if not record and employee and date_value:
        return {
            "id": f"{employee['employeeId']}:{date_value}",
            "recordId": None,
            "employeeId": employee["employeeId"],
            "name": employee["name"],
            "email": employee.get("email", ""),
            "role": employee.get("role", "Employee"),
            "department": employee.get("department", "Unassigned"),
            "shift": employee.get("shift", "10:00 AM - 07:00 PM"),
            "workMode": employee.get("workMode", "On-site"),
            "status": "Absent",
            "clockIn": "--",
            "clockOut": "--",
            "date": date_value,
            "note": "",
            "source": None,
            "marked": False,
        }

    if not record:
        return {}

    employee_id = _employee_id(record)
    date_key = str(record.get("date") or date_value or "")
    employee_info = employee or {}
    return {
        "id": str(record.get("_id") or f"{employee_id}:{date_key}"),
        "recordId": str(record.get("_id")) if record.get("_id") else None,
        "employeeId": employee_id,
        "name": _employee_name(record, employee_info.get("name", employee_id)),
        "email": record.get("email") or employee_info.get("email", ""),
        "role": _employee_role(record) if record.get("role") else employee_info.get("role", "Employee"),
        "department": record.get("department") or employee_info.get("department", "Unassigned"),
        "shift": record.get("shift") or employee_info.get("shift", "10:00 AM - 07:00 PM"),
        "workMode": record.get("workMode") or record.get("mode") or employee_info.get("workMode", "On-site"),
        "status": _status_for_record(date_key, record),
        "clockIn": _clock_value(record, "check_in_time", "checkInTime", "clockIn"),
        "clockOut": _clock_value(record, "check_out_time", "checkOutTime", "clockOut"),
        "date": date_key,
        "note": record.get("hr_note") or record.get("note") or "",
        "source": record.get("source"),
        "marked": True,
        "updatedAt": record.get("updatedAt"),
        "createdAt": record.get("createdAt"),
    }


def _find_record_by_id(attendance, attendance_id: str) -> Optional[dict]:
    oid = _object_id(attendance_id)
    if oid is not None:
        record = attendance.find_one({"_id": oid})
        if record:
            return record

    if ":" in attendance_id:
        employee_id, date_value = attendance_id.split(":", 1)
        return attendance.find_one({"employee_id": employee_id, "date": date_value})

    return None


def _record_action(employee: dict, actor: dict, action_type: str, details: dict) -> None:
    actions = _collection(hr_actions_collection, "hr_actions")
    if actions is None:
        return

    actions.insert_one(
        {
            "employee_id": employee["employee_id"],
            "employee_name": employee["name"],
            "action_type": action_type,
            "status": "completed",
            "details": details,
            "createdAt": _utc_iso(),
            "createdBy": actor,
        }
    )


def _date_list(start: str, end: str) -> list[str]:
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    if end_date < start_date:
        start_date, end_date = end_date, start_date

    max_days = 31
    dates = []
    current = start_date
    while current <= end_date and len(dates) < max_days:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def _build_attendance_update(body: AttendanceCreateRequest | AttendanceUpdateRequest, employee: dict, actor: dict, existing: Optional[dict] = None) -> dict:
    if isinstance(body, AttendanceCreateRequest):
        target_date = body.date
        status = body.status
        update = {
            "employee_id": employee["employee_id"],
            "employee_name": employee["name"],
            "email": employee.get("email", ""),
            "department": employee.get("department", "Unassigned"),
            "role": employee.get("role", "Employee"),
            "date": target_date,
            "status": status,
            "shift": body.shift or employee.get("shift") or "10:00 AM - 07:00 PM",
            "workMode": body.work_mode,
            "updatedAt": _utc_iso(),
            "updatedBy": actor,
            "source": "hr_attendance",
        }
        if status in {"Present", "Late", "Remote"}:
            update["check_in_time"] = body.check_in_time or _current_time_label()
        elif body.check_in_time:
            update["check_in_time"] = body.check_in_time
        else:
            update.pop("check_in_time", None)

        if body.check_out_time:
            update["check_out_time"] = body.check_out_time
            update["check_out_status"] = "Checked Out"
        if body.note:
            update["hr_note"] = body.note
        return update

    update: dict[str, Any] = {"updatedAt": _utc_iso(), "updatedBy": actor, "source": "hr_attendance"}
    if body.date is not None:
        update["date"] = body.date
    if body.status is not None:
        update["status"] = body.status
    if body.shift is not None:
        update["shift"] = body.shift
    if body.work_mode is not None:
        update["workMode"] = body.work_mode
    if body.check_in_time is not None:
        update["check_in_time"] = body.check_in_time
    if body.check_out_time is not None:
        update["check_out_time"] = body.check_out_time
        update["check_out_status"] = "Checked Out"
    if body.note is not None:
        update["hr_note"] = body.note

    merged_date = update.get("date") or (existing or {}).get("date") or _today_iso()
    merged_check_in = update.get("check_in_time") or (existing or {}).get("check_in_time")
    merged_check_out = update.get("check_out_time") or (existing or {}).get("check_out_time")
    if merged_check_in and merged_check_out:
        check_in = _parse_time(str(merged_date), merged_check_in)
        check_out = _parse_time(str(merged_date), merged_check_out)
        if check_in and check_out and check_out <= check_in:
            raise HTTPException(status_code=400, detail="Check-out time must be after check-in time")

    return update


@router.get("")
def list_hr_attendance(
    start: str = Query(default=None),
    end: Optional[str] = Query(default=None),
    status: str = Query(default="All"),
    department: str = Query(default="All Departments"),
    employee_id: str = Query(default="All Employees"),
    search: str = Query(default=""),
    include_absent: bool = Query(default=True),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        return {"success": True, "data": [], "summary": {"total": 0, "present": 0, "absent": 0, "late": 0, "onLeave": 0}, "departments": [], "employees": []}

    start_date = start or _today_iso()
    end_date = end or start_date
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format")

    dates = _date_list(start_date, end_date)
    employees = _load_all_employees()
    docs = list(attendance.find({"date": {"$gte": dates[0], "$lte": dates[-1]}}))

    records_by_key: dict[str, dict] = {}
    for doc in docs:
        employee_key = _employee_id(doc)
        date_key = str(doc.get("date") or "")
        if employee_key and date_key:
            records_by_key[f"{employee_key}:{date_key}"] = doc

    rows: list[dict] = []
    single_day = len(dates) == 1 and include_absent

    if single_day:
        target_date = dates[0]
        for employee in employees.values():
            if employee_id not in {"All Employees", "", "all"} and employee["employeeId"] != employee_id:
                continue
            if department not in {"All Departments", "", "all"} and employee["department"] != department:
                continue

            record = records_by_key.get(f"{employee['employeeId']}:{target_date}")
            row = _serialize_record(record, employee, target_date)
            rows.append(row)
    else:
        for key, record in records_by_key.items():
            employee = employees.get(record.get("employee_id") or key.split(":", 1)[0], {})
            row = _serialize_record(record, employee or None)
            if employee_id not in {"All Employees", "", "all"} and row["employeeId"] != employee_id:
                continue
            if department not in {"All Departments", "", "all"} and row["department"] != department:
                continue
            rows.append(row)

    query = search.strip().lower()
    if query:
        rows = [
            row
            for row in rows
            if query
            in " ".join(
                str(row.get(field) or "")
                for field in ("name", "email", "role", "department", "status", "employeeId", "date")
            ).lower()
        ]

    if status not in {"All", "", "all"}:
        rows = [row for row in rows if row["status"] == status]

    rows.sort(key=lambda item: (item["date"], item["name"].lower()))

    summary = {
        "total": len(rows),
        "present": sum(1 for row in rows if row["status"] == "Present"),
        "absent": sum(1 for row in rows if row["status"] == "Absent"),
        "late": sum(1 for row in rows if row["status"] == "Late"),
        "onLeave": sum(1 for row in rows if row["status"] == "On Leave"),
        "remote": sum(1 for row in rows if row["status"] == "Remote"),
        "marked": sum(1 for row in rows if row.get("marked")),
        "checkedIn": sum(1 for row in rows if row.get("marked") and row.get("clockIn") not in {"--", "Absent", "Weekend", ""}),
        "onTime": sum(1 for row in rows if row["status"] in {"Present", "On Time"}),
        "earlyOut": sum(1 for row in rows if row.get("marked") and row.get("clockOut") not in {"--", "Absent", "Weekend", ""}),
    }
    marked_rows = summary["marked"] or 0
    summary["rate"] = round((summary["checkedIn"] / marked_rows) * 100) if marked_rows else 0

    departments = sorted({emp["department"] for emp in employees.values() if emp.get("department")})
    employee_options = sorted(
        [{"id": emp["employeeId"], "name": emp["name"], "department": emp["department"]} for emp in employees.values()],
        key=lambda item: item["name"].lower(),
    )

    return {
        "success": True,
        "data": rows,
        "summary": summary,
        "departments": departments,
        "employees": employee_options,
    }


@router.get("/{attendance_id}")
def get_hr_attendance(
    attendance_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    attendance = _require_collection(attendance_collection, "attendance_logs")
    record = _find_record_by_id(attendance, attendance_id)

    if not record:
        if ":" in attendance_id:
            employee_id, date_value = attendance_id.split(":", 1)
            try:
                employee = _find_employee(employee_id)
            except HTTPException:
                raise HTTPException(status_code=404, detail="Attendance record not found") from None
            return {"success": True, "data": _serialize_record(None, employee, date_value)}

        raise HTTPException(status_code=404, detail="Attendance record not found")

    employee = _find_employee(_employee_id(record))
    return {"success": True, "data": _serialize_record(record, employee)}


@router.post("")
def create_hr_attendance(
    body: AttendanceCreateRequest,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    _ensure_indexes()

    employee = _find_employee(body.employee_id)
    attendance = _require_collection(attendance_collection, "attendance_logs")

    existing = attendance.find_one({"employee_id": employee["employee_id"], "date": body.date})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Attendance already exists for {employee['name']} on {body.date}. Use update instead.",
        )

    update = _build_attendance_update(body, employee, actor)
    record = attendance.find_one_and_update(
        {"employee_id": employee["employee_id"], "date": body.date},
        {"$set": update, "$setOnInsert": {"createdAt": _utc_iso()}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    _record_action(
        employee,
        actor,
        "create_attendance",
        {"date": body.date, "status": body.status, "attendance_id": str(record["_id"])},
    )

    return {
        "success": True,
        "message": "Attendance created",
        "data": _serialize_record(record, employee),
    }


@router.put("/{attendance_id}")
def update_hr_attendance(
    attendance_id: str,
    body: AttendanceUpdateRequest,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    attendance = _require_collection(attendance_collection, "attendance_logs")

    existing = _find_record_by_id(attendance, attendance_id)
    if not existing and ":" in attendance_id:
        employee_id, date_value = attendance_id.split(":", 1)
        employee = _find_employee(employee_id)
        create_body = AttendanceCreateRequest(
            employee_id=employee["employee_id"],
            date=date_value,
            status=body.status or "Present",
            checkInTime=body.check_in_time,
            checkOutTime=body.check_out_time,
            shift=body.shift,
            workMode=body.work_mode or "On-site",
            note=body.note,
        )
        update = _build_attendance_update(create_body, employee, actor)
        record = attendance.find_one_and_update(
            {"employee_id": employee["employee_id"], "date": date_value},
            {"$set": update, "$setOnInsert": {"createdAt": _utc_iso()}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        _record_action(
            employee,
            actor,
            "create_attendance",
            {"date": date_value, "status": update["status"], "attendance_id": str(record["_id"])},
        )
        return {"success": True, "message": "Attendance created", "data": _serialize_record(record, employee)}

    if not existing:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    employee = _find_employee(_employee_id(existing))
    update = _build_attendance_update(body, employee, actor, existing)
    new_date = update.get("date", existing.get("date"))

    if new_date != existing.get("date"):
        conflict = attendance.find_one(
            {
                "employee_id": employee["employee_id"],
                "date": new_date,
                "_id": {"$ne": existing["_id"]},
            }
        )
        if conflict:
            raise HTTPException(status_code=409, detail="Another attendance record already exists for that date")

    record = attendance.find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )

    _record_action(
        employee,
        actor,
        "update_attendance",
        {"date": record.get("date"), "status": record.get("status"), "attendance_id": str(record["_id"])},
    )

    return {
        "success": True,
        "message": "Attendance updated",
        "data": _serialize_record(record, employee),
    }


@router.delete("/{attendance_id}")
def delete_hr_attendance(
    attendance_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    actor = _require_hr_actor(authorization, x_user_id, x_user_name, x_user_role)
    attendance = _require_collection(attendance_collection, "attendance_logs")

    existing = _find_record_by_id(attendance, attendance_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    employee = _find_employee(_employee_id(existing))
    attendance.delete_one({"_id": existing["_id"]})

    _record_action(
        employee,
        actor,
        "delete_attendance",
        {"date": existing.get("date"), "status": existing.get("status"), "attendance_id": str(existing["_id"])},
    )

    return {"success": True, "message": "Attendance deleted"}
