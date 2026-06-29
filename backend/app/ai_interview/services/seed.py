"""Seed dummy candidates/assessments/results so the recruitment UI is populated on first run."""
from sqlalchemy.orm import Session
from ..models.interview import Interview
from ..models.resume import CandidateResume
from ..models.assessment import Assessment
from ..models.result import InterviewResult
from ..database import AI_UPLOAD_URL_PREFIX


DUMMY = [
    ("Aarav Sharma", "aarav.sharma@example.com", "Frontend Engineer", ["React", "TypeScript", "TailwindCSS"], "applied", None, None),
    ("Priya Patel", "priya.patel@example.com", "Backend Engineer", ["Python", "FastAPI", "PostgreSQL"], "screening", 72, None),
    ("Rohan Verma", "rohan.verma@example.com", "Full Stack Engineer", ["Node.js", "React", "MongoDB"], "assessment", 81, None),
    ("Sneha Iyer", "sneha.iyer@example.com", "Data Analyst", ["SQL", "Python", "Tableau"], "ai_interview", 78, 84),
    ("Kabir Singh", "kabir.singh@example.com", "DevOps Engineer", ["AWS", "Docker", "Kubernetes"], "offer", 88, 91),
    ("Ananya Rao", "ananya.rao@example.com", "Product Designer", ["Figma", "UX Research"], "hired", 92, 95),
    ("Vikram Mehta", "vikram.mehta@example.com", "ML Engineer", ["PyTorch", "Python", "NLP"], "ai_interview", 70, 76),
    ("Isha Kapoor", "isha.kapoor@example.com", "QA Engineer", ["Selenium", "Cypress", "Manual Testing"], "screening", 65, None),
]


def seed(db: Session) -> None:
    if db.query(CandidateResume).count() > 0:
        return

    iv = db.query(Interview).first()
    if not iv:
        iv = Interview(
            title="General Recruitment Drive",
            department="Engineering",
            experience_level="mid",
            skills=["Communication", "Problem Solving"],
            difficulty="medium",
            duration=30,
            question_count=5,
            interview_type="technical",
        )
        db.add(iv); db.commit(); db.refresh(iv)

    for name, email, role, skills, stage, assess_avg, interview_score in DUMMY:
        c = CandidateResume(
            interview_id=iv.id,
            candidate_name=name,
            email=email,
            applied_role=role,
            resume_url=f"{AI_UPLOAD_URL_PREFIX}/{name.lower().replace(' ', '_')}.pdf",
            skills=skills,
            projects=[],
            experience="3+ years of relevant industry experience.",
            education=[{"degree": "B.Tech", "institute": "IIT Demo"}],
            pipeline_stage=stage,
        )
        db.add(c); db.commit(); db.refresh(c)

        if assess_avg is not None:
            db.add(Assessment(
                candidate_id=c.id,
                technical_score=assess_avg,
                aptitude_score=max(50, assess_avg - 5),
                communication_score=min(100, assess_avg + 3),
                status="completed",
            ))

        if interview_score is not None:
            db.add(InterviewResult(
                candidate_id=c.id,
                interview_id=iv.id,
                technical_score=interview_score,
                communication_score=interview_score - 4,
                confidence_score=interview_score - 2,
                problem_solving_score=interview_score + 1,
                final_score=interview_score,
                strengths=["Strong fundamentals", "Clear communication"],
                weaknesses=["System design depth"],
                suggestions=["Practice scalability patterns"],
                recommendation="hire" if interview_score >= 80 else "consider",
            ))
    db.commit()
