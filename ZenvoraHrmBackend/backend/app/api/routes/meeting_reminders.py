import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/meeting-reminders", tags=["meeting-reminders"])

from app.core.database import db

if db is not None:
    meetings_col = db["meetings"]
else:
    meetings_col = None


class MeetingSchedule(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    scheduled_at: str  # ISO 8601 format
    attendees: list = Field(default=[])  # List of {name, phone, email}
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    reminder_minutes_before: int = Field(default=30)


def _db_check():
    if meetings_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_meeting_reminder(meeting: dict, attendee: dict):
    """Send WhatsApp meeting reminder scheduled for specified minutes before meeting"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    attendee_name = attendee.get("name", "Attendee")
    attendee_phone = attendee.get("phone")
    
    if not attendee_phone:
        print(f"DEBUG /api/meeting-reminders - attendee missing phone, skipping: {attendee}")
        return
    
    try:
        meeting_time_str = meeting.get("scheduled_at", "")
        reminder_mins = meeting.get("reminder_minutes_before", 30)
        
        meeting_dt = datetime.fromisoformat(meeting_time_str.replace("Z", "+00:00"))
        scheduled_send_time = meeting_dt - timedelta(minutes=reminder_mins)
        print("DEBUG /api/meeting-reminders - queuing WhatsApp job", {
            "attendee_name": attendee_name,
            "attendee_phone": attendee_phone,
            "meeting_subject": meeting.get("title"),
            "meeting_time": meeting_time_str,
            "reminder_minutes_before": reminder_mins,
            "scheduled_send_time": scheduled_send_time.isoformat(),
        })
        result = whatsapp_service.queue_message(
            recipient_name=attendee_name,
            phone=attendee_phone,
            notification_type="meeting_reminders",
            template_data={
                "meeting_subject": meeting.get("title", "Meeting"),
                "meeting_time": meeting_time_str,
                "join_link": meeting.get("meeting_link") or meeting.get("location") or "See Zenvora portal for link"
            },
            scheduled_time=scheduled_send_time
        )
        print("DEBUG /api/meeting-reminders - queued WhatsApp job result", result)
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue meeting reminder: {e}")


@router.post("/schedule")
async def schedule_meeting(meeting: MeetingSchedule):
    _db_check()
    
    try:
        meeting_dict = meeting.model_dump()
        print("DEBUG /api/meeting-reminders/schedule - incoming payload", meeting_dict)
        if meetings_col is not None:
            print("DEBUG /api/meeting-reminders/schedule - meetings collection:", meetings_col.name)
            try:
                print("DEBUG /api/meeting-reminders/schedule - meetings count before insert:", meetings_col.count_documents({}))
            except Exception as exc:
                print("DEBUG /api/meeting-reminders/schedule - meetings count failed:", str(exc))
        if not meeting_dict.get("meeting_link") and not meeting_dict.get("location"):
            base_url = os.getenv("FASTAPI_BASE_URL", "http://localhost:8000").rstrip("/")
            meeting_dict["meeting_link"] = f"{base_url}/meetings/{uuid.uuid4().hex}"
        meeting_dict["created_at"] = datetime.utcnow().isoformat()
        meeting_dict["status"] = "scheduled"
        
        result = meetings_col.insert_one(meeting_dict)
        meeting_dict["_id"] = str(result.inserted_id)
        print("DEBUG /api/meeting-reminders/schedule - inserted meeting id", meeting_dict["_id"])
        
        # Send reminders to all attendees, scheduled 30 min before
        for attendee in meeting_dict.get("attendees", []):
            print("DEBUG /api/meeting-reminders/schedule - scheduling reminder for attendee", attendee)
            _send_meeting_reminder(meeting_dict, attendee)
        
        return {
            "success": True,
            "message": "Meeting scheduled successfully",
            "data": meeting_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to schedule meeting: {str(exc)}")


@router.get("")
async def get_meetings(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        meetings = []
        for doc in meetings_col.find().sort("scheduled_at", -1).limit(limit):
            doc["_id"] = str(doc["_id"])
            meetings.append(doc)
        
        return {"success": True, "data": meetings}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meetings: {str(exc)}")


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str):
    _db_check()
    
    try:
        oid = ObjectId(meeting_id)
        meeting = meetings_col.find_one({"_id": oid})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        meeting["_id"] = str(meeting["_id"])
        return {"success": True, "data": meeting}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meeting: {str(exc)}")


@router.patch("/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    meeting: MeetingSchedule,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(meeting_id)
        
        update_dict = meeting.model_dump()
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        meetings_col.update_one({"_id": oid}, {"$set": update_dict})
        
        updated = meetings_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Meeting updated successfully", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update meeting: {str(exc)}")


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(meeting_id)
        meeting = meetings_col.find_one({"_id": oid})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        meetings_col.delete_one({"_id": oid})
        
        return {"success": True, "message": "Meeting deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete meeting: {str(exc)}")
