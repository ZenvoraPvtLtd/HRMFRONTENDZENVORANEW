from pydantic import BaseModel
from typing import List

class ResultOut(BaseModel):
    id: int
    candidate_id: int
    interview_id: int
    technical_score: float
    communication_score: float
    confidence_score: float
    problem_solving_score: float
    final_score: float
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    recommendation: str
    class Config:
        from_attributes = True
