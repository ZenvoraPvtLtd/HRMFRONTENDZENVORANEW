from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import pytz
import requests

logger = logging.getLogger("GoogleCalendarService")

BACKEND_DIR = Path(__file__).resolve().parents[2]
CLIENT_SECRET_PATH = BACKEND_DIR / "client_secret.json"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _load_client_secrets() -> Dict[str, str]:
    if not CLIENT_SECRET_PATH.exists():
        return {}

    try:
        data = json.loads(CLIENT_SECRET_PATH.read_text(encoding="utf-8"))
        return data.get("web") or data.get("installed") or {}
    except Exception as exc:
        logger.error("Failed to read client_secret.json: %s", exc)
        return {}


def _get_google_credentials() -> Dict[str, str]:
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env", override=True)
    
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        secrets = _load_client_secrets()
        client_id = client_id or secrets.get("client_id", "")
        client_secret = client_secret or secrets.get("client_secret", "")

    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
    timezone_name = os.getenv("GOOGLE_CALENDAR_TIMEZONE", "UTC").strip() or "UTC"

    if not client_id or not client_secret:
        raise RuntimeError(
            "Google OAuth client credentials are missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or provide them in client_secret.json."
        )

    if not refresh_token:
        raise RuntimeError(
            "Google Calendar refresh token is missing. Set GOOGLE_REFRESH_TOKEN with a valid refresh token to authorize calendar event creation."
        )

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "timezone": timezone_name,
    }


def _validate_email(email: str) -> bool:
    return bool(email and EMAIL_REGEX.match(email.strip()))


def _parse_time_string(value: str) -> datetime.time:
    value = value.strip()
    for fmt in ["%H:%M", "%H:%M:%S"]:
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Time must be in HH:MM or HH:MM:SS format: {value}")


def _build_rfc3339_local(date_string: str, time_string: str, timezone_name: str) -> str:
    try:
        date_part = datetime.strptime(date_string.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"Interview date must be YYYY-MM-DD: {date_string}") from exc

    time_part = _parse_time_string(time_string)

    try:
        tz = pytz.timezone(timezone_name)
    except Exception as exc:
        raise ValueError(f"Invalid timezone: {timezone_name}") from exc

    local_dt = datetime.combine(date_part, time_part)
    localized = tz.localize(local_dt)
    return localized.isoformat()


def _refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    response = requests.post(TOKEN_URL, data=payload, timeout=30)

    if response.status_code != 200:
        raise RuntimeError(
            f"Failed to refresh Google access token: {response.status_code} {response.text}"
        )

    token_data = response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise RuntimeError(
            f"Google token response did not contain access_token: {token_data}"
        )

    return access_token


def _extract_meet_link(event: Dict[str, any]) -> Optional[str]:
    meet_url = event.get("hangoutLink")
    if meet_url:
        return meet_url

    conference = event.get("conferenceData", {})
    for entry in conference.get("entryPoints", []) if conference else []:
        if entry.get("entryPointType") in {"video", "hangoutsMeet"}:
            return entry.get("uri")

    return None


def create_interview_meeting(
    candidate_name: str,
    interviewer_name: str,
    interview_date: str,
    start_time: str,
    end_time: str,
    candidate_email: str,
) -> Dict[str, str]:
    """
    Create a Google Calendar event for an interview and return event details.
    """
    if not candidate_name or not interviewer_name:
        raise ValueError("Candidate and interviewer names are required.")

    if not _validate_email(candidate_email):
        raise ValueError("A valid candidate_email is required for Google Calendar attendee creation.")

    creds = _get_google_credentials()
    start_iso = _build_rfc3339_local(interview_date, start_time, creds["timezone"])
    end_iso = _build_rfc3339_local(interview_date, end_time, creds["timezone"])

    access_token = _refresh_access_token(
        client_id=creds["client_id"],
        client_secret=creds["client_secret"],
        refresh_token=creds["refresh_token"],
    )

    event_body = {
        "summary": f"Interview: {candidate_name} with {interviewer_name}",
        "description": (
            f"Interview scheduled for {candidate_name} with {interviewer_name}. "
            f"Candidate email: {candidate_email}."
        ),
        "start": {"dateTime": start_iso, "timeZone": creds["timezone"]},
        "end": {"dateTime": end_iso, "timeZone": creds["timezone"]},
        "attendees": [{"email": candidate_email, "displayName": candidate_name}],
        "conferenceData": {
            "createRequest": {
                "requestId": f"zenvora-interview-{uuid.uuid4().hex}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {"useDefault": True},
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    params = {"conferenceDataVersion": 1}
    response = requests.post(
        CALENDAR_EVENTS_URL,
        headers=headers,
        params=params,
        json=event_body,
        timeout=30,
    )

    if response.status_code not in {200, 201}:
        detail = response.text
        logger.error("Google Calendar event creation failed: %s", detail)
        raise RuntimeError(
            f"Google Calendar API error ({response.status_code}): {detail}"
        )

    event = response.json()
    meet_link = _extract_meet_link(event)
    calendar_link = event.get("htmlLink")
    event_id = event.get("id")

    if not event_id or not calendar_link:
        raise RuntimeError("Google Calendar event created but response did not include expected event_id or calendar_link.")

    return {
        "event_id": event_id,
        "meet_link": meet_link or "",
        "calendar_link": calendar_link,
    }
