from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

MAIL_USERNAME = os.getenv("EMAIL_USER")
MAIL_PASSWORD = os.getenv("EMAIL_PASS")
# FROM_EMAIL falls back to EMAIL_USER if not explicitly set
MAIL_FROM = os.getenv("FROM_EMAIL") or os.getenv("EMAIL_USER")
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_SERVER = os.getenv("MAIL_SERVER") or os.getenv("SMTP_HOST")

print("EMAIL_USER   =", MAIL_USERNAME)
print("FROM_EMAIL   =", MAIL_FROM)
print("MAIL_SERVER  =", MAIL_SERVER)
print("MAIL_PORT    =", MAIL_PORT)
print("EMAIL_PASS exists =", bool(MAIL_PASSWORD))

try:
    from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
except Exception as exc:
    FastMail = None
    MessageSchema = None
    ConnectionConfig = None
    FASTAPI_MAIL_IMPORT_ERROR = exc
else:
    FASTAPI_MAIL_IMPORT_ERROR = None

# Lazy initialization — only build ConnectionConfig when email vars are present.
# This prevents the server from crashing at startup when email is not configured.
_conf = None

def _get_conf():
    global _conf
    if ConnectionConfig is None:
        raise RuntimeError(
            "Email package is not available. Install fastapi-mail to send email."
        ) from FASTAPI_MAIL_IMPORT_ERROR
    if _conf is None:
        if not MAIL_SERVER or not MAIL_FROM:
            raise RuntimeError(
                "Email not configured. Set MAIL_SERVER (or SMTP_HOST) and "
                "FROM_EMAIL (or EMAIL_USER) in your .env file."
            )
        _conf = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,
            MAIL_PASSWORD=MAIL_PASSWORD,
            MAIL_FROM=MAIL_FROM,
            MAIL_PORT=MAIL_PORT,
            MAIL_SERVER=MAIL_SERVER,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
        )
    return _conf


