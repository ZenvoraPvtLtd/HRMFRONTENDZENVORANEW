import os

from .database import Base, engine, SessionLocal


def init_ai_interview() -> None:
    from .models import answer, assessment, interview, proctoring_event, question, result, resume  # noqa: F401

    Base.metadata.create_all(bind=engine)
    if os.getenv("AI_INTERVIEW_SEED_DEMO", "").strip().lower() not in {"1", "true", "yes"}:
        return

    from .services.seed import seed

    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
