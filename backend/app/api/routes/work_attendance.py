import os
from datetime import datetime, timedelta
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.core.database import attendance_collection, db, users_collection

router = APIRouter(prefix="/api/attendance", tags=["work-attendance"])

SECRET_KEY = os.getenv("JWT_SECRET", "ZENVORA_SECRET_KEY_2024")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


class ClockEventRequest(BaseModel):
    workMode: Optional[str] = "On-site"
    location: Optional[dict[str, Any]] = None


def _collection(handle: Any, name: str):
    if handle is not None:
        return handle
    if db is None:
        return None
    return db[name]


def _decode_token(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        token = authorization.split(" ", 1)[1]
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_user(user_id: str) -> dict:
    users = _collection(users_collection, "users")
    if users is None:
        raise HTTPException(status_code=503, detail="Database offline")

    try:
        user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = users.find_one({"_id": user_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


def _now() -> datetime:
    return datetime.now()


def _time_label(value: datetime) -> str:
    return value.strftime("%I:%M:%S %p")


def _date_label(value: datetime) -> str:
    return value.date().isoformat()


def _employee_id(user: dict) -> str:
    return str(user.get("employeeId") or user.get("employee_id") or user.get("email") or user.get("_id") or "").strip()


@router.post("/clock-in")
def clock_in(body: ClockEventRequest, authorization: Optional[str] = Header(None)):
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        raise HTTPException(status_code=503, detail="Database offline")

    payload = _decode_token(authorization)
    user = _get_user(str(payload.get("sub") or ""))
    now = _now()
    employee_id = _employee_id(user)
    today = _date_label(now)

    record = attendance.find_one_and_update(
        {"employee_id": employee_id, "date": today},
        {
            "$setOnInsert": {
                "employee_id": employee_id,
                "employee_name": user.get("fullName") or user.get("name") or user.get("email") or "Employee",
                "email": user.get("email", ""),
                "department": user.get("department", "Unassigned"),
                "role": user.get("role", "Employee"),
                "date": today,
            },
            "$set": {
                "check_in_time": _time_label(now),
                "checkInTime": now.isoformat(),
                "status": "Present",
                "workMode": body.workMode or "On-site",
                "location": body.location,
                "source": "work-clock",
                "updatedAt": now.isoformat(),
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return {"message": "Clock-in synced", "attendance": {"id": str(record["_id"]), "date": today}}


@router.post("/clock-out")
def clock_out(body: ClockEventRequest, authorization: Optional[str] = Header(None)):
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        raise HTTPException(status_code=503, detail="Database offline")

    payload = _decode_token(authorization)
    user = _get_user(str(payload.get("sub") or ""))
    now = _now()
    employee_id = _employee_id(user)
    today = _date_label(now)

    record = attendance.find_one_and_update(
        {"employee_id": employee_id, "date": today},
        {
            "$setOnInsert": {
                "employee_id": employee_id,
                "employee_name": user.get("fullName") or user.get("name") or user.get("email") or "Employee",
                "email": user.get("email", ""),
                "department": user.get("department", "Unassigned"),
                "role": user.get("role", "Employee"),
                "date": today,
                "check_in_time": _time_label(now),
                "checkInTime": now.isoformat(),
                "status": "Present",
            },
            "$set": {
                "check_out_time": _time_label(now),
                "checkOutTime": now.isoformat(),
                "workMode": body.workMode or "On-site",
                "location": body.location,
                "check_out_status": "Checked Out",
                "source": "work-clock",
                "updatedAt": now.isoformat(),
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return {"message": "Clock-out synced", "attendance": {"id": str(record["_id"]), "date": today}}


@router.get("/my-logs")
def my_attendance_logs(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    authorization: Optional[str] = Header(None),
):
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        raise HTTPException(status_code=503, detail="Database offline")

    payload = _decode_token(authorization)
    user = _get_user(str(payload.get("sub") or ""))
    employee_id = _employee_id(user)

    records = list(
        attendance.find(
            {"employee_id": employee_id, "date": {"$gte": start, "$lte": end}},
            {"_id": 0},
        ).sort("date", 1)
    )

    # Also try matching by email if employee_id didn't find anything
    if not records:
        email = user.get("email", "")
        if email and email != employee_id:
            records = list(
                attendance.find(
                    {"employee_id": email, "date": {"$gte": start, "$lte": end}},
                    {"_id": 0},
                ).sort("date", 1)
            )

    results = []
    for r in records:
        check_in = r.get("check_in_time") or r.get("checkInTime") or ""
        check_out = r.get("check_out_time") or r.get("checkOutTime") or ""
        db_status = r.get("status") or "Present"
        work_mode = r.get("workMode") or r.get("work_mode") or "On-site"

        # Map DB status → frontend DayStatus token.
        # Only re-derive late/onTime from the actual clock-in time; never
        # overwrite explicit HR-set statuses (Absent, On Leave, Remote, etc.)
        status_lower = db_status.strip().lower()

        if status_lower == "absent":
            parsed_status = "absent"
        elif status_lower in {"on leave", "leave"}:
            parsed_status = "leave"
        elif status_lower == "remote":
            parsed_status = "remote"
        elif check_in:
            # Parse only the wall-clock time to decide late vs on-time.
            # check_in_time is stored as "HH:MM:SS AM/PM" (12-hr) or ISO string.
            try:
                raw = str(check_in)
                if "T" in raw:
                    # ISO datetime — take only the time part (already 24-hr)
                    ci_time = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    ci_hour, ci_minute = ci_time.hour, ci_time.minute
                else:
                    # "03:01:19 PM" format
                    ci_time = datetime.strptime(raw.strip(), "%I:%M:%S %p")
                    ci_hour, ci_minute = ci_time.hour, ci_time.minute

                # 9:45 AM threshold
                LATE_HOUR, LATE_MINUTE = 9, 45
                is_late = (ci_hour, ci_minute) > (LATE_HOUR, LATE_MINUTE)
                parsed_status = "late" if is_late else "onTime"
            except (ValueError, TypeError):
                parsed_status = "onTime"
        else:
            parsed_status = "onTime"

        results.append({
            "date": r.get("date", ""),
            "status": parsed_status,
            "checkIn": check_in,
            "checkOut": check_out,
            "workMode": work_mode,
        })

    return {"success": True, "data": results}


@router.get("/all")
def get_all_attendance(
    employee_id: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(None),
):
    """HR endpoint — fetch attendance records for any employee by employee_id."""
    attendance = _collection(attendance_collection, "attendance_logs")
    if attendance is None:
        raise HTTPException(status_code=503, detail="Database offline")

    # Require HR/Admin token
    payload = _decode_token(authorization)
    role = str(payload.get("role") or "").strip().lower()
    if role not in {"hr", "admin", "superadmin", "manager"}:
        raise HTTPException(status_code=403, detail="HR/Admin access required")

    query: dict = {}
    if employee_id:
        query["employee_id"] = employee_id
    if start_date or end_date:
        date_filter: dict = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["date"] = date_filter

    records = list(
        attendance.find(query, {"_id": 0}).sort("date", -1).limit(100)
    )

    results = []
    for r in records:
        results.append({
            "date": r.get("date", ""),
            "status": r.get("status") or "Present",
            "check_in_time": r.get("check_in_time") or r.get("checkInTime") or "",
            "check_out_time": r.get("check_out_time") or r.get("checkOutTime") or "",
            "shift": r.get("shift") or "",
            "source": r.get("source") or "",
            "hr_note": r.get("hr_note") or "",
        })

    return {"success": True, "data": results}
