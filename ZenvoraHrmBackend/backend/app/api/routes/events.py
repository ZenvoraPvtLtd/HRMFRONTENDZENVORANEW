from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import events_collection, notifications_collection, users_collection

router = APIRouter(prefix="/api/events", tags=["events"])

EVENT_STATUSES = {"Planned", "Completed", "Cancelled"}


class EventPayload(BaseModel):
    title: str
    category: str
    date: str
    time: Optional[str] = ""
    venue: Optional[str] = ""
    organizer: Optional[str] = ""
    audience: Optional[str] = "All Employees"
    description: Optional[str] = ""
    status: Optional[str] = "Planned"


def ensure_collection():
    if events_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected")


def serialize_event(event: dict) -> dict:
    return {
        "id": str(event["_id"]),
        "title": event.get("title", ""),
        "category": event.get("category", ""),
        "date": event.get("date", ""),
        "time": event.get("time", ""),
        "venue": event.get("venue", ""),
        "organizer": event.get("organizer", ""),
        "audience": event.get("audience", "All Employees"),
        "description": event.get("description", ""),
        "status": event.get("status", "Planned"),
        "created_at": event.get("created_at", ""),
        "updated_at": event.get("updated_at", ""),
    }

def get_users_for_audience(audience: str):
    if users_collection is None:
        return []

    if audience == "All Employees":
        return list(users_collection.find({"role": "employee"}))

    if audience == "Leadership & Teams":
        return list(users_collection.find({"role": {"$in": ["hr", "manager", "employee"]}}))

    if audience == "HR Team":
        return list(users_collection.find({"role": "hr"}))

    if audience == "Department Only":
        return list(users_collection.find({"role": "employee"}))

    return []


def create_event_notifications(event: dict):
    if notifications_collection is None:
        return

    users = get_users_for_audience(event.get("audience", ""))

    notifications = []
    for user in users:
        notifications.append({
            "title": "New Event Created",
            "message": f"{event.get('title', '')} is scheduled on {event.get('date', '')} at {event.get('time', '') or 'TBA'}. Place: {event.get('venue', '') or 'TBA'}. Details: {event.get('description', '') or 'N/A'}.",
            "type": "event",
            "role": user.get("role"),
            "user_id": str(user.get("_id")),
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    if notifications:
        notifications_collection.insert_many(notifications)
        
@router.get("")
def get_events():
    ensure_collection()
    events = events_collection.find().sort("created_at", -1)
    return {"events": [serialize_event(event) for event in events]}


@router.post("")
def create_event(payload: EventPayload):
    ensure_collection()

    if not payload.title.strip() or not payload.date.strip():
        raise HTTPException(status_code=400, detail="Title and date are required")

    if payload.status not in EVENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid event status")

    now = datetime.now(timezone.utc).isoformat()

    event = {
        "title": payload.title.strip(),
        "category": payload.category.strip(),
        "date": payload.date,
        "time": payload.time or "",
        "venue": payload.venue or "",
        "organizer": payload.organizer or "",
        "audience": payload.audience or "All Employees",
        "description": payload.description or "",
        "status": payload.status or "Planned",
        "created_at": now,
        "updated_at": now,
    }

    result = events_collection.insert_one(event)
    event["_id"] = result.inserted_id

    create_event_notifications(event)

    return serialize_event(event)


@router.put("/{event_id}")
def update_event(event_id: str, payload: EventPayload):
    ensure_collection()

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event id")

    if not payload.title.strip() or not payload.date.strip():
        raise HTTPException(status_code=400, detail="Title and date are required")

    if payload.status not in EVENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid event status")

    update_data = {
        "title": payload.title.strip(),
        "category": payload.category.strip(),
        "date": payload.date,
        "time": payload.time or "",
        "venue": payload.venue or "",
        "organizer": payload.organizer or "",
        "audience": payload.audience or "All Employees",
        "description": payload.description or "",
        "status": payload.status or "Planned",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = events_collection.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    event = events_collection.find_one({"_id": ObjectId(event_id)})
    return serialize_event(event)


@router.delete("/{event_id}")
def delete_event(event_id: str):
    ensure_collection()

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event id")

    result = events_collection.delete_one({"_id": ObjectId(event_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"message": "Event deleted successfully"}
