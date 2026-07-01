import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bson import ObjectId
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.core.database import db
from app.schemas.whatsapp import ScheduleWhatsAppRequest, SendWhatsAppRequest, SendMediaRequest, BroadcastWhatsAppRequest, BulkScheduleWhatsAppRequest
from app.services.whatsapp_service import whatsapp_service

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

DEFAULT_WHATSAPP_RULES = {
    "interview": True,
    "attendance": False,
    "leave": True,
    "tasks": True,
    "offers": True,
    "salary": False,
    "meetings": True,
    "deadlines": True,
    "shortlisting": True,
    "announcements": True,
}

DEFAULT_WHATSAPP_TEMPLATES = [
    {
        "id": "tpl_1",
        "name": "Interview Scheduling",
        "category": "Recruitment",
        "text": "Hello {{name}},\nYour interview has been scheduled for {{date}} at {{time}}.\n\nRole: {{title}}\nMeeting Link: {{link}}\n\nPlease join 5 minutes early.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_2",
        "name": "Project Deadlines",
        "category": "Task Management",
        "text": "Task deadline reminder:\nProject submission due in {{time}}.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_3",
        "name": "Attendance Alerts",
        "category": "HR Operations",
        "text": "Hello {{name}},\nYou have not clocked in for today yet. Please mark your attendance.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_4",
        "name": "Leave Approval/Rejection",
        "category": "HR Operations",
        "text": "Hello {{name}},\nYour leave request from {{time}} has been {{status}} by your manager.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_5",
        "name": "Task Assignments",
        "category": "Operations",
        "text": "Hi {{name}},\nA new task '{{title}}' has been assigned to you. Deadline: {{time}}.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_6",
        "name": "Offer Letters",
        "category": "Recruitment",
        "text": "Congratulations {{name}}!\n\nZenvora has extended an offer for the {{title}} role.\n\nSalary: {{salary}}\nJoining Date: {{joining_date}}\n\nOffer Letter PDF attached. Please review and confirm.",
        "supports_media": True,
        "media_type": "document",
    },
    {
        "id": "tpl_7",
        "name": "Salary Notifications",
        "category": "Finance",
        "text": "Hi {{name}},\n\nYour salary for {{month}} has been credited successfully.\n\nAmount: {{amount}}\nPayroll Date: {{date}}\n\nPayslip PDF attached.",
        "supports_media": True,
        "media_type": "document",
    },
    {
        "id": "tpl_8",
        "name": "Meeting Reminders",
        "category": "Operations",
        "text": "Reminder! The {{title}} meeting starts in 30 minutes.\n\nTime: {{time}}\nJoin Link: {{link}}\n\nPlease be ready!",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_9",
        "name": "Candidate Shortlisting",
        "category": "Recruitment",
        "text": "Great news {{name}}!\n\nYou have been shortlisted for the {{title}} role at Zenvora.\n\nNext Round: {{next_round}}\nScheduled on: {{date}}\n\nPlease await the next update from HR.",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_10",
        "name": "Employee Announcements",
        "category": "General",
        "text": "Announcement: {{title}}\n\nDear Zenvora team,\n{{body}}",
        "supports_media": False,
        "media_type": None,
    },
    {
        "id": "tpl_11",
        "name": "Bulk Team Broadcast",
        "category": "General",
        "text": "{{message}}",
        "supports_media": True,
        "media_type": "any",
    },
]

DEFAULT_WHATSAPP_CONFIG = {
    "twilio_sid": "",
    "twilio_token": "",
    "twilio_from": "",
    "waba_phone_id": "",
    "waba_token": "",
}


class WhatsAppConfigPayload(BaseModel):
    twilio_sid: Optional[str] = None
    twilio_token: Optional[str] = None
    twilio_from: Optional[str] = None
    waba_phone_id: Optional[str] = None
    waba_token: Optional[str] = None


class WhatsAppRulesPayload(BaseModel):
    interview: bool = True
    attendance: bool = False
    leave: bool = True
    tasks: bool = True
    offers: bool = True
    salary: bool = False
    meetings: bool = True
    deadlines: bool = True
    shortlisting: bool = True
    announcements: bool = True


class WhatsAppTemplatesPayload(BaseModel):
    templates: List[Dict[str, Any]]


