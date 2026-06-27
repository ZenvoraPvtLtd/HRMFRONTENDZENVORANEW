from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ExitInterviewCreate(BaseModel):
    employee_id: str
    employee_name: str
    resignation_date: str
    last_working_date: str
    reason: Optional[str] = None

class ExitInterviewUpdate(BaseModel):
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    resignation_date: Optional[str] = None
    last_working_date: Optional[str] = None
    reason: Optional[str] = None
    conducted_date: Optional[str] = None
    status: Optional[str] = None