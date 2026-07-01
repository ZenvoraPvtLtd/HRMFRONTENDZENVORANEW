from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import os
from uuid import uuid4
from dotenv import load_dotenv

load_dotenv() 


from sqlalchemy.orm import Session
from typing import List
from ..database import AI_UPLOAD_DIR, AI_UPLOAD_URL_PREFIX, get_db
from ..models.interview import Interview
from ..models.question import Question
from ..models.answer import CandidateAnswer
from ..models.resume import CandidateResume
from ..models.result import InterviewResult
from ..models.proctoring_event import ProctoringEvent
from ..schemas.interview import InterviewCreate, InterviewOut, QuestionOut
from ..schemas.answer import AnswerCreate, AnswerOut
from ..schemas.result import ResultOut
from ..schemas.proctoring import ProctoringEventCreate, ProctoringEventOut
from ..services.ai_service import generate_hf_interview_question, generate_local_resume_question
from ..schemas.interview_question_generation import GenerateQuestionIn, GenerateQuestionOut

from ..services.scoring_service import aggregate

router = APIRouter()

@router.post("/create", response_model=InterviewOut)
def create_interview(data: InterviewCreate, db: Session = Depends(get_db)):
    iv = Interview(**data.model_dump())
    db.add(iv); db.commit(); db.refresh(iv)
    for i in range(iv.question_count):
        db.add(Question(interview_id=iv.id, question_text="", order=i))
    db.commit()
    return iv



@router.get("/list", response_model=List[InterviewOut])
def list_interviews(db: Session = Depends(get_db)):
    return db.query(Interview).order_by(Interview.created_at.desc()).all()

@router.get("/history")
def history(db: Session = Depends(get_db)):
    rows = db.query(InterviewResult).all()
    out = []
    for r in rows:
        c = db.query(CandidateResume).get(r.candidate_id)
        iv = db.query(Interview).get(r.interview_id)
        out.append({
            "result_id": r.id,
            "candidate_name": c.candidate_name if c else "Candidate",
            "role": iv.title if iv else "-",
            "date": r.created_at,
            "score": r.final_score,
            "status": "Completed",
        })
    return out

@router.get("/{iv_id}", response_model=InterviewOut)
def get_interview(iv_id: int, db: Session = Depends(get_db)):
    iv = db.query(Interview).get(iv_id)
    if not iv: raise HTTPException(404, "Not found")
    return iv

@router.post("/generate-questions", response_model=List[QuestionOut])
def regen(iv_id: int, db: Session = Depends(get_db)):
    # Keep this legacy endpoint from generating template/static questions.
    # Live interview flow fills these placeholders through /generate-question.
    iv = db.query(Interview).get(iv_id)
    if not iv: raise HTTPException(404)
    db.query(Question).filter(Question.interview_id == iv_id).delete()
    objs = [
        Question(interview_id=iv_id, question_text="", order=i)
        for i in range(iv.question_count)
    ]
    db.add_all(objs); db.commit()
    for o in objs: db.refresh(o)
    return objs

@router.get("/{iv_id}/questions", response_model=List[QuestionOut])
def get_questions(iv_id: int, db: Session = Depends(get_db)):
    return db.query(Question).filter(Question.interview_id == iv_id).order_by(Question.order).all()

@router.post("/start")
def start(iv_id: int, candidate_id: int, db: Session = Depends(get_db)):
    return {"status": "started", "interview_id": iv_id, "candidate_id": candidate_id}

@router.post("/submit-answer", response_model=AnswerOut)
def submit_answer(data: AnswerCreate, db: Session = Depends(get_db)):
    a = CandidateAnswer(**data.model_dump())
    db.add(a); db.commit(); db.refresh(a)
    return a

@router.post("/proctoring-events", response_model=ProctoringEventOut)
def save_proctoring_event(data: ProctoringEventCreate, db: Session = Depends(get_db)):
    allowed_types = {
        "multiple_faces",
        "no_face",
        "background_voice",
        "tab_switch",
        "fullscreen_exit",
        "paste_detected",
        "network_disconnect",
        "termination_screenshot",
        "multiple_faces_terminated",
        "no_face_terminated",
        "background_voice_terminated",
        "tab_switch_terminated",
        "fullscreen_exit_terminated",
        "paste_detected_terminated",
    }
    if data.event_type not in allowed_types:
        raise HTTPException(400, "Invalid proctoring event type")
    event = ProctoringEvent(**data.model_dump())
    db.add(event); db.commit(); db.refresh(event)
    return event