def _mask_secret(value: Optional[str]) -> str:
    if not value:
        return ""
    return "••••••••••••" if value else ""


def _should_store_secret(raw_value: Optional[str]) -> Optional[str]:
    if raw_value is None:
        return None
    value = raw_value.strip()
    if value == "":
        return ""
    if "••••" in value:
        return None
    return value


def _get_collection(name: str):
    if db is None:
        return None
    return db[name]


def _read_singleton(col, default):
    if col is None:
        return default
    document = col.find_one({})
    if not document:
        return default
    document.pop("_id", None)
    return document


@router.get("/config")
def get_whatsapp_config():
    try:
        col = _get_collection("whatsapp_settings")
        config = _read_singleton(col, DEFAULT_WHATSAPP_CONFIG)

        return {
            "success": True,
            "data": {
                "twilioSid": _mask_secret(config.get("twilio_sid")),
                "twilioToken": _mask_secret(config.get("twilio_token")),
                "twilioFrom": config.get("twilio_from", ""),
                "wabaPhoneId": config.get("waba_phone_id", ""),
                "wabaToken": _mask_secret(config.get("waba_token")),
            },
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.put("/config")
def save_whatsapp_config(payload: WhatsAppConfigPayload):
    try:
        col = _get_collection("whatsapp_settings")
        if col is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        existing = col.find_one({}) or {}
        update_data: Dict[str, Any] = {}

        twilio_sid = _should_store_secret(payload.twilio_sid)
        if twilio_sid is not None:
            update_data["twilio_sid"] = twilio_sid

        twilio_token = _should_store_secret(payload.twilio_token)
        if twilio_token is not None:
            update_data["twilio_token"] = twilio_token

        if payload.twilio_from is not None:
            update_data["twilio_from"] = payload.twilio_from.strip()

        if payload.waba_phone_id is not None:
            update_data["waba_phone_id"] = payload.waba_phone_id.strip()

        waba_token = _should_store_secret(payload.waba_token)
        if waba_token is not None:
            update_data["waba_token"] = waba_token

        if existing:
            col.update_one({"_id": existing["_id"]}, {"$set": update_data})
        else:
            col.insert_one(update_data)

        return {"success": True, "message": "WhatsApp configuration saved successfully"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/rules")
def get_whatsapp_rules():
    try:
        col = _get_collection("whatsapp_rules")
        rules = _read_singleton(col, DEFAULT_WHATSAPP_RULES)
        return {"success": True, "data": rules}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.put("/rules")
def save_whatsapp_rules(payload: WhatsAppRulesPayload):
    try:
        col = _get_collection("whatsapp_rules")
        if col is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        data = payload.model_dump()
        col.update_one({}, {"$set": data}, upsert=True)
        return {"success": True, "message": "WhatsApp automation rules saved"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/templates")
def get_whatsapp_templates():
    try:
        col = _get_collection("whatsapp_templates")
        templates_doc = _read_singleton(col, {"templates": DEFAULT_WHATSAPP_TEMPLATES})
        templates = templates_doc.get("templates") if isinstance(templates_doc, dict) else DEFAULT_WHATSAPP_TEMPLATES
        return {"success": True, "data": templates}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.put("/templates")
def save_whatsapp_templates(payload: WhatsAppTemplatesPayload):
    try:
        col = _get_collection("whatsapp_templates")
        if col is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        col.update_one({}, {"$set": {"templates": payload.templates}}, upsert=True)
        return {"success": True, "message": "WhatsApp templates saved successfully"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


def _format_whatsapp_number(phone: str) -> str:
    formatted = phone.strip().replace(" ", "")
    if not formatted.startswith("whatsapp:"):
        formatted = f"whatsapp:{'+' if not formatted.startswith('+') else ''}{formatted}"
    return formatted


@router.post("/schedule")
def schedule_whatsapp(payload: ScheduleWhatsAppRequest):
    try:
        scheduled_dt = None
        if payload.scheduled_time:
            try:
                clean_time = payload.scheduled_time.replace("Z", "+00:00")
                scheduled_dt = datetime.fromisoformat(clean_time)
            except Exception as parse_err:
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "message": f"Invalid scheduled_time format: {parse_err}. Please use ISO-8601 format.",
                    },
                )

        return whatsapp_service.queue_message(
            recipient_name=payload.recipient_name,
            phone=payload.phone,
            notification_type=payload.notification_type,
            template_data=payload.template_data,
            scheduled_time=scheduled_dt,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "message": "Failed to queue WhatsApp message"},
        )


@router.post("/send")
def send_whatsapp_now(payload: SendWhatsAppRequest):
    try:
        sid = payload.twilio_sid if payload.twilio_sid and "••••" not in payload.twilio_sid else None
        token = payload.twilio_token if payload.twilio_token and "••••" not in payload.twilio_token else None
        from_number = payload.twilio_from or os.getenv("TWILIO_FROM_NUMBER") or "+14155238886"

        if sid and token:
            formatted_phone = _format_whatsapp_number(payload.phone)
            formatted_from = _format_whatsapp_number(from_number)
            twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

            response = requests.post(
                twilio_url,
                data={"To": formatted_phone, "From": formatted_from, "Body": payload.message},
                auth=requests.auth.HTTPBasicAuth(sid, token),
                timeout=60,
            )

            try:
                data = response.json()
            except ValueError:
                data = {}

            if not response.ok:
                return JSONResponse(
                    status_code=response.status_code,
                    content={
                        "success": False,
                        "message": data.get("message") or "Twilio gateway request failed",
                        "error": data,
                    },
                )

            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Message successfully sent via Twilio Gateway",
                    "message_sid": data.get("sid"),
                    "gatewayId": data.get("sid"),
                    "sid": data.get("sid"),
                    "status": data.get("status"),
                    "recipient": formatted_phone,
                },
            )

        return whatsapp_service.send_whatsapp_message(
            phone=payload.phone,
            message=payload.message,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "message": "Failed to instantly dispatch WhatsApp message"},
        )


