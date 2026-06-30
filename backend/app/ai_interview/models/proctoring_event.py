from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate_resumes.id"), nullable=False)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False, default="warning")
    message = Column(String(300), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
