import io
import os
import re
import asyncio
from typing import List, Optional
from app.utils.pdf_extractor import extract_text_from_pdf
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from app.services.email_service import send_interview_link, send_application_acknowledgement
from app.services.calendar_service import create_google_meet
from app.services.google_calendar_service import create_interview_meeting
from docx import Document as DocxDocument
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Lazy-load sentence_transformers to avoid blocking startup
# ---------------------------------------------------------------------------

_model = None

def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
            print("[RESUME] SentenceTransformer model loaded.")
        except Exception as exc:
            print(f"[RESUME] SentenceTransformer unavailable, using keyword matching: {exc}")
    return _model


# ---------------------------------------------------------------------------
# Router — must be defined before any endpoint decorators
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/resume", tags=["Resume Screening"])


# ---------------------------------------------------------------------------
# File extraction helpers
# ---------------------------------------------------------------------------

def extract_text_from_docx(data: bytes) -> str:
    try:
        doc = DocxDocument(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print("DOCX Error:", str(e))
        return ""


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def extract_email(text: str) -> Optional[str]:
    m = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    return m.group(0) if m else None


def extract_phone(text: str) -> Optional[str]:
    m = re.search(r"(\+?\d[\d\s\-().]{8,14}\d)", text)
    return m.group(0) if m else None


def extract_experience(text: str) -> Optional[int]:
    patterns = [
        r"(\d+)\+?\s*years?\s*experience",
        r"(\d+)\+?\s*years?\s+of\s+experience",
        r"(\d+)\+?\s*yrs?\s*exp",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return int(m.group(1))
    return None


RESUME_HEADERS = {"resume", "curriculum vitae", "cv", "profile"}


def extract_candidate_name(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for line in lines[:5]:
        if (
            len(line.split()) <= 5
            and len(line) < 40
            and "@" not in line
            and line.lower() not in RESUME_HEADERS
        ):
            return line
    return "Unknown"


def score_to_status(score: int) -> str:
    if score >= 75:
        return "Shortlisted"
    elif score >= 50:
        return "Review"
    else:
        return "Rejected"


# ---------------------------------------------------------------------------
# Skill extraction & keyword matching
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "for", "with",
    "on", "at", "by", "is", "are", "was", "be", "as", "from", "that",
    "this", "it", "we", "you", "he", "she", "they", "our", "your",
    "their", "will", "have", "has", "had", "not", "but", "so", "if",
    "about", "also", "any", "all", "can", "may", "must", "should",
    "than", "then", "into", "over", "under", "up", "out", "more",
}

_ALIASES: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "db": "database",
    "sql": "sql",
    "nosql": "nosql",
    "k8s": "kubernetes",
    "aws": "amazon web services",
    "gcp": "google cloud platform",
    "ci/cd": "ci cd",
    "oop": "object oriented programming",
    "api": "api",
    "rest": "rest api",
    "restful": "rest api",
}


def extract_skills_from_jd(jd_text: str) -> List[str]:
    """Dynamically extract candidate skill tokens from a job description."""
    tokens = re.findall(r"[a-zA-Z0-9\+\#\.\/\-]+", jd_text.lower())
    skills: List[str] = []
    for tok in tokens:
        normalised = _ALIASES.get(tok, tok)
        if normalised not in _STOP_WORDS and len(normalised) >= 2:
            skills.append(normalised)
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: List[str] = []
    for s in skills:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique


def keyword_match(resume_text: str, jd_text: str) -> dict:
    """Pure keyword-based matching returning matched/missing skills and a score."""
    jd_skills = extract_skills_from_jd(jd_text)
    resume_lower = resume_text.lower()

    matched: List[str] = []
    missing: List[str] = []

    for skill in jd_skills:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, resume_lower):
            matched.append(skill)
        else:
            missing.append(skill)

    total = len(jd_skills)
    score = round((len(matched) / total) * 100) if total > 0 else 0
    score = max(0, min(score, 100))

    return {
        "matched": matched,
        "missing": missing,
        "score": score,
    }


# ---------------------------------------------------------------------------
# Google Meet helpers
# ---------------------------------------------------------------------------

def _create_google_meet_link(candidate_name: str, candidate_email: str) -> Optional[str]:
    """Wrapper around calendar service — returns a Meet link or None."""
    try:
        return create_google_meet(
            candidate_name=candidate_name,
            candidate_email=candidate_email,
        )
    except Exception as exc:
        import traceback
        print(f"[RESUME] _create_google_meet_link failed: {exc}")
        traceback.print_exc()
        return None


