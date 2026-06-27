from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ....core.errors import ApiException
from ....db.database import get_collection
from ....middleware.common import authorize_roles, get_current_user, require_db_ready
from ....services.notifications import create_notification


router = APIRouter(prefix="/api/jobs")

allowed_job_types = ["Full-time", "Part-time", "Internship", "Contract"]
allowed_status = ["Open", "Closed", "Paused"]


def to_string_array(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        # JS: value.split(/\n|,/)
        parts: List[str] = []
        for chunk in value.split("\n"):
            parts.extend(chunk.split(","))
        return [p.strip() for p in parts if p.strip()]
    return []


def build_job_payload(body: Dict[str, Any], is_update: bool = False) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    fields = [
        "title",
        "description",
        "department",
        "location",
        "jobType",
        "experienceLevel",
        "status",
    ]

    for field in fields:
        if field in body and body[field] is not None:
            payload[field] = str(body[field]).strip()

    if "salaryMin" in body and body["salaryMin"] != "":
        payload["salaryMin"] = float(body["salaryMin"])

    if "salaryMax" in body and body["salaryMax"] != "":
        payload["salaryMax"] = float(body["salaryMax"])

    if "openings" in body and body["openings"] != "":
        payload["openings"] = int(body["openings"])

    if body.get("applicationDeadline"):
        payload["applicationDeadline"] = dt.datetime.fromisoformat(str(body["applicationDeadline"]))

    if "skills" in body and body["skills"] is not None:
        payload["skills"] = to_string_array(body["skills"])

    if "responsibilities" in body and body["responsibilities"] is not None:
        payload["responsibilities"] = to_string_array(body["responsibilities"])

    if "qualifications" in body and body["qualifications"] is not None:
        payload["qualifications"] = to_string_array(body["qualifications"])

    if not is_update:
        required_fields = [
            "title",
            "description",
            "department",
            "location",
            "jobType",
            "experienceLevel",
            "skills",
            "responsibilities",
            "qualifications",
        ]
        missing = None
        for f in required_fields:
            v = payload.get(f)
            if isinstance(v, list):
                if len(v) == 0:
                    missing = f
                    break
            else:
                if not v:
                    missing = f
                    break
        if missing:
            raise ValueError("Please provide all required job fields")

    if payload.get("jobType") and payload["jobType"] not in allowed_job_types:
        raise ValueError("Invalid job type")

    if payload.get("status") and payload["status"] not in allowed_status:
        raise ValueError("Invalid status value")

    return payload


def get_status_code(error: Exception) -> int:
    msg = str(error)
    return 400 if msg.startswith("Invalid") or msg.startswith("Please") else 500


def _serialize_job(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    if "createdAt" in out and isinstance(out["createdAt"], dt.datetime):
        out["createdAt"] = out["createdAt"].isoformat()
    return out


@router.get("/")
def get_jobs(request: Request):
    require_db_ready()
    _ = get_current_user(request)
    try:
        jobs = list(get_collection("jobs").find().sort("createdAt", -1))
        return {"success": True, "jobs": [_serialize_job(j) for j in jobs]}
    except Exception as e:
        raise ApiException(status_code=500, payload={"success": False, "message": "Failed to fetch jobs", "error": str(e)})


@router.get("/{id}")
def get_job_by_id(request: Request, id: str):
    require_db_ready()
    _ = get_current_user(request)
    try:
        job = get_collection("jobs").find_one({"_id": ObjectId(id)})
        if not job:
            raise ApiException(status_code=404, payload={"success": False, "message": "Job not found"})
        return {"success": True, "job": _serialize_job(job)}
    except ApiException:
        raise
    except Exception as e:
        raise ApiException(status_code=500, payload={"success": False, "message": "Failed to fetch job", "error": str(e)})


@router.post("/")
def create_job(request: Request, body: Dict[str, Any]):
    require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "hr", "employee")
    try:
        user_id = str(user_decoded.get("id"))
        jobs = get_collection("jobs")
        payload = build_job_payload(body, is_update=False)
        now = dt.datetime.utcnow()
        job_doc = {
            **payload,
            "openings": payload.get("openings") or 1,
            "status": payload.get("status") or "Open",
            "createdBy": ObjectId(user_id),
            "createdAt": now,
            "updatedAt": now,
        }
        inserted = jobs.insert_one(job_doc)
        job_doc["_id"] = inserted.inserted_id

        create_notification(
            "New Job Posted",
            f'A new job position "{job_doc.get("title")}" has been created for the {job_doc.get("department")} department.',
            "job_created",
            role="candidate",
        )
        create_notification(
            "Job Posted Successfully",
            f'You have successfully posted the job opening for "{job_doc.get("title")}".',
            "job_created",
            role="hr",
            recipient_id=user_id,
        )

        return JSONResponse(status_code=201, content={"success": True, "job": _serialize_job(job_doc)})
    except Exception as e:
        status_code = get_status_code(e)
        msg = str(e) if status_code == 400 else "Failed to create job"
        raise ApiException(status_code=status_code, payload={"success": False, "message": msg, "error": str(e)})


@router.put("/{id}")
def update_job(request: Request, id: str, body: Dict[str, Any]):
    require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "hr", "employee")
    try:
        payload = build_job_payload(body, is_update=True)
        jobs = get_collection("jobs")
        updated = jobs.find_one({"_id": ObjectId(id)})
        if not updated:
            raise ApiException(status_code=404, payload={"success": False, "message": "Job not found"})

        jobs.update_one({"_id": ObjectId(id)}, {"$set": payload})
        jobs.update_one({"_id": ObjectId(id)}, {"$set": {"updatedAt": dt.datetime.utcnow()}})
        job_doc = jobs.find_one({"_id": ObjectId(id)})
        if not job_doc:
            raise ApiException(status_code=404, payload={"success": False, "message": "Job not found"})

        user_id = str(user_decoded.get("id"))
        create_notification(
            "Job Details Updated",
            f'The job details for "{job_doc.get("title")}" have been updated successfully.',
            "job_updated",
            role="hr",
            recipient_id=user_id,
        )

        return {"success": True, "job": _serialize_job(job_doc)}
    except ApiException:
        raise
    except Exception as e:
        status_code = get_status_code(e)
        msg = str(e) if status_code == 400 else "Failed to update job"
        raise ApiException(status_code=status_code, payload={"success": False, "message": msg, "error": str(e)})


@router.delete("/{id}")
def delete_job(request: Request, id: str):
    require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "hr", "employee")
    try:
        jobs = get_collection("jobs")
        job_doc = jobs.find_one({"_id": ObjectId(id)})
        if not job_doc:
            raise ApiException(status_code=404, payload={"success": False, "message": "Job not found"})
        jobs.delete_one({"_id": ObjectId(id)})

        user_id = str(user_decoded.get("id"))
        create_notification(
            "Job Opening Deleted",
            f'The job opening for "{job_doc.get("title")}" has been deleted.',
            "job_deleted",
            role="hr",
            recipient_id=user_id,
        )
        return {"success": True, "message": "Job deleted successfully"}
    except ApiException:
        raise
    except Exception as e:
        raise ApiException(status_code=500, payload={"success": False, "message": "Failed to delete job", "error": str(e)})

