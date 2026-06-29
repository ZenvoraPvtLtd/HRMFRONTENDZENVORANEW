from typing import List
import httpx
import asyncio

HF_DEFAULT_MODEL = "google/flan-t5-base"
HF_DEFAULT_API_BASE_URL = "https://router.huggingface.co/hf-inference/models"


_QUESTION_PREFIXES = [
    "based on your resume",
    "you mention",
    "i see in your resume",
    "according to your profile",
    "from your experience",
    "looking at your background",
]


def clean_generated_question(text: str) -> str:
    if not text:
        return ""

    out = " ".join(str(text).strip().split())

    for prefix in _QUESTION_PREFIXES:
        if out.lower().startswith(prefix.lower()):
            out = out[len(prefix):].lstrip(" .:-")

    return out.strip().strip('"').strip()


def _normalize_question(q: str) -> str:
    return (
        q.lower()
        .strip()
        .replace("?", "")
        .replace(".", "")
        .replace(",", "")
        .replace("!", "")
    )


def _extract_resume_skills(resume_text: str) -> List[str]:
    text = (resume_text or "").lower()

    candidates = [
        "python", "fastapi", "django", "flask", "react", "node",
        "javascript", "typescript", "sql", "postgres", "mysql",
        "mongodb", "docker", "kubernetes", "aws", "gcp", "azure",
        "redis", "graphql", "rest", "tailwind", "redux", "nextjs"
    ]

    found = []
    seen = set()

    for skill in candidates:
        if skill in text and skill not in seen:
            found.append(skill)
            seen.add(skill)

    return found


def _get_unused_skills(
    all_skills: List[str],
    previous_questions: List[str]
) -> List[str]:
    used_skills = []

    for question in previous_questions:
        q_lower = question.lower()

        for skill in all_skills:
            if skill.lower() in q_lower:
                used_skills.append(skill)

    remaining = [s for s in all_skills if s not in used_skills]

    return remaining if remaining else all_skills


def _resume_based_local_question(
    resume_text: str,
    job_role: str,
    previous_questions: List[str],
    current_difficulty: str,
) -> str:
    skills = _get_unused_skills(
        _extract_resume_skills(resume_text),
        previous_questions,
    )
    skill = skills[0] if skills else "your strongest technical area"
    role = (job_role or "this role").strip()
    difficulty = (current_difficulty or "medium").lower()

    if difficulty == "hard":
        question = (
            f"How would you design, scale, and troubleshoot a production-grade "
            f"{skill} solution for {role}?"
        )
    elif difficulty == "medium":
        question = (
            f"Can you walk through a project where you used {skill}, including "
            f"the main technical decisions and trade-offs?"
        )
    else:
        question = f"Can you explain your practical experience with {skill}?"

    normalized_previous = {_normalize_question(q) for q in previous_questions}
    if _normalize_question(question) not in normalized_previous:
        return question

    return (
        f"What was the most challenging problem you solved using {skill}, "
        "and how did you approach it?"
    )


def generate_local_resume_question(
    resume_text: str,
    job_role: str = "",
    previous_questions: List[str] = None,
    current_difficulty: str = "medium",
) -> str:
    return _resume_based_local_question(
        resume_text,
        job_role,
        previous_questions or [],
        current_difficulty,
    )


async def generate_hf_interview_question(
    resume_text: str,
    job_role: str,
    previous_questions: List[str],
    previous_answers: List[str],
    current_difficulty: str,
    *,
    hf_api_token: str,
    hf_model: str = HF_DEFAULT_MODEL,
    hf_api_base_url: str = HF_DEFAULT_API_BASE_URL,
    timeout_s: float = 8.0,
) -> str:

    resume_text = (resume_text or "").strip()
    hf_api_token = (hf_api_token or "").strip()
    hf_model = (hf_model or "").strip() or HF_DEFAULT_MODEL
    hf_api_base_url = (hf_api_base_url or "").strip().rstrip("/") or HF_DEFAULT_API_BASE_URL
    previous_questions = previous_questions or []
    previous_answers = previous_answers or []

    if not resume_text:
        raise RuntimeError("Resume context is required to generate resume-based questions.")

    if not hf_api_token:
        print("HF token is not configured, using resume-based local question.")
        return _resume_based_local_question(
            resume_text,
            job_role,
            previous_questions,
            current_difficulty,
        )

    all_skills = _extract_resume_skills(resume_text)
    available_skills = _get_unused_skills(
        all_skills,
        previous_questions
    )

    skills_text = (
        ", ".join(available_skills)
        if available_skills
        else "General Development"
    )

    prev_q = "\n".join(
        [f"{i+1}. {q}" for i, q in enumerate(previous_questions[-5:])]
    )

    difficulty_map = {
        "easy": "Beginner level",
        "medium": "Intermediate level",
        "hard": "Advanced level",
    }

    diff_desc = difficulty_map.get(
        (current_difficulty or "").lower(),
        "Intermediate level"
    )

    prompt = (
        "Generate exactly ONE interview question.\n\n"
        "STRICT RULES:\n"
        "- Use job role and candidate skills.\n"
        "- Never mention resume or profile.\n"
        "- Never repeat previous questions.\n"
        "- Never ask about the same skill twice.\n"
        "- Pick a NEW skill/topic every time.\n"
        "- Return ONLY the question.\n\n"
        f"Job Role: {job_role}\n"
        f"Difficulty: {diff_desc}\n"
        f"Available Skills: {skills_text}\n\n"
        f"Resume Context:\n{resume_text[:800]}\n\n"
        f"Previous Questions:\n{prev_q or 'None'}\n"
    )

    headers = {
        "Authorization": f"Bearer {hf_api_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "inputs": prompt,
        "parameters": {
            "temperature": 0.8,
            "max_new_tokens": 35,
            "top_p": 0.9,
            "return_full_text": False,
        },
    }

    last_error = "No response from Hugging Face."

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        for attempt in range(3):
            try:
                resp = await client.post(
                    f"{hf_api_base_url}/{hf_model}",
                    headers=headers,
                    json=payload,
                )

                if resp.status_code in (429, 503):
                    last_error = f"Hugging Face model is not ready or rate-limited: {resp.text}"
                    await asyncio.sleep(1)
                    continue

                if resp.status_code >= 400:
                    last_error = (
                        f"Hugging Face returned HTTP {resp.status_code}: "
                        f"{resp.text[:500]}"
                    )
                    await asyncio.sleep(1)
                    continue

                data = resp.json()

                output = None

                if isinstance(data, list) and data:
                    output = data[0].get("generated_text")

                elif isinstance(data, dict):
                    output = data.get("generated_text")

                if output:
                    question = clean_generated_question(output)

                    normalized_current = _normalize_question(question)
                    normalized_previous = [
                        _normalize_question(q)
                        for q in previous_questions
                    ]

                    if normalized_current in normalized_previous:
                        print("Duplicate detected. Retrying...")
                        continue

                    return question

            except Exception as e:
                last_error = repr(e)
                print("HF ERROR:", repr(e))
                await asyncio.sleep(1)

    print(f"HF unavailable, using resume-based local question: {last_error}")
    return _resume_based_local_question(
        resume_text,
        job_role,
        previous_questions,
        current_difficulty,
    )
