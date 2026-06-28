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

