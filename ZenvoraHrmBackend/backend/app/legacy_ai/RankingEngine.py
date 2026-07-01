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


def calculate_experience_score(candidate_exp, required_exp):
    """Calculate experience score based on candidate vs required experience."""
    if required_exp == 0:
        return 100
    score = min((candidate_exp / required_exp) * 100, 100)
    return score


def calculate_semantic_similarity(resume_text, jd_text):
    """Calculate semantic similarity between resume and job description."""
    vectorizer = CountVectorizer().fit_transform([resume_text, jd_text])
    similarity = cosine_similarity(vectorizer)
    return round(similarity[0][1] * 100, 2)


def calculate_job_fit_score(resume_data, jd_data, resume_text, jd_text, skill_result):
    """Calculate overall job fit score combining skills, experience, and semantic similarity."""
    candidate_exp = (
        resume_data["experience"]["experience"]
        ["total_experience_years"]
    )

    required_exp = (
        jd_data["required_experience"]
    )

    experience_score = (
        calculate_experience_score(
            candidate_exp,
            required_exp
        )
    )

    semantic_score = (
        calculate_semantic_similarity(
            resume_text,
            jd_text
        )
    )

    final_score = (
        (0.5 * skill_result["skill_score"])
        +
        (0.3 * experience_score)
        +
        (0.2 * semantic_score)
    )

    ranking = "Poor Match"

    if final_score >= 80:
        ranking = "Excellent Match"

    elif final_score >= 60:
        ranking = "Good Match"

    elif final_score >= 40:
        ranking = "Average Match"

    return {
        "job_fit_score": round(final_score, 2),

        "ranking": ranking,

        "matched_skills": (
            skill_result["matched_skills"]
        ),

        "missing_skills": (
            skill_result["missing_skills"]
        ),

        "skill_score": (
            skill_result["skill_score"]
        ),

        "experience_score": experience_score,

        "semantic_similarity": semantic_score
    }


def calculate_skill_score(resume_skills, jd_skills):
    """Calculate skill matching score between resume and job description."""
    if not jd_skills:
        return {
            "skill_score": 100,
            "matched_skills": list(resume_skills),
            "missing_skills": []
        }

    resume_skills_set = set(resume_skills)
    jd_skills_set = set(jd_skills)

    matched_skills = list(resume_skills_set.intersection(jd_skills_set))
    missing_skills = list(jd_skills_set - resume_skills_set)

    skill_score = (len(matched_skills) / len(jd_skills_set)) * 100 if jd_skills_set else 0

    return {
        "skill_score": round(skill_score, 2),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills
    }


def generate_candidate_ranking(resume_data, jd_data, resume_text, jd_text):
    """Generate comprehensive candidate ranking against job description."""
    # Extract skills from resume and JD
    resume_skills = flatten_skills(extract_skills(resume_text))
    jd_skills = flatten_skills(extract_skills(jd_text))

    # Calculate skill score and matching
    skill_result = calculate_skill_score(resume_skills, jd_skills)

    # Calculate overall job fit score
    ranking_result = calculate_job_fit_score(
        resume_data,
        jd_data,
        resume_text,
        jd_text,
        skill_result
    )

    return ranking_result
