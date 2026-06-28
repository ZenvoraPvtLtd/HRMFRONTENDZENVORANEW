from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import db, notifications_collection, users_collection

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


def get_col():
    if db is None:
        return None
    return db["announcements"]


class AnnouncementPayload(BaseModel):
    title: str
    message: str
    targetType: Optional[str] = "All Employees"
    targetValue: Optional[str] = None
    priority: Optional[str] = "Medium"
    status: Optional[str] = "Published"
    expiresAt: Optional[str] = None


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


def create_announcement_notifications(announcement: dict):
    """Create per-employee notifications for All Employees announcements (mirrors events.py pattern)."""
    if notifications_collection is None or users_collection is None:
        return
    if announcement.get("targetType") != "All Employees":
        return

    users = list(users_collection.find({"role": "employee"}))
    notifications = []
    for user in users:
        notifications.append({
            "title": "New Announcement",
            "message": f"{announcement.get('title', '')} has been published.",
            "type": "announcement",
            "role": user.get("role"),
            "user_id": str(user.get("_id")),
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    if notifications:
        notifications_collection.insert_many(notifications)


@router.get("")
def get_announcements():
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    announcements = list(col.find({}).sort("createdAt", -1))
    return [serialize(a) for a in announcements]


@router.get("/{announcement_id}")
def get_announcement(announcement_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    if not ObjectId.is_valid(announcement_id):
        return JSONResponse(status_code=400, content={"message": "Invalid announcement id"})
    doc = col.find_one({"_id": ObjectId(announcement_id)})
    if not doc:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return serialize(doc)


@router.post("")
def create_announcement(payload: AnnouncementPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    now = datetime.now(timezone.utc).isoformat()
    data = payload.model_dump()
    data["createdAt"] = now
    data["updatedAt"] = now
    result = col.insert_one(data)
    data["_id"] = str(result.inserted_id)
    data["id"] = data["_id"]
    try:
        create_announcement_notifications(data)
    except Exception as exc:
        print(f"[WARNING] Announcement saved but notification creation failed: {exc}")
    return {"message": "Announcement created", "announcement": data}


@router.put("/{announcement_id}")
def update_announcement(announcement_id: str, payload: AnnouncementPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    if not ObjectId.is_valid(announcement_id):
        return JSONResponse(status_code=400, content={"message": "Invalid announcement id"})
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = col.find_one_and_update(
        {"_id": ObjectId(announcement_id)},
        {"$set": data},
        return_document=True,
    )
    if not result:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return {"message": "Announcement updated", "announcement": serialize(result)}


@router.delete("/{announcement_id}")
def delete_announcement(announcement_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    if not ObjectId.is_valid(announcement_id):
        return JSONResponse(status_code=400, content={"message": "Invalid announcement id"})
    result = col.delete_one({"_id": ObjectId(announcement_id)})
    if result.deleted_count == 0:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return {"message": "Announcement deleted"}
