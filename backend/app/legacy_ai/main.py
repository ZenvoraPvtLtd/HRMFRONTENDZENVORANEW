import os
import shutil

import json

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ResumeParser import universal_parser
from Extractor import build_json
from database import collection
from JDExtractor import build_jd_json
from RankingEngine import generate_candidate_ranking


from pydantic import BaseModel
from JobMatcher import match_jobs
from database import jobs_collection

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


@app.get("/health")
def health():
    return {"success": True, "service": "fastapi-ai", "status": "ok"}


def save_upload_file(upload_file: UploadFile, prefix: str = ""):
    safe_name = os.path.basename(upload_file.filename or "uploaded-file")
    file_path = os.path.join(UPLOAD_DIR, f"{prefix}{safe_name}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return file_path


def normalize_required_skills(required_skills: str | None):
    if not required_skills:
        return []

    try:
        parsed = json.loads(required_skills)
        if isinstance(parsed, list):
            return [str(skill) for skill in parsed]
    except Exception:
        pass

    return [
        skill.strip()
        for skill in required_skills.split(",")
        if skill.strip()
    ]


def build_job_description_text(
    job_title: str | None,
    department: str | None,
    location: str | None,
    experience_required: str | None,
    required_skills: list[str],
    job_description: str | None,
):
    return "\n".join(
        [
            f"Job Title: {job_title or ''}",
            f"Department: {department or ''}",
            f"Location: {location or ''}",
            f"Experience Required: {experience_required or ''}",
            f"Required Skills: {', '.join(required_skills)}",
            f"Job Description: {job_description or ''}",
        ]
    )


def flatten_resume_skills(resume_data: dict):
    skills = resume_data.get("skills", {}) or {}
    detected = []

    for key in ("technical_skills", "soft_skills", "tools_and_technologies"):
        value = skills.get(key, [])
        if isinstance(value, list):
            detected.extend([str(skill) for skill in value if skill])

    return detected


def store_parsed_resume(payload: dict):
    if collection is None:
        return None

    result = collection.insert_one(payload)
    return str(result.inserted_id)





# JOB OPENING SCHEMA


class JobOpening(BaseModel):

    job_title: str

    required_skills: list[str]

    experience_required: str

    department: str

    location: str

    job_description: str



# CREATE JOB OPENING ENDPOINT


@app.post("/create_job_opening")
def create_job_opening(job: JobOpening):

    job_data = job.dict()

    result = jobs_collection.insert_one(
        job_data
    )

    return {

        "success": True,

        "message":
        "Job created successfully",

        "job_id":
        str(result.inserted_id)
    }

# SMART JOB MATCH ENDPOINT


@app.post("/smart_job_match")
async def smart_job_match(
    file: UploadFile = File(...)
):

    try:

        # -----------------------------
        # Save Resume
        # -----------------------------

        file_path = (
            f"{UPLOAD_DIR}/{file.filename}"
        )

        with open(file_path, "wb") as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

        # -----------------------------
        # Parse Resume
        # -----------------------------

        extracted_text = universal_parser(
            file_path
        )

        parsed_data = build_json(
            extracted_text
        )

        # -----------------------------
        # Match Jobs
        # -----------------------------

        matched_jobs = match_jobs(
            parsed_data
        )

        # -----------------------------
        # Response
        # -----------------------------

        return {

            "candidate_name":
                parsed_data.get("personal_information", {}).get("full_name")
                or parsed_data.get("name"),

            "candidate_skills":
                parsed_data.get("skills"),

            "candidate_experience":
                parsed_data.get("experience"),

            "recommended_jobs":
                matched_jobs
        }

    except Exception as e:

        return JSONResponse(

            status_code=500,

            content={
                "error": str(e),

                "message":
                    "Smart Job Matching Failed"
            }
        )


from RiskAnalyzer import (
    analyze_candidate_risk
)

@app.post("/risk_analysis")
async def risk_analysis(
    resume: UploadFile,
    jd: UploadFile
):

    # -----------------------------
    # Save Resume
    # -----------------------------

    resume_path = (
        f"uploads/{resume.filename}"
    )

    with open(resume_path, "wb") as f:
        f.write(await resume.read())

    # -----------------------------
    # Parse Resume
    # -----------------------------

    resume_text = universal_parser(
        resume_path
    )

    resume_data = build_json(
        resume_text
    )

    # -----------------------------
    # Save JD
    # -----------------------------

    jd_path = (
        f"uploads/{jd.filename}"
    )

    with open(jd_path, "wb") as f:
        f.write(await jd.read())

    # -----------------------------
    # Parse JD
    # -----------------------------

    jd_text = universal_parser(
        jd_path
    )

    jd_data = build_jd_json(
        jd_text
    )

    # -----------------------------
    # Risk Analysis
    # -----------------------------

    risk_result = (
        analyze_candidate_risk(
            resume_data,
            jd_data,
            resume_text,
            jd_text
        )
    )

    return {
        "candidate_data": resume_data,

        "jd_data": jd_data,

        "risk_analysis": risk_result
    }


@app.post("/candidate_ranking")
async def candidate_ranking(
    resume: UploadFile,
    jd: UploadFile
):

    # -----------------------------
    # Parse Resume
    # -----------------------------

    resume_path = f"uploads/{resume.filename}"

    with open(resume_path, "wb") as f:
        f.write(await resume.read())

    resume_text = universal_parser(resume_path)

    resume_data = build_json(resume_text)

    # -----------------------------
    # Parse JD
    # -----------------------------

    jd_path = f"uploads/{jd.filename}"

    with open(jd_path, "wb") as f:
        f.write(await jd.read())

    jd_text = universal_parser(jd_path)

    jd_data = build_jd_json(jd_text)

    # -----------------------------
    # Generate Ranking
    # -----------------------------

    ranking_result = (
        generate_candidate_ranking(
            resume_data,
            jd_data,
            resume_text,
            jd_text
        )
    )

    return {
        "candidate_data": resume_data,
        "jd_data": jd_data,
        "ranking_result": ranking_result
    }


@app.post("/parse_resume")
async def parse_resume(file: UploadFile = File(...)):
    try:
        file_path = f"{UPLOAD_DIR}/{file.filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        extracted_text = universal_parser(file_path)

        parsed_data = build_json(extracted_text)

        parsed_data["raw_resume_text"] = extracted_text

        # Insert into database if available
        if collection is not None:
            stored_data = {
                **parsed_data,
                "detected_skills": flatten_resume_skills(parsed_data),
                "detected_experience": parsed_data.get("experience", {}).get("experience", {}),
            }
            parsed_resume_id = store_parsed_resume(stored_data)
            if parsed_resume_id:
                parsed_data["_id"] = parsed_resume_id  # Convert ObjectId to string
        else:
            print("Warning: MongoDB not available. Data not stored in database.")

        return {
            "message": "Resume Parsed Successfully",
            "parsed_resume_id": parsed_data.get("_id"),
            "detected_skills": flatten_resume_skills(parsed_data),
            "detected_experience": parsed_data.get("experience", {}).get("experience", {}),
            "data": parsed_data
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "message": "Failed to parse resume"}
        )


