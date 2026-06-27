from __future__ import annotations

import datetime as dt
import os
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from ....core.errors import ApiException
from ....db.database import get_collection
from ....middleware.common import authorize_roles, get_current_user, require_db_ready
from ....services.candidate_analysis import (
    analyze_with_fastapi,
    build_candidate_ai_fields,
    build_frontend_analysis,
)
from ....services.notifications import create_notification
from ....services.upload_resume import save_resume_upload


router = APIRouter(prefix="/api/applications")


def _serialize_application(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    if "userId" in out and isinstance(out["userId"], ObjectId):
        out["userId"] = str(out["userId"])
    return out


@router.post("/")
def submit_application(
    request: Request,
    resume: Optional[UploadFile] = File(None),
    jobId: str = Form(...),
    jobTitle: str = Form(...),
    company: str = Form(...),
    firstName: str = Form(...),
    lastName: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    linkedin: Optional[str] = Form(None),
    portfolio: Optional[str] = Form(None),
    coverLetter: Optional[str] = Form(None),
):
    require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "candidate")

    user_id = str(user_decoded.get("id"))
    try:
        # Required fields parity with Express
        required = [jobId, jobTitle, company, firstName, lastName, email, phone]
        if any(v is None or v == "" for v in required):
            return JSONResponse(status_code=400, content={"message": "Required fields missing"})

        applications_col = get_collection("applications")
        candidates_col = get_collection("candidates")

        existing = applications_col.find_one({"userId": ObjectId(user_id), "jobId": jobId})
        if existing:
            return JSONResponse(status_code=409, content={"message": "You have already applied for this job"})

        resume_url: Optional[str] = None
        resume_original_name: Optional[str] = None
        resume_mime_type: Optional[str] = None
        resume_path: Optional[str] = None

        if resume:
            try:
                resume_info = save_resume_upload(resume)
            except ValueError as e:
                raise ApiException(status_code=400, payload={"message": str(e)})
            resume_url = f"/uploads/resumes/{resume_info['filename']}"
            resume_original_name = resume_info["originalname"]
            resume_mime_type = resume_info["mimetype"]
            resume_path = resume_info["path"]
        else:
            candidate = candidates_col.find_one({"userId": ObjectId(user_id)})
            if candidate and candidate.get("resumeUrl"):
                resume_url = candidate.get("resumeUrl")
                resume_original_name = candidate.get("resumeOriginalName")
                resume_mime_type = candidate.get("resumeMimeType")
                rel = str(resume_url).lstrip("/")
                backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
                resume_path = os.path.join(backend_root, rel)

        if not resume_url or not resume_path:
            return JSONResponse(status_code=400, content={"message": "Resume is required to apply"})

        applied_job = {"job_title": jobTitle, "company": company, "title": jobTitle}

        # Build resume dict expected by analyze_with_fastapi
        resume_dict = {
            "path": resume_path,
            "originalname": resume_original_name or "resume.pdf",
            "mimetype": resume_mime_type or "application/pdf",
            "filename": os.path.basename(resume_url),
        }

        fast_api_result = analyze_with_fastapi(resume_dict, applied_job=applied_job)
        frontend_analysis = build_frontend_analysis(fast_api_result, resume_dict, user_decoded, applied_job=applied_job)
        ai_fields = build_candidate_ai_fields(fast_api_result)

        candidates_col.update_one(
            {"userId": ObjectId(user_id)},
            {
                "$set": {
                    "userId": ObjectId(user_id),
                    "resumeUrl": resume_url,
                    "resumeOriginalName": resume_original_name,
                    "resumeMimeType": resume_mime_type,
                    "appliedJob": applied_job,
                    "aiAnalysis": frontend_analysis,
                    **ai_fields,
                    "uploadedAt": dt.datetime.utcnow(),
                }
            },
            upsert=True,
        )

        application_doc = {
            "jobId": jobId,
            "jobTitle": jobTitle,
            "company": company,
            "userId": ObjectId(user_id),
            "firstName": firstName,
            "lastName": lastName,
            "email": email,
            "phone": phone,
            "linkedin": linkedin,
            "portfolio": portfolio,
            "coverLetter": coverLetter,
            "resumeUrl": resume_url,
            "resumeOriginalName": resume_original_name,
            "status": "pending",
            "appliedAt": dt.datetime.utcnow(),
        }
        insert_res = applications_col.insert_one(application_doc)
        application_doc["_id"] = insert_res.inserted_id

        create_notification(
            "Application Submitted",
            f'Your application for "{jobTitle}" at {company} has been received.',
            "application_submitted",
            role="candidate",
            recipient_id=user_id,
        )
        create_notification(
            "New Job Application Received",
            f"{firstName} {lastName} has applied for the \"{jobTitle}\" role.",
            "application_submitted",
            role="hr",
        )

        return JSONResponse(
            status_code=201,
            content={"success": True, "message": "Application submitted successfully", "application": _serialize_application(application_doc)},
        )
    except ApiException:
        raise
    except Exception as e:
        raise ApiException(status_code=500, payload={"message": str(e)})


@router.get("/my")
def get_my_applications(request: Request):
    require_db_ready()
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "candidate")
    user_id = str(user_decoded.get("id"))
    try:
        applications_col = get_collection("applications")
        apps = list(applications_col.find({"userId": ObjectId(user_id)}).sort("appliedAt", -1))
        return {"success": True, "applications": [_serialize_application(a) for a in apps]}
    except Exception as e:
        raise ApiException(status_code=500, payload={"message": str(e)})

