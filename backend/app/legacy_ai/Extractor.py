import re
import uuid
import spacy
from ExperienceExtractor import extract_experience
from SkillsExtractor import extract_skills

from ProjectCertificationExtractor import (
    extract_projects,
    extract_certifications
)

from skills_db import (
    TECHNICAL_SKILLS,
    SOFT_SKILLS,
    TOOLS
)

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Start with blank model if language model isn't installed.
    nlp = spacy.blank("en")


def extract_email(text):
    emails = re.findall(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}",
        text
    )

    return emails[0] if emails else ""


def extract_phone(text):
    phones = re.findall(
        r"\+?\d[\d -]{8,12}\d",
        text
    )

    return phones[0] if phones else ""


def extract_name(text):
    doc = nlp(text)

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text

    return ""


def extract_skills(text):
    text = text.lower()

    technical = []
    soft = []
    tools = []

    for skill in TECHNICAL_SKILLS:
        if skill.lower() in text:
            technical.append(skill)

    for skill in SOFT_SKILLS:
        if skill.lower() in text:
            soft.append(skill)

    for tool in TOOLS:
        if tool.lower() in text:
            tools.append(tool)

    return technical, soft, tools


def build_json(text):

    technical, soft, tools = extract_skills(text)

    data = {
        "candidate_id": str(uuid.uuid4()),
        "resume_id": str(uuid.uuid4()),

        "personal_information": {
            "full_name": extract_name(text),
            "email": extract_email(text),
            "phone": extract_phone(text),
            "location": "",
            "linkedin": "",
            "github": ""
        },

        "education": [],

        "experience": {
            "experience": extract_experience(text),
        },

        "skills": {
        "technical_skills": technical,
        "soft_skills": soft,
        "tools_and_technologies": tools
    },

    "projects": extract_projects(text),

    "certifications": extract_certifications(text)

    }

    return data