@router.post("/send-media")
def send_whatsapp_media(payload: SendMediaRequest):
    try:
        return whatsapp_service.send_media_message(
            phone=payload.phone,
            media_url=payload.media_url,
            caption=payload.caption or "",
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "message": "Failed to send media message"},
        )


@router.get("/status")
def get_scheduler_status():
    try:
        queue_stats = whatsapp_service.get_queue_status()

        return {
            "success": True,
            "pending": queue_stats.get("pending", 0),
            "sent": queue_stats.get("sent", 0),
            "failed": queue_stats.get("failed", 0),
            "cancelled": queue_stats.get("cancelled", 0),
            "scheduler_running": whatsapp_service.scheduler_running,
            "twilio_configured": whatsapp_service.twilio_configured,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/webhook")
def receive_twilio_whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(None),
    MessageSid: str = Form(None),
):
    try:
        message_body = Body or ""
        normalized = re.sub(r"\s+", " ", message_body.strip()).upper()
        stop_pattern = re.compile(r"\b(?:STOP|CANCEL|NO|UNSUBSCRIBE)\b", re.IGNORECASE)

        if whatsapp_service.queue_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        if stop_pattern.search(normalized):
            whatsapp_service.cancel_pending_by_phone(
                phone=From,
                reason=f"Cancelled due to user reply: '{message_body}'",
            )

        return Response(content="<Response></Response>", media_type="text/xml")
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/schedules")
def get_schedules(limit: int = 100):
    try:
        return {"success": True, "data": whatsapp_service.get_schedules(limit=limit)}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: str):
    try:
        if whatsapp_service.queue_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        return whatsapp_service.cancel_notification(schedule_id)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/broadcast/send")
