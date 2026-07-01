import json
from typing import Optional

from app.utils.uploads import save_upload_file
from app.core.database import collection


def _legacy():
    """Lazy-load legacy AI modules after import paths are configured."""
    from app.core.import_paths import configure_legacy_import_paths
    configure_legacy_import_paths()
    from Extractor import build_json
    from JDExtractor import build_jd_json
    from JobMatcher import match_jobs
    from RankingEngine import generate_candidate_ranking
    from ResumeParser import universal_parser
    from RiskAnalyzer import analyze_candidate_risk
    return build_json, build_jd_json, match_jobs, generate_candidate_ranking, universal_parser, analyze_candidate_risk


def normalize_required_skills(required_skills: Optional[str]) -> list[str]:
    if not required_skills:
        return []
    try:
        parsed = json.loads(required_skills)
        if isinstance(parsed, list):
            return [str(s) for s in parsed]
    except Exception:
        pass
    return [s.strip() for s in required_skills.split(",") if s.strip()]


def build_job_description_text(job_title, department, location, experience_required, required_skills, job_description) -> str:
    return "\n".join([
        f"Job Title: {job_title or ''}",
        f"Department: {department or ''}",
        f"Location: {location or ''}",
        f"Experience Required: {experience_required or ''}",
        f"Required Skills: {', '.join(required_skills)}",
        f"Job Description: {job_description or ''}",
    ])


def flatten_resume_skills(resume_data: dict) -> list[str]:
    skills = resume_data.get("skills", {}) or {}
    detected: list[str] = []
    for key in ("technical_skills", "soft_skills", "tools_and_technologies"):
        value = skills.get(key, [])
        if isinstance(value, list):
            detected.extend([str(s) for s in value if s])
    return detected


def store_parsed_resume(payload: dict) -> Optional[str]:
    if collection is None:
        return None
    result = collection.insert_one(payload)
    return str(result.inserted_id)


def parse_resume_upload(file) -> dict:
    build_json, _, _, _, universal_parser, _ = _legacy()
    file_path = save_upload_file(file)
    extracted_text = universal_parser(file_path)
    parsed_data = build_json(extracted_text)
    parsed_data["raw_resume_text"] = extracted_text
    return parsed_data


def parse_jd_upload(file) -> tuple[str, dict]:
    _, build_jd_json, _, _, universal_parser, _ = _legacy()
    file_path = save_upload_file(file)
    jd_text = universal_parser(file_path)
    return jd_text, build_jd_json(jd_text)


def analyze_resume_against_job(resume, job_title, required_skills, experience_required, department, location, job_description) -> dict:
    _, build_jd_json, match_jobs, generate_candidate_ranking, _, analyze_candidate_risk = _legacy()

    resume_data = parse_resume_upload(resume)
    resume_text = resume_data["raw_resume_text"]
    matched_jobs = match_jobs(resume_data, resume_text)

    required_skills_list = normalize_required_skills(required_skills)
    jd_text = build_job_description_text(job_title, department, location, experience_required, required_skills_list, job_description)
    jd_data = build_jd_json(jd_text)

    risk_result = analyze_candidate_risk(resume_data, jd_data, resume_text, jd_text)
    ranking_result = generate_candidate_ranking(resume_data, jd_data, resume_text, jd_text)

    parsed_resume_id = None
    if collection is not None:
        stored_data = {
            **resume_data,
            "detected_skills": flatten_resume_skills(resume_data),
            "detected_experience": resume_data.get("experience", {}).get("experience", {}),
            "application_job": {
                "job_title": job_title, "required_skills": required_skills_list,
                "experience_required": experience_required, "department": department,
                "location": location, "job_description": job_description,
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