async def generate_meet_link(candidate_name: str, candidate_email: str) -> Optional[str]:
    """Async wrapper — offloads blocking calendar call to a thread."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _create_google_meet_link, candidate_name, candidate_email
    )


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class MatchResult(BaseModel):
    candidate_name: str
    file_name: str
    match_score: int
    status: str
    matched_skills: List[str]
    missing_skills: List[str]
    experience_years: Optional[int]
    education: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    summary: str


class MatchResponse(BaseModel):
    job_title: str
    total_resumes: int
    shortlisted: int
    results: List[MatchResult]


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@router.post("/match", response_model=MatchResponse)
async def match_resumes(
    job_title: str = Form(...),
    job_description: str = Form(...),
    resumes: list[UploadFile] = File(...)
):
    print("===== REQUEST RECEIVED =====")
    print("Job Title:", job_title)
    print("Job Description Length:", len(job_description))
    print("Files:", [f.filename for f in resumes])

    try:
        if not job_description.strip():
            raise HTTPException(status_code=400, detail="Job description required")

        results: List[MatchResult] = []

        for upload in resumes:
            print("Processing:", upload.filename)
            file_bytes = await upload.read()
            print("File size:", len(file_bytes))

            filename = upload.filename or "resume"
            ext = os.path.splitext(filename)[1].lower().replace(".", "")
            print("FILENAME:", filename, "EXT:", ext, "Bytes:", len(file_bytes))

            resume_text = ""

            if ext == "pdf":
                resume_text = extract_text_from_pdf(file_bytes)
                print("==== PDF TEXT PREVIEW ====")
                print(resume_text[:1000])
                print("==========================")
            elif ext in ("docx", "doc"):
                resume_text = extract_text_from_docx(file_bytes)
            else:
                print(f"Skipping unsupported file type: {filename}")
                continue

            print("Extracted text length:", len(resume_text))
            print("Extracted text preview:", resume_text[:300])

            if len(resume_text.strip()) < 20:
                print(f"WARNING: Very little text extracted from {filename}, skipping.")
                continue

            name = extract_candidate_name(resume_text)
            email = extract_email(resume_text)
            phone = extract_phone(resume_text)
            exp = extract_experience(resume_text)

            kw = keyword_match(resume_text, job_description)

            print("MATCH SCORE:", kw["score"])
            print("MATCHED:", kw["matched"])
            print("MISSING:", kw["missing"])

            status = score_to_status(kw["score"])

            results.append(
                MatchResult(
                    candidate_name=name,
                    file_name=filename,
                    match_score=kw["score"],
                    status=status,
                    matched_skills=kw["matched"],
                    missing_skills=kw["missing"],
                    experience_years=exp,
                    education=None,
                    email=email,
                    phone=phone,
                    summary="Keyword-based resume matching",
                )
            )

            print("STATUS:", status, "EMAIL:", email)

            # Send interview email immediately for shortlisted candidates
            if status == "Shortlisted" and email:
                print(f"Sending interview email to {email}")
                meet_link = await generate_meet_link(name, email)

                try:
                    await send_interview_link(
                        candidate_email=email,
                        candidate_name=name,
                        interview_link=meet_link or "Link to be shared separately",
                    )
                    print("Interview email sent successfully")
                except Exception:
                    import traceback
                    print("Email sending failed:")
                    traceback.print_exc()

            # Schedule rejection email after 24 h for rejected candidates
            elif status == "Rejected" and email:
                async def _send_rejection(cand_email: str, cand_name: str) -> None:
                    await asyncio.sleep(86400)  # 24 hours
                    try:
                        await send_application_acknowledgement(
                            candidate_email=cand_email,
                            candidate_name=cand_name,
                        )
                        print(f"Rejection email sent to {cand_email}")
                    except Exception:
                        import traceback
                        print("Rejection email failed:")
                        traceback.print_exc()

                asyncio.create_task(_send_rejection(email, name))

        return MatchResponse(
            job_title=job_title,
            total_resumes=len(results),
            shortlisted=sum(1 for r in results if r.status == "Shortlisted"),
            results=results,
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("\n========= RESUME MATCH ERROR =========")
        traceback.print_exc()
        print("======================================\n")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/debug-extract")
async def debug_extract(file: UploadFile = File(...)):
    file_bytes = await file.read()
    filename = file.filename or "resume"
    ext = os.path.splitext(filename)[1].lower().replace(".", "")

    resume_text = ""
    if ext == "pdf":
        resume_text = extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        resume_text = extract_text_from_docx(file_bytes)

    return {
        "filename": filename,
        "ext": ext,
        "file_size": len(file_bytes),
        "text_length": len(resume_text),
        "text_preview": resume_text[:500],
        "passed_threshold": len(resume_text.strip()) >= 20,
    }


@router.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    return {"filename": file.filename}


@router.post("/debug-upload")
async def debug_upload(resumes: list[UploadFile] = File(...)):
    return {"files": [f.filename for f in resumes]}


@router.get("/health")
async def health():
    model_available = _get_model() is not None
    return {
        "status": "ok",
        "ai_matching": model_available,
        "ocr_enabled": True,
        "pdf_support": True,
        "docx_support": True,
    }
