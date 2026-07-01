from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import jobs_collection

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobPayload(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    jobType: Optional[str] = None
    experienceLevel: Optional[str] = None
    salaryMin: Optional[float] = None
    salaryMax: Optional[float] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = []
    responsibilities: Optional[List[str]] = []
    qualifications: Optional[List[str]] = []
    openings: Optional[int] = 1
    status: Optional[str] = "Open"
    applicationDeadline: Optional[str] = None


def serialize_job(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


@router.get("")
def get_jobs():
    try:
        if jobs_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})
        jobs = [serialize_job(j) for j in jobs_collection.find({}).sort("createdAt", -1)]
        return {"jobs": jobs}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("")
def create_job(payload: JobPayload):
    try:
        if jobs_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})
        data = payload.model_dump()
        data["createdAt"] = datetime.utcnow().isoformat()
        result = jobs_collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        data["id"] = data["_id"]
        return {"job": data, "message": "Job created successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.put("/{job_id}")
def update_job(job_id: str, payload: JobPayload):
    try:
        if jobs_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})
        data = {k: v for k, v in payload.model_dump().items() if v is not None}
        result = jobs_collection.find_one_and_update(
            {"_id": ObjectId(job_id)},
            {"$set": data},
            return_document=True,
        )
        if not result:
            return JSONResponse(status_code=404, content={"message": "Job not found"})
        return {"job": serialize_job(result), "message": "Job updated"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.delete("/{job_id}")
def delete_job(job_id: str):
    try:
        if jobs_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})
        result = jobs_collection.delete_one({"_id": ObjectId(job_id)})
        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"message": "Job not found"})
        return {"message": "Job deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
