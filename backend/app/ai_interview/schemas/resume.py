from pydantic import BaseModel
from typing import List, Optional

class ResumeOut(BaseModel):
    id: int
    candidate_name: Optional[str] = None
    email: Optional[str] = None
    resume_url: Optional[str] = None
    skills: List[str] = []
    projects: List[str] = []
    experience: Optional[str] = None
    education: List[str] = []
    class Config:
        from_attributes = True
