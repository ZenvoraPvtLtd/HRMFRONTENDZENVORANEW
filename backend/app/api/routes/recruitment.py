from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import (
    recruitment_candidates_collection,
    recruitment_interviews_collection,
    recruitment_jobs_collection,
)

router = APIRouter(prefix="/api/recruitment", tags=["recruitment"])

JOB_STATUSES = {"Published", "Draft", "Closed"}
CANDIDATE_STATUSES = {"Accepted", "Offered", "Applied", "Rejected"}


class RecruitmentJobPayload(BaseModel):
    title: str
    type: str = "Full Time"
    location: str
    department: str
    status: str = "Published"
    posted: Optional[str] = ""
    description: Optional[str] = ""


class RecruitmentCandidatePayload(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    role: str
    status: str = "Applied"
    applied: Optional[str] = ""
    source: Optional[str] = "Manual"


class RecruitmentInterviewPayload(BaseModel):
    candidate: str
    role: str
    date: str
    time: str
    mode: str = "Video Interview"
    interviewer: Optional[str] = "HR Team"
    meetingLink: Optional[str] = ""


def ensure_collection(collection):
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not connected")


def ensure_object_id(record_id: str, label: str) -> ObjectId:
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail=f"Invalid {label} id")
    return ObjectId(record_id)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_date() -> str:
    return datetime.now().strftime("%d/%m/%Y")


def serialize_job(job: dict) -> dict:
    return {
        "id": str(job["_id"]),
        "title": job.get("title", ""),
        "type": job.get("type", "Full Time"),
        "location": job.get("location", ""),
        "department": job.get("department", ""),
        "status": job.get("status", "Published"),
        "posted": job.get("posted", ""),
        "description": job.get("description", ""),
        "createdAt": job.get("createdAt", ""),
        "updatedAt": job.get("updatedAt", ""),
    }


def serialize_candidate(candidate: dict) -> dict:
    return {
        "id": str(candidate["_id"]),
        "name": candidate.get("name", ""),
        "email": candidate.get("email", ""),
        "phone": candidate.get("phone", ""),
        "role": candidate.get("role", ""),
        "status": candidate.get("status", "Applied"),
        "applied": candidate.get("applied", ""),
        "source": candidate.get("source", "Manual"),
        "createdAt": candidate.get("createdAt", ""),
        "updatedAt": candidate.get("updatedAt", ""),
    }


def serialize_interview(interview: dict) -> dict:
    return {
        "id": str(interview["_id"]),
        "candidate": interview.get("candidate", ""),
        "role": interview.get("role", ""),
        "date": interview.get("date", ""),
        "time": interview.get("time", ""),
        "mode": interview.get("mode", "Video Interview"),
        "interviewer": interview.get("interviewer", "HR Team"),
        "meetingLink": interview.get("meetingLink", ""),
        "createdAt": interview.get("createdAt", ""),
        "updatedAt": interview.get("updatedAt", ""),
    }


@router.get("/jobs")
def get_recruitment_jobs():
    ensure_collection(recruitment_jobs_collection)
    jobs = recruitment_jobs_collection.find().sort("createdAt", -1)
    return {"jobs": [serialize_job(job) for job in jobs]}


@router.post("/jobs")
def create_recruitment_job(payload: RecruitmentJobPayload):
    ensure_collection(recruitment_jobs_collection)

    if not payload.title.strip() or not payload.location.strip() or not payload.department.strip():
        raise HTTPException(status_code=400, detail="Title, location, and department are required")
    if payload.status not in JOB_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid job status")

    timestamp = now_iso()
    job = payload.model_dump()
    job["title"] = job["title"].strip()
    job["location"] = job["location"].strip()
    job["department"] = job["department"].strip()
    job["posted"] = job.get("posted") or default_date()
    job["createdAt"] = timestamp
    job["updatedAt"] = timestamp

    result = recruitment_jobs_collection.insert_one(job)
    job["_id"] = result.inserted_id
    return {"message": "Recruitment job created successfully", "job": serialize_job(job)}


@router.put("/jobs/{job_id}")
def update_recruitment_job(job_id: str, payload: RecruitmentJobPayload):
    ensure_collection(recruitment_jobs_collection)
    object_id = ensure_object_id(job_id, "job")

    if payload.status not in JOB_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid job status")

    update_data = payload.model_dump()
    update_data["updatedAt"] = now_iso()
    result = recruitment_jobs_collection.update_one({"_id": object_id}, {"$set": update_data})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recruitment job not found")

    job = recruitment_jobs_collection.find_one({"_id": object_id})
    return {"message": "Recruitment job updated successfully", "job": serialize_job(job)}


