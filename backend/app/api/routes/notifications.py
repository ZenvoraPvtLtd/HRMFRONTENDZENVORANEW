from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.jwt_auth import get_current_user, TokenPayload
from app.services.notifications import (
    create_notification,
    delete_notification,
    get_notifications_for_user,
    mark_all_as_read,
    mark_notification_as_read,
)
from datetime import datetime
from typing import Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import notifications_collection
from app.core.jwt_auth import get_current_user, TokenPayload


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "general"
    role: Optional[str] = None
    recipientId: Optional[str] = None


@router.get("")
async def get_notifications(current_user: TokenPayload = Depends(get_current_user)):
    notifications = get_notifications_for_user(str(current_user.sub), current_user.role)
    return {"success": True, "notifications": notifications}
    if notifications_collection is None:
        return {
            "success": True,
            "notifications": [serialize_notification(item) for item in memory_notifications],
        }

    query = {
        "$or": [
            {"user_id": current_user.sub},
            {"role": current_user.role},
            {"user_id": {"$exists": False}, "role": {"$exists": False}},
        ]
    }

    items = notifications_collection.find(query).sort("createdAt", -1).limit(50)

    return {
        "success": True,
        "notifications": [serialize_notification(item) for item in items],
    }

@router.post("")
async def create_notification_route(body: NotificationCreate):
    create_notification(
        title=body.title.strip(),
        message=body.message.strip(),
        type_=body.type,
        role=body.role,
        recipient_id=body.recipientId,
    )
    return {"success": True, "message": "Notification created successfully"}


@router.put("/read-all")
async def mark_all_notifications_read(current_user: TokenPayload = Depends(get_current_user)):
    mark_all_as_read(str(current_user.sub), current_user.role)
    return {"success": True, "message": "All notifications marked as read"}


@router.put("/{notification_id}/read")
async def mark_notification_read_route(notification_id: str, current_user: TokenPayload = Depends(get_current_user)):
    ok = mark_notification_as_read(notification_id, str(current_user.sub))
    if not ok:
        return {"success": False, "message": "Notification not found"}
    return {"success": True, "message": "Notification marked as read"}


@router.delete("/{notification_id}")
async def delete_notification_route(notification_id: str):
    ok = delete_notification(notification_id)
    if not ok:
        return {"success": False, "message": "Notification not found"}
    return {"success": True, "message": "Notification deleted successfully"}
async def create_notification(body: NotificationCreate):
    item = {
        "title": body.title.strip(),
        "message": body.message.strip(),
        "type": body.type,
        "role": body.role,
        "read": False,
        "createdAt": datetime.utcnow().isoformat(),
    }

    if notifications_collection is None:
        item["id"] = str(uuid4())
        memory_notifications.insert(0, item)
        return {"success": True, "notification": serialize_notification(item)}

    result = notifications_collection.insert_one(item)
    item["_id"] = result.inserted_id
    return {"success": True, "notification": serialize_notification(item)}


@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    if notifications_collection is None:
        for item in memory_notifications:
            if str(item.get("id")) == notification_id:
                item["read"] = True
                break
        return {"success": True}

    if ObjectId.is_valid(notification_id):
        notifications_collection.update_one({"_id": ObjectId(notification_id)}, {"$set": {"read": True}})
from bson import ObjectId
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.core.database import db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_col():
    if db is None:
        return None
    return db["notifications"]


def serialize(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["_id"] = doc["id"]
    return doc


class NotificationPayload(BaseModel):
    title: str
    message: str
    type: str
    role: Optional[str] = "hr"


@router.get("")
def get_notifications(request: Request):
    col = get_col()
    if col is None:
        return {"success": True, "notifications": []}
    role = request.headers.get("X-User-Role", "hr")
    items = [serialize(n) for n in col.find({"role": role}).sort("createdAt", -1).limit(50)]
    return {"success": True, "notifications": items}


@router.post("")
def create_notification(payload: NotificationPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    data = {**payload.model_dump(), "read": False, "createdAt": datetime.utcnow().isoformat()}
    result = col.insert_one(data)
    data["id"] = str(result.inserted_id)
    data["_id"] = data["id"]
    return {"success": True, "notification": data}


@router.put("/{notification_id}/read")
def mark_read(notification_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    col.update_one({"_id": ObjectId(notification_id)}, {"$set": {"read": True}})
    return {"success": True}


@router.put("/read-all")
async def mark_all_notifications_read():
    if notifications_collection is None:
        for item in memory_notifications:
            item["read"] = True
        return {"success": True}

    notifications_collection.update_many({}, {"$set": {"read": True}})
def mark_all_read(request: Request):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    role = request.headers.get("X-User-Role", "hr")
    col.update_many({"role": role}, {"$set": {"read": True}})
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    if notifications_collection is None:
        memory_notifications[:] = [
            item for item in memory_notifications if str(item.get("id")) != notification_id
        ]
        return {"success": True}

    if ObjectId.is_valid(notification_id):
        notifications_collection.delete_one({"_id": ObjectId(notification_id)})
    else:
        notifications_collection.delete_one({"id": notification_id})
def delete_notification(notification_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    col.delete_one({"_id": ObjectId(notification_id)})
    return {"success": True}
