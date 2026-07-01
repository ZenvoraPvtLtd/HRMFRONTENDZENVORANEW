from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from ..core.config import get_settings


settings = get_settings()


to_array_cache: Dict[str, Any] = {}


def to_array(value: Any) -> List[str]:
    """
    Port of TS `toArray` helper from `backend/src/controllers/candidate.controller.ts`.
    """
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        s = value
        s_stripped = s.strip()
        if not s_stripped:
            return []

        # Try JSON
        try:
            parsed = json.loads(s_stripped)
            if isinstance(parsed, list):
                return [str(skill).strip() for skill in parsed if str(skill).strip()]
        except Exception:
            pass

        parts = s_stripped.split(",")
        out: List[str] = []
        for item in parts:
            cleaned = item.strip()
            # Remove wrapping quotes/brackets (best-effort parity with JS regex).
            cleaned = cleaned.replace('["', "").replace('"]', "")
            cleaned = cleaned.replace("['", "").replace("']", "")
            cleaned = cleaned.replace("[", "").replace("]", "")
            cleaned = cleaned.strip().strip('"').strip("'")
            if cleaned:
                out.append(cleaned)
        return out

    return []


def flatten_candidate_skills(candidate_data: Dict[str, Any]) -> List[str]:
    skills = candidate_data.get("skills") or {}
    return [
        *to_array(skills.get("technical_skills")),
        *to_array(skills.get("soft_skills")),
        *to_array(skills.get("tools_and_technologies")),
    ]


DEGREE_KEYWORDS = [
    "b.tech",
    "m.tech",
    "btech",
    "mtech",
    "b.e",
    "m.e",
    "bsc",
    "msc",
    "mba",
    "bca",
    "mca",
    "phd",
    "b.sc",
    "m.sc",
]

JOB_ROLE_WORDS = [
    "backend",
    "frontend",
    "fullstack",
    "full-stack",
    "developer",
    "engineer",
    "designer",
    "analyst",
    "manager",
    "intern",
    "lead",
    "devops",
    "data scientist",
]


def is_likely_degree(name: str) -> bool:
    return any(kw == name.lower().strip() for kw in DEGREE_KEYWORDS)


def get_candidate_name(candidate_data: Dict[str, Any], fallback: str = "Candidate") -> str:
    parsed_name = (
        candidate_data.get("personal_information", {}).get("full_name")
        or candidate_data.get("name")
        or ""
    )
    if parsed_name and not is_likely_degree(parsed_name):
        return parsed_name
    return fallback


def get_candidate_email(candidate_data: Dict[str, Any], fallback: str = "") -> str:
    return (
        candidate_data.get("personal_information", {}).get("email")
        or candidate_data.get("email")
        or fallback
    )


def clean_user_name(name: str) -> str:
    parts = name.strip().split()
    cleaned = [p for p in parts if p.lower() not in JOB_ROLE_WORDS]
    return " ".join(cleaned) if cleaned else name.strip()


def get_match_score(analysis: Dict[str, Any]) -> int:
    ranking_job_fit = analysis.get("ranking_result", {}).get("job_fit_score")
    risk_semantic = analysis.get("risk_analysis", {}).get("semantic_similarity")
    raw = ranking_job_fit if ranking_job_fit is not None else risk_semantic
    try:
        return int(round(float(raw or 0)))
    except Exception:
        return 0


