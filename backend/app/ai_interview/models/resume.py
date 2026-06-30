from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from ..database import Base

class CandidateResume(Base):
    __tablename__ = "candidate_resumes"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=True)
    candidate_name = Column(String(200))
    email = Column(String(200))
    applied_role = Column(String(200), default="")
    resume_url = Column(String(500))
    skills = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    experience = Column(Text)
    education = Column(JSON, default=list)
    pipeline_stage = Column(String(50), default="applied")  # applied|screening|assessment|ai_interview|offer|hired
    created_at = Column(DateTime(timezone=True), server_default=func.now())
