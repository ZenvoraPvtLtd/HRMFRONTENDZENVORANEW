from rapidfuzz import fuzz
import re


def extract_resume_skills(
    resume_text: str,
    jd_skills: list
):

    found = []

    text = resume_text.lower()

    for skill in jd_skills:

        pattern = re.escape(skill.lower())

        if pattern in text:
            found.append(skill)

    return found


def llm_skill_match(
    resume_text: str,
    jd_skills: list
):

    resume_skills = extract_resume_skills(
        resume_text,
        jd_skills
    )

    matched = []
    missing = []

    for jd_skill in jd_skills:

        found = False

        for resume_skill in resume_skills:

            similarity = fuzz.ratio(
                jd_skill.lower(),
                resume_skill.lower()
            )

            if similarity >= 85:
                matched.append(jd_skill)
                found = True
                break

        if not found:
            missing.append(jd_skill)

    score = round(
        len(matched)
        /
        max(len(jd_skills), 1)
        * 100
    )

    return {
        "matched": matched,
        "missing": missing,
        "score": score
    }