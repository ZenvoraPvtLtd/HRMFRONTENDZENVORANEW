import asyncio
import os
from datetime import datetime, timedelta

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.services.whatsapp_scheduler import WhatsAppSchedulerService
except ImportError as exc:
    BackgroundScheduler = None
    WhatsAppSchedulerService = None
    scheduler_import_error = exc
else:
    scheduler_import_error = None

whatsapp_service = WhatsAppSchedulerService() if WhatsAppSchedulerService else None
scheduler = BackgroundScheduler() if BackgroundScheduler else None


# ── WhatsApp poller ────────────────────────────────────────────────────────

def poll_whatsapp_jobs() -> None:
    if not whatsapp_service:
        return


    print("DEBUG poll_whatsapp_jobs - invoked")
    try:
        processed = whatsapp_service.poll_and_process_jobs()
        print(f"DEBUG poll_whatsapp_jobs - processed {processed} jobs")
    except Exception as exc:
        print(f"[WhatsApp Scheduler Poller Error] {exc}")


# ── Attendance report helpers ──────────────────────────────────────────────

def _build_report_data(start_date: datetime, end_date: datetime):
    """
    Query attendance_collection for the given date range and build
    summary + per-employee breakdown rows.
    """
    try:
        from app.core.database import attendance_collection
        if attendance_collection is None:
            return None, None

        start_str = start_date.strftime("%Y-%m-%d")
        end_str   = end_date.strftime("%Y-%m-%d")

        docs = list(
            attendance_collection.find({"date": {"$gte": start_str, "$lte": end_str}})
        )

        # Group by employee
        emp_map: dict = {}
        for doc in docs:
            eid  = str(doc.get("employeeId") or doc.get("employee_id") or doc.get("email") or "unknown")
            name = str(
                doc.get("employee_name") or doc.get("name") or
                doc.get("fullName") or eid
            )
            role = str(doc.get("role") or "Employee")

            raw_status = str(
                doc.get("attendanceStatus") or doc.get("status") or ""
            ).lower()

            check_in = doc.get("check_in_time") or doc.get("checkInTime") or doc.get("clockIn")
            is_late  = False
            if check_in and isinstance(check_in, str):
                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%I:%M:%S %p", "%I:%M %p"):
                    try:
                        dt = datetime.strptime(check_in.strip()[:19], fmt) if fmt.startswith("%Y") else datetime.strptime(check_in.strip(), fmt)
                        is_late = dt.hour > 10 or (dt.hour == 10 and dt.minute > 15)
                        break
                    except ValueError:
                        continue

            is_absent   = raw_status in {"absent"}
            is_on_leave = raw_status in {"leave", "on leave"}
            is_present  = not is_absent and not is_on_leave

            if eid not in emp_map:
                emp_map[eid] = {"name": name, "role": role, "present": 0, "late": 0, "absent": 0, "on_leave": 0, "days": 0}

            emp_map[eid]["days"] += 1
            if is_absent:
                emp_map[eid]["absent"] += 1
            elif is_on_leave:
                emp_map[eid]["on_leave"] += 1
            else:
                emp_map[eid]["present"] += 1
                if is_late:
                    emp_map[eid]["late"] += 1

        rows = []
        for data in emp_map.values():
            days    = max(data["days"], 1)
            on_time = data["present"] - data["late"]
            rows.append({
                "name":       data["name"],
                "role":       data["role"],
                "present":    data["present"],
                "late":       data["late"],
                "absent":     data["absent"],
                "on_time_pct": round((on_time / days) * 100),
            })

        rows.sort(key=lambda r: r["name"].lower())

        total   = len(emp_map)
        present = sum(r["present"] for r in rows)
        late    = sum(r["late"]    for r in rows)
        absent  = sum(r["absent"]  for r in rows)
        on_leave= sum(d["on_leave"] for d in emp_map.values())

        summary = {
            "total":    total,
            "present":  present,
            "late":     late,
            "absent":   absent,
            "on_leave": on_leave,
        }
        return summary, rows

    except Exception as exc:
        print(f"[REPORT] ❌ Failed to build report data: {exc}")
        import traceback
        traceback.print_exc()
        return None, None


def _send_report(report_type: str, start_date: datetime, end_date: datetime) -> None:
    """Sync wrapper — runs the async email send in a new event loop."""
    admin_email = os.getenv("ADMIN_REPORT_EMAIL") or os.getenv("EMAIL_USER")
    if not admin_email:
        print("[REPORT] ⚠️ No ADMIN_REPORT_EMAIL configured — skipping report.")
        return

    summary, rows = _build_report_data(start_date, end_date)
    if summary is None:
        print("[REPORT] ⚠️ No data available — skipping report.")
        return

    if report_type == "Weekly":
        period_label = (
            f"Week of {start_date.strftime('%d %b')} – {end_date.strftime('%d %b %Y')}"
        )
    elif report_type == "Daily":
        period_label = start_date.strftime("%A, %d %B %Y")
    else:
        period_label = start_date.strftime("%B %Y")

    async def _async_send():
        from app.services.email_service import send_attendance_report
        await send_attendance_report(
            admin_email=admin_email,
            report_type=report_type,
            period_label=period_label,
            summary=summary,
            rows=rows,
        )

    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_async_send())
        loop.close()
        print(f"[REPORT] ✅ {report_type} attendance report sent to {admin_email}")
    except Exception as exc:
        print(f"[REPORT] ❌ Failed to send {report_type} report: {exc}")
        import traceback
        traceback.print_exc()


def send_weekly_report() -> None:
    """Runs every Monday — covers Mon–Sun of the previous week."""
    today     = datetime.now()
    end_date  = today - timedelta(days=today.weekday() + 1)   # last Sunday
    start_date= end_date - timedelta(days=6)                   # previous Monday
    print(f"[REPORT] Generating Weekly report: {start_date.date()} → {end_date.date()}")
    _send_report("Weekly", start_date, end_date)


def send_monthly_report() -> None:
    """Runs on the 1st of each month — covers the entire previous month."""
    today      = datetime.now()
    first_this = today.replace(day=1)
    end_date   = first_this - timedelta(days=1)                # last day of prev month
    start_date = end_date.replace(day=1)                       # 1st of prev month
    print(f"[REPORT] Generating Monthly report: {start_date.date()} → {end_date.date()}")
    _send_report("Monthly", start_date, end_date)


# ── Register jobs ──────────────────────────────────────────────────────────

if scheduler:
    # WhatsApp polling — every 60 seconds
    scheduler.add_job(poll_whatsapp_jobs, "interval", seconds=60)

    # Weekly attendance report — every Monday at 08:00 AM
    scheduler.add_job(
        send_weekly_report,
        "cron",
        day_of_week="mon",
        hour=8,
        minute=0,
        id="weekly_attendance_report",
        replace_existing=True,
    )

    # Monthly attendance report — 1st of every month at 08:00 AM
    scheduler.add_job(
        send_monthly_report,
        "cron",
        day=1,
        hour=8,
        minute=0,
        id="monthly_attendance_report",
        replace_existing=True,
    )


# ── Lifecycle ──────────────────────────────────────────────────────────────

def start_scheduler() -> None:
    if not scheduler:
        print(f"[WARN] Scheduler disabled: {scheduler_import_error}")
        return

    if not scheduler.running:
        scheduler.start()
        print("[SUCCESS] Background Scheduler started (WhatsApp + Attendance Reports).")


def stop_scheduler() -> None:
    if not scheduler:
        return

    if scheduler.running:
        scheduler.shutdown()
        print("[SUCCESS] Background Scheduler stopped.")
