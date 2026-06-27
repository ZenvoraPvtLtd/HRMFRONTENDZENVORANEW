from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from app.services.skill_extractor import extract_skills
from app.services.skill_matcher import llm_skill_match
from app.services.resume_service import (
    analyze_resume_against_job,
    flatten_resume_skills,
    parse_jd_upload,
    parse_resume_upload,
    store_parsed_resume,
)

router = APIRouter(tags=["resumes"])


@router.post("/parse_resume")
async def parse_resume(file: UploadFile = File(...)):
    try:
        from JobMatcher import match_jobs
        from RankingEngine import generate_candidate_ranking
        from RiskAnalyzer import analyze_candidate_risk

        parsed_data = parse_resume_upload(file)
        stored_data = {
            **parsed_data,
            "detected_skills": flatten_resume_skills(parsed_data),
            "detected_experience": parsed_data.get("experience", {}).get("experience", {}),
        }
        parsed_resume_id = store_parsed_resume(stored_data)
        if parsed_resume_id:
            parsed_data["_id"] = parsed_resume_id

        return {
            "message": "Resume Parsed Successfully",
            "parsed_resume_id": parsed_data.get("_id"),
            "detected_skills": flatten_resume_skills(parsed_data),
            "detected_experience": parsed_data.get("experience", {}).get("experience", {}),
            "data": parsed_data,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "message": "Failed to parse resume"},
        )

@router.post("/debug-skills")
async def debug_skills(
    text: str = Form(...)
):
    skills = extract_skills(text)

    print("\n===== DEBUG SKILLS =====")
    print(skills)

    return {
        "skills": skills
    }

@router.post("/smart_job_match")
async def smart_job_match(file: UploadFile = File(...)):
    try:
        from JobMatcher import match_jobs
        parsed_data = parse_resume_upload(file)
        matched_jobs = match_jobs(parsed_data)
        return {
            "candidate_name": (
                parsed_data.get("name")
                or parsed_data.get("personal_information", {}).get("full_name")
            ),
            "candidate_skills": parsed_data.get("skills"),
            "candidate_experience": parsed_data.get("experience"),
            "recommended_jobs": matched_jobs,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "message": "Smart Job Matching Failed"},
        )


@router.post("/risk_analysis")
async def risk_analysis(resume: UploadFile, jd: UploadFile):
    from RiskAnalyzer import analyze_candidate_risk
    resume_data = parse_resume_upload(resume)
    resume_text = resume_data["raw_resume_text"]
    jd_text, jd_data = parse_jd_upload(jd)
    return {
        "candidate_data": resume_data,
        "jd_data": jd_data,
        "risk_analysis": analyze_candidate_risk(resume_data, jd_data, resume_text, jd_text),
    }


@router.post("/candidate_ranking")
async def candidate_ranking(resume: UploadFile, jd: UploadFile):
    from RankingEngine import generate_candidate_ranking
    resume_data = parse_resume_upload(resume)
    resume_text = resume_data["raw_resume_text"]
    jd_text, jd_data = parse_jd_upload(jd)
    return {
        "candidate_data": resume_data,
        "jd_data": jd_data,
        "ranking_result": generate_candidate_ranking(resume_data, jd_data, resume_text, jd_text),
    }


@router.post("/analyze_application")
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
        return analyze_resume_against_job(
            resume, job_title, required_skills,
            experience_required, department, location, job_description,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "message": "Application analysis failed"},
        )
