import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

from app.core.database import DATABASE_NAME, db
from twilio.rest import Client

# Configure Logging with rich details
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("WhatsAppScheduler")

class WhatsAppTemplateEngine:
    """
    Renders professional, sleek notifications for all 10 HR automation events.
    """
    
    TEMPLATES = {
        "interview_scheduling": (
            "📅 *Interview Scheduled — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "Your interview has been scheduled. Here are the details:\n\n"
            "🏷️  *Position:* {position}\n"
            "🕐  *Date & Time:* {interview_time}\n"
            "📋  *Type:* {interview_type}\n"
            "📍  *Location/Link:* {location}\n\n"
            "Please confirm your availability by replying to this message.\n\n"
            "Best Regards,\n— *HR Team, Zenvora*"
        ),
        "attendance_alerts": (
            "🚨 *Attendance Alert — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "{alert_message}\n\n"
            "If this is incorrect, please contact HR immediately.\n\n"
            "— *HR Team, Zenvora*"
        ),
        "leave_approval_rejection": (
            "📝 *Leave Request Update — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "Your leave request has been *{status}*.\n\n"
            "📅  *Leave Dates:* {leave_dates}\n"
            "💬  *Manager's Note:* {notes}\n\n"
            "For queries, contact your HR representative.\n\n"
            "— *HR Team, Zenvora*"
        ),
        "task_assignments": (
            "📋 *New Task Assigned — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "A new task has been assigned to you:\n\n"
            "📌  *Task:* {task_title}\n"
            "⚡  *Priority:* {priority}\n"
            "📅  *Due Date:* {due_date}\n\n"
            "Please log in to the portal for full details.\n\n"
            "— *HR Team, Zenvora*"
        ),
        "offer_letters": (
            "Congratulations! 🎉\n"
            "Hello {recipient_name},\n"
            "We are thrilled to offer you the position of {position} at Zenvora Pvt Ltd.\n"
            "Department: {department}\n"
            "Salary: {salary}\n"
            "Joining Date: {joining_date}\n"
            "Employment Type: {employment_type}\n"
            "Your official offer letter document is attached. "
            "Please review and respond by {deadline}."
        ),
        "salary_notifications": (
            "Salary Notification 💰\n"
            "Hello {recipient_name},\n"
            "Your salary slip for {month} has been processed and credited to your account.\n"
            "Gross Salary: {gross_salary}\n"
            "Deductions: {deductions}\n"
            "Net Credit: {net_salary}\n"
            "Your payslip document is attached. Download it for your records."
        ),
        "meeting_reminders": (
            "🎉 *Interview Shortlisting — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "Congratulations! 🥳 You have been *shortlisted* for the next round of our hiring process.\n\n"
            "📋 *Interview Details*\n"
            "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n"
            "🏷️  *Role:* {meeting_subject}\n"
            "🕐  *Time:* {meeting_time}\n"
            "📍  *Mode:* Google Meet (Online)\n\n"
            "🔗 *Join Interview:*\n"
            "{join_link}\n\n"
            "📌 *Tips before joining:*\n"
            "• Join 5 minutes early\n"
            "• Ensure stable internet connection\n"
            "• Keep camera & mic ready\n"
            "• Find a quiet, well-lit space\n\n"
            "Best of luck! 💼\n"
            "— *HR Team, Zenvora*"
        ),
        "project_deadlines": (
            "Project Deadline Reminder ⏰\n"
            "Hello {recipient_name},\n"
            "Project '{project_name}' is due in {hours_remaining} hours.\n"
            "Priority: {priority}\n"
            "Action Required: Please ensure timely submission."
        ),
        "candidate_shortlisting": (
            "✅ *Shortlisting Update — Zenvora HRM*\n\n"
            "Hello *{recipient_name}*,\n\n"
            "Great news! 🌟 You have been *shortlisted* for the *{position}* role at Zenvora.\n\n"
            "📋 *Next Steps*\n"
            "┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n"
            "🔹 *Next Round:* {next_round}\n"
            "📅 *Scheduled on:* {date}\n\n"
            "Our HR team will reach out with further details shortly.\n"
            "Keep an eye on your WhatsApp & email! 📧\n\n"
            "Best Regards,\n— *HR Team, Zenvora*"
        ),
        "employee_announcements": (
            "📢 Zenvora Announcement:\n"
            "Subject: {title}\n\n"
            "{content}"
        )
    }

    @classmethod
    def render(cls, notification_type: str, recipient_name: str, template_data: Dict[str, Any]) -> str:
        """
        Renders the message body using the specified template and data payload.
        """
        raw_template = cls.TEMPLATES.get(notification_type)
        if not raw_template:
            # Fallback template
            return f"Notification for {recipient_name}: {str(template_data)}"
        
        # Merge recipient_name into template_data if not present
        data = {"recipient_name": recipient_name, **template_data}
        
        try:
            # Standard formatting
            return raw_template.format(**data)
        except KeyError as e:
            logger.warning(f"Missing key {e} in template data for type '{notification_type}'. Using fallback layout.")
            # Graceful fallback by replacing unresolved keys
            formatted = raw_template
            for k, v in data.items():
                formatted = formatted.replace(f"{{{k}}}", str(v))
            return formatted

