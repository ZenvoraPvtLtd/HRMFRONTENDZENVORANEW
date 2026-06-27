import os
import re
from datetime import datetime
from pathlib import Path
from textwrap import wrap
from typing import Iterable, Tuple

from PIL import Image, ImageDraw, ImageFont


UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
PDF_ROOT = UPLOAD_ROOT / "generated"


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()
    return slug or "document"


def _font(size: int, bold: bool = False):
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: Tuple[int, int],
    font,
    fill: str = "#111827",
    width: int = 82,
    line_height: int = 26,
) -> int:
    x, y = xy
    for paragraph in str(text).splitlines() or [""]:
        lines = wrap(paragraph, width=width) or [""]
        for line in lines:
            draw.text((x, y), line, font=font, fill=fill)
            y += line_height
        y += 6
    return y


def _draw_rows(draw: ImageDraw.ImageDraw, rows: Iterable[Tuple[str, str]], y: int) -> int:
    label_font = _font(24, bold=True)
    value_font = _font(24)
    left = 90
    right = 380
    for label, value in rows:
        draw.text((left, y), str(label), font=label_font, fill="#374151")
        y = _draw_wrapped(draw, str(value), (right, y), value_font, width=55, line_height=30)
        y += 6
    return y


def _save_pdf(image: Image.Image, filename: str) -> str:
    PDF_ROOT.mkdir(parents=True, exist_ok=True)
    path = PDF_ROOT / filename
    image.convert("RGB").save(path, "PDF", resolution=100.0)
    return str(path)


def public_upload_url(path: str) -> str:
    base_url = os.getenv("FASTAPI_BASE_URL", "http://localhost:8000").rstrip("/")
    relative = Path(path).resolve().relative_to(UPLOAD_ROOT.resolve()).as_posix()
    return f"{base_url}/uploads/{relative}"


def create_payslip_pdf(salary: dict) -> str:
    image = Image.new("RGB", (1240, 1754), "#ffffff")
    draw = ImageDraw.Draw(image)
    title_font = _font(44, bold=True)
    subtitle_font = _font(24)

    draw.rectangle((0, 0, 1240, 160), fill="#0f766e")
    draw.text((80, 48), "Zenvora Pvt Ltd", font=title_font, fill="#ffffff")
    draw.text((80, 105), "Employee Payslip", font=subtitle_font, fill="#d1fae5")

    y = 230
    y = _draw_rows(
        draw,
        [
            ("Employee", salary.get("employee_name", "")),
            ("Employee ID", salary.get("employee_id", "")),
            ("Month", salary.get("month", "")),
            ("Gross Salary", f"{float(salary.get('gross_salary', 0)):.2f}"),
            ("Deductions", f"{float(salary.get('deductions', 0)):.2f}"),
            ("Bonus", f"{float(salary.get('bonus') or 0):.2f}"),
            ("Net Salary", f"{float(salary.get('net_salary', 0)):.2f}"),
        ],
        y,
    )

    details = salary.get("details")
    if details:
        y += 30
        draw.text((90, y), "Details", font=_font(28, bold=True), fill="#111827")
        y += 45
        for key, value in details.items():
            y = _draw_rows(draw, [(str(key), str(value))], y)

    draw.text((90, 1620), f"Generated on {datetime.utcnow().strftime('%Y-%m-%d')}", font=_font(20), fill="#6b7280")
    filename = f"payslip-{_safe_slug(salary.get('employee_name', 'employee'))}-{_safe_slug(salary.get('month', 'month'))}.pdf"
    return _save_pdf(image, filename)


def create_offer_letter_pdf(offer: dict) -> str:
    image = Image.new("RGB", (1240, 1754), "#ffffff")
    draw = ImageDraw.Draw(image)
    title_font = _font(42, bold=True)
    body_font = _font(25)

    draw.rectangle((0, 0, 1240, 150), fill="#1d4ed8")
    draw.text((80, 50), "Zenvora Pvt Ltd", font=title_font, fill="#ffffff")
    draw.text((80, 105), "Offer Letter", font=_font(24), fill="#dbeafe")

    y = 230
    y = _draw_wrapped(draw, f"Dear {offer.get('candidate_name', 'Candidate')},", (90, y), body_font, width=78, line_height=34)
    y += 20
    body = (
        f"We are pleased to offer you the position of {offer.get('position', '')} "
        f"in the {offer.get('department', '')} department at Zenvora Pvt Ltd. "
        "This offer is subject to completion of standard joining formalities."
    )
    y = _draw_wrapped(draw, body, (90, y), body_font, width=78, line_height=34)
    y += 25
    y = _draw_rows(
        draw,
        [
            ("Position", offer.get("position", "")),
            ("Department", offer.get("department", "")),
            ("Employment Type", offer.get("employment_type", "Full-time")),
            ("Salary", f"{float(offer.get('salary', 0)):.2f}"),
            ("Joining Date", offer.get("joining_date", "")),
            ("Accept By", offer.get("deadline_to_accept", "")),
        ],
        y,
    )
    y += 35
    y = _draw_wrapped(
        draw,
        "Please review this offer and confirm your acceptance before the deadline. We look forward to welcoming you to the team.",
        (90, y),
        body_font,
        width=78,
        line_height=34,
    )
    draw.text((90, 1500), "Regards,", font=body_font, fill="#111827")
    draw.text((90, 1540), "Zenvora HR Team", font=_font(27, bold=True), fill="#111827")

    filename = f"offer-letter-{_safe_slug(offer.get('candidate_name', 'candidate'))}-{_safe_slug(offer.get('position', 'role'))}.pdf"
    return _save_pdf(image, filename)


def create_shortlist_report_pdf(position: str | None, candidates: list[dict]) -> str:
    image = Image.new("RGB", (1240, 1754), "#ffffff")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1240, 150), fill="#7c3aed")
    draw.text((80, 48), "Shortlisted Candidates Report", font=_font(40, bold=True), fill="#ffffff")
    draw.text((80, 105), f"Position: {position or 'All roles'}", font=_font(23), fill="#ede9fe")

    y = 220
    draw.text((90, y), f"Total Shortlisted: {len(candidates)}", font=_font(28, bold=True), fill="#111827")
    y += 55
    for idx, candidate in enumerate(candidates, 1):
        if y > 1580:
            break
        draw.text((90, y), f"{idx}. {candidate.get('candidate_name', 'N/A')}", font=_font(25, bold=True), fill="#111827")
        y += 34
        y = _draw_wrapped(
            draw,
            f"Email: {candidate.get('candidate_email', 'N/A')} | Round: {candidate.get('round_number', 1)} | Role: {candidate.get('position', position or 'N/A')}",
            (120, y),
            _font(22),
            fill="#374151",
            width=85,
            line_height=28,
        )
        y += 12

    draw.text((90, 1620), f"Generated on {datetime.utcnow().strftime('%Y-%m-%d')}", font=_font(20), fill="#6b7280")
    filename = f"shortlist-report-{_safe_slug(position or 'all')}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    return _save_pdf(image, filename)
