from pydantic import BaseModel
from typing import Optional

class AnswerCreate(BaseModel):
    candidate_id: int
    question_id: int
    answer_text: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None

class AnswerOut(AnswerCreate):
    id: int
    class Config:
        from_attributes = True
