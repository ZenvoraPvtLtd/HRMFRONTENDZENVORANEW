from __future__ import annotations

import datetime as dt
import os
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ....middleware.common import get_current_user, authorize_roles
from ....core.errors import ApiException
from ....core.database import db as mongo_db

router = APIRouter(prefix="/api/candidate")


def _str_id(val: Any) -> str:
    if isinstance(val, ObjectId):
        return str(val)
    return str(val) if val is not None else ""


def _serialize_date(val: Any) -> str:
    if isinstance(val, dt.datetime):
        return val.isoformat()
    return str(val) if val else ""


def _split_skills(val: Any) -> List[str]:
    if isinstance(val, list):
        return [s.strip() for s in val if s and str(s).strip()]
    if not val:
        return []
    return [s.strip() for s in str(val).split(",") if s.strip()]


@router.get("/applications")
def get_candidate_applications(request: Request):
    print("[DEBUG] Candidate Applications Auth Header:", request.headers.get("authorization"))
    try:
        user_decoded = get_current_user(request)
        print("[DEBUG] Candidate Applications Decoded User:", user_decoded)
    except Exception as e:
        print("[DEBUG] Candidate Applications Auth Exception:", str(e))
        if hasattr(e, 'payload'):
            print("[DEBUG] ApiException Payload:", e.payload)
        raise
    authorize_roles(user_decoded, "hr", "admin")

    if mongo_db is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database not connected"})

    try:
        applications_col = mongo_db["applications"]
        recruitment_col = mongo_db["recruitment_candidates"]

        app_total = applications_col.count_documents({})
        rec_total = recruitment_col.count_documents({})
        print(f"[DEBUG] applications collection: {app_total} docs, recruitment_candidates: {rec_total} docs")
        out: List[Dict[str, Any]] = []

        for app in applications_col.find({}).sort("createdAt", -1):
            name = (
                app.get("name")
                or f"{app.get('firstName', '')} {app.get('lastName', '')}".strip()
                or "Unknown"
            )

            resume_payload = app.get("resume") or {}
            resume_url = (
                resume_payload.get("url")
                or app.get("resumeUrl")
                or ""
            )
            resume_original_name = (
                resume_payload.get("originalName")
                or app.get("resumeOriginalName")
                or ""
            )
            resume_mime_type = (
                resume_payload.get("mimeType")
                or app.get("resumeMimeType")
                or resume_payload.get("mimetype")
                or ""
            )
            if not resume_original_name and resume_url:
                resume_original_name = os.path.basename(resume_url)


            applied_date = app.get("createdAt") or app.get("appliedAt") or app.get("appliedDate")

            tech_skills = _split_skills(app.get("technicalSkills") or app.get("skills") or "")
            soft_skills = _split_skills(app.get("softSkills") or app.get("softskills") or "")

            out.append({
                "id": _str_id(app.get("_id")),
                "name": name,
                "email": app.get("email", ""),
                "phone": str(app.get("phone", "")),
                "role": app.get("jobTitle") or app.get("role") or "",
                "company": app.get("company", ""),
                "status": app.get("status", "pending"),

                # New nested resume payload (Cloudinary URL preferred)
                "resume": {
                    "url": resume_url,
                    "originalName": resume_original_name,
                    "mimeType": resume_mime_type,
                },

                "resumeUrl": resume_url,
                "resumeOriginalName": resume_original_name,

                "portfolio": app.get("portfolio", ""),
                "linkedin": app.get("linkedin", ""),
                "coverLetter": app.get("coverLetter", ""),
                "appliedDate": _serialize_date(applied_date),
                "matchScore": app.get("matchScore") or 0,
                "experience": app.get("experience") or 0,
                "technicalSkills": tech_skills,
                "softSkills": soft_skills,
                "source": "application",
            })

        for rec in recruitment_col.find({}).sort("createdAt", -1):
            applied_date = rec.get("createdAt") or rec.get("appliedAt") or rec.get("applied") or ""
            resume_payload_rec = rec.get("resume") or {}
            resume_url_rec = (
                resume_payload_rec.get("url")
                or rec.get("resumeUrl")
                or ""
            )
            resume_original_name_rec = (
                resume_payload_rec.get("originalName")
                or rec.get("resumeOriginalName")
                or ""
            )
            resume_mime_type_rec = (
                resume_payload_rec.get("mimeType")
                or rec.get("resumeMimeType")
                or resume_payload_rec.get("mimetype")
                or ""
            )
            if not resume_original_name_rec and resume_url_rec:
                resume_original_name_rec = os.path.basename(resume_url_rec)

            out.append({
                "id": _str_id(rec.get("_id")),
                "name": rec.get("name") or "Unknown",
                "email": rec.get("email", ""),
                "phone": str(rec.get("phone", "")),
                "role": rec.get("role") or rec.get("jobTitle") or "",
                "company": rec.get("company", ""),
                "status": rec.get("status", "Applied"),

                "resume": {
                    "url": resume_url_rec,
                    "originalName": resume_original_name_rec,
                    "mimeType": resume_mime_type_rec,
                },

                "resumeUrl": resume_url_rec,
                "resumeOriginalName": resume_original_name_rec,


                "portfolio": rec.get("portfolio", ""),
                "linkedin": rec.get("linkedin", ""),
                "coverLetter": "",
                "appliedDate": _serialize_date(applied_date) if applied_date else "",
                "matchScore": rec.get("matchScore") or 0,
                "experience": rec.get("experience") or 0,
                "technicalSkills": _split_skills(rec.get("technicalSkills") or rec.get("skills") or ""),
                "softSkills": _split_skills(rec.get("softSkills") or ""),
                "source": "recruitment",
            })

        return JSONResponse(content={"success": True, "candidates": out})

    except Exception as e:
        raise ApiException(status_code=500, payload={"success": False, "message": str(e)})


@router.delete("/applications/all")
def delete_all_candidates(request: Request):
    user_decoded = get_current_user(request)
    authorize_roles(user_decoded, "hr", "admin")

    if mongo_db is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database not connected"})

    try:
        r = mongo_db["applications"].delete_many({})
        return JSONResponse(content={"success": True, "message": f"Deleted {r.deleted_count} application(s)"})
    except Exception as e:
        raise ApiException(status_code=500, payload={"success": False, "message": str(e)})