@app.post("/analyze_application")
async def analyze_application(
    resume: UploadFile = File(...),
    job_title: str | None = Form(None),
    required_skills: str | None = Form(None),
    experience_required: str | None = Form(None),
    department: str | None = Form(None),
    location: str | None = Form(None),
    job_description: str | None = Form(None),
):
    try:
        resume_path = save_upload_file(resume, "application-")
        resume_text = universal_parser(resume_path)
        resume_data = build_json(resume_text)
        resume_data["raw_resume_text"] = resume_text

        matched_jobs = match_jobs(resume_data, resume_text)

        required_skills_list = normalize_required_skills(required_skills)
        jd_text = build_job_description_text(
            job_title,
            department,
            location,
            experience_required,
            required_skills_list,
            job_description,
        )
        jd_data = build_jd_json(jd_text)

        risk_result = analyze_candidate_risk(
            resume_data,
            jd_data,
            resume_text,
            jd_text,
        )

        ranking_result = generate_candidate_ranking(
            resume_data,
            jd_data,
            resume_text,
            jd_text,
        )

        parsed_resume_id = None

        if collection is not None:
            stored_data = {
                **resume_data,
                "detected_skills": flatten_resume_skills(resume_data),
                "detected_experience": resume_data.get("experience", {}).get("experience", {}),
                "application_job": {
                    "job_title": job_title,
                    "required_skills": required_skills_list,
                    "experience_required": experience_required,
                    "department": department,
                    "location": location,
                    "job_description": job_description,
                },
                "recommended_jobs": matched_jobs,
                "risk_analysis": risk_result,
                "ranking_result": ranking_result,
            }
            parsed_resume_id = store_parsed_resume(stored_data)
            if parsed_resume_id:
                resume_data["_id"] = parsed_resume_id

        return {
            "success": True,
            "message": "Application analyzed successfully",
            "parsed_resume_id": parsed_resume_id,
            "candidate_data": resume_data,
            "detected_skills": flatten_resume_skills(resume_data),
            "detected_experience": resume_data.get("experience", {}).get("experience", {}),
            "jd_data": jd_data,
            "recommended_jobs": matched_jobs,
            "risk_analysis": risk_result,
            "ranking_result": ranking_result,
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "Application analysis failed",
            },
        )