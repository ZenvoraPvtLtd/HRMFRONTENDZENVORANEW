from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.core.database import db

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


# In-memory fallback used when MongoDB is not available (development mode)
FALLBACK_HOLIDAYS: list[dict] = []


def get_col():
    if db is None:
        return None
    return db["holidays"]


class HolidayCreate(BaseModel):
    title: str = Field(..., min_length=1)
    date: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    status: str = Field(default="Active")
    region: str = Field(default="All")


class HolidayUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    region: Optional[str] = None


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


SEED_HOLIDAYS = [
    { "title": "New Year", "date": "2026-01-01", "type": "Public Holiday", "status": "Active", "region": "All" },
    { "title": "Republic Day", "date": "2026-01-26", "type": "National Holiday", "status": "Active", "region": "All" },
    { "title": "Holi", "date": "2026-03-04", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Labour Day", "date": "2026-05-01", "type": "Government Holiday", "status": "Active", "region": "All" },
    { "title": "Independence Day", "date": "2026-08-15", "type": "National Holiday", "status": "Active", "region": "All" },
    { "title": "Raksha Bandhan", "date": "2026-08-28", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Janmashtami", "date": "2026-09-04", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Gandhi Jayanti", "date": "2026-10-02", "type": "National Holiday", "status": "Active", "region": "All" },
    { "title": "Dussehra", "date": "2026-10-20", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Diwali", "date": "2026-11-08", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Guru Nanak Jayanti", "date": "2026-11-24", "type": "Government / Festival", "status": "Active", "region": "All" },
    { "title": "Christmas", "date": "2026-12-25", "type": "Public Holiday", "status": "Active", "region": "All" }
]


@router.get("")
def list_holidays():
    col = get_col()
    if col is None:
        # Return fallback in-memory data when DB is offline
        if not FALLBACK_HOLIDAYS:
            for idx, h in enumerate(SEED_HOLIDAYS):
                h_copy = h.copy()
                h_copy["id"] = str(idx + 1)
                h_copy["_id"] = str(idx + 1)
                FALLBACK_HOLIDAYS.append(h_copy)
        return {"data": [serialize(doc) if "_id" in doc else {**doc, "_id": str(doc.get("id")), "id": str(doc.get("id"))} for doc in FALLBACK_HOLIDAYS]}

    docs = list(col.find({}).sort("date", 1))
    if not docs:
        col.insert_many([{**h, "created_at": datetime.utcnow().isoformat()} for h in SEED_HOLIDAYS])
        docs = list(col.find({}).sort("date", 1))

    return {"data": [serialize(doc) for doc in docs]}


@router.post("")
def create_holiday(payload: HolidayCreate):
    col = get_col()
    data = payload.model_dump()
    data["created_at"] = datetime.utcnow().isoformat()

    if col is None:
        # Create in fallback store
        new_id = str(ObjectId())
        data["_id"] = new_id
        data["id"] = new_id
        FALLBACK_HOLIDAYS.append(data)
        return data

    result = col.insert_one(data)
    data["_id"] = str(result.inserted_id)
    data["id"] = data["_id"]
    return data


@router.put("/{holiday_id}")
def update_holiday(holiday_id: str, payload: HolidayUpdate):
    col = get_col()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if col is None:
        # Update in fallback store
        for i, doc in enumerate(FALLBACK_HOLIDAYS):
            doc_id = doc.get("id") or doc.get("_id")
            if str(doc_id) == holiday_id:
                FALLBACK_HOLIDAYS[i] = {**doc, **updates}
                updated = FALLBACK_HOLIDAYS[i]
                return {**updated, "_id": str(updated.get("id")), "id": str(updated.get("id"))}
        raise HTTPException(status_code=404, detail="Holiday not found")

    if not ObjectId.is_valid(holiday_id):
        raise HTTPException(status_code=400, detail="Invalid holiday ID format")
    oid = ObjectId(holiday_id)

    result = col.find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Holiday not found")

    return serialize(result)


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: str):
    col = get_col()
    if col is None:
        for i, doc in enumerate(FALLBACK_HOLIDAYS):
            doc_id = doc.get("id") or doc.get("_id")
            if str(doc_id) == holiday_id:
                FALLBACK_HOLIDAYS.pop(i)
                return {"message": "Holiday deleted"}
        raise HTTPException(status_code=404, detail="Holiday not found")

    if not ObjectId.is_valid(holiday_id):
        raise HTTPException(status_code=400, detail="Invalid holiday ID format")
    oid = ObjectId(holiday_id)

    result = col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")

    return {"message": "Holiday deleted"}
