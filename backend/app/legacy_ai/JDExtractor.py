from SkillsExtractor import extract_skills

from ExperienceExtractor import (
    extract_experience
)


def build_jd_json(text):

    extracted_skills = extract_skills(text)

    if isinstance(extracted_skills, tuple):
        all_skills = []

        for skill_group in extracted_skills:
            if isinstance(skill_group, list):
                all_skills.extend(skill_group)
            elif skill_group:
                all_skills.append(skill_group)
    else:
        all_skills = extracted_skills or []

    experience = (
        extract_experience(text)
    )

    all_skills = list(

        set(
            all_skills
        )
    )

    return {

        "skills": all_skills,

        "required_experience": (

            experience.get(
                "total_experience_years",
                0
            )
        )
    }
