from pydantic import BaseModel


class JobOpening(BaseModel):
    job_title: str
    required_skills: list[str]
    experience_required: str
    department: str
    location: str
    job_description: str
