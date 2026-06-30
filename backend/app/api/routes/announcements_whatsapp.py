import os
from datetime import datetime
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

router = APIRouter(prefix="/api/announcements/whatsapp", tags=["announcements_whatsapp"])

from app.core.database import db

if db is not None:
    announcements_col = db["announcements"]
    employees_col = db["employees"]
else:
    announcements_col = None
    employees_col = None


class Announcement(BaseModel):
    title: str = Field(..., min_length=2)
    content: str = Field(..., min_length=10)
    author_name: str = Field(..., min_length=2)
    priority: str = Field(default="Normal")  # High, Normal, Low
    send_to_all: bool = Field(default=True)
    recipient_phones: Optional[list] = None  # List of phone numbers if not sending to all


def _db_check():
    if announcements_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_announcement_notification(announcement: dict, recipient: dict):
    """Send WhatsApp announcement notification"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    recipient_name = recipient.get("name", "Employee")
    recipient_phone = recipient.get("phone")
    
    if not recipient_phone:
        return
    
    try:
        whatsapp_service.queue_message(
            recipient_name=recipient_name,
            phone=recipient_phone,
            notification_type="employee_announcements",
            template_data={
                "title": announcement.get("title", "Announcement"),
                "content": announcement.get("content", "")[:100]  # First 100 chars
            }
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue announcement notification: {e}")


@router.post("/create")
async def create_announcement(announcement: Announcement):
    _db_check()
    
    try:
        announcement_dict = announcement.model_dump()
        announcement_dict["created_at"] = datetime.utcnow().isoformat()
        announcement_dict["status"] = "published"
        
        result = announcements_col.insert_one(announcement_dict)
        announcement_dict["_id"] = str(result.inserted_id)
        
        # Send WhatsApp notifications to employees
        if announcement.send_to_all and employees_col:
            try:
                for emp in employees_col.find({"phone": {"$exists": True}}).limit(500):
                    _send_announcement_notification(announcement_dict, emp)
            except Exception as e:
                print(f"[WHATSAPP] Error sending announcements to all employees: {e}")
        elif announcement.recipient_phones:
            for phone in announcement.recipient_phones:
                recipient = {"name": "Employee", "phone": phone}
                _send_announcement_notification(announcement_dict, recipient)
        
        return {
            "success": True,
            "message": "Announcement created and published successfully",
            "data": announcement_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create announcement: {str(exc)}")


@router.get("")
async def get_announcements(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        announcements = []
        for doc in announcements_col.find().sort("created_at", -1).limit(limit):
            doc["_id"] = str(doc["_id"])
            announcements.append(doc)
        
        return {"success": True, "data": announcements}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch announcements: {str(exc)}")


@router.get("/{announcement_id}")
async def get_announcement(announcement_id: str):
    _db_check()
    
    try:
        oid = ObjectId(announcement_id)
        announcement = announcements_col.find_one({"_id": oid})
        
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        announcement["_id"] = str(announcement["_id"])
        return {"success": True, "data": announcement}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch announcement: {str(exc)}")


@router.patch("/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    announcement: Announcement,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(announcement_id)
        
        update_dict = announcement.model_dump()
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        announcements_col.update_one({"_id": oid}, {"$set": update_dict})
        
        updated = announcements_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Announcement updated successfully", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update announcement: {str(exc)}")


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(announcement_id)
        announcement = announcements_col.find_one({"_id": oid})
        
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        announcements_col.delete_one({"_id": oid})
        
        return {"success": True, "message": "Announcement deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete announcement: {str(exc)}")
