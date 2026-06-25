from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import db

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


def get_col():
    if db is None:
        return None
    return db["announcements"]


class AnnouncementPayload(BaseModel):
    title: str
    message: str
    targetType: Optional[str] = "all"
    targetValue: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "published"
    expiresAt: Optional[str] = None


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


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
    doc = col.find_one({"_id": ObjectId(announcement_id)})
    if not doc:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return serialize(doc)


@router.post("")
def create_announcement(payload: AnnouncementPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    data = payload.model_dump()
    data["createdAt"] = datetime.utcnow().isoformat()
    data["updatedAt"] = datetime.utcnow().isoformat()
    result = col.insert_one(data)
    data["_id"] = str(result.inserted_id)
    data["id"] = data["_id"]
    return {"message": "Announcement created", "announcement": data}


@router.put("/{announcement_id}")
def update_announcement(announcement_id: str, payload: AnnouncementPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    data["updatedAt"] = datetime.utcnow().isoformat()
    result = col.find_one_and_update(
        {"_id": ObjectId(announcement_id)},
        {"$set": data},
        return_document=True
    )
    if not result:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return {"message": "Announcement updated", "announcement": serialize(result)}


@router.delete("/{announcement_id}")
def delete_announcement(announcement_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    result = col.delete_one({"_id": ObjectId(announcement_id)})
    if result.deleted_count == 0:
        return JSONResponse(status_code=404, content={"message": "Announcement not found"})
    return {"message": "Announcement deleted"}