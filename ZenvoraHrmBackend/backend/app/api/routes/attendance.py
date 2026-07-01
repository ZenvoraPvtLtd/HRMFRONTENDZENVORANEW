import io
import os
import random
import string
import threading
import time
from urllib.parse import urlencode

import numpy as np

import sys
import warnings
warnings.filterwarnings('ignore')

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except Exception:
    face_recognition = None
    FACE_RECOGNITION_AVAILABLE = False

# pyrefly: ignore [missing-import]
from PIL import Image, ImageOps

from datetime import datetime
from typing import Optional

import pytz

# pyrefly: ignore [missing-import]
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    Depends,
    Query,
)
from fastapi.responses import RedirectResponse

from app.core.database import (
    employees_collection,
    attendance_collection,
    users_collection,
    db,
)

from app.attendance.role_checker import (

    admin_only,

    hr_or_admin
)

router = APIRouter()


# ============================================================
# FACE ENCODING HELPERS
# ============================================================

FALLBACK_FACE_MODEL = "simple-image-signature-v2"
LEGACY_FALLBACK_FACE_MODEL = "simple-image-signature-v1"


def read_rgb_image(contents):
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    return np.array(image)


def create_fallback_encoding(image):
    height, width = image.shape[:2]
    crop_width = int(width * 0.62)
    crop_height = int(height * 0.78)
    left = max((width - crop_width) // 2, 0)
    top = max((height - crop_height) // 2, 0)
    cropped = image[top:top + crop_height, left:left + crop_width]

    pil_image = Image.fromarray(cropped).convert("L")
    pil_image = ImageOps.equalize(pil_image)
    pil_image = pil_image.resize((32, 32))

    vector = np.asarray(pil_image, dtype=np.float32).flatten()
    if float(vector.std()) < 5:
        return None

    vector = (vector - vector.mean()) / (vector.std() + 1e-6)
    return vector


def get_face_encoding(image):
    if FACE_RECOGNITION_AVAILABLE:
        faces = face_recognition.face_locations(image)

        if len(faces) == 0:
            return None, "face_recognition"

        encodings = face_recognition.face_encodings(image, faces)
        if not encodings:
            return None, "face_recognition"

        return encodings[0], "face_recognition"

    return create_fallback_encoding(image), FALLBACK_FACE_MODEL


def compare_face_encodings(saved_encoding, unknown_encoding, saved_model=None):
    saved = np.array(saved_encoding, dtype=np.float32)
    unknown = np.array(unknown_encoding, dtype=np.float32)

    if (
        FACE_RECOGNITION_AVAILABLE
        and saved_model != FALLBACK_FACE_MODEL
        and saved.shape == (128,)
        and unknown.shape == (128,)
    ):
        result = face_recognition.compare_faces(
            [saved],
            unknown,
            tolerance=0.5
        )
        return bool(result[0]), 1.0 if bool(result[0]) else 0.0

    if saved.shape != unknown.shape:
        return False, 0.0

    similarity = float(
        np.dot(saved, unknown) /
        ((np.linalg.norm(saved) * np.linalg.norm(unknown)) + 1e-6)
    )

    threshold = 0.85 if saved_model in {FALLBACK_FACE_MODEL, LEGACY_FALLBACK_FACE_MODEL, None} else 0.75
    return similarity >= threshold, similarity


# ============================================================
# IST TIME FUNCTION
# ============================================================

def get_indian_time():

    return datetime.now(

        pytz.timezone(
            "Asia/Kolkata"
        )

    )


# ============================================================
# SHIFT DETECTION
# ============================================================

def detect_shift():

    current_hour = get_indian_time().hour

    if 6 <= current_hour < 14:

        return "Morning Shift"

    elif 14 <= current_hour < 22:

        return "Evening Shift"

    else:

        return "Night Shift"

def _new_qr_token() -> str:
    return "".join(
        random.choices(
            string.ascii_uppercase + string.digits,
            k=10,
        )
    )


QR_TOKEN_TTL_SECONDS = 86400  # 24 hours — valid for the full working day
_qr_tokens_fallback: list[tuple[str, float]] = []


def _issue_qr_token() -> str:
    global _qr_tokens_fallback
    token = _new_qr_token()
    now = time.time()

    if db is not None:
        try:
            qr_tokens_collection = db["qr_tokens"]
            qr_tokens_collection.insert_one({
                "token": token,
                "createdAt": now
            })
            qr_tokens_collection.delete_many({"createdAt": {"$lt": now - QR_TOKEN_TTL_SECONDS * 2}})
            return token
        except Exception as e:
            print(f"[WARNING] QR DB insert failed, using fallback: {e}")

    _qr_tokens_fallback.insert(0, (token, now))
    _qr_tokens_fallback = [
        (stored, issued)
        for stored, issued in _qr_tokens_fallback
        if now - issued <= QR_TOKEN_TTL_SECONDS * 2
    ][:5]
    return token


def _verify_qr_token(token: str) -> bool:
    global _qr_tokens_fallback
    cleaned = str(token or "").strip().upper()
    if not cleaned:
        return False

    now = time.time()

    if db is not None:
        try:
            qr_tokens_collection = db["qr_tokens"]
            doc = qr_tokens_collection.find_one({"token": cleaned})
            if doc:
                issued = doc.get("createdAt", 0)
                if now - issued <= QR_TOKEN_TTL_SECONDS:
                    return True
        except Exception as e:
            print(f"[WARNING] QR DB query failed, checking fallback: {e}")

    for stored, issued in _qr_tokens_fallback:
        if stored == cleaned and now - issued <= QR_TOKEN_TTL_SECONDS:
            return True
    return False


def _normalize_attendance_role(role: str) -> str:
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


def _lookup_employee_profile(employee_id: str, fallback_name: str = "") -> dict:
    employee_ref = str(employee_id or "").strip()
    if not employee_ref:
        return {
            "employee_id": employee_ref,
            "employee_name": fallback_name,
            "role": "Employee",
            "department": "Unassigned",
        }

    lookup = {
        "$or": [
            {"employee_id": employee_ref},
            {"employeeId": employee_ref},
            {"id": employee_ref},
        ]
    }

    for collection in (users_collection, employees_collection):
        if collection is None:
            continue

        doc = collection.find_one(lookup)
        if not doc:
            continue

        raw_role = doc.get("role") or doc.get("jobTitle") or doc.get("designation") or ""
        return {
            "employee_id": str(doc.get("employeeId") or doc.get("employee_id") or employee_ref),
            "employee_name": str(
                doc.get("fullName")
                or doc.get("employee_name")
                or doc.get("name")
                or fallback_name
                or employee_ref
            ),
            "role": _normalize_attendance_role(raw_role),
            "department": str(doc.get("department") or "Unassigned"),
        }

    return {
        "employee_id": employee_ref,
        "employee_name": fallback_name or employee_ref,
        "role": "Employee",
        "department": "Unassigned",
    }


@router.get("/check_face_registration")
async def check_face_registration(employee_id: str = Query(...)):
    """
    Returns whether a face encoding is already stored for this employee_id.
    Used by the frontend to disable the Register button when already registered.
    """
    if employees_collection is None:
        return {"registered": False}

    doc = employees_collection.find_one(
        {"employee_id": employee_id.strip()},
        {"face_encoding": 1},
    )
    registered = bool(doc and doc.get("face_encoding"))
    return {"registered": registered}


# ============================================================
# REGISTER FACE
# ============================================================

@router.post("/register_face")
async def register_face(
    employee_id: str = Form(...),
    employee_name: str = Form(...),
    department: str = Form(...),
    file: UploadFile = File(...)
):
    if employees_collection is None:
        return {"success": False, "message": "Database unavailable"}

    contents = await file.read()
    image = read_rgb_image(contents)
    encoding, encoding_model = get_face_encoding(image)

    if encoding is None:
        return {"success": False, "message": "No face detected"}

    now = get_indian_time().isoformat()

    # Atomic upsert:
    # - $setOnInsert  → written only when a NEW document is created
    # - $set          → always updated (keeps name/dept/encoding fresh on re-register)
    result = employees_collection.update_one(
        {"employee_id": employee_id},
        {
            "$setOnInsert": {
                "employee_id": employee_id,
                "face_registered_at": now,
            },
            "$set": {
                "employee_name":       employee_name,
                "department":          department,
                "face_encoding":       encoding.tolist(),
                "face_encoding_model": encoding_model,
                "face_updated_at":     now,
            },
        },
        upsert=True,
    )

    if result.upserted_id is not None:
        return {"success": True, "message": "Face Registered Successfully"}

    return {"success": True, "message": "Face Updated Successfully"}


# ============================================================
# CHECK FACE
# ============================================================

@router.post("/check_face")

async def check_face(

    file: UploadFile = File(...)
):
    if employees_collection is None:
        return {"success": False, "message": "Database unavailable"}

    contents = await file.read()

    image = read_rgb_image(contents)

    unknown_encoding, _ = get_face_encoding(image)

    if unknown_encoding is None:

        return {

            "success": False,

            "message":
            "No face detected"
        }

    employees = list(

        employees_collection.find({})
    )

    best_match = None
    best_score = -1.0

    for employee in employees:

        if not employee.get("face_encoding"):
            continue

        saved_encoding = np.array(employee["face_encoding"])
        matched, score = compare_face_encodings(
            saved_encoding,
            unknown_encoding,
            employee.get("face_encoding_model")
        )

        if matched and score > best_score:
            best_score = score
            best_match = employee

    if best_match is not None:
        return {
            "success": True,
            "registered": True,
            "employee_name": best_match["employee_name"],
            "employee_id": best_match["employee_id"],
        }

    return {

        "success": True,

        "registered": False,

        "message":
        "New Employee"
    }


# ============================================================
# MARK ATTENDANCE
# ============================================================

@router.post("/mark_attendance")
async def mark_attendance(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    expected_employee_id: Optional[str] = Form(None),  # logged-in user's employee ID
):
    if employees_collection is None or attendance_collection is None:
        return {"success": False, "message": "Database unavailable"}

    contents = await file.read()
    image = read_rgb_image(contents)
    unknown_encoding, _ = get_face_encoding(image)

    if unknown_encoding is None:
        return {"success": False, "message": "No face detected"}

    employees = list(employees_collection.find({}))

    # ── Find best match (highest similarity score) ───────────────────────────
    best_employee = None
    best_score = -1.0

    for employee in employees:
        if not employee.get("face_encoding"):
            continue
        saved_encoding = np.array(employee["face_encoding"])
        matched, score = compare_face_encodings(
            saved_encoding,
            unknown_encoding,
            employee.get("face_encoding_model"),
        )
        if matched and score > best_score:
            best_score = score
            best_employee = employee

    if best_employee is None:
        return {"success": False, "message": "Face Not Recognized"}

    emp_id   = best_employee["employee_id"]
    emp_name = best_employee["employee_name"]

    # ── Optional: block if matched employee ≠ logged-in user ────────────────
    if expected_employee_id and expected_employee_id.strip():
        if emp_id.strip().lower() != expected_employee_id.strip().lower():
            return {
                "success": False,
                "message": f"Face recognized as {emp_name}, but you are logged in as a different employee. Please register your own face.",
                "matched_employee": emp_name,
            }

    today_date    = str(get_indian_time().date())
    now_time      = get_indian_time().strftime("%I:%M:%S %p")
    location_data = {"lat": latitude, "lng": longitude} if latitude is not None and longitude is not None else None

    existing = attendance_collection.find_one({"employee_id": emp_id, "date": today_date})

    # ── No record → FIRST CHECK-IN ───────────────────────────────────────────
    if existing is None:
        new_doc = {
            "employee_id":   emp_id,
            "employee_name": emp_name,
            "department":    best_employee.get("department", "Unassigned"),
            "date":          today_date,
            "check_in_time": now_time,
            "status":        "Present",
            "shift":         detect_shift(),
            "source":        "face",
            "sessions":      [{"check_in": now_time, "check_out": None, "location": location_data}],
        }
        if location_data:
            new_doc["check_in_location"] = location_data
        attendance_collection.update_one(
            {"employee_id": emp_id, "date": today_date},
            {"$setOnInsert": new_doc},
            upsert=True,
        )
        return {"success": True, "message": "Check-In Successful", "employee_name": emp_name, "employee_id": emp_id}

    sessions = existing.get("sessions") or []

    # ── Open session → CHECK-OUT ─────────────────────────────────────────────
    open_idx = next((i for i, s in enumerate(sessions) if s.get("check_out") is None), None)
    if open_idx is not None:
        sessions[open_idx]["check_out"] = now_time
        attendance_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"sessions": sessions, "check_out_time": now_time, "check_out_status": "Checked Out"}},
        )
        return {"success": True, "message": "Check-Out Successful", "employee_name": emp_name, "employee_id": emp_id}

    # ── All sessions closed → RE-CHECK-IN ────────────────────────────────────
    sessions.append({"check_in": now_time, "check_out": None, "location": location_data})
    update_fields: dict = {"sessions": sessions, "check_out_time": None, "check_out_status": None}
    if location_data:
        update_fields["last_check_in_location"] = location_data
    attendance_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
    return {"success": True, "message": "Check-In Successful", "employee_name": emp_name, "employee_id": emp_id}


