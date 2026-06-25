from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ScheduleWhatsAppRequest(BaseModel):
    recipient_name: str
    phone: str
    notification_type: str
    template_data: Dict[str, Any]
    scheduled_time: Optional[str] = None


class SendWhatsAppRequest(BaseModel):
    phone: str
    message: str
    twilio_sid: Optional[str] = None
    twilio_token: Optional[str] = None
    twilio_from: Optional[str] = None


class SendMediaRequest(BaseModel):
    phone: str
    media_url: str
    caption: Optional[str] = ""


class BroadcastWhatsAppRequest(BaseModel):
    """Broadcast message to multiple recipients by department"""
    department: str
    message: str
    media_url: Optional[str] = None
    media_caption: Optional[str] = ""


class BulkScheduleWhatsAppRequest(BaseModel):
    """Schedule bulk messages with template data"""
    recipients: List[Dict[str, Any]]  # List of {name, phone, template_data}
    notification_type: str
    scheduled_time: Optional[str] = None