def broadcast_whatsapp_message(payload: BroadcastWhatsAppRequest):
    """Send message to multiple recipients by department"""
    try:
        # Fetch employee phone numbers from MongoDB based on department
        query = {}
        if payload.department != "All Employees":
            query = {"department": payload.department}
        
        # Query employees collection for active employees with phone numbers
        employees = list(db["employees"].find(
            {**query, "phoneNumber": {"$exists": True, "$ne": ""}, "status": {"$ne": "inactive"}},
            {"phoneNumber": 1, "name": 1, "department": 1, "status": 1, "_id": 1}
        ))

        print("DEBUG broadcast_whatsapp_message - department:", payload.department)
        print("DEBUG broadcast_whatsapp_message - query:", {**query, "phoneNumber": {"$exists": True, "$ne": ""}, "status": {"$ne": "inactive"}})
        for emp in employees:
            print(
                "DEBUG employee:",
                {
                    "name": emp.get("name"),
                    "department": emp.get("department"),
                    "status": emp.get("status"),
                    "phoneNumber": emp.get("phoneNumber"),
                },
            )
        
        if not employees:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": f"No active employees found in {payload.department} department with phone numbers"},
            )
        
        recipient_phones = [emp.get("phoneNumber") for emp in employees if emp.get("phoneNumber")]
        
        if not recipient_phones:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No recipient phones found after filtering"},
            )

        results = []
        for idx, phone in enumerate(recipient_phones):
            try:
                if payload.media_url:
                    result = whatsapp_service.send_media_message(
                        phone=phone,
                        media_url=payload.media_url,
                        caption=payload.media_caption or payload.message,
                    )
                else:
                    result = whatsapp_service.send_whatsapp_message(
                        phone=phone,
                        message=payload.message,
                    )
                results.append({"phone": phone, "success": result.get("success", False), "result": result})
            except Exception as e:
                results.append({"phone": phone, "success": False, "error": str(e)})

        return {
            "success": True,
            "message": f"Broadcast sent to {len(recipient_phones)} recipients in {payload.department}",
            "recipient_count": len(recipient_phones),
            "results": results,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/broadcast/schedule")
def bulk_schedule_whatsapp(payload: BulkScheduleWhatsAppRequest):
    """Schedule bulk messages for multiple recipients"""
    try:
        if not payload.recipients:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No recipients provided"},
            )

        scheduled_dt = None
        if payload.scheduled_time:
            try:
                clean_time = payload.scheduled_time.replace("Z", "+00:00")
                scheduled_dt = datetime.fromisoformat(clean_time)
            except Exception as parse_err:
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "message": f"Invalid scheduled_time format: {parse_err}. Please use ISO-8601 format.",
                    },
                )

        results = []
        for recipient in payload.recipients:
            try:
                result = whatsapp_service.queue_message(
                    recipient_name=recipient.get("name", ""),
                    phone=recipient.get("phone", ""),
                    notification_type=payload.notification_type,
                    template_data=recipient.get("template_data", {}),
                    scheduled_time=scheduled_dt,
                )
                results.append({"phone": recipient.get("phone"), "success": result.get("success", False)})
            except Exception as e:
                results.append({"phone": recipient.get("phone"), "success": False, "error": str(e)})

        return {
            "success": True,
            "message": f"Bulk schedule created for {len(payload.recipients)} recipients",
            "results": results,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


# ── PDF Upload + Send ──────────────────────────────────────────────

_WHATSAPP_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "whatsapp")
os.makedirs(_WHATSAPP_UPLOAD_DIR, exist_ok=True)


