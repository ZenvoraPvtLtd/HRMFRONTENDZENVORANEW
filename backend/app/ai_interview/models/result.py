from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from ..database import Base

class InterviewResult(Base):
    __tablename__ = "interview_results"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate_resumes.id"))
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    technical_score = Column(Float, default=0)
    communication_score = Column(Float, default=0)
    confidence_score = Column(Float, default=0)
    problem_solving_score = Column(Float, default=0)
    final_score = Column(Float, default=0)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    suggestions = Column(JSON, default=list)
    recommendation = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