class WhatsAppSchedulerService:
    """
    Poller Service that checks MongoDB for due notifications, renders them,
    and dispatches them using Twilio.
    """
    
    def __init__(self):
        if db is not None:
            self.db = db
            self.client = db.client
            self.queue_collection = db["whatsapp_schedules"]
            logger.info(
                "Using shared MongoDB connection for queue polling (%s.whatsapp_schedules)",
                DATABASE_NAME,
            )
            try:
                count = self.queue_collection.count_documents({})
                logger.info("WhatsApp queue collection contains %d documents", count)
            except Exception as exc:
                logger.warning("Unable to count whatsapp_schedules docs: %s", exc)
        else:
            logger.error("Shared MongoDB connection unavailable. WhatsApp queue disabled.")
            self.client = None
            self.db = None
            self.queue_collection = None
            
        # Twilio setup
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.getenv("TWILIO_FROM_NUMBER") or "+14155238886"
        
        # Strip masked credentials if they were copied by mistake
        if self.twilio_sid and "••••" in self.twilio_sid:
            self.twilio_sid = None
        if self.twilio_token and "••••" in self.twilio_token:
            self.twilio_token = None

        if self.twilio_sid and self.twilio_token:
            logger.info("Twilio API configured. Live gateway active.")
            self.twilio_client = Client(self.twilio_sid, self.twilio_token)
        else:
            logger.warning("Twilio API keys missing or masked. Running in Simulation Sandbox Mode.")
            self.twilio_client = None

    def queue_message(
        self,
        recipient_name: str,
        phone: str,
        notification_type: str,
        template_data: Dict[str, Any],
        scheduled_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Queues a message in MongoDB. If scheduled_time is not provided, defaults to immediate (now).
        """
        if self.queue_collection is None:
            logger.error("Queue collection is offline. Cannot queue message.")
            return {"success": False, "error": "Database offline"}
            
        scheduled_dt = scheduled_time or datetime.now(timezone.utc)
        
        payload = {
            "recipient_name": recipient_name,
            "phone": phone,
            "notification_type": notification_type,
            "template_data": template_data,
            "scheduled_time": scheduled_dt,
            "status": "pending",
            "message_sid": None,
            "error_message": None,
            "created_at": datetime.now(timezone.utc),
            "processed_at": None
        }
        
        result = self.queue_collection.insert_one(payload)
        logger.info(f"Queued WhatsApp notification of type '{notification_type}' for {recipient_name} at {scheduled_dt}")
        
        return {
            "success": True,
            "job_id": str(result.inserted_id),
            "scheduled_time": scheduled_dt.isoformat()
        }

    def dispatch_now(self, recipient_name: str, phone: str, notification_type: str, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Helper method to render and dispatch a message instantly, skipping the queue database.
        """
        message_body = WhatsAppTemplateEngine.render(notification_type, recipient_name, template_data)
        return self._send_via_gateway(phone, message_body)

    def send_whatsapp_message(self, phone: str, message: str) -> Dict[str, Any]:
        """
        Send a raw WhatsApp message immediately.
        """
        if not phone:
            return {"success": False, "error": "Phone number is required."}
        if not message:
            return {"success": False, "error": "Message is required."}
        return self._send_via_gateway(phone, message)

    def send_media_message(self, phone: str, media_url: str, caption: str = "") -> Dict[str, Any]:
        """
        Send WhatsApp message with media attachment (PDF, image, etc).
        media_url must be publicly accessible URL.
        """
        if not phone:
            return {"success": False, "error": "Phone number is required."}
        if not media_url:
            return {"success": False, "error": "Media URL is required."}
        return self._send_media_via_gateway(phone, media_url, caption)

    def get_queue_status(self) -> Dict[str, int]:
        if self.queue_collection is None:
            return {"pending": 0, "sent": 0, "failed": 0, "cancelled": 0}

        return {
            "pending": self.queue_collection.count_documents({"status": "pending"}),
            "sent": self.queue_collection.count_documents({"status": "sent"}),
            "failed": self.queue_collection.count_documents({"status": "failed"}),
            "cancelled": self.queue_collection.count_documents({"status": "cancelled"}),
        }

    def get_schedules(self, limit: int = 100) -> list[Dict[str, Any]]:
        if self.queue_collection is None:
            return []

        result = []
        cursor = self.queue_collection.find({}).sort("created_at", -1).limit(limit)
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            for field in ("created_at", "scheduled_time", "processed_at"):
                if field in doc and hasattr(doc[field], "isoformat"):
                    doc[field] = doc[field].isoformat()
            result.append(doc)
        return result

    def cancel_scheduled_job(self, schedule_id: str, reason: str = "Cancelled manually") -> Dict[str, Any]:
        if self.queue_collection is None:
            return {"success": False, "message": "Database offline"}

        try:
            obj_id = ObjectId(schedule_id)
        except Exception:
            return {"success": False, "message": "Invalid schedule ID format"}

        schedule = self.queue_collection.find_one({"_id": obj_id})
        if not schedule:
            return {"success": False, "message": "Schedule not found"}

        if schedule.get("status") != "pending":
            return {"success": False, "message": "Only pending schedules can be cancelled"}

        self.queue_collection.update_one(
            {"_id": obj_id},
            {"$set": {"status": "cancelled", "error_message": reason, "processed_at": datetime.now(timezone.utc)}},
        )

        return {"success": True, "message": "Schedule successfully cancelled"}

    def cancel_pending_by_phone(self, phone: str, reason: str) -> Dict[str, Any]:
        if self.queue_collection is None:
            return {"success": False, "message": "Database offline"}

        clean_phone = phone.replace("whatsapp:", "").strip()
        normalized = clean_phone.lstrip("+")
        query_phones = [clean_phone, f"+{normalized}", f"whatsapp:{normalized}", f"whatsapp:+{normalized}"]

        update_result = self.queue_collection.update_many(
            {"phone": {"$in": query_phones}, "status": "pending"},
            {"$set": {"status": "cancelled", "error_message": reason, "processed_at": datetime.now(timezone.utc)}},
        )

        return {"success": True, "cancelled_count": update_result.modified_count}

    def poll_and_process_jobs(self) -> int:
        """
        Polls the database for due pending messages and dispatches them.
        Returns the count of processed jobs.
        """
        if self.queue_collection is None:
            logger.debug("Database connection offline. Skipping polling interval.")
            return 0
            
        now = datetime.now(timezone.utc)
        
        # Query: status = 'pending' AND scheduled_time <= now
        query = {
            "status": "pending",
            "scheduled_time": {"$lte": now}
        }
        
        due_jobs = list(self.queue_collection.find(query))
        if not due_jobs:
            logger.info("No due WhatsApp jobs found at %s", now.isoformat())
            return 0
            
        logger.info(f"Found {len(due_jobs)} due notification jobs to process.")
        processed_count = 0
        
        for job in due_jobs:
            job_id = job["_id"]
            recipient_name = job.get("recipient_name", "Employee")
            phone = job.get("phone")
            notification_type = job.get("notification_type")
            template_data = job.get("template_data", {})
            
            logger.info(f"Processing Job {job_id} for {recipient_name} ({notification_type})")
            
            try:
                # 1. Render message body
                message_body = WhatsAppTemplateEngine.render(notification_type, recipient_name, template_data)
                
                # 2. Dispatch
                dispatch_result = self._send_via_gateway(phone, message_body)
                
                # 3. Update DB based on dispatch success
                if dispatch_result["success"]:
                    self.queue_collection.update_one(
                        {"_id": job_id},
                        {
                            "$set": {
                                "status": "sent",
                                "message_sid": dispatch_result["message_sid"],
                                "processed_at": datetime.now(timezone.utc),
                                "error_message": None
                            }
                        }
                    )
                    logger.info(f"Successfully sent and archived Job {job_id}")
                else:
                    self.queue_collection.update_one(
                        {"_id": job_id},
                        {
                            "$set": {
                                "status": "failed",
                                "error_message": dispatch_result["error"],
                                "processed_at": datetime.now(timezone.utc)
                            }
                        }
                    )
                    logger.error(f"Job {job_id} dispatch failed: {dispatch_result['error']}")
                    
            except Exception as e:
                logger.error(f"Error processing job {job_id}: {e}")
                self.queue_collection.update_one(
                    {"_id": job_id},
                    {
                        "$set": {
                            "status": "failed",
                            "error_message": str(e),
                            "processed_at": datetime.now(timezone.utc)
                        }
                    }
                )
                
            processed_count += 1
            
        return processed_count

    def _send_via_gateway(self, phone: str, message_body: str) -> Dict[str, Any]:
        """
        Low-level driver to execute twilio dispatch or trigger mock simulation log.
        """
        if not phone:
            return {"success": False, "error": "Recipient phone number is missing"}
            
        # Format destination phone number to Twilio E.164 sandbox format if needed
        clean_phone = phone.strip().replace(" ", "")
        if not clean_phone.startswith("whatsapp:"):
            clean_phone = f"whatsapp:{'+' if not clean_phone.startswith('+') else ''}{clean_phone}"
            
        # Format sender number
        sender = self.twilio_from.strip().replace(" ", "")
        if not sender.startswith("whatsapp:"):
            sender = f"whatsapp:{'+' if not sender.startswith('+') else ''}{sender}"
            
        # Live Twilio dispatch
        if self.twilio_client:
            try:
                message = self.twilio_client.messages.create(
                    body=message_body,
                    from_=sender,
                    to=clean_phone
                )
                return {
                    "success": True,
                    "message_sid": message.sid,
                    "status": message.status
                }
            except Exception as e:
                logger.error(f"Twilio Gateway Exception: {e}")
                return {"success": False, "error": f"Twilio API Error: {str(e)}"}
        else:
            # Sandbox Simulation Mode Logger - Beautiful console logging
            mock_sid = f"MGmock_{os.urandom(8).hex()}"
            print("\n" + "="*50)
            print("🚀 [WHATSAPP SANDBOX SIMULATOR - DISPATCH SUCCESS]")
            print(f"To:         {clean_phone}")
            print(f"From:       {sender}")
            print(f"Mock SID:   {mock_sid}")
            print(f"Timestamp:  {datetime.now().isoformat()}")
            print("-"*50)
            print(message_body)
            print("="*50 + "\n")
            
            return {
                "success": True,
                "message_sid": mock_sid,
                "status": "queued",
                "simulated": True
            }

    def _send_media_via_gateway(self, phone: str, media_url: str, caption: str = "") -> Dict[str, Any]:
        """
        Send WhatsApp message with media attachment via Twilio or simulate.
        """
        if not phone:
            return {"success": False, "error": "Recipient phone number is missing"}
        
        clean_phone = phone.strip().replace(" ", "")
        if not clean_phone.startswith("whatsapp:"):
            clean_phone = f"whatsapp:{'+' if not clean_phone.startswith('+') else ''}{clean_phone}"
        
        sender = self.twilio_from.strip().replace(" ", "")
        if not sender.startswith("whatsapp:"):
            sender = f"whatsapp:{'+' if not sender.startswith('+') else ''}{sender}"
        
        if self.twilio_client:
            try:
                message = self.twilio_client.messages.create(
                    body=caption if caption else "Document attached",
                    from_=sender,
                    to=clean_phone,
                    media_url=[media_url]
                )
                return {
                    "success": True,
                    "message_sid": message.sid,
                    "status": message.status
                }
            except Exception as e:
                logger.error(f"Twilio Media Gateway Exception: {e}")
                return {"success": False, "error": f"Twilio API Error: {str(e)}"}
        else:
            mock_sid = f"MGmock_{os.urandom(8).hex()}"
            print("\n" + "="*50)
            print("📎 [WHATSAPP MEDIA SIMULATOR - DISPATCH SUCCESS]")
            print(f"To:         {clean_phone}")
            print(f"From:       {sender}")
            print(f"Mock SID:   {mock_sid}")
            print(f"Timestamp:  {datetime.now().isoformat()}")
            print(f"Media URL:  {media_url}")
            print(f"Caption:    {caption or 'Document attached'}")
            print("="*50 + "\n")
            
            return {
                "success": True,
                "message_sid": mock_sid,
                "status": "queued",
                "simulated": True,
                "media_url": media_url
            }


if __name__ == "__main__":
    import time
    print("Initializing standalone WhatsApp Scheduler Daemon...")
    service = WhatsAppSchedulerService()
    
    # Simple standalone worker loop for testing
    print("Worker loop starting. Polling database every 5 seconds. Press Ctrl+C to exit.")
    try:
        while True:
            processed = service.poll_and_process_jobs()
            if processed > 0:
                print(f"Processed {processed} scheduled jobs.")
            time.sleep(5)
    except KeyboardInterrupt:
        print("Scheduler worker stopped.")