def build_frontend_analysis(
    fast_api_result: Dict[str, Any],
    resume: Dict[str, Any],
    user: Dict[str, Any],
    applied_job: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    candidate_data = fast_api_result.get("candidate_data") or fast_api_result.get("data") or {}
    ranking = fast_api_result.get("ranking_result") or {}
    risk = fast_api_result.get("risk_analysis") or {}

    match_score = get_match_score(fast_api_result)

    applied_job = applied_job or {}
    job_title = str(
        applied_job.get("job_title")
        or applied_job.get("title")
        or ranking.get("ranking")
        or "Applied Role"
    )

    status = "Rejected" if risk.get("decision") == "REJECT" else ("Shortlisted" if match_score >= 70 else "Pending")

    return {
        "candidate": {
            "name": get_candidate_name(candidate_data, user.get("name") or "Candidate"),
            "email": get_candidate_email(candidate_data, user.get("email") or ""),
            "skills": candidate_data.get("skills") or {},
            "experience": candidate_data.get("experience") or {},
        },
        "application": {
            "role": job_title,
            "appliedDate": _today_iso_date(),
            "status": status,
            "matchScore": match_score,
            "recommendation": ranking.get("ranking") or "Analysis Complete",
        },
        "resume": {
            "url": resume.get("secure_url"),
            "originalName": resume.get("originalname"),
            "mimeType": resume.get("mimetype"),
        },
        "ai": {
            "parsedResume": candidate_data,
            "recommendedJobs": fast_api_result.get("recommended_jobs") or [],
            "riskAnalysis": risk,
            "rankingResult": ranking,
            "jdData": fast_api_result.get("jd_data") or {},
        },
    }


def _today_iso_date() -> str:
    # Node uses `new Date().toISOString().slice(0,10)` which is UTC date.
    import datetime as dt

    return dt.datetime.utcnow().date().isoformat()


def build_candidate_ai_fields(fast_api_result: Dict[str, Any]) -> Dict[str, Any]:
    candidate_data = fast_api_result.get("candidate_data") or fast_api_result.get("data") or {}
    return {
        "parsedResume": candidate_data,
        "detectedSkills": flatten_candidate_skills(candidate_data),
        "detectedExperience": candidate_data.get("experience", {}).get("experience")
        or candidate_data.get("experience")
        or {},
        "riskAnalysis": fast_api_result.get("risk_analysis") or {},
        "rankingResult": fast_api_result.get("ranking_result") or {},
        "recommendedJobs": fast_api_result.get("recommended_jobs") or [],
        "fastApiParsedResumeId": fast_api_result.get("parsed_resume_id")
        or (fast_api_result.get("data") or {}).get("_id")
        or fast_api_result.get("_id"),
    }


def get_mern_fallback_analysis(resume: Dict[str, Any], applied_job: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    applied_job = applied_job or {}

    original_name = str(resume.get("originalname") or resume.get("filename") or "")
    # Extract plausible name from filename
    base = original_name
    if "." in base:
        base = ".".join(base.split(".")[:-1])
    base = base.replace("resume", "").replace("cv", "")
    base = base.replace("Resume", "").replace("CV", "")
    # Remove underscores/dashes.
    base = base.replace("_", " ").replace("-", " ")
    parts = [p for p in base.strip().split() if p]
    full_name = " ".join(parts) if parts else "Candidate User"

    job_title = str(applied_job.get("job_title") or applied_job.get("title") or "Software Engineer")
    seed = len(original_name) + len(job_title)
    match_score = 65 + (seed % 30)
    risk_score = 10 + (seed % 25)

    return {
        "success": True,
        "candidate_data": {
            "personal_information": {
                "full_name": full_name,
                "email": f"{parts[0] if parts else 'candidate'}@example.com".lower(),
            },
            "skills": {
                "technical_skills": ["JavaScript", "React", "Node.js", "Express", "MongoDB", "HTML/CSS"],
                "soft_skills": ["Communication", "Teamwork", "Problem Solving"],
                "tools_and_technologies": ["Git", "VS Code", "Postman"],
            },
            "experience": {
                "experience": {
                    "total_experience_years": 2 + (seed % 5),
                    "experience_text": "Experienced in building scalable web applications.",
                }
            },
        },
        "ranking_result": {
            "job_fit_score": match_score,
            "ranking": "Shortlisted" if match_score >= 75 else "Pending",
            "semantic_similarity": match_score - 5,
            "skill_score": match_score + 5,
            "experience_score": match_score,
            "matched_skills": ["JavaScript", "React", "Node.js"],
            "missing_skills": ["TypeScript", "Docker"],
        },
        "risk_analysis": {
            "risk_score": risk_score,
            "decision": "SAFE" if risk_score < 30 else "REVIEW",
            "semantic_similarity": match_score - 5,
            "skill_overlap_score": match_score,
            "matched_skills": ["JavaScript", "React", "Node.js"],
            "missing_skills": ["TypeScript", "Docker"],
            "risk_factors": [
                "Slight grammar inconsistencies detected",
                "Generic objective statement",
            ]
            if risk_score >= 30
            else [],
            "grammar_score": 90 - (seed % 10),
        },
        "recommended_jobs": [],
    }


def analyze_with_fastapi(resume: Dict[str, Any], applied_job: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Calls legacy FastAPI `/analyze_application` and falls back on exception/non-success.
    """
    applied_job = applied_job or {}

    fast_api_base = settings["FASTAPI_BASE_URL"] or "http://localhost:8000"
    url = f"{fast_api_base}/analyze_application"

    form_data = {
        "job_title": str(applied_job.get("job_title") or applied_job.get("title") or ""),
        "department": str(applied_job.get("department") or applied_job.get("field") or ""),
        "location": str(applied_job.get("location") or ""),
        "experience_required": str(applied_job.get("experience_required") or applied_job.get("experience") or ""),
        "required_skills": json.dumps(
            to_array(applied_job.get("required_skills") or applied_job.get("skills") or applied_job.get("tags"))
        ),
        "job_description": str(applied_job.get("job_description") or applied_job.get("description") or ""),
    }

    resume_path = resume.get("path")
    if not resume_path:
        # No disk path => cannot call FastAPI; fallback.
        return get_mern_fallback_analysis(resume, applied_job)

    try:
        with open(resume_path, "rb") as f:
            files = {
                "resume": (resume.get("originalname") or "resume.pdf", f, resume.get("mimetype") or "application/pdf")
            }
            resp = requests.post(url, files=files, data=form_data, timeout=120)
        result = resp.json() if resp.content else {}

        if (not resp.ok) or result.get("success") is False:
            return get_mern_fallback_analysis(resume, applied_job)
        return result
    except Exception:
        return get_mern_fallback_analysis(resume, applied_job)