def _save_uploaded_pdf(file: UploadFile) -> str:
    """Save uploaded file and return the public URL path."""
    safe_name = re.sub(r"[^\w\-.]", "_", file.filename or "document.pdf")
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    file_path = os.path.join(_WHATSAPP_UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        content = file.file.read()
        f.write(content)
    # Return the public URL (backend serves /uploads as static)
    return f"/uploads/whatsapp/{unique_name}"


@router.post("/send-pdf")
async def send_whatsapp_pdf(
    phone: str = Form(...),
    caption: str = Form(""),
    file: UploadFile = File(...),
):
    """Upload a PDF/file and send it via WhatsApp to a single recipient."""
    try:
        # Validate file
        if not file.filename:
            return JSONResponse(status_code=400, content={"success": False, "message": "No file provided"})

        # Save file to uploads/whatsapp/
        media_url = _save_uploaded_pdf(file)
        print(f"[WHATSAPP-PDF] Saved file: {media_url}")

        # Build the full URL for Twilio (needs publicly accessible URL)
        # For local dev, use the relative path; Twilio will need a public URL
        # If running behind ngrok or public domain, prepend it
        base_url = os.getenv("BACKEND_PUBLIC_URL", "").strip()
        if base_url:
            full_media_url = f"{base_url}{media_url}"
        else:
            full_media_url = media_url  # Will work in sandbox mode

        # Send via WhatsApp
        result = whatsapp_service.send_media_message(
            phone=phone,
            media_url=full_media_url,
            caption=caption or "Document attached",
        )

        return {
            "success": True,
            "message": "PDF sent via WhatsApp",
            "media_url": media_url,
            "result": result,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


# ── Bulk Send (Text + Optional PDF) ────────────────────────────────

@router.post("/bulk-send")
async def bulk_send_whatsapp(
    phones: str = Form(...),
    message: str = Form(""),
    file: Optional[UploadFile] = File(None),
    caption: str = Form(""),
):
    """
    Send text message and/or PDF to multiple WhatsApp recipients.
    phones: comma-separated phone numbers (e.g. '+919876543210,+919876543211')
    message: text message to send (optional if file is provided)
    file: PDF/image file to attach (optional)
    caption: caption for the file (optional)
    """
    try:
        # Parse phone numbers
        phone_list = [p.strip() for p in phones.split(",") if p.strip()]
        if not phone_list:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No valid phone numbers provided"},
            )

        # If file is provided, save it first
        media_url = None
        if file and file.filename:
            media_url = _save_uploaded_pdf(file)
            base_url = os.getenv("BACKEND_PUBLIC_URL", "").strip()
            if base_url:
                media_url = f"{base_url}{media_url}"
            print(f"[BULK-WHATSAPP] Saved file: {media_url}")

        if not message and not media_url:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Provide at least a message or a file"},
            )

        results = []
        sent_count = 0
        failed_count = 0

        for phone in phone_list:
            try:
                if media_url:
                    # Send media with caption
                    result = whatsapp_service.send_media_message(
                        phone=phone,
                        media_url=media_url,
                        caption=caption or message or "Document attached",
                    )
                else:
                    # Send text only
                    result = whatsapp_service.send_whatsapp_message(
                        phone=phone,
                        message=message,
                    )

                success = result.get("success", False)
                results.append({"phone": phone, "success": success})
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                results.append({"phone": phone, "success": False, "error": str(e)})
                failed_count += 1

        return {
            "success": True,
            "message": f"Bulk send complete: {sent_count} sent, {failed_count} failed out of {len(phone_list)} recipients",
            "total": len(phone_list),
            "sent": sent_count,
            "failed": failed_count,
            "media_url": media_url,
            "results": results,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


# ── Bulk Send from Contact List ────────────────────────────────────

@router.post("/bulk-send-employees")
async def bulk_send_to_employees(
    message: str = Form(""),
    file: Optional[UploadFile] = File(None),
    caption: str = Form(""),
    department: str = Form(""),
):
    """
    Send WhatsApp message/PDF to employees from the database.
    Optionally filter by department.
    """
    try:
        from app.core.database import employees_collection
        if employees_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        # Build query
        query = {}
        if department:
            query["department"] = department

        # Fetch employees with phone numbers
        employees = list(employees_collection.find(query, {"phone": 1, "name": 1, "department": 1, "_id": 0}))
        phone_list = []
        for emp in employees:
            phone = emp.get("phone", "")
            if phone:
                clean = re.sub(r"[^\d+]", "", phone)
                if clean:
                    if not clean.startswith("+"):
                        clean = "+91" + clean
                    phone_list.append(clean)

        if not phone_list:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": f"No employees with phone numbers found" + (f" in department '{department}'" if department else "")},
            )

        # Save file if provided
        media_url = None
        if file and file.filename:
            media_url = _save_uploaded_pdf(file)
            base_url = os.getenv("BACKEND_PUBLIC_URL", "").strip()
            if base_url:
                media_url = f"{base_url}{media_url}"

        if not message and not media_url:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Provide at least a message or a file"},
            )

        results = []
        sent_count = 0

        for phone in phone_list:
            try:
                if media_url:
                    result = whatsapp_service.send_media_message(
                        phone=phone,
                        media_url=media_url,
                        caption=caption or message or "Document attached",
                    )
                else:
                    result = whatsapp_service.send_whatsapp_message(
                        phone=phone,
                        message=message,
                    )
                success = result.get("success", False)
                results.append({"phone": phone, "success": success})
                if success:
                    sent_count += 1
            except Exception as e:
                results.append({"phone": phone, "success": False, "error": str(e)})

        return {
            "success": True,
            "message": f"Sent to {sent_count}/{len(phone_list)} employees",
            "total": len(phone_list),
            "sent": sent_count,
            "failed": len(phone_list) - sent_count,
            "results": results,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})
