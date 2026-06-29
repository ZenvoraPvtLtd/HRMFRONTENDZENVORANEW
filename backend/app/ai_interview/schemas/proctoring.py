from datetime import datetime
from pydantic import BaseModel


class ProctoringEventCreate(BaseModel):
    candidate_id: int
    interview_id: int
    event_type: str
    severity: str = "warning"
    message: str


class ProctoringEventOut(ProctoringEventCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
