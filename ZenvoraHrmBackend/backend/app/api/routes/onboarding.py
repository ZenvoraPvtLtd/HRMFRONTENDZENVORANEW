from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import onboarding_collection

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

ONBOARDING_STATUSES = {"Not Initiated", "Pending", "In Progress", "Completed"}
DOCUMENT_STATUSES = {"Pending", "Submitted", "Verified", "Rejected"}
ASSET_STATUSES = {"Pending", "Assigned", "Not Required"}


class OnboardingPayload(BaseModel):
    employeeId: str
    name: str
    email: str
    department: str
    designation: str
    reportingManager: str
    startDate: str
    employmentType: str
    documentStatus: str = "Pending"
    assetStatus: str = "Pending"
    status: str = "Pending"
    notes: Optional[str] = ""


class OnboardingStatusPayload(BaseModel):
    documentStatus: Optional[str] = None
    assetStatus: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


def ensure_collection():
    if onboarding_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected")


def validate_statuses(payload: OnboardingPayload):
    if payload.status not in ONBOARDING_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid onboarding status")
    if payload.documentStatus not in DOCUMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid document status")
    if payload.assetStatus not in ASSET_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid asset status")


def serialize_record(record: dict) -> dict:
    return {
        "id": str(record["_id"]),
        "employeeId": record.get("employeeId", ""),
        "name": record.get("name", ""),
        "email": record.get("email", ""),
        "department": record.get("department", ""),
        "designation": record.get("designation", ""),
        "reportingManager": record.get("reportingManager", ""),
        "startDate": record.get("startDate", ""),
        "employmentType": record.get("employmentType", ""),
        "documentStatus": record.get("documentStatus", "Pending"),
        "assetStatus": record.get("assetStatus", "Pending"),
        "status": record.get("status", "Pending"),
        "notes": record.get("notes", ""),
        "createdAt": record.get("createdAt", ""),
        "updatedAt": record.get("updatedAt", ""),
    }


@router.get("")
def get_onboarding_records():
    ensure_collection()
    records = onboarding_collection.find().sort("createdAt", -1)
    return {"records": [serialize_record(record) for record in records]}


@router.post("")
def create_onboarding_record(payload: OnboardingPayload):
    ensure_collection()
    validate_statuses(payload)

    if not payload.employeeId.strip() or not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Employee ID, name, and email are required")

    now = datetime.now(timezone.utc).isoformat()
    record = payload.model_dump()
    record["createdAt"] = now
    record["updatedAt"] = now

    result = onboarding_collection.insert_one(record)
    record["_id"] = result.inserted_id

    return {
        "message": "Onboarding record created successfully",
        "record": serialize_record(record),
    }


@router.put("/{record_id}")
def update_onboarding_record(record_id: str, payload: OnboardingPayload):
    ensure_collection()

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid onboarding record id")

    validate_statuses(payload)

    update_data = payload.model_dump()
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = onboarding_collection.update_one(
        {"_id": ObjectId(record_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Onboarding record not found")

    record = onboarding_collection.find_one({"_id": ObjectId(record_id)})
    return {
        "message": "Onboarding record updated successfully",
        "record": serialize_record(record),
    }


@router.patch("/{record_id}/status")
def update_onboarding_status(record_id: str, payload: OnboardingStatusPayload):
    ensure_collection()

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid onboarding record id")

    update_data = {key: value for key, value in payload.model_dump().items() if value is not None}

    if "status" in update_data and update_data["status"] not in ONBOARDING_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid onboarding status")
    if "documentStatus" in update_data and update_data["documentStatus"] not in DOCUMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid document status")
    if "assetStatus" in update_data and update_data["assetStatus"] not in ASSET_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid asset status")

    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = onboarding_collection.update_one(
        {"_id": ObjectId(record_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Onboarding record not found")

    record = onboarding_collection.find_one({"_id": ObjectId(record_id)})
    return {
        "message": "Onboarding status updated successfully",
        "record": serialize_record(record),
    }


@router.delete("/{record_id}")
def delete_onboarding_record(record_id: str):
    ensure_collection()

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid onboarding record id")

    result = onboarding_collection.delete_one({"_id": ObjectId(record_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Onboarding record not found")

    return {"message": "Onboarding record deleted successfully"}
