from pydantic import BaseModel
from typing import List, Optional


class GenerateQuestionIn(BaseModel):
    resume_text: Optional[str] = None
    interview_id: Optional[int] = None
    candidate_id: Optional[int] = None
    job_role: Optional[str] = None
    previous_questions: List[str] = []
    previous_answers: List[str] = []
    current_difficulty: str = "easy"



class GenerateQuestionOut(BaseModel):
    question: str
    current_difficulty: str