# ============================================================
# GENERATE QR
# ============================================================

def _frontend_base_url() -> str:
    configured = (
        os.getenv("FRONTEND_URL")
        or os.getenv("FRONTEND_LOGIN_URL")
        or "http://localhost:5173/login"
    ).strip().rstrip("/")

    if configured.endswith("/login"):
        configured = configured[:-6]

    if configured.startswith("http://") or configured.startswith("https://"):
        return configured

    return f"http://{configured}"


def _build_qr_scan_url(token: str) -> str:
    return f"{_frontend_base_url()}/qr-attendance?{urlencode({'token': token})}"


@router.get("/generate_qr")
async def generate_qr():
    token = _issue_qr_token()
    scan_url = _build_qr_scan_url(token)

    return {
        "token": token,
        "scanUrl": scan_url,
        "expiresIn": QR_TOKEN_TTL_SECONDS,
    }


@router.get("/qr-attendance-open")
async def open_qr_attendance(token: str = Query(...)):
    """Mobile QR fallback: opens frontend attendance page in browser."""
    return RedirectResponse(url=_build_qr_scan_url(token), status_code=302)


# ============================================================
# VERIFY QR
# ============================================================

@router.post("/verify_qr")

async def verify_qr(

    token: str = Form(...)
):

    if _verify_qr_token(token):
        return {
            "success": True
        }

    return {
        "success": False,
        "message": "Invalid or expired QR token. Ask HR to refresh the QR code.",
    }