async def send_application_acknowledgement(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str = "Zenvora",
):
    """
    Sent immediately after resume upload / screening.
    A professional 'Thank you for applying' email.
    """
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Application Received</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#111827;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:#ffffff14;border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;margin-bottom:16px;">
                ✉️
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                Application Received
              </h1>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">
                {company_name} Talent Team
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Hi <strong style="color:#111827;">{candidate_name}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Thank you for applying for the <strong style="color:#111827;">{job_title}</strong> position at
                <strong style="color:#111827;"> {company_name}</strong>. We've successfully received your
                application and our team is reviewing it carefully.
              </p>

              <!-- INFO BOX -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin:24px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">📋 Position</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">{job_title}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">🏢 Company</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">{company_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">⏱️ Next Step</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">Review within 24 hours</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- WHAT HAPPENS NEXT -->
              <h3 style="margin:0 0 14px;font-size:14px;color:#111827;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                What Happens Next?
              </h3>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#111827;border-radius:50%;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">1</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Application Review</strong> — Our team is currently screening all applications.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#111827;border-radius:50%;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">2</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Interview Invite</strong> — If shortlisted, you'll receive an interview
                            link via email within <strong>24 hours</strong>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#111827;border-radius:50%;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">3</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Final Decision</strong> — Our HR team will contact you with next steps
                            after the interview.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:14px;color:#6b7280;line-height:1.7;">
                If you have any questions, feel free to reach out to our HR team. We appreciate your interest
                in joining <strong style="color:#111827;">{company_name}</strong>!
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                This is an automated message from <strong style="color:#6b7280;">{company_name}</strong> Talent Team.<br/>
                Please do not reply to this email.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#d1d5db;">
                © 2026 {company_name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""

    if FastMail is None or MessageSchema is None:
        raise RuntimeError(
            "Email package is not available. Install fastapi-mail."
        ) from FASTAPI_MAIL_IMPORT_ERROR

    message = MessageSchema(
        subject=f"We received your application — {job_title} | {company_name}",
        recipients=[candidate_email],
        body=html,
        subtype="html",
    )

    print(f"[EMAIL] Sending acknowledgement to {candidate_email} ...")
    fm = FastMail(_get_conf())
    try:
        await fm.send_message(message)
        print(f"[EMAIL] ✅ Acknowledgement sent to {candidate_email}")
    except Exception as e:
        import traceback
        print(f"[EMAIL] ❌ Failed to send acknowledgement to {candidate_email}: {e}")
        traceback.print_exc()
        raise


async def send_interview_link(
    candidate_email: str,
    candidate_name: str,
    interview_link: str,
    meeting_time: str = "To be confirmed — HR will contact you shortly",
    job_title: str = "Software Engineer",
    company_name: str = "Zenvora",
):
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Interview Invitation</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:40px 20px;background:#f3f4f6;">

  <table cellpadding="0" cellspacing="0" width="100%" style="width:100%;table-layout:fixed;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#111827;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:#ffffff14;border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;margin-bottom:16px;">
                🗓️
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                Interview Invitation
              </h1>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">
                {company_name} Talent Team
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Hi <strong style="color:#111827;">{candidate_name}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Congratulations! We have reviewed your profile and we are thrilled to invite you for an interview for the <strong style="color:#111827;">{job_title}</strong> position at <strong style="color:#111827;">{company_name}</strong>.
              </p>

              <!-- INFO BOX -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin:24px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">📋 Position</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">{job_title}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">📅 Date & Time</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">{meeting_time}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">🏢 Format</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">Online (Video Call)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="font-size:13px;color:#6b7280;font-weight:600;">📍 Platform</span>
                          <span style="float:right;font-size:13px;color:#111827;font-weight:700;">Google Meet</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 20px;text-align:center;">
                <tr>
                  <td>
                    <a href="{interview_link}" target="_blank"
                       style="background:#2563eb;color:#ffffff;padding:14px 32px;
                              text-decoration:none;border-radius:8px;font-size:15px;
                              font-weight:700;display:inline-block;box-shadow:0 4px 6px -1px rgba(37,99,235,0.2);">
                      Join Google Meet Interview
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#6b7280;text-align:center;">
                Or copy and paste this link in your browser:<br/>
                <a href="{interview_link}" style="color:#2563eb;text-decoration:underline;">{interview_link}</a>
              </p>

              <!-- INTERVIEW TIPS -->
              <h3 style="margin:28px 0 14px;font-size:14px;color:#111827;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                Interview Preparation Checklist
              </h3>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#e5e7eb;border-radius:50%;color:#111827;font-size:12px;font-weight:700;text-align:center;line-height:24px;">✓</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Technical Check</strong> — Ensure your camera, microphone, and internet connection are working properly.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#e5e7eb;border-radius:50%;color:#111827;font-size:12px;font-weight:700;text-align:center;line-height:24px;">✓</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Quiet Space</strong> — Join from a well-lit, quiet environment free from distractions.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#e5e7eb;border-radius:50%;color:#111827;font-size:12px;font-weight:700;text-align:center;line-height:24px;">✓</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:2px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                            <strong>Be On Time</strong> — Please join the Google Meet call at least <strong>5 minutes early</strong>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:14px;color:#374151;line-height:1.7;">
                If you need to reschedule or have any questions, feel free to respond to this email or reach out to our talent acquisition team.
              </p>
              
              <p style="margin:16px 0 0;font-size:14px;color:#374151;line-height:1.7;">
                We look forward to meeting you!
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                This is an automated message from <strong style="color:#6b7280;">{company_name}</strong> Talent Team.<br/>
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#d1d5db;">
                © 2026 {company_name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""

    if FastMail is None or MessageSchema is None:
        raise RuntimeError(
            "Email package is not available. Install fastapi-mail to send interview links."
        ) from FASTAPI_MAIL_IMPORT_ERROR

    message = MessageSchema(
        subject="Interview Invitation — You've been Shortlisted!",
        recipients=[candidate_email],
        body=html,
        subtype="html"
    )

    print(f"[EMAIL] Sending interview invitation to {candidate_email} ...")

    fm = FastMail(_get_conf())

    try:
        await fm.send_message(message)
        print(f"[EMAIL] ✅ Sent successfully to {candidate_email}")
    except Exception as e:
        import traceback
        print(f"[EMAIL] ❌ Failed to send to {candidate_email}: {e}")
        traceback.print_exc()
        raise


async def send_attendance_report(
    admin_email: str,
    report_type: str,           # "Weekly" or "Monthly"
    period_label: str,          # e.g. "Week of 16 Jun – 22 Jun 2026"
    summary: dict,              # {total, present, late, absent, on_leave}
    rows: list,                 # list of {name, role, present, late, absent, on_time_pct}
    company_name: str = "Zenvora",
):
    """
    Auto-generated attendance report email sent to admin.
    """
    total      = summary.get("total", 0)
    present    = summary.get("present", 0)
    late       = summary.get("late", 0)
    absent     = summary.get("absent", 0)
    on_leave   = summary.get("on_leave", 0)
    attendance_rate = round((present / max(total, 1)) * 100)

    # Build employee rows HTML
    row_html = ""
    for i, emp in enumerate(rows):
        bg = "#f9fafb" if i % 2 == 0 else "#ffffff"
        pct = emp.get("on_time_pct", 0)
        bar_color = "#16a34a" if pct >= 80 else "#f59e0b" if pct >= 50 else "#ef4444"
        row_html += f"""
        <tr style="background:{bg};">
          <td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;">{emp.get('name','—')}</td>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;">{emp.get('role','—')}</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;text-align:center;">{emp.get('present',0)}</td>
          <td style="padding:10px 16px;font-size:13px;color:#f59e0b;text-align:center;">{emp.get('late',0)}</td>
          <td style="padding:10px 16px;font-size:13px;color:#ef4444;text-align:center;">{emp.get('absent',0)}</td>
          <td style="padding:10px 16px;text-align:center;">
            <div style="background:#e5e7eb;border-radius:999px;height:6px;width:80px;display:inline-block;vertical-align:middle;">
              <div style="background:{bar_color};border-radius:999px;height:6px;width:{pct}%;max-width:80px;"></div>
            </div>
            <span style="font-size:12px;color:#6b7280;margin-left:6px;">{pct}%</span>
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>{report_type} Attendance Report</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

      <!-- HEADER -->
      <tr><td style="background:#111827;border-radius:16px 16px 0 0;padding:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:12px;color:#9ca3af;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
                {company_name} · Automated Report
              </p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:22px;font-weight:700;">
                {report_type} Attendance Report
              </h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">{period_label}</p>
            </td>
            <td align="right">
              <div style="background:#ffffff14;border-radius:12px;padding:12px 20px;text-align:center;">
                <div style="font-size:32px;font-weight:900;color:#ffffff;">{attendance_rate}%</div>
                <div style="font-size:11px;color:#9ca3af;font-weight:600;margin-top:2px;">ATTENDANCE RATE</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- STATS -->
      <tr><td style="background:#ffffff;padding:28px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            {"".join(f'''
            <td style="text-align:center;padding:0 8px;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 12px;">
                <div style="font-size:24px;font-weight:800;color:{clr};">{val}</div>
                <div style="font-size:11px;color:#6b7280;font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">{lbl}</div>
              </div>
            </td>''' for lbl, val, clr in [
              ("Total Staff", total, "#111827"),
              ("Present", present, "#16a34a"),
              ("Late", late, "#f59e0b"),
              ("Absent", absent, "#ef4444"),
              ("On Leave", on_leave, "#6366f1"),
            ])}
          </tr>
        </table>
      </td></tr>

      <!-- TABLE -->
      <tr><td style="background:#ffffff;padding:24px 40px 32px;">
        <h3 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#111827;
                   letter-spacing:0.06em;text-transform:uppercase;">Employee Breakdown</h3>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">EMPLOYEE</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">ROLE</th>
              <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">PRESENT</th>
              <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">LATE</th>
              <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">ABSENT</th>
              <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.06em;">ON-TIME %</th>
            </tr>
          </thead>
          <tbody>{row_html if row_html else '<tr><td colspan="6" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px;">No attendance data for this period.</td></tr>'}</tbody>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;
                     border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
          This is an auto-generated report from <strong style="color:#6b7280;">{company_name} HRM</strong>.<br/>
          Generated on {datetime.utcnow().strftime('%d %b %Y at %H:%M UTC')}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>"""

    if FastMail is None or MessageSchema is None:
        raise RuntimeError("Email package not available.") from FASTAPI_MAIL_IMPORT_ERROR

    message = MessageSchema(
        subject=f"[{company_name}] {report_type} Attendance Report — {period_label}",
        recipients=[admin_email],
        body=html,
        subtype="html",
    )

    print(f"[REPORT EMAIL] Sending {report_type} attendance report to {admin_email} ...")
    fm = FastMail(_get_conf())
    try:
        await fm.send_message(message)
        print(f"[REPORT EMAIL] ✅ Sent to {admin_email}")
    except Exception as e:
        import traceback
        print(f"[REPORT EMAIL] ❌ Failed: {e}")
        traceback.print_exc()
        raise


async def send_rejection_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str = "Zenvora",
):
    """
    Professional rejection email — sent 3 days after a candidate is marked Rejected.
    Warm, respectful tone like a real company would send.
    """
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Application Update</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HEADER -->
      <tr>
        <td style="background:#111827;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:12px;">📬</div>
          <h1 style="margin:0;color:#ffffff;font-size:21px;font-weight:700;letter-spacing:-0.3px;">
            An Update on Your Application
          </h1>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">{company_name} Talent Team</p>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#ffffff;padding:36px 40px;">

          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.75;">
            Dear <strong style="color:#111827;">{candidate_name}</strong>,
          </p>

          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.75;">
            Thank you for taking the time to apply for the
            <strong style="color:#111827;"> {job_title}</strong> position at
            <strong style="color:#111827;"> {company_name}</strong> and for your interest
            in joining our team.
          </p>

          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.75;">
            After careful consideration of your application and background, we have decided
            to move forward with other candidates whose qualifications more closely match
            our current requirements for this role.
          </p>

          <!-- CALLOUT BOX -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9fafb;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;
                        margin:24px 0;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
                  💡 <strong>This decision is not a reflection of your overall abilities.</strong>
                  We encourage you to continue pursuing opportunities that align with your
                  skills and aspirations.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.75;">
            We will keep your profile in our talent pool and may reach out if a suitable
            opportunity arises in the future. We also encourage you to keep an eye on our
            careers page for future openings.
          </p>

          <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.75;">
            We sincerely appreciate your time and effort, and wish you the very best in
            your job search and future career endeavours.
          </p>

          <p style="margin:28px 0 0;font-size:15px;color:#374151;">
            Warm regards,<br/>
            <strong style="color:#111827;">HR Team</strong><br/>
            <span style="color:#6b7280;font-size:13px;">{company_name}</span>
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;
                   border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            This email was sent by <strong style="color:#6b7280;">{company_name}</strong> regarding
            your application for <em>{job_title}</em>.<br/>
            Please do not reply to this automated message.
          </p>
          <p style="margin:10px 0 0;font-size:12px;color:#d1d5db;">
            © 2026 {company_name}. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>"""

    if FastMail is None or MessageSchema is None:
        raise RuntimeError("Email package not available.") from FASTAPI_MAIL_IMPORT_ERROR

    message = MessageSchema(
        subject=f"Your Application for {job_title} — {company_name}",
        recipients=[candidate_email],
        body=html,
        subtype="html",
    )

    print(f"[EMAIL] Sending rejection email to {candidate_email} ...")
    fm = FastMail(_get_conf())
    try:
        await fm.send_message(message)
        print(f"[EMAIL] ✅ Rejection email sent to {candidate_email}")
    except Exception as e:
        import traceback
        print(f"[EMAIL] ❌ Failed to send rejection email to {candidate_email}: {e}")
        traceback.print_exc()
        raise
