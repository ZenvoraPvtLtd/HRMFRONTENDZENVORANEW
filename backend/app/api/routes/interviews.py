import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient
import uuid

from app.core.smtp import get_smtp_settings
from app.services.google_calendar_service import create_interview_meeting

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    _db = _client[DATABASE_NAME]
    interviews_col = _db["interviews"]
    candidates_col = _db["candidates"]
    interviews_col.create_index([("candidate_id", 1), ("scheduled_at", -1)])
except Exception as e:
    print(f"[INTERVIEWS] MongoDB connection failed: {e}")
    interviews_col = None
    candidates_col = None


class InterviewSchedule(BaseModel):
    candidate_id: str = Field(..., min_length=1)
    candidate_name: str = Field(..., min_length=2)
    candidate_phone: str = Field(..., min_length=5)
    candidate_email: str = Field(..., min_length=5)
    position: str = Field(..., min_length=2)
    scheduled_at: str  # ISO 8601 format
    interview_type: str = Field(default="phone")  # phone, video, in-person
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    location: Optional[str] = None
    zoom_link: Optional[str] = None


class InterviewUpdate(BaseModel):
    status: Optional[str] = None  # scheduled, completed, rejected, cancelled
    feedback: Optional[str] = None
    rating: Optional[float] = None


def _db_check():
    if interviews_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_interview_scheduled_notification(interview: dict):
    """Send WhatsApp notification when interview is scheduled"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    candidate_name = interview.get("candidate_name", "Candidate")
    candidate_phone = interview.get("candidate_phone")
    position = interview.get("position", "")
    
    if not candidate_phone:
        return
    
    try:
        location_or_link = (
            interview.get("zoom_link")
            or interview.get("meet_link")
            or interview.get("location")
            or "Contact HR for details"
        )
        
        whatsapp_service.queue_message(
            recipient_name=candidate_name,
            phone=candidate_phone,
            notification_type="interview_scheduling",
            template_data={
                "position": position,
                "interview_time": interview.get("scheduled_at", ""),
                "interview_type": interview.get("interview_type", "phone"),
                "location": location_or_link
            }
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue interview notification: {e}")


def _send_interview_email(interview: dict):
    """Send candidate interview confirmation email."""
    smtp = get_smtp_settings()
    if not smtp["enabled"] or not smtp["user"] or not smtp["password"]:
        print("[INTERVIEWS] SMTP not configured. Skipping interview email.")
        return

    candidate_email = interview.get("candidate_email")
    if not candidate_email:
        print("[INTERVIEWS] Missing candidate_email. Skipping interview email.")
        return

    try:
        subject = f"Interview Scheduled: {interview.get('position', 'Interview')}"
        meet_link = (
            interview.get("meet_link")
            or interview.get("zoom_link")
            or interview.get("location")
            or "Contact HR for details"
        )
        body = f"""Hello {interview.get('candidate_name', 'Candidate')},

Your interview for the {interview.get('position', 'role')} role has been scheduled.

Date & Time: {interview.get('scheduled_at')}
Interviewer: {interview.get('interviewer_name') or 'TBD'}
Type: {interview.get('interview_type')}
Location / Link: {meet_link}

Please join on time.

Best regards,
Zenvora HR Team
"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp["from_addr"]
        msg["To"] = candidate_email
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.starttls()
            server.login(smtp["user"], smtp["password"])
            server.sendmail(smtp["from_addr"], [candidate_email], msg.as_string())

        print(f"[INTERVIEWS] Interview email sent to {candidate_email}")
    except Exception as e:
        print(f"[INTERVIEWS] Failed to send interview email to {candidate_email}: {e}")


