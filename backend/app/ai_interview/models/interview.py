from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.sql import func
from ..database import Base

class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    department = Column(String(100))
    experience_level = Column(String(50))
    skills = Column(JSON, default=list)
    difficulty = Column(String(20), default="medium")
    duration = Column(Integer, default=30)
    question_count = Column(Integer, default=5)
    interview_type = Column(String(50), default="technical")
    status = Column(String(20), default="active")
    created_by = Column(String(100), default="HR")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
