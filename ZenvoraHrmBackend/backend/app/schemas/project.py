from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    code: str
    project_name: str
    type: str
    status: str
    manager: str
    members: str
    duration: str

class ProjectResponse(ProjectCreate):
    id: str