@router.post("")
async def schedule_interview(interview: InterviewSchedule):
    _db_check()
    
    try:
        interview_dict = interview.model_dump()
        interview_dict["created_at"] = datetime.utcnow().isoformat()
        interview_dict["status"] = "scheduled"
        
        # Insert interview
        result = interviews_col.insert_one(interview_dict)
        interview_dict["_id"] = str(result.inserted_id)

        # ---------- Generate meeting link (fallback) ----------
        meeting_uuid = uuid.uuid4().hex
        base_url = os.getenv("FASTAPI_BASE_URL", "http://localhost:8000")
        meet_link = f"{base_url}/meetings/{meeting_uuid}"
        interview_dict["meet_link"] = meet_link
        # Store the UUID for possible reference
        interview_dict["meeting_uuid"] = meeting_uuid
        # Update DB with the generated link
        interviews_col.update_one(
            {"_id": ObjectId(result.inserted_id)},
            {"$set": {"meet_link": meet_link, "meeting_uuid": meeting_uuid}}
        )
        
        google_error = None
        try:
            scheduled_at = interview_dict["scheduled_at"]
            if "T" in scheduled_at:
                date_string, time_string = scheduled_at.split("T", 1)
                if "+" in time_string:
                    time_string = time_string.split("+", 1)[0]
                if "Z" in time_string:
                    time_string = time_string.replace("Z", "")
            else:
                raise ValueError("scheduled_at must be ISO 8601 datetime string")

            end_time_value = interview_dict.get("end_time")
            if not end_time_value:
                # default to 1 hour duration
                dt_start = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
                dt_end = dt_start + timedelta(hours=1)
                end_time_value = dt_end.time().strftime("%H:%M:%S")

            calendar_data = create_interview_meeting(
                candidate_name=interview_dict["candidate_name"],
                interviewer_name=interview_dict.get("interviewer_name") or "HR Team",
                interview_date=date_string,
                start_time=time_string,
                end_time=end_time_value,
                candidate_email=interview_dict["candidate_email"],
            )
            interview_dict["event_id"] = calendar_data.get("event_id")
            interview_dict["meet_link"] = calendar_data.get("meet_link")
            interview_dict["calendar_link"] = calendar_data.get("calendar_link")
            interviews_col.update_one(
                {"_id": ObjectId(result.inserted_id)},
                {"$set": {
                    "event_id": interview_dict["event_id"],
                    "meet_link": interview_dict["meet_link"],
                    "calendar_link": interview_dict["calendar_link"],
                }}
            )
        except Exception as exc:
            google_error = str(exc)
            print(f"[GOOGLE_CALENDAR] Failed to create event: {google_error}")

        # Send notifications even when Google Calendar fails
        _send_interview_scheduled_notification(interview_dict)
        _send_interview_email(interview_dict)

        response = {
            "success": True,
            "message": "Interview scheduled successfully",
            "data": interview_dict,
        }
        if google_error:
            response["google_calendar_error"] = google_error
        
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to schedule interview: {str(exc)}")


@router.get("")
async def get_interviews(
    candidate_id: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        query = {}
        if candidate_id:
            query["candidate_id"] = candidate_id
        
        interviews = []
        for doc in interviews_col.find(query).sort("scheduled_at", -1).limit(limit):
            doc["_id"] = str(doc["_id"])
            interviews.append(doc)
        
        return {"success": True, "data": interviews}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interviews: {str(exc)}")


@router.get("/{interview_id}")
async def get_interview(interview_id: str):
    _db_check()
    
    try:
        oid = ObjectId(interview_id)
        interview = interviews_col.find_one({"_id": oid})
        
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        interview["_id"] = str(interview["_id"])
        return {"success": True, "data": interview}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview: {str(exc)}")


@router.patch("/{interview_id}")
async def update_interview(
    interview_id: str,
    update: InterviewUpdate,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(interview_id)
        interview = interviews_col.find_one({"_id": oid})
        
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        updates = {}
        if update.status:
            updates["status"] = update.status
        if update.feedback:
            updates["feedback"] = update.feedback
        if update.rating is not None:
            updates["rating"] = update.rating
        
        updates["updated_at"] = datetime.utcnow().isoformat()
        
        interviews_col.update_one({"_id": oid}, {"$set": updates})
        
        updated = interviews_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Interview updated successfully", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update interview: {str(exc)}")

@router.post("/{interview_id}/notify-whatsapp")
async def send_interview_whatsapp_notification(interview_id: str, authorization: Optional[str] = Header(default=None)):
    _db_check()
    try:
        oid = ObjectId(interview_id)
        interview = interviews_col.find_one({"_id": oid})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        _send_interview_scheduled_notification(interview)
        return {"success": True, "message": "WhatsApp notification queued"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp notification: {str(exc)}")


@router.delete("/{interview_id}")
async def delete_interview(
    interview_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(interview_id)
        interview = interviews_col.find_one({"_id": oid})
        
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        interviews_col.delete_one({"_id": oid})
        
        return {"success": True, "message": "Interview deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete interview: {str(exc)}")