# ============================================================
# QR ATTENDANCE
# ============================================================

@router.post("/qr_attendance")

async def qr_attendance(
    employee_id: str = Form(...),
    employee_name: str = Form(...),
    token: str = Form(...),
):
    if attendance_collection is None:
        return {"success": False, "message": "Database unavailable"}

    if not _verify_qr_token(token):
        return {
            "success": False,
            "message": "Invalid or expired QR token. Ask HR to refresh the QR code.",
        }

    profile = _lookup_employee_profile(employee_id, employee_name)
    resolved_employee_id = profile["employee_id"]
    today_date = str(get_indian_time().date())
    now_time = get_indian_time().strftime("%I:%M:%S %p")

    existing = attendance_collection.find_one(
        {"employee_id": resolved_employee_id, "date": today_date}
    )

    # ── No record yet → CHECK-IN ────────────────────────────────────────────
    if existing is None:
        attendance_collection.update_one(
            {"employee_id": resolved_employee_id, "date": today_date},
            {
                "$setOnInsert": {
                    "employee_id":   resolved_employee_id,
                    "employee_name": profile["employee_name"],
                    "role":          profile["role"],
                    "department":    profile["department"],
                    "date":          today_date,
                    "check_in_time": now_time,
                    "status":        "Present",
                    "shift":         detect_shift(),
                    "source":        "qr",
                    "sessions":      [{"check_in": now_time, "check_out": None}],
                }
            },
            upsert=True,
        )
        return {"success": True, "message": "Check-In Successful"}

    sessions = existing.get("sessions") or []

    # ── Open session exists → CHECK-OUT ────────────────────────────────────
    open_idx = next(
        (i for i, s in enumerate(sessions) if s.get("check_out") is None), None
    )
    if open_idx is not None:
        sessions[open_idx]["check_out"] = now_time
        attendance_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "sessions":         sessions,
                "check_out_time":   now_time,
                "check_out_status": "Checked Out",
            }},
        )
        return {"success": True, "message": "Check-Out Successful"}

    # ── All sessions closed → RE-CHECK-IN (same day) ───────────────────────
    sessions.append({"check_in": now_time, "check_out": None})
    attendance_collection.update_one(
        {"_id": existing["_id"]},
        {"$set": {
            "sessions":         sessions,
            "check_out_time":   None,
            "check_out_status": None,
        }},
    )
    return {"success": True, "message": "Check-In Successful"}
