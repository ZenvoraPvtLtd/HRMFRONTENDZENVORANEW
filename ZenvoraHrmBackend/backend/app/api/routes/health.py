from fastapi import APIRouter

from app.core.database import get_mongo_status
from app.core.smtp import get_smtp_settings, verify_smtp_login

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    smtp_ok, smtp_error = verify_smtp_login()
    smtp = get_smtp_settings()
    mongo = get_mongo_status()
    return {
        "success": True,
        "service": "zenvora-python-backend",
        "status": "ok" if mongo["connected"] else "degraded",
        "mongodb": mongo,
        "smtp": {
            "enabled": smtp["enabled"],
            "user": smtp["user"],
            "ready": smtp_ok,
            "error": smtp_error,
        },
    }
