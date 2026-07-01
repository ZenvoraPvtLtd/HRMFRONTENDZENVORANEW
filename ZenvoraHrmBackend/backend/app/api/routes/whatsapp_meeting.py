import os
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.whatsapp_service import whatsapp_service

router = APIRouter(prefix="/api/whatsapp/meeting", tags=["whatsapp_meeting"])

class MeetingLinkPayload(BaseModel):
    recipient_name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=5)
    meeting_subject: str = Field(..., min_length=1)
    meeting_time: str = Field(..., description="ISO-8601 datetime string")
    custom_link: str | None = None

@router.post("/send")
async def send_meeting_link(payload: MeetingLinkPayload):
    """Generate (or accept) a meeting link and send it via WhatsApp.
    Uses the existing `meeting_reminders` template which expects
    `{meeting_subject}`, `{meeting_time}` and `{join_link}` placeholders.
    """
    if not whatsapp_service:
        raise HTTPException(status_code=503, detail="WhatsApp service unavailable")

    # Determine link
    if payload.custom_link:
        join_link = payload.custom_link
    else:
        base_url = os.getenv("FASTAPI_BASE_URL", "http://localhost:8000")
        join_link = f"{base_url}/meetings/{uuid.uuid4().hex}"

    try:
        whatsapp_service.queue_message(
            recipient_name=payload.recipient_name,
            phone=payload.phone,
            notification_type="meeting_reminders",
            template_data={
                "meeting_subject": payload.meeting_subject,
                "meeting_time": payload.meeting_time,
                "join_link": join_link,
            },
        )
        return {
            "success": True,
            "message": "WhatsApp meeting link queued",
            "join_link": join_link,
            "meeting_link": join_link,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue WhatsApp message: {e}")
