from typing import Optional

from pydantic import BaseModel


class PIPCreate(BaseModel):
    employee_id: Optional[str] = ""
    employee_name: str
    issue_description: str
    expectations: str
    timeline_days: int
    start_date: str
    end_date: Optional[str] = ""
    warning_message: Optional[str] = ""
    status: Optional[str] = "Active"


class PIPUpdate(BaseModel):
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    issue_description: Optional[str] = None
    expectations: Optional[str] = None
    timeline_days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    warning_message: Optional[str] = None
    status: Optional[str] = None
