from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class InterviewCreate(BaseModel):
    title: str
    department: Optional[str] = None
    experience_level: Optional[str] = "mid"
    skills: List[str] = []
    difficulty: str = "medium"
    duration: int = 30
    question_count: int = 5
    interview_type: str = "technical"

class InterviewOut(InterviewCreate):
    id: int
    status: str
    created_by: str
    created_at: datetime
    class Config:
        from_attributes = True

class QuestionOut(BaseModel):
    id: int
    interview_id: int
    question_text: str
    order: int
    class Config:
        from_attributes = True
