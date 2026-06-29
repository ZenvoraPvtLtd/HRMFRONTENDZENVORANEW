import os
import site
import sys
from pathlib import Path
from dotenv import load_dotenv

# Force load the backend .env at the very start so any module-level os.getenv evaluations get the correct values
_BACKEND_ENV = Path(__file__).resolve().parent / ".env"
if not os.path.exists(_BACKEND_ENV):
    # Fallback to one level up if run from backend/app
    _BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_BACKEND_ENV, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

_vendor_dir = os.path.join(os.path.dirname(__file__), "..", ".vendor")
if os.path.isdir(_vendor_dir):
    sys.path.append(os.path.abspath(_vendor_dir))
    site.addsitedir(_vendor_dir)

# from app.api.routers.oauth import router as oauth_router
from app.api.routes.resume_match import router as resume_router
from app.api.routes import (
    admin,
    ai,
    attendance,
    attendance_alerts,
    attendance_login,
    auth,
    candidates,
    chat,
    compliance,
    dashboard,
    documents,
    employees,
    events,
    exit_management,
    grievances,
    health,
    holidays,
    hr_actions,
    hr_attendance,
    interviews,
    jobs,
    leaves,
    meeting_reminders,
    manager_attendance,
    notifications,
    offer_letters,
    onboarding,
    oauth,
    performance_reviews,
    pip,
    productivity,
    profile,
    project_deadlines,
    recruitment,
    resumes,
    salary,
    sprints,
    tasks,
    teams,
    test,
    # oauth,
    timesheets,
    training,
    work_attendance,
    whatsapp,
    whatsapp_meeting,
    announcement as announcements,
    announcements_whatsapp,
    project,
    team,
)
from app.api.v1.routes import announcements, candidate, applications as candidate_applications
from app.core.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.core.errors import ApiException, api_exception_handler
from app.core.import_paths import configure_legacy_import_paths
from app.core.smtp import reload_backend_env
from app.services.scheduler import start_scheduler, stop_scheduler
from app.api.routes import google_calendar_oauth
from app.ai_interview import init_ai_interview
from app.ai_interview.api import interview as ai_interview_api
from app.ai_interview.api import recruitment as ai_recruitment_api
from app.ai_interview.api import resume as ai_resume_api

configure_legacy_import_paths()
reload_backend_env()

app = FastAPI(title="Zenvora HRM Python Backend")
app.add_exception_handler(ApiException, api_exception_handler)

_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(attendance_alerts.router)
# app.include_router(oauth_router)  
app.include_router(test.router)
app.include_router(attendance_login.router)
app.include_router(attendance.router)
app.include_router(google_calendar_oauth.router)
app.include_router(attendance_login.router)
app.include_router(employees.router)
app.include_router(hr_actions.router)
app.include_router(hr_attendance.router)
app.include_router(jobs.router)
app.include_router(leaves.router)
app.include_router(manager_attendance.router)
app.include_router(productivity.router)
app.include_router(recruitment.router)
app.include_router(resumes.router)
app.include_router(sprints.router)
app.include_router(tasks.router)
app.include_router(teams.router)
app.include_router(whatsapp.router)
app.include_router(whatsapp_meeting.router)
app.include_router(timesheets.router)
app.include_router(notifications.router)
app.include_router(timesheets.router)
# app.include_router(whatsapp.router)
app.include_router(ai.router)
app.include_router(holidays.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(compliance.router)
app.include_router(dashboard.router)

app.include_router(project.router)
app.include_router(project.legacy_router)
app.include_router(team.router)
app.include_router(interviews.router)
app.include_router(performance_reviews.router)
app.include_router(exit_management.router)
app.include_router(pip.router)
app.include_router(profile.router)
app.include_router(documents.router)
app.include_router(events.router)
app.include_router(training.router)
app.include_router(work_attendance.router)
app.include_router(grievances.router)
app.include_router(onboarding.router)
app.include_router(announcements.router)
app.include_router(announcements_whatsapp.router)
app.include_router(candidate.router)
app.include_router(candidate_applications.router)
app.include_router(salary.router)
app.include_router(candidates.router)
app.include_router(offer_letters.router)
app.include_router(meeting_reminders.router)
app.include_router(project_deadlines.router)
app.include_router(resume_router)
app.include_router(ai_interview_api.router, prefix="/api/ai-interview/interview", tags=["ai-interview"])
app.include_router(ai_resume_api.router, prefix="/api/ai-interview/resume", tags=["ai-interview"])
app.include_router(ai_recruitment_api.router, prefix="/api/ai-interview/recruitment", tags=["ai-interview"])



@app.on_event("startup")
def on_startup():
    from app.db.database import init_mongo
    from app.core.config import get_settings
    settings = get_settings()
    mongo_uri = settings.get("MONGO_URI") or settings.get("MONGODB_URI")
    db_name = settings.get("DATABASE_NAME")
    if mongo_uri:
        init_mongo(mongo_uri, db_name)
    init_ai_interview()
    start_scheduler()
    _ensure_attendance_index()


def _ensure_attendance_index():
    """
    Create unique indexes to enforce one record per employee per day (attendance)
    and one face registration per employee_id (employees).
    """
    try:
        from app.core.database import attendance_collection, employees_collection
        if attendance_collection is not None:
            attendance_collection.create_index(
                [("employee_id", 1), ("date", 1)],
                unique=True,
                name="unique_employee_per_day",
                background=True,
            )
            print("[INFO] attendance_logs: unique index on (employee_id, date) ensured.")
        if employees_collection is not None:
            employees_collection.create_index(
                [("employee_id", 1)],
                unique=True,
                name="unique_employee_id",
                background=True,
            )
            print("[INFO] employees: unique index on employee_id ensured.")
    except Exception as e:
        print(f"[WARNING] Could not create indexes: {e}")


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()

