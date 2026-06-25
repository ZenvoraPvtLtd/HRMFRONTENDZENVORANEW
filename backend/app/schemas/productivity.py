from typing import List, Optional

from pydantic import BaseModel


class EmployeeActivity(BaseModel):
    employee_id: int
    employee_name: str
    tasks_assigned: int
    tasks_completed: int
    idle_minutes: int
    overtime_minutes: int
    activity_date: Optional[str] = None
    team_name: Optional[str] = None


class ProductivityPrediction(BaseModel):
    employee_id: str
    employee_name: str
    team_name: str
    burnout_risk: int
    burnout_level: str
    resignation_probability: int
    resignation_level: str
    performance_drop: int
    performance_drop_level: str


class ProductivityPredictionResponse(BaseModel):
    filters: dict
    predictions: List[ProductivityPrediction]
