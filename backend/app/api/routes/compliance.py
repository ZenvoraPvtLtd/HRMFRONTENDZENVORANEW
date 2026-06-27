from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.core.database import db

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

FALLBACK_COMPLIANCE_RECORDS: list[dict] = []


def get_col():
    if db is None:
        return None
    return db["compliance_records"]


class ComplianceCreate(BaseModel):
    employeeId: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    registrationNumber: str = Field(..., min_length=1)
    amount: str = Field(..., min_length=1)
    period: str = Field(..., min_length=1)


class ComplianceUpdate(BaseModel):
    employeeId: Optional[str] = None
    type: Optional[str] = None
    registrationNumber: Optional[str] = None
    amount: Optional[str] = None
    period: Optional[str] = None


def serialize_record(doc: dict) -> dict:
    record_id = str(doc.get("_id") or doc.get("id"))
    return {
        "id": record_id,
        "_id": record_id,
        "employeeId": doc.get("employeeId", ""),
        "type": doc.get("type", ""),
        "registrationNumber": doc.get("registrationNumber", ""),
        "amount": doc.get("amount", ""),
        "period": doc.get("period", ""),
        "createdAt": doc.get("createdAt", ""),
        "updatedAt": doc.get("updatedAt", ""),
    }


def find_fallback_record(record_id: str) -> tuple[int, dict] | tuple[None, None]:
    for index, record in enumerate(FALLBACK_COMPLIANCE_RECORDS):
        if str(record.get("id") or record.get("_id")) == record_id:
            return index, record
    return None, None


@router.get("")
def list_compliance_records():
    col = get_col()
    if col is None:
        return {"data": [serialize_record(record) for record in FALLBACK_COMPLIANCE_RECORDS]}

    records = col.find({}).sort("createdAt", -1)
    return {"data": [serialize_record(record) for record in records]}


@router.get("/{record_id}")
def get_compliance_record(record_id: str):
    col = get_col()
    if col is None:
        _, record = find_fallback_record(record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Compliance record not found")
        return serialize_record(record)

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid compliance record id")

    record = col.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Compliance record not found")
    return serialize_record(record)


@router.post("")
def create_compliance_record(payload: ComplianceCreate):
    col = get_col()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        **payload.model_dump(),
        "createdAt": now,
        "updatedAt": now,
    }

    if col is None:
        record_id = str(ObjectId())
        record["_id"] = record_id
        record["id"] = record_id
        FALLBACK_COMPLIANCE_RECORDS.insert(0, record)
        return serialize_record(record)

    result = col.insert_one(record)
    record["_id"] = result.inserted_id
    return serialize_record(record)


@router.put("/{record_id}")
def update_compliance_record(record_id: str, payload: ComplianceUpdate):
    updates = {
        key: value
        for key, value in payload.model_dump().items()
        if value is not None
    }
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    col = get_col()

    if col is None:
        index, record = find_fallback_record(record_id)
        if record is None or index is None:
            raise HTTPException(status_code=404, detail="Compliance record not found")
        FALLBACK_COMPLIANCE_RECORDS[index] = {**record, **updates}
        return serialize_record(FALLBACK_COMPLIANCE_RECORDS[index])

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid compliance record id")

    record = col.find_one_and_update(
        {"_id": ObjectId(record_id)},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Compliance record not found")
    return serialize_record(record)


@router.delete("/{record_id}")
def delete_compliance_record(record_id: str):
    col = get_col()
    if col is None:
        index, record = find_fallback_record(record_id)
        if record is None or index is None:
            raise HTTPException(status_code=404, detail="Compliance record not found")
        FALLBACK_COMPLIANCE_RECORDS.pop(index)
        return {"message": "Compliance record deleted successfully"}

    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid compliance record id")

    result = col.delete_one({"_id": ObjectId(record_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compliance record not found")
    return {"message": "Compliance record deleted successfully"}
