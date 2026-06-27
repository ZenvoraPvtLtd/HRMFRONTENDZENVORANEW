from fastapi import FastAPI
from pydantic import BaseModel , Field
from datetime import datetime ,date
from typing import List ,Optional
from enum import Enum


app = FastAPI(title="Team Productivity API")

class TeamActivity(BaseModel):
    team_name: str
    employee_id: int
    employee_name: str
    login_time: datetime
    logout_time: datetime
    tasks_assigned: int
    tasks_completed: int
    idle_minutes: int
    overtime_minutes: int

# Temporary in-memory storage for demo
team_records: List[TeamActivity] = []

@app.get("/")
def home():
    return {"message": "Team Productivity API is running"}

# Endpoint to log team activity
@app.post("/team/activity")
def add_team_activity(team: List[TeamActivity]):
    for record in team:
        team_records.append(record)
    return {"message": "Team activity recorded", "records_count": len(team)}

# Endpoint to calculate weekly team scorecard
@app.get("/team/weekly_score")
def weekly_score():
    if not team_records:
        return {"message": "No team records found."}

    team_summary = {}
    for record in team_records:
        team = record.team_name
        if team not in team_summary:
            team_summary[team] = {
                "total_employees": 0,
                "total_tasks_assigned": 0,
                "total_tasks_completed": 0,
                "total_idle_minutes": 0,
                "total_overtime_minutes": 0
            }
        team_summary[team]["total_employees"] += 1
        team_summary[team]["total_tasks_assigned"] += record.tasks_assigned
        team_summary[team]["total_tasks_completed"] += record.tasks_completed
        team_summary[team]["total_idle_minutes"] += record.idle_minutes
        team_summary[team]["total_overtime_minutes"] += record.overtime_minutes

    # Calculate productivity score
    for team, stats in team_summary.items():
        tasks_score = (stats["total_tasks_completed"] / stats["total_tasks_assigned"]) * 100 if stats["total_tasks_assigned"] > 0 else 0
        idle_penalty = stats["total_idle_minutes"] * 0.5  # 0.5 point per idle minute
        overtime_bonus = stats["total_overtime_minutes"] * 0.2  # 0.2 point per overtime minute
        stats["productivity_score"] = round(tasks_score - idle_penalty + overtime_bonus, 2)

    return {"weekly_team_score": team_summary}

class LeaveStatus(str, Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"


class LeaveCreate(BaseModel):
    leave_type: str = Field(..., min_length=2)
    duration_type: str = Field(..., min_length=2)
    leave_date: date
    days: float = Field(..., gt=0)
    reason: str = Field(..., min_length=3)


class LeaveUpdate(BaseModel):
    leave_type: Optional[str] = None
    duration_type: Optional[str] = None
    leave_date: Optional[date] = None
    days: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None


class LeaveStatusUpdate(BaseModel):
    status: LeaveStatus
    reviewed_by: Optional[str] = None
    comment: Optional[str] = None


class LeaveResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    leave_type: str
    duration_type: str
    leave_date: date
    days: float
    reason: str
    status: LeaveStatus
    applied_date: datetime
    manager_reviewed_at: Optional[datetime] = None
    hr_reviewed_at: Optional[datetime] = None


class LeaveBalanceResponse(BaseModel):
    employee_id: str
    year: int
    earned: float
    used: float
    remaining: float


class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    department: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    productivity: int = 70
    status: str = "Active"


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    productivity: Optional[int] = None
    status: Optional[str] = None


class ChatUserCreate(BaseModel):
    user_id: Optional[str] = None
    contact_id: Optional[str] = None
    name: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    initials: Optional[str] = None
    avatar_color: Optional[str] = "#111827"
    is_online: bool = True


class ChatConversationCreate(BaseModel):
    participant_id: str = Field(..., min_length=1)


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1)
    attachment_name: Optional[str] = None
