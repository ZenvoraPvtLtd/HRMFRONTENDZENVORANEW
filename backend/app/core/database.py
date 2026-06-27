import os
import certifi
from pathlib import Path

from pymongo import MongoClient
from dotenv import load_dotenv

_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
try:
    load_dotenv(_BACKEND_ENV, override=True)
except OSError as e:
    print(f"[WARNING] Failed to load .env file: {e}")
    print("[WARNING] Using default environment variables")

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_URI_FALLBACK = os.getenv("MONGO_URI_FALLBACK") or os.getenv("MONGODB_FALLBACK_URI", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "parsed_resumes")
MONGO_PREFER_LOCAL = os.getenv("MONGO_PREFER_LOCAL", "").strip().lower() in ("1", "true", "yes")


def create_mongo_client(uri: str, **extra) -> MongoClient:
    """Build a PyMongo client with Atlas TLS settings when needed."""
    mongo_options = {
        "serverSelectionTimeoutMS": 10000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": None,
        "retryWrites": True,
        "maxPoolSize": 50,
        **extra,
    }
    if "mongodb+srv" in uri or ".mongodb.net" in uri or "ssl=true" in uri.lower():
        mongo_options["tlsCAFile"] = certifi.where()
        mongo_options["tls"] = True
        mongo_options["w"] = "majority"
    return MongoClient(uri, **mongo_options)


def _mask_uri(uri: str) -> str:
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        host_part = rest.split("@", 1)[1]
        return f"{scheme}://***@{host_part}"
    return uri


def _connect_mongo() -> tuple[MongoClient | None, str | None]:
    endpoints: list[tuple[str, str]] = [("primary", MONGODB_URI), ("fallback", MONGO_URI_FALLBACK)]
    if MONGO_PREFER_LOCAL and MONGO_URI_FALLBACK and MONGO_URI_FALLBACK != MONGODB_URI:
        endpoints = [("fallback", MONGO_URI_FALLBACK), ("primary", MONGODB_URI)]

    has_fallback = bool(MONGO_URI_FALLBACK and MONGO_URI_FALLBACK != MONGODB_URI)

    for label, uri in endpoints:
        if not uri or (label == "fallback" and uri == MONGODB_URI):
            continue
        try:
            mongo_client = create_mongo_client(uri)
            mongo_client.server_info()
            return mongo_client, label
        except Exception as exc:
            if label == "primary" and has_fallback:
                print(f"[WARNING] MongoDB primary unavailable, trying fallback...")
            else:
                print(f"[ERROR] MongoDB {label} connection failed: {exc}")
    return None, None


def get_mongo_status() -> dict:
    return {
        "connected": client is not None,
        "database": DATABASE_NAME if client is not None else None,
        "source": _connection_source,
        "prefer_local": MONGO_PREFER_LOCAL,
        "primary_uri": _mask_uri(MONGODB_URI),
        "fallback_uri": _mask_uri(MONGO_URI_FALLBACK),
    }


client = None
db = None
_connection_source: str | None = None
collection = None
jobs_collection = None
projects_collection = None
tasks_collection = None
employees_list_collection = None
sprints_collection = None
employees_collection = None
attendance_collection = None
leaves_collection = None
leave_balances_collection = None
hr_actions_collection = None
timesheet_approvals_collection = None
employee_activity_collection = None
notifications_collection = None
interviews_collection = None
performance_reviews_collection = None
exit_management_collection = None
pip_collection = None
users_collection = None
documents_collection = None
events_collection = None
trainings_collection = None
grievances_collection = None
onboarding_collection = None
teams_collection = None
recruitment_candidates_collection = None
recruitment_interviews_collection = None
recruitment_jobs_collection = None

try:
    client, _connection_source = _connect_mongo()
    if client is None:
        raise RuntimeError("MongoDB unavailable on primary and fallback URIs")

    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    jobs_collection = db["Jobs"]
    projects_collection = db["Projects"]
    tasks_collection = db["Tasks"]
    employees_list_collection = db["employees_list"]
    sprints_collection = db["Sprints"]
    employees_collection = db["employees"]
    attendance_collection = db["attendance_logs"]
    leaves_collection = db["leaves"]
    leave_balances_collection = db["leave_balances"]
    hr_actions_collection = db["hr_actions"]
    timesheet_approvals_collection = db["timesheet_approvals"]
    employee_activity_collection = db["employee_activity"]
    notifications_collection = db["notifications"]
    interviews_collection = db["interviews"]
    performance_reviews_collection = db["performance_reviews"]
    exit_management_collection = db["exit_management"]
    pip_collection = db["performance_improvement_plans"]
    users_collection = db["users"]
    documents_collection = db["employee_documents"]
    events_collection = db["events"]
    trainings_collection = db["trainings"]
    grievances_collection = db["grievances"]
    onboarding_collection = db["onboarding"]
    teams_collection = db["teams"]
    recruitment_candidates_collection = db["recruitment_candidates"]
    recruitment_interviews_collection = db["recruitment_interviews"]
    recruitment_jobs_collection = db["recruitment_jobs"]

    try:
        users_collection.create_index("email", unique=True)
    except Exception:
        pass

    source_label = "local fallback" if _connection_source == "fallback" else "primary"
    print(f"[SUCCESS] MongoDB Connected ({source_label})! DB: {DATABASE_NAME}")

except Exception as e:
    print(f"[ERROR] MongoDB connection failed: {e}")
    client = None
    db = None
    _connection_source = None
    collection = None
    jobs_collection = None
    projects_collection = None
    tasks_collection = None
    employees_list_collection = None
    sprints_collection = None
    employees_collection = None
    attendance_collection = None
    leaves_collection = None
    leave_balances_collection = None
    hr_actions_collection = None
    timesheet_approvals_collection = None
    employee_activity_collection = None
    notifications_collection = None
    interviews_collection = None
    performance_reviews_collection = None
    exit_management_collection = None
    pip_collection = None
    users_collection = None
    documents_collection = None
    events_collection = None
    trainings_collection = None
    grievances_collection = None
    onboarding_collection = None
    teams_collection = None
    recruitment_candidates_collection = None
    recruitment_interviews_collection = None
    recruitment_jobs_collection = None
