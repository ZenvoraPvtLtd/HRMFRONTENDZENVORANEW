from fastapi import APIRouter, HTTPException
from bson import ObjectId
from datetime import datetime

from app.core.database import exit_management_collection
from app.models.exit_management import ExitInterviewCreate, ExitInterviewUpdate

router = APIRouter(prefix="/api/exit-management", tags=["Exit Management"])

def serialize_exit(record):
    return {
        "id": str(record["_id"]),
        "employee_id": record.get("employee_id", ""),
        "employee_name": record.get("employee_name", ""),
        "resignation_date": record.get("resignation_date", ""),
        "last_working_date": record.get("last_working_date", ""),
        "reason": record.get("reason", ""),
        "conducted_date": record.get("conducted_date", ""),
        "status": record.get("status", "Pending"),
        "created_at": record.get("created_at", ""),
    }

@router.get("")
async def get_exit_interviews():
    if exit_management_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    records = []
    for record in exit_management_collection.find().sort("created_at", -1):
        records.append(serialize_exit(record))
    return {"exit_interviews": records}

@router.post("")
async def create_exit_interview(payload: ExitInterviewCreate):
    if exit_management_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    data = payload.model_dump()
    data["status"] = "Pending"
    data["conducted_date"] = ""
    data["created_at"] = datetime.utcnow().isoformat()

    result = exit_management_collection.insert_one(data)
    created = exit_management_collection.find_one({"_id": result.inserted_id})
    return serialize_exit(created)

@router.put("/{exit_id}")
async def update_exit_interview(exit_id: str, payload: ExitInterviewUpdate):
    if not ObjectId.is_valid(exit_id):
        raise HTTPException(status_code=400, detail="Invalid exit interview id")

    update_data = {
        key: value
        for key, value in payload.model_dump(exclude_unset=True).items()
        if value is not None
    }

    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    if exit_management_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    exit_management_collection.update_one(
        {"_id": ObjectId(exit_id)},
        {"$set": update_data},
    )

    updated = exit_management_collection.find_one({"_id": ObjectId(exit_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Exit interview not found")

    return serialize_exit(updated)

@router.delete("/{exit_id}")
async def delete_exit_interview(exit_id: str):
    if not ObjectId.is_valid(exit_id):
        raise HTTPException(status_code=400, detail="Invalid exit interview id")

    if exit_management_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    result = exit_management_collection.delete_one({"_id": ObjectId(exit_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exit interview not found")

    return {"message": "Exit interview deleted successfully"}
