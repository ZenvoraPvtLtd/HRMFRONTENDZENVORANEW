import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[2]
AI_UPLOAD_DIR = BACKEND_ROOT / "uploads" / "ai_interview"
AI_UPLOAD_URL_PREFIX = "/uploads/ai_interview"
DEFAULT_SQLITE_DB = BACKEND_ROOT / "ai_interview.db"

DATABASE_URL = os.getenv("AI_INTERVIEW_DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_DB.as_posix()}")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
