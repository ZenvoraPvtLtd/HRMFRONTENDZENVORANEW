from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.resume import CandidateResume
from ..models.assessment import Assessment
from ..models.result import InterviewResult
from ..models.interview import Interview

router = APIRouter()

STAGES = ["applied", "screening", "assessment", "ai_interview", "offer", "hired"]


def candidate_dict(db: Session, c: CandidateResume):
    a = db.query(Assessment).filter(Assessment.candidate_id == c.id).order_by(Assessment.id.desc()).first()
    r = db.query(InterviewResult).filter(InterviewResult.candidate_id == c.id).order_by(InterviewResult.id.desc()).first()
    iv = db.query(Interview).get(c.interview_id) if c.interview_id else None
    return {
        "id": c.id,
        "name": c.candidate_name or "Candidate",
        "email": c.email or "",
        "applied_role": c.applied_role or (iv.title if iv else ""),
        "resume_url": c.resume_url,
        "skills": c.skills or [],
        "pipeline_stage": c.pipeline_stage or "applied",
        "assessment_status": a.status if a else "pending",
        "assessment_score": round(((a.technical_score + a.aptitude_score + a.communication_score) / 3), 1) if a else None,
        "interview_status": "completed" if r else "pending",
        "interview_score": r.final_score if r else None,
        "created_at": c.created_at,
    }


@router.get("/candidates")
def list_candidates(db: Session = Depends(get_db)):
    rows = db.query(CandidateResume).order_by(CandidateResume.created_at.desc()).all()
    return [candidate_dict(db, c) for c in rows]


@router.get("/candidates/{cid}")
def get_candidate(cid: int, db: Session = Depends(get_db)):
    c = db.query(CandidateResume).get(cid)
    if not c: raise HTTPException(404, "Not found")
    return candidate_dict(db, c)


class StageUpdate(BaseModel):
    candidate_id: int
    stage: str


@router.patch("/pipeline/update-stage")
def update_stage(data: StageUpdate, db: Session = Depends(get_db)):
    if data.stage not in STAGES:
        raise HTTPException(400, f"Invalid stage. Allowed: {STAGES}")
    c = db.query(CandidateResume).get(data.candidate_id)
    if not c: raise HTTPException(404, "Candidate not found")
    c.pipeline_stage = data.stage
    db.commit(); db.refresh(c)
    return candidate_dict(db, c)


@router.get("/pipeline")
def pipeline(db: Session = Depends(get_db)):
    rows = db.query(CandidateResume).all()
    grouped = {s: [] for s in STAGES}
    for c in rows:
        s = c.pipeline_stage or "applied"
        if s not in grouped: s = "applied"
        grouped[s].append(candidate_dict(db, c))
    return {"stages": STAGES, "groups": grouped}


@router.get("/assessments")
def list_assessments(db: Session = Depends(get_db)):
    cands = db.query(CandidateResume).all()
    out = []
    for c in cands:
        a = db.query(Assessment).filter(Assessment.candidate_id == c.id).order_by(Assessment.id.desc()).first()
        out.append({
            "candidate_id": c.id,
            "candidate_name": c.candidate_name,
            "applied_role": c.applied_role,
            "technical_score": a.technical_score if a else 0,
            "aptitude_score": a.aptitude_score if a else 0,
            "communication_score": a.communication_score if a else 0,
            "status": a.status if a else "pending",
        })
    # summary cards
    total = len(cands)
    completed = sum(1 for x in out if x["status"] == "completed")
    completion_rate = round((completed / total * 100), 1) if total else 0.0
    summary = [
        {"key": "technical", "title": "Technical Skill Test",
         "description": "Role-specific technical & coding assessment",
         "candidates": total, "completed": completed,
         "avg": round(sum(x["technical_score"] for x in out) / total, 1) if total else 0},
        {"key": "aptitude", "title": "Aptitude Test",
         "description": "Logical reasoning, math, and problem solving",
         "candidates": total, "completed": completed,
         "avg": round(sum(x["aptitude_score"] for x in out) / total, 1) if total else 0},
        {"key": "communication", "title": "Communication Test",
         "description": "Written and verbal communication assessment",
         "candidates": total, "completed": completed,
         "avg": round(sum(x["communication_score"] for x in out) / total, 1) if total else 0},
    ]
    return {"completion_rate": completion_rate, "summary": summary, "candidates": out}


class AssessmentUpsert(BaseModel):
    candidate_id: int
    technical_score: Optional[float] = None
    aptitude_score: Optional[float] = None
    communication_score: Optional[float] = None
    status: Optional[str] = None


@router.post("/assessments/upsert")
def upsert_assessment(data: AssessmentUpsert, db: Session = Depends(get_db)):
    a = db.query(Assessment).filter(Assessment.candidate_id == data.candidate_id).order_by(Assessment.id.desc()).first()
    if not a:
        a = Assessment(candidate_id=data.candidate_id)
        db.add(a)
    for f in ["technical_score", "aptitude_score", "communication_score", "status"]:
        v = getattr(data, f)
        if v is not None: setattr(a, f, v)
    db.commit(); db.refresh(a)
    return {"id": a.id, "status": a.status}
