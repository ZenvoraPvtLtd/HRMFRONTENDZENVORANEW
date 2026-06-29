import os, uuid
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import AI_UPLOAD_DIR, AI_UPLOAD_URL_PREFIX, get_db
from ..models.resume import CandidateResume
from ..models.interview import Interview
from ..schemas.resume import ResumeOut
from ..services.resume_parser import parse_resume, compute_match, extract_text

router = APIRouter()

@router.post("/upload", response_model=ResumeOut)
async def upload_resume(
    file: UploadFile = File(...),
    interview_id: int = Form(None),
    role: str = Form(""),
    db: Session = Depends(get_db),
):
    os.makedirs(AI_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".pdf"
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(AI_UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(await file.read())
    parsed = parse_resume(fpath)
    cr = CandidateResume(
        interview_id=interview_id,
        candidate_name=parsed["candidate_name"],
        email=parsed["email"],
        applied_role=role or "",
        resume_url=f"{AI_UPLOAD_URL_PREFIX}/{fname}",
        skills=parsed["skills"],
        projects=parsed["projects"],
        experience=parsed["experience"],
        education=parsed["education"],
    )
    db.add(cr); db.commit(); db.refresh(cr)
    return cr

@router.post("/parse", response_model=ResumeOut)
def parse_existing(candidate_id: int, db: Session = Depends(get_db)):
    cr = db.query(CandidateResume).get(candidate_id)
    if not cr: raise HTTPException(404)
    return cr

@router.get("/match")
def match_resume(
    candidate_id: int = Query(...),
    role: str = Query(""),
    interview_id: int = Query(None),
    db: Session = Depends(get_db),
):
    cr = db.query(CandidateResume).get(candidate_id)
    if not cr: raise HTTPException(404, "Candidate not found")
    target_role = role or cr.applied_role or ""
    if not target_role and interview_id:
        iv = db.query(Interview).get(interview_id)
        if iv: target_role = iv.title or ""
    # re-read text from disk for keyword scoring (best-effort)
    raw_text = ""
    if cr.resume_url:
        local = os.path.join(AI_UPLOAD_DIR, os.path.basename(cr.resume_url))
        if os.path.exists(local):
            raw_text = extract_text(local)
    parsed = {
        "skills": cr.skills or [],
        "projects": cr.projects or [],
        "experience": cr.experience or "",
        "education": cr.education or [],
        "raw_text": raw_text,
    }
    return compute_match(parsed, target_role, raw_text)