@router.delete("/jobs/{job_id}")
def delete_recruitment_job(job_id: str):
    ensure_collection(recruitment_jobs_collection)
    object_id = ensure_object_id(job_id, "job")
    result = recruitment_jobs_collection.delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recruitment job not found")

    return {"message": "Recruitment job deleted successfully"}


@router.get("/candidates")
def get_recruitment_candidates():
    ensure_collection(recruitment_candidates_collection)
    candidates = recruitment_candidates_collection.find().sort("createdAt", -1)
    return {"candidates": [serialize_candidate(candidate) for candidate in candidates]}


@router.post("/candidates")
def create_recruitment_candidate(payload: RecruitmentCandidatePayload):
    ensure_collection(recruitment_candidates_collection)

    if not payload.name.strip() or not payload.role.strip():
        raise HTTPException(status_code=400, detail="Candidate name and role are required")
    if payload.status not in CANDIDATE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid candidate status")

    timestamp = now_iso()
    candidate = payload.model_dump()
    candidate["name"] = candidate["name"].strip()
    candidate["role"] = candidate["role"].strip()
    candidate["applied"] = candidate.get("applied") or default_date()
    candidate["source"] = candidate.get("source") or "Manual"
    candidate["createdAt"] = timestamp
    candidate["updatedAt"] = timestamp

    result = recruitment_candidates_collection.insert_one(candidate)
    candidate["_id"] = result.inserted_id
    return {"message": "Candidate added successfully", "candidate": serialize_candidate(candidate)}


@router.put("/candidates/{candidate_id}")
def update_recruitment_candidate(candidate_id: str, payload: RecruitmentCandidatePayload):
    ensure_collection(recruitment_candidates_collection)
    object_id = ensure_object_id(candidate_id, "candidate")

    if payload.status not in CANDIDATE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid candidate status")

    update_data = payload.model_dump()
    update_data["updatedAt"] = now_iso()
    result = recruitment_candidates_collection.update_one({"_id": object_id}, {"$set": update_data})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = recruitment_candidates_collection.find_one({"_id": object_id})
    return {"message": "Candidate updated successfully", "candidate": serialize_candidate(candidate)}


@router.delete("/candidates/{candidate_id}")
def delete_recruitment_candidate(candidate_id: str):
    ensure_collection(recruitment_candidates_collection)
    object_id = ensure_object_id(candidate_id, "candidate")
    result = recruitment_candidates_collection.delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {"message": "Candidate deleted successfully"}


@router.get("/interviews")
def get_recruitment_interviews():
    ensure_collection(recruitment_interviews_collection)
    interviews = recruitment_interviews_collection.find().sort("createdAt", -1)
    return {"interviews": [serialize_interview(interview) for interview in interviews]}


@router.post("/interviews")
def schedule_recruitment_interview(payload: RecruitmentInterviewPayload):
    ensure_collection(recruitment_interviews_collection)

    if not payload.candidate.strip() or not payload.role.strip() or not payload.date.strip() or not payload.time.strip():
        raise HTTPException(status_code=400, detail="Candidate, role, date, and time are required")

    timestamp = now_iso()
    interview = payload.model_dump()
    interview["candidate"] = interview["candidate"].strip()
    interview["role"] = interview["role"].strip()
    interview["interviewer"] = interview.get("interviewer") or "HR Team"
    interview["createdAt"] = timestamp
    interview["updatedAt"] = timestamp

    result = recruitment_interviews_collection.insert_one(interview)
    interview["_id"] = result.inserted_id
    return {"message": "Interview scheduled successfully", "interview": serialize_interview(interview)}


@router.put("/interviews/{interview_id}")
def update_recruitment_interview(interview_id: str, payload: RecruitmentInterviewPayload):
    ensure_collection(recruitment_interviews_collection)
    object_id = ensure_object_id(interview_id, "interview")

    update_data = payload.model_dump()
    update_data["updatedAt"] = now_iso()
    result = recruitment_interviews_collection.update_one({"_id": object_id}, {"$set": update_data})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = recruitment_interviews_collection.find_one({"_id": object_id})
    return {"message": "Interview updated successfully", "interview": serialize_interview(interview)}


@router.delete("/interviews/{interview_id}")
def delete_recruitment_interview(interview_id: str):
    ensure_collection(recruitment_interviews_collection)
    object_id = ensure_object_id(interview_id, "interview")
    result = recruitment_interviews_collection.delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Interview not found")

    return {"message": "Interview deleted successfully"}