import spacy

from spacy.matcher import PhraseMatcher

from skillNer.skill_extractor_class import SkillExtractor
from skillNer.general_params import SKILL_DB


# Load spaCy model.
# Some environments don't have `en_core_web_sm` downloaded; fall back to a blank model
# so the service can still start (skill extraction may be less accurate).
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = spacy.blank("en")


# Initialize SkillExtractor
skill_extractor = SkillExtractor(
    nlp,
    SKILL_DB,
    PhraseMatcher
)


def extract_skills(text):

    annotations = skill_extractor.annotate(text)

    detected_skills = set()

    # Full matches
    for match in annotations["results"]["full_matches"]:

        skill = match["doc_node_value"]

        detected_skills.add(skill)

    # Ngram matches
    for match in annotations["results"]["ngram_scored"]:

        skill = match["doc_node_value"]

        detected_skills.add(skill)

    return list(detected_skills)