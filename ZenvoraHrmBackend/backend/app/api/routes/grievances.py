from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import grievances_collection
from app.core.jwt_auth import TokenPayload, get_current_user

router = APIRouter(prefix="/api/grievances", tags=["grievances"])


class GrievanceCreate(BaseModel):
    subject: str
    category: str
    description: str
    priority: str = "Medium"
    employee_name: Optional[str] = ""
    employee_email: Optional[str] = ""


class GrievanceStatusUpdate(BaseModel):
    status: str
    resolution: Optional[str] = ""


def ensure_collection():
    if grievances_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not connected",
        )


def serialize_grievance(grievance: dict) -> dict:
    grievance["id"] = str(grievance["_id"])
    grievance.pop("_id", None)

    for key in ["created_at", "updated_at", "resolved_at"]:
        if grievance.get(key):
            grievance[key] = grievance[key].isoformat()

    return grievance


def notify_employee_grievance_updated(grievance: dict, status_value: str, hr_user_id: str = None):
    try:
        from app.services.notifications import create_notification
        subject = grievance.get('subject', 'request')

        # Notify the employee who submitted the grievance
        employee_id = grievance.get("employee_id")
        if employee_id:
            create_notification(
                title="Grievance Status Updated",
                message=f"Your grievance '{subject}' status is now '{status_value}'.",
                type_="grievance_status_updated",
                recipient_id=str(employee_id),
            )

        # Also notify HR who made the update
        if hr_user_id and hr_user_id != str(employee_id):
            create_notification(
                title="Grievance Updated",
                message=f"You updated grievance '{subject}' to '{status_value}'.",
                type_="grievance_status_updated",
                recipient_id=str(hr_user_id),
            )
    except Exception as e:
        print(f"[NOTIFY] Failed to send grievance notification: {e}")


@router.post("")
def create_grievance(
    payload: GrievanceCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    ensure_collection()

    grievance = {
        "employee_id": current_user.sub,
        "employee_name": (payload.employee_name or "").strip(),
        "employee_email": (payload.employee_email or "").strip().lower(),
        "subject": payload.subject.strip(),
        "category": payload.category.strip(),
        "description": payload.description.strip(),
        "priority": payload.priority,
        "status": "Open",
        "resolution": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "resolved_at": None,
    }

    result = grievances_collection.insert_one(grievance)
    grievance["_id"] = result.inserted_id

    return serialize_grievance(grievance)


@router.get("")
def get_all_grievances(current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()

    grievances = grievances_collection.find().sort("created_at", -1)
    return [serialize_grievance(item) for item in grievances]


@router.get("/my")
def get_my_grievances(current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()

    grievances = grievances_collection.find(
        {"employee_id": current_user.sub}
    ).sort("created_at", -1)

    return [serialize_grievance(item) for item in grievances]


@router.patch("/{grievance_id}/status")
def update_grievance_status(
    grievance_id: str,
    payload: GrievanceStatusUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    ensure_collection()

    if not ObjectId.is_valid(grievance_id):
        raise HTTPException(status_code=400, detail="Invalid grievance id")

    updates = {
        "status": payload.status,
        "resolution": payload.resolution or "",
        "updated_at": datetime.utcnow(),
    }

    if payload.status in ["Resolved", "Closed", "Rejected"]:
        updates["resolved_at"] = datetime.utcnow()

    result = grievances_collection.update_one(
        {"_id": ObjectId(grievance_id)},
        {"$set": updates},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Grievance not found")

    grievance = grievances_collection.find_one({"_id": ObjectId(grievance_id)})
    notify_employee_grievance_updated(grievance, payload.status, hr_user_id=current_user.sub)
    return serialize_grievance(grievance)


@router.delete("/{grievance_id}")
def delete_grievance(
    grievance_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    ensure_collection()

    if not ObjectId.is_valid(grievance_id):
        raise HTTPException(status_code=400, detail="Invalid grievance id")

    result = grievances_collection.delete_one({"_id": ObjectId(grievance_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Grievance not found")

    return {"message": "Grievance deleted successfully"}
