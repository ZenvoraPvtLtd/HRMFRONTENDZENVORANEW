from typing import Any, Dict

from app.services.scheduler import scheduler
from app.services.whatsapp_scheduler import WhatsAppSchedulerService


class WhatsAppService:
    def __init__(self):
        self._core = WhatsAppSchedulerService()

    @property
    def queue_collection(self):
        return self._core.queue_collection

    @property
    def twilio_configured(self) -> bool:
        return self._core.twilio_client is not None

    @property
    def scheduler_running(self) -> bool:
        return bool(scheduler and scheduler.running)

    def send_whatsapp_message(self, phone: str, message: str) -> Dict[str, Any]:
        return self._core.send_whatsapp_message(phone=phone, message=message)

    def send_media_message(self, phone: str, media_url: str, caption: str = "") -> Dict[str, Any]:
        return self._core.send_media_message(phone=phone, media_url=media_url, caption=caption)

    def queue_message(
        self,
        recipient_name: str,
        phone: str,
        notification_type: str,
        template_data: Dict[str, Any],
        scheduled_time=None,
    ) -> Dict[str, Any]:
        return self._core.queue_message(
            recipient_name=recipient_name,
            phone=phone,
            notification_type=notification_type,
            template_data=template_data,
            scheduled_time=scheduled_time,
        )

    def schedule_notification(
        self,
        recipient_name: str,
        phone: str,
        notification_type: str,
        template_data: Dict[str, Any],
        scheduled_time=None,
    ) -> Dict[str, Any]:
        return self.queue_message(
            recipient_name=recipient_name,
            phone=phone,
            notification_type=notification_type,
            template_data=template_data,
            scheduled_time=scheduled_time,
        )

    def get_queue_status(self) -> Dict[str, int]:
        return self._core.get_queue_status()

    def get_schedules(self, limit: int = 100) -> list[Dict[str, Any]]:
        return self._core.get_schedules(limit=limit)

    def cancel_notification(self, schedule_id: str) -> Dict[str, Any]:
        return self._core.cancel_scheduled_job(schedule_id)

    def cancel_pending_by_phone(self, phone: str, reason: str) -> Dict[str, Any]:
        return self._core.cancel_pending_by_phone(phone=phone, reason=reason)


whatsapp_service = WhatsAppService()
