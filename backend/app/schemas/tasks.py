from typing import List, Optional

from pydantic import BaseModel, Field


class SprintTask(BaseModel):
    title: str
    work_type: str = Field(alias="workType")
    description: Optional[str] = None
    priority: str
    due_date: Optional[str] = Field(alias="dueDate", default=None)
    estimated_hours: Optional[str] = Field(alias="estimatedHours", default=None)
    estimated_minutes: Optional[str] = Field(alias="estimatedMinutes", default=None)
    assignee: str
    reporter: str
    labels: str
    status: str = "TO DO"
    sprint_id: Optional[str] = Field(alias="sprintId", default=None)
    linked_issues: List[str] = Field(alias="linkedIssues", default_factory=list)
    subtasks: List[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class SprintTaskUpdate(BaseModel):
    status: Optional[str] = None
    assignee: Optional[str] = None
    reporter: Optional[str] = None
    linked_issues: Optional[List[str]] = Field(alias="linkedIssues", default=None)
    subtasks: Optional[List[str]] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = Field(alias="dueDate", default=None)
    labels: Optional[str] = None
    comments: Optional[List[dict]] = None
    worklogs: Optional[List[dict]] = None
    history: Optional[List[dict]] = None
    updated_at: Optional[str] = Field(alias="updatedAt", default=None)

    class Config:
        populate_by_name = True

