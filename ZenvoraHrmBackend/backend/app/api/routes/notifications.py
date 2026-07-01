from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import db
from app.core.jwt_auth import get_current_user, TokenPayload

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def _col():
    """Return the notifications collection, or None if DB is unavailable."""
    if db is None:
        return None
    return db["notifications"]

def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "type": doc.get("type", "general"),
        "read": bool(doc.get("read", False)),
        "createdAt": doc.get("createdAt", ""),
    }

def _user_query(current_user: TokenPayload) -> dict:
    """
    Build a MongoDB query that returns all notifications relevant to this user.

    Two storage patterns exist in the notifications collection:
    - Per-user:  {"user_id": "<str id>", "role": "<role>"}  (written by events.py)
    - Role-wide: {"role": "<role>"}                          (written by other modules)

    Matching either pattern ensures nothing is missed.
    """
    return {
        "$or": [
            {"user_id": str(current_user.sub)},
            {"role": current_user.role},
        ]
    }

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "general"
    role: Optional[str] = None

@router.get("")
def get_notifications(current_user: TokenPayload = Depends(get_current_user)):
    col = _col()
    if col is None:
        return {"success": True, "notifications": []}
    docs = list(col.find(_user_query(current_user)).sort("createdAt", -1).limit(50))
    return {"success": True, "notifications": [_serialize(d) for d in docs]}

@router.post("")
def create_notification(payload: NotificationCreate):
    col = _col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    doc = {
        "title": payload.title.strip(),
        "message": payload.message.strip(),
        "type": payload.type,
        "role": payload.role,
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    result = col.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return {"success": True, "notification": doc}

@router.put("/read-all")
def mark_all_notifications_read(current_user: TokenPayload = Depends(get_current_user)):
    col = _col()
    if col is None:
        return {"success": True}
    col.update_many(_user_query(current_user), {"$set": {"read": True}})
    return {"success": True, "message": "All notifications marked as read"}

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    col = _col()
    if col is None:
        return {"success": False, "message": "Database offline"}
    if not ObjectId.is_valid(notification_id):
        return {"success": False, "message": "Invalid notification id"}
    col.update_one({"_id": ObjectId(notification_id)}, {"$set": {"read": True}})
    return {"success": True, "message": "Notification marked as read"}

@router.delete("/{notification_id}")
async def delete_notification_route(notification_id: str):
    ok = delete_notification(notification_id)
    if not ok:
        return {"success": False, "message": "Notification not found"}
    return {"success": True, "message": "Notification deleted successfully"}

def delete_notification(notification_id: str):
    col = _col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    if not ObjectId.is_valid(notification_id):
        return JSONResponse(status_code=400, content={"message": "Invalid notification id"})
    col.delete_one({"_id": ObjectId(notification_id)})
    return {"success": True, "message": "Notification deleted"}
