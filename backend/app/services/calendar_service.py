"""
calendar_service.py — compatibility shim.

The actual implementation lives in google_calendar_service.py which uses
OAuth 2.0 refresh tokens (server-safe, no google_auth_oauthlib needed).
This file re-exports the same interface so existing imports still work.
"""

from app.services.google_calendar_service import create_interview_meeting  # noqa: F401


def create_google_meet(candidate_name: str, candidate_email: str = "") -> str:
    """
    Legacy wrapper — kept for backward compatibility.
    Creates a Google Calendar event with Google Meet and returns the Meet link.
    Falls back to Jitsi if Google credentials are not configured.
    """
    import os
    from datetime import datetime, timedelta

    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        result = create_interview_meeting(
            candidate_name=candidate_name,
            interviewer_name="HR Team",
            interview_date=tomorrow,
            start_time="10:00",
            end_time="11:00",
            candidate_email=candidate_email or "noreply@zenvora.com",
        )
        meet_link = result.get("meet_link", "")
        if meet_link:
            return meet_link
    except Exception as exc:
        print(f"[CALENDAR] Google Meet creation failed, using fallback: {exc}")

    # Fallback — use configured link or Jitsi
    from dotenv import load_dotenv
    load_dotenv(override=True)
    configured = os.getenv("INTERVIEW_LINK", "").strip()
    if configured and "abc-defg-hij" not in configured:
        return configured
    return "https://meet.jit.si/ZenvoraHRM-Interview"
