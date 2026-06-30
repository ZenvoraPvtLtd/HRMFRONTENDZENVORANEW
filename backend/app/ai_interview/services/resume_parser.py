"""Resume parsing + dynamic job-role matching with weighted scoring."""
import re, os
from typing import Dict, Any, List, Tuple

SKILL_BANK = [
    "python","javascript","typescript","react","node","nodejs","fastapi","django","flask",
    "sql","postgres","postgresql","mysql","mongodb","redis","aws","gcp","azure","docker",
    "kubernetes","java","spring","c++","c#",".net","go","golang","rust","html","css",
    "tailwind","redux","zustand","next","nextjs","graphql","rest","git","linux","ml",
    "tensorflow","pytorch","numpy","pandas","scikit","nlp","data","analytics","tableau",
    "powerbi","figma","ui","ux","selenium","jest","pytest","ci","cd","jenkins","kafka",
    "rabbitmq","microservices","agile","scrum",
]

# Role -> required skills map (used when job role provided)
ROLE_SKILLS = {
    "frontend": ["react","javascript","typescript","html","css","tailwind","redux","nextjs"],
    "backend": ["python","fastapi","django","node","sql","postgres","redis","docker","rest"],
    "fullstack": ["react","node","typescript","sql","postgres","docker","rest","aws"],
    "data": ["python","sql","pandas","numpy","ml","tensorflow","analytics"],
    "devops": ["docker","kubernetes","aws","linux","ci","cd","jenkins","kafka"],
    "mobile": ["react","javascript","typescript","kotlin","swift"],
    "ml": ["python","tensorflow","pytorch","numpy","pandas","scikit","nlp","ml"],
    "qa": ["selenium","jest","pytest","ci","cd","java","python"],
}

def _read_pdf(path: str) -> str:
    try:
        from PyPDF2 import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)
    except Exception:
        return ""

def _read_docx(path: str) -> str:
    try:
        import docx
        return "\n".join(p.text for p in docx.Document(path).paragraphs)
    except Exception:
        return ""

def extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf": return _read_pdf(path)
    if ext in (".docx", ".doc"): return _read_docx(path)
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""

def parse_resume(path: str) -> Dict[str, Any]:
    text = extract_text(path)
    lower = text.lower()
    email_m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    name_m = re.search(r"(?m)^([A-Z][a-z]+\s+[A-Z][a-z]+)", text)
    skills = sorted({s for s in SKILL_BANK if re.search(rf"\b{re.escape(s)}\b", lower)})
    projects, education = [], []
    for line in text.splitlines():
        l = line.strip()
        if not l: continue
        ll = l.lower()
        if any(k in ll for k in ["project", "built", "developed", "implemented"]) and 10 < len(l) < 200:
            projects.append(l)
        if any(k in ll for k in ["b.tech","b.e.","bachelor","master","mca","bca","university","college","institute"]) and len(l) < 200:
            education.append(l)
    exp_m = re.search(r"(\d+)\+?\s*(years|yrs)", lower)
    experience = f"{exp_m.group(1)} years" if exp_m else "Fresher / Not specified"
    return {
        "candidate_name": name_m.group(1) if name_m else "Candidate",
        "email": email_m.group(0) if email_m else "",
        "skills": skills or ["python", "sql"],
        "projects": projects[:5] or ["Sample Project — built with modern stack"],
        "experience": experience,
        "education": education[:3] or ["Bachelor's Degree"],
        "raw_text": text[:8000],
    }

def _role_key(role: str) -> str:
    r = (role or "").lower()
    for k in ROLE_SKILLS:
        if k in r: return k
    if "front" in r: return "frontend"
    if "back" in r: return "backend"
    if "full" in r: return "fullstack"
    if "data" in r or "analyst" in r: return "data"
    if "devops" in r or "sre" in r: return "devops"
    if "android" in r or "ios" in r or "mobile" in r: return "mobile"
    if "machine" in r or "ai" in r: return "ml"
    if "test" in r or "qa" in r: return "qa"
    return "fullstack"

def _years(experience: str) -> float:
    m = re.search(r"(\d+(?:\.\d+)?)", experience or "")
    return float(m.group(1)) if m else 0.0

def compute_match(parsed: Dict[str, Any], role: str = "", raw_text: str = "") -> Dict[str, Any]:
    """Weighted dynamic match score. Skills 40 / Experience 25 / Projects 20 / Education 10 / Keywords 5."""
    key = _role_key(role)
    required = ROLE_SKILLS.get(key, [])
    have = {s.lower() for s in (parsed.get("skills") or [])}
    matched = [s for s in required if s in have]
    missing = [s for s in required if s not in have]

    # 1) Skills match (40)
    skills_pct = (len(matched) / len(required)) if required else 0.5
    skills_score = skills_pct * 40

    # 2) Experience relevance (25) — scaled 0..5+ years
    yrs = _years(parsed.get("experience", ""))
    exp_score = min(25.0, (yrs / 5.0) * 25.0) if yrs > 0 else 6.0  # fresher floor

    # 3) Project relevance (20) — count of required keywords found in project text
    proj_text = " ".join(parsed.get("projects") or []).lower()
    proj_hits = sum(1 for s in required if s in proj_text)
    proj_score = min(20.0, (proj_hits / max(1, len(required))) * 20.0 + min(8, len(parsed.get("projects") or []) * 1.5))

    # 4) Education (10)
    edu_text = " ".join(parsed.get("education") or []).lower()
    if any(k in edu_text for k in ["master","mca","m.tech","msc","phd"]):
        edu_score = 10.0
    elif any(k in edu_text for k in ["bachelor","b.tech","b.e.","bca","bsc"]):
        edu_score = 8.0
    elif edu_text:
        edu_score = 5.0
    else:
        edu_score = 2.0

    # 5) Keyword relevance (5) — raw text mentions
    rt = (raw_text or parsed.get("raw_text","")).lower()
    kw_hits = sum(1 for s in required if s in rt)
    kw_score = min(5.0, (kw_hits / max(1, len(required))) * 5.0)

    total = round(skills_score + exp_score + proj_score + edu_score + kw_score, 1)
    total = max(15.0, min(98.0, total))

    explanation = (
        f"Matched {len(matched)}/{len(required)} core skills for {key.title()} role"
        f" · {yrs or 0} yrs experience · {len(parsed.get('projects') or [])} relevant projects."
    )
    return {
        "match_score": total,
        "role_key": key,
        "matched_skills": matched,
        "missing_skills": missing,
        "breakdown": {
            "skills": round(skills_score, 1),
            "experience": round(exp_score, 1),
            "projects": round(proj_score, 1),
            "education": round(edu_score, 1),
            "keywords": round(kw_score, 1),
        },
        "explanation": explanation,
    }
