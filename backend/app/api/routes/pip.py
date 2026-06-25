from datetime import datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.core.database import pip_collection
from app.models.pip import PIPCreate, PIPUpdate

router = APIRouter(prefix="/api/pip", tags=["PIP"])


def serialize_pip(record):
    return {
        "id": str(record["_id"]),
        "employee_id": record.get("employee_id", ""),
        "employee_name": record.get("employee_name", ""),
        "issue_description": record.get("issue_description", ""),
        "expectations": record.get("expectations", ""),
        "timeline_days": record.get("timeline_days", 0),
        "start_date": record.get("start_date", ""),
        "end_date": record.get("end_date", ""),
        "warning_message": record.get("warning_message", ""),
        "status": record.get("status", "Active"),
        "created_at": record.get("created_at", ""),
    }


@router.get("")
async def get_pips():
    if pip_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    records = []
    for record in pip_collection.find().sort("created_at", -1):
        records.append(serialize_pip(record))

    return {"pips": records}


@router.post("")
async def create_pip(payload: PIPCreate):
    if pip_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    data = payload.model_dump()
    data["status"] = data.get("status") or "Active"
    data["created_at"] = datetime.utcnow().isoformat()

    if not data.get("warning_message"):
        data["warning_message"] = (
            "You are expected to improve your performance within the given timeline. "
            "If improvement is not observed, further disciplinary action, including "
            "termination, may be considered as per company policy."
        )

    if not data.get("end_date") and data.get("start_date") and data.get("timeline_days"):
        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d")
            data["end_date"] = (
                start_date + timedelta(days=data["timeline_days"])
            ).strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="start_date must be YYYY-MM-DD")

    result = pip_collection.insert_one(data)
    created = pip_collection.find_one({"_id": result.inserted_id})

    return serialize_pip(created)


@router.put("/{pip_id}")
async def update_pip(pip_id: str, payload: PIPUpdate):
    if not ObjectId.is_valid(pip_id):
        raise HTTPException(status_code=400, detail="Invalid PIP id")

    if pip_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    update_data = {
        key: value
        for key, value in payload.model_dump(exclude_unset=True).items()
        if value is not None
    }

    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    pip_collection.update_one(
        {"_id": ObjectId(pip_id)},
        {"$set": update_data},
    )

    updated = pip_collection.find_one({"_id": ObjectId(pip_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="PIP not found")

    return serialize_pip(updated)


@router.delete("/{pip_id}")
async def delete_pip(pip_id: str):
    if not ObjectId.is_valid(pip_id):
        raise HTTPException(status_code=400, detail="Invalid PIP id")

    if pip_collection is None:
        raise HTTPException(status_code=503, detail="Database offline")

    result = pip_collection.delete_one({"_id": ObjectId(pip_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PIP not found")

    return {"message": "PIP deleted successfully"}
