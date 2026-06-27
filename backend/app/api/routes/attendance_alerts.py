"""
Attendance alerts + manual report trigger endpoints.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/attendance", tags=["attendance-alerts"])


@router.post("/reports/send-now")
async def trigger_report_now(report_type: str = "weekly"):
    """
    Manually trigger an attendance report email.
    report_type: "today" | "weekly" | "monthly"
    """
    from datetime import datetime, timedelta

    report_type = report_type.lower().strip()
    now = datetime.now()

    if report_type == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date   = now
        label      = "Daily"
    elif report_type == "monthly":
        first_this  = now.replace(day=1)
        end_date    = first_this - timedelta(days=1)
        start_date  = end_date.replace(day=1)
        label       = "Monthly"
    else:
        # weekly — last 7 days
        end_date   = now
        start_date = now - timedelta(days=7)
        label      = "Weekly"

    try:
        from app.services.scheduler import _build_report_data, _send_report
        _send_report(label, start_date, end_date)
        return {"success": True, "message": f"{label} attendance report sent to admin email."}
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )


@router.get("/reports/config")
async def get_report_config():
    """Return current auto-report schedule configuration."""
    import os
    return {
        "admin_email": os.getenv("ADMIN_REPORT_EMAIL") or os.getenv("EMAIL_USER") or "",
        "weekly":  {"enabled": True, "schedule": "Every Monday at 08:00 AM"},
        "monthly": {"enabled": True, "schedule": "1st of every month at 08:00 AM"},
    }