@router.post("/termination-screenshot", response_model=ProctoringEventOut)
async def save_termination_screenshot(
    candidate_id: int = Form(...),
    interview_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    iv = db.query(Interview).get(interview_id)
    if not iv:
        raise HTTPException(404, "Interview not found")
    candidate = db.query(CandidateResume).get(candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    ext = ".jpg"
    if file.content_type == "image/png":
        ext = ".png"
    fname = f"proctoring_{interview_id}_{candidate_id}_{uuid4().hex}{ext}"
    upload_dir = os.path.join(AI_UPLOAD_DIR, "proctoring")
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, fname)
    with open(path, "wb") as f:
        f.write(await file.read())

    url = f"{AI_UPLOAD_URL_PREFIX}/proctoring/{fname}"
    event = ProctoringEvent(
        candidate_id=candidate_id,
        interview_id=interview_id,
        event_type="termination_screenshot",
        severity="critical",
        message=url,
    )
    db.add(event); db.commit(); db.refresh(event)
    return event

@router.post("/{iv_id}/terminate")
def terminate_interview(iv_id: int, db: Session = Depends(get_db)):
    iv = db.query(Interview).get(iv_id)
    if not iv:
        raise HTTPException(404, "Interview not found")
    if iv.status not in ("terminated", "completed"):
        iv.status = "terminated"
        db.commit()
    print(f"[SESSION] interview_id={iv_id} → terminated")
    return {"status": iv.status, "interview_id": iv_id}


@router.post("/{iv_id}/complete")
def complete_interview(iv_id: int, db: Session = Depends(get_db)):
    """Mark an interview as completed after all questions are answered."""
    iv = db.query(Interview).get(iv_id)
    if not iv:
        raise HTTPException(404, "Interview not found")
    if iv.status not in ("terminated", "completed"):
        iv.status = "completed"
        db.commit()
    print(f"[SESSION] interview_id={iv_id} → completed")
    return {"status": iv.status, "interview_id": iv_id}

@router.post("/analyze", response_model=ResultOut)
def analyze(candidate_id: int, interview_id: int, db: Session = Depends(get_db)):
    answers = db.query(CandidateAnswer).filter(CandidateAnswer.candidate_id == candidate_id).all()
    agg = aggregate([a.answer_text or "" for a in answers])
    r = InterviewResult(candidate_id=candidate_id, interview_id=interview_id, **agg)
    db.add(r); db.commit(); db.refresh(r)
    return r

@router.post("/generate-question", response_model=GenerateQuestionOut)
async def generate_question(payload: GenerateQuestionIn, db: Session = Depends(get_db)):
    load_dotenv(override=True)

    job_role = (payload.job_role or "").strip()
    resume_text = (payload.resume_text or "").strip()

    if payload.interview_id:
        iv = db.query(Interview).get(payload.interview_id)
        if iv:
            job_role = job_role or iv.title or ""

    if payload.candidate_id:
        cr = db.query(CandidateResume).get(payload.candidate_id)
        if cr:
            resume_bits = [
                f"Experience: {cr.experience}" if cr.experience else "",
                f"Skills: {', '.join(cr.skills or [])}" if cr.skills else "",
                f"Projects: {' | '.join(cr.projects or [])}" if cr.projects else "",
                f"Education: {' | '.join(cr.education or [])}" if cr.education else "",
            ]
            db_resume_text = "\n".join([bit for bit in resume_bits if bit])
            resume_text = resume_text or db_resume_text
            job_role = job_role or cr.applied_role or ""

    if not resume_text:
        raise HTTPException(
            status_code=400,
            detail="Resume context is required to generate resume-based questions.",
        )

    # Live interview question generation must go through the HF generator.
    # Token checks and HF request logging live inside the service.
    hf_token = os.getenv("HUGGINGFACE_API_TOKEN", "") or os.getenv("HF_API_TOKEN", "")
    hf_model = os.getenv("HUGGINGFACE_MODEL", "")
    hf_api_base_url = os.getenv("HUGGINGFACE_API_BASE_URL", "")
    try:
        q = await generate_hf_interview_question(
            resume_text=resume_text,
            job_role=job_role,
            previous_questions=payload.previous_questions,
            previous_answers=payload.previous_answers,
            current_difficulty=payload.current_difficulty,
            hf_api_token=hf_token,
            hf_model=hf_model,
            hf_api_base_url=hf_api_base_url,
        )
    except Exception as e:
        print(f"[HF DEBUG] live question generation failed: {repr(e)}")
        q = generate_local_resume_question(
            resume_text=resume_text,
            job_role=job_role,
            previous_questions=payload.previous_questions,
            current_difficulty=payload.current_difficulty,
        )
    return GenerateQuestionOut(question=q, current_difficulty=payload.current_difficulty)


@router.get("/results/{candidate_id}", response_model=ResultOut)
def get_results(candidate_id: int, db: Session = Depends(get_db)):

    r = db.query(InterviewResult).filter(InterviewResult.candidate_id == candidate_id).order_by(InterviewResult.id.desc()).first()

    if not r: raise HTTPException(404, "No result yet")
    return r
