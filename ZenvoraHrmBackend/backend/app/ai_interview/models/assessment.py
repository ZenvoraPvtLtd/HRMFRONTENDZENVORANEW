from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from ..database import Base

class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate_resumes.id"), nullable=False)
    technical_score = Column(Float, default=0)
    aptitude_score = Column(Float, default=0)
    communication_score = Column(Float, default=0)
    status = Column(String(30), default="pending")   # pending | in_progress | completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
