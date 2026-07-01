import re

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from SkillsExtractor import extract_skills


def flatten_skills(skills):
    if isinstance(skills, tuple):
        flattened = []
        for group in skills:
            if isinstance(group, list):
                flattened.extend(group)
            elif group:
                flattened.append(group)
        return flattened

    return skills or []


from collections import Counter

def detect_fake_experience(resume_text, jd_text):
    """Detect signs of fake or exaggerated experience."""
    text = resume_text.lower()
    expert_count = text.count("expert") + text.count("master") + text.count("guru")
    if expert_count > 5:
        return {
            "fake_experience_detected": True,
            "reason": f"Suspiciously high number of 'expert/master' claims ({expert_count})"
        }
    return {
        "fake_experience_detected": False,
        "reason": "Experience verification passed"
    }


def detect_keyword_stuffing(resume_text):
    """Detect keyword stuffing in resume."""
    words = re.findall(r'\b[a-zA-Z]{3,}\b', resume_text.lower())
    if not words:
        return {"keyword_stuffing": False, "suspicious_keywords": []}
    
    counts = Counter(words)
    stop_words = {"and", "the", "with", "for", "this", "that", "from", "have", "has", "was", "are", "project", "developed", "using", "used", "worked", "team", "application", "system", "software", "data", "business", "design", "development", "management", "experience", "work", "skills", "knowledge", "years", "including", "various", "new", "based", "about", "which", "their", "there", "what", "when", "where", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now"}
    
    suspicious = []
    for word, count in counts.items():
        if word not in stop_words and count > 12: 
            suspicious.append(f"{word}({count})")
            
    if suspicious:
        return {
            "keyword_stuffing": True,
            "suspicious_keywords": suspicious
        }
    return {
        "keyword_stuffing": False,
        "suspicious_keywords": []
    }


def detect_fake_certification(resume_text):
    """Detect signs of fake certifications."""
    text = resume_text.lower()
    if "fake cert" in text or "guaranteed certification" in text or "pay for cert" in text:
        return {
            "fake_certification_risk": True,
            "warnings": ["Suspicious certification language detected"]
        }
    return {
        "fake_certification_risk": False,
        "warnings": []
    }


def detect_ai_patterns(resume_text):
    """Detect AI-generated resume patterns."""
    ai_phrases = [
        "as an ai", "language model", "delve into", "testament to", 
        "tapestry", "multifaceted", "synergy", "seamlessly", 
        "in conclusion", "to summarize", "dynamic landscape", "ever-evolving",
        "keen understanding", "adept at", "fostered", "pivotal role"
    ]
    text = resume_text.lower()
    count = sum(1 for phrase in ai_phrases if phrase in text)
    if count >= 3:
        return {
            "ai_pattern_detected": True,
            "confidence": min(count * 20, 100)
        }
    return {
        "ai_pattern_detected": False,
        "confidence": 0
    }


def check_grammar(resume_text):
    """Check grammar quality."""
    errors = []
    if re.search(r',{2,}', resume_text) or re.search(r'\.{4,}', resume_text):
        errors.append("Excessive punctuation")
    
    if re.search(r',[^\s\d]', resume_text):
        errors.append("Missing spaces after commas")
        
    score = 90 - (len(errors) * 15)
    return {
        "grammar_score": max(score, 0),
        "errors": errors
    }


def calculate_skill_overlap(resume_skills, jd_skills):
    """Calculate skill overlap between resume and JD."""
    resume_skills_set = set([skill.lower() for skill in flatten_skills(resume_skills)])
    jd_skills_set = set([skill.lower() for skill in flatten_skills(jd_skills)])
    matched_skills = sorted(resume_skills_set & jd_skills_set)
    missing_skills = sorted(jd_skills_set - resume_skills_set)
    overlap_score = round((len(matched_skills) / len(jd_skills_set)) * 100, 2) if jd_skills_set else 100

    return {
        "overlap_score": overlap_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills
    }


def calculate_semantic_similarity(resume_text, jd_text):
    """Calculate semantic similarity between resume and JD."""
    vectorizer = CountVectorizer().fit_transform([resume_text, jd_text])
    similarity = cosine_similarity(vectorizer)
    return round(similarity[0][1] * 100, 2)


def analyze_candidate_risk(resume_data, jd_data, resume_text, jd_text):
    """Analyze overall candidate risk."""
    fake_exp_result = detect_fake_experience(resume_text, jd_text)
    stuffing_result = detect_keyword_stuffing(resume_text)
    fake_cert_result = detect_fake_certification(resume_text)
    ai_pattern_result = detect_ai_patterns(resume_text)
    grammar_result = check_grammar(resume_text)
    
    resume_skills = extract_skills(resume_text)
    jd_skills = jd_data.get("skills", [])
    skill_result = calculate_skill_overlap(resume_skills, jd_skills)
    
    semantic_score = calculate_semantic_similarity(resume_text, jd_text)
    
    risk_score = 0
    risk_factors = []
    
    if fake_exp_result["fake_experience_detected"]:
        risk_score += 30
        risk_factors.append(
            fake_exp_result["reason"]
        )

    if stuffing_result["keyword_stuffing"]:
        risk_factors.append(
            "Keyword stuffing detected"
        )

    if fake_cert_result["fake_certification_risk"]:
        risk_factors.extend(
            fake_cert_result["warnings"]
        )

    if ai_pattern_result["ai_pattern_detected"]:
        risk_factors.append(
            "AI-generated resume patterns detected"
        )

    if grammar_result["grammar_score"] < 70:
        risk_factors.append(
            "Grammar inconsistency detected"
        )

    decision = "SAFE" if risk_score < 30 else "REVIEW" if risk_score < 60 else "REJECT"

    return {
        "risk_score": risk_score,
        "decision": decision,
        "semantic_similarity": semantic_score,
        "skill_overlap_score": skill_result["overlap_score"],
        "matched_skills": skill_result["matched_skills"],
        "missing_skills": skill_result["missing_skills"],
        "risk_factors": risk_factors,
        "grammar_score": grammar_result["grammar_score"]
    }
