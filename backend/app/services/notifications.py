from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List, Optional

from bson import ObjectId

from ..db.database import get_collection


def create_notification(
    title: str,
    message: str,
    type_: str,
    role: Optional[str] = None,
    recipient_id: Optional[str] = None,
) -> None:
    notifications = get_collection("notifications")
    now = dt.datetime.utcnow() if False else None
    from datetime import datetime as _dt

    now = _dt.utcnow()
    doc: Dict[str, Any] = {"title": title, "message": message, "type": type_, "createdAt": now, "updatedAt": now}
    if role:
        doc["role"] = role
    if recipient_id:
        doc["recipientId"] = ObjectId(recipient_id)
    notifications.insert_one(doc)


def get_notifications_for_user(user_id: str, user_role: Optional[str]) -> List[Dict[str, Any]]:
    notifications = get_collection("notifications")
    query: Dict[str, Any] = {
        "$or": [
            {"recipientId": ObjectId(user_id)},
            {"recipientId": {"$exists": False}, "role": {"$exists": False}}
        ]
    }
    if user_role:
        query["$or"].append({"role": user_role, "recipientId": {"$exists": False}})

    docs = list(notifications.find(query).sort("createdAt", -1))
    out: List[Dict[str, Any]] = []
    for n in docs:
        read_by = n.get("readBy") or []
        is_read = any(str(x) == str(user_id) for x in read_by)
        out.append(
            {
                "id": str(n.get("_id")),
                "title": n.get("title"),
                "message": n.get("message"),
                "type": n.get("type"),
                "read": is_read,
                "createdAt": n.get("createdAt"),
            }
        )
    return out


def mark_notification_as_read(notification_id: str, user_id: str) -> bool:
    notifications = get_collection("notifications")
    n = notifications.find_one({"_id": ObjectId(notification_id)})
    if not n:
        return False
    read_by = n.get("readBy") or []
    if not any(str(x) == str(user_id) for x in read_by):
        read_by.append(ObjectId(user_id))
        notifications.update_one({"_id": ObjectId(notification_id)}, {"$set": {"readBy": read_by}})
    return True


def mark_all_as_read(user_id: str, user_role: Optional[str]) -> int:
    notifications = get_collection("notifications")
    query: Dict[str, Any] = {
        "$or": [
            {"recipientId": ObjectId(user_id)},
            {"recipientId": {"$exists": False}, "role": {"$exists": False}}
        ]
    }
    if user_role:
        query["$or"].append({"role": user_role, "recipientId": {"$exists": False}})

    docs = list(notifications.find(query))
    updated = 0
    for n in docs:
        read_by = n.get("readBy") or []
        if any(str(x) == str(user_id) for x in read_by):
            continue
        read_by.append(ObjectId(user_id))
        notifications.update_one({"_id": n["_id"]}, {"$set": {"readBy": read_by}})
        updated += 1
    return updated


def delete_notification(notification_id: str) -> bool:
    notifications = get_collection("notifications")
    res = notifications.delete_one({"_id": ObjectId(notification_id)})
    return res.deleted_count == 1

