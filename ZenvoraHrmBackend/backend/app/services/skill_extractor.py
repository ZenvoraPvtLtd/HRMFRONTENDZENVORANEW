import json
import os

HF_TOKEN = os.getenv("HF_TOKEN")
MODEL = "Qwen/Qwen3-4B-Instruct"

# Lazy-load huggingface_hub so missing package doesn't crash startup
_client = None

def _get_client():
    global _client
    if _client is None:
        try:
            from huggingface_hub import InferenceClient
            _client = InferenceClient(
                provider="hf-inference",
                api_key=HF_TOKEN,
            )
        except Exception as exc:
            print(f"[SKILL_EXTRACTOR] huggingface_hub unavailable: {exc}")
    return _client


def extract_skills(text: str):
    client = _get_client()
    if client is None:
        return []

    prompt = f"""
Extract all technical skills from the following text.

Return ONLY valid JSON.

Example:

{{
  "skills": [
    "Python",
    "FastAPI",
    "MongoDB",
    "React"
  ]
}}

Text:

{text}
"""

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
        )

        content = completion.choices[0].message.content

        print("\n==============================")
        print("RAW LLM RESPONSE")
        print("==============================")
        print(content)

        result = json.loads(content)
        skills = result.get("skills", [])

        print("\n==============================")
        print("EXTRACTED SKILLS:", skills)
        print("==============================\n")

        return skills

    except Exception as e:
        print(f"[SKILL_EXTRACTOR] HF Skill Extraction Error: {e}")
        return []


def extract_jd_skills(text: str):
    return extract_skills(text)
