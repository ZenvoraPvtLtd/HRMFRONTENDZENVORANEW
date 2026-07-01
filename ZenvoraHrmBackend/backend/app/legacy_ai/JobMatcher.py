from database import jobs_collection

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Semantic Similarity

def calculate_semantic_similarity(

    resume_text,

    job_description
):

    try:

        documents = [

            resume_text,

            job_description
        ]

        cv = CountVectorizer()

        matrix = cv.fit_transform(
            documents
        )

        similarity = cosine_similarity(
            matrix
        )[0][1]

        return round(
            similarity * 100,
            2
        )

    except:

        return 0


# Experience Score

def calculate_experience_score(

    candidate_exp,

    required_exp
):

    try:

        required_exp = float(
            required_exp
        )

    except:

        required_exp = 0

    if required_exp == 0:
        return 100

    if candidate_exp == 0:
        return 50

    score = (candidate_exp / required_exp) * 100
    return min(score, 100)

# Education Matching


def calculate_education_score(

    education_list,

    job_description
):

    if not education_list:

        return 40

    education_text = " ".join(

        [

            str(edu)

            for edu in education_list
        ]

    ).lower()

    job_description = (
        job_description.lower()
    )

    education_keywords = [

        "b.tech",

        "b.e",

        "m.tech",

        "bca",

        "mca",

        "bsc",

        "msc",

        "mba",

        "phd",

        "diploma",

        "computer science",

        "information technology",

        "mechanical",

        "civil",

        "electronics",

        "electrical",

        "artificial intelligence",

        "machine learning",

        "data science",

        "cyber security",

        "finance",

        "marketing",

        "commerce",

        "business administration"
    ]

    matched = 0

    total_required = 0

    for keyword in education_keywords:

        if keyword in job_description:

            total_required += 1

            if keyword in education_text:

                matched += 1

    if total_required == 0:

        return 70

    score = (

        matched

        /

        total_required

    ) * 100

    return round(score, 2)

# Project Relevance


def calculate_project_score(

    projects,

    required_skills
):

    if not projects:

        return 40

    project_text = " ".join(

        [

            str(project)

            for project in projects
        ]

    ).lower()

    matched = 0

    for skill in required_skills:

        if skill.lower() in project_text:

            matched += 1

    if len(required_skills) == 0:

        return 0

    return (

        matched

        /

        len(required_skills)

    ) * 100


# Main AI Job Matcher


def match_jobs(

    candidate_data,

    resume_text=""
):
    if jobs_collection is None:
        return []


# Candidate Skills
  

    technical_skills = (

        candidate_data.get(
            "skills",
            {}
        ).get(
            "technical_skills",
            []
        )
    )

    soft_skills = (

        candidate_data.get(
            "skills",
            {}
        ).get(
            "soft_skills",
            []
        )
    )

    tools = (

        candidate_data.get(
            "skills",
            {}
        ).get(
            "tools_and_technologies",
            []
        )
    )

    candidate_skills = list(

        set(

            technical_skills

            +

            soft_skills

            +

            tools
        )
    )

    candidate_skills = [

        skill.lower()

        for skill in candidate_skills
    ]

  # Candidate Experience
  
    candidate_experience = (

        candidate_data.get(
            "experience",
            {}
        ).get(
            "experience",
            {}
        ).get(
            "total_experience_years",
            0
        )
    )

  
 # Education
   

    education = candidate_data.get(
        "education",
        []
    )

  
 # Projects
  

    projects = candidate_data.get(
        "projects",
        []
    )

   # Fetch Jobs
   

    all_jobs = list(

        jobs_collection.find({})
    )

    matched_jobs = []

  
 # Compare Jobs
  

    for job in all_jobs:

        required_skills = [

            skill.lower()

            for skill in job.get(
                "required_skills",
                []
            )
        ]

        matched_skills = list(

            set(candidate_skills)

            &

            set(required_skills)
        )

    # Skill Score
      

        if len(required_skills) == 0:

            skill_score = 0

        else:

            skill_score = (

                len(matched_skills)

                /

                len(required_skills)

            ) * 100

     # Experience Score
       

        try:

            required_experience = float(

                job.get(
                    "experience_required",
                    0
                )
            )

        except:

            required_experience = 0

        experience_score = (

            calculate_experience_score(

                candidate_experience,

                required_experience
            )
        )

    
    # Semantic Similarity
     

        semantic_score = (

            calculate_semantic_similarity(

                resume_text,

                job.get(
                    "job_description",
                    ""
                )
            )
        )

     
     # Education Score
    

        education_score = (

            calculate_education_score(

                education,

                job.get(
                    "job_description",
                    ""
                )
            )
        )

# Project Score
      

        project_score = (

            calculate_project_score(

                projects,

                required_skills
            )
        )

  
 # Final AI Match Score
  

        final_score = (

            (0.4 * skill_score)

            +

            (0.3 * experience_score)

            +

            (0.2 * semantic_score)

            +

            (0.05 * education_score)

            +

            (0.05 * project_score)
        )

     
        # Recommendation
       

        recommendation = (
            "Not Recommended"
        )

        if final_score >= 80:

            recommendation = (
                "Highly Recommended"
            )

        elif final_score >= 60:

            recommendation = (
                "Recommended"
            )

        elif final_score >= 40:

            recommendation = (
                "Average Match"
            )

     
        # Show Recommended Jobs
     

        if final_score >= 40:

            job_data = {

                "job_title":
                job.get("job_title"),

                "department":
                job.get("department"),

                "location":
                job.get("location"),

                "experience_required":
                job.get("experience_required"),

                "required_skills":
                job.get("required_skills", []),

                "job_description":
                job.get("job_description"),

                "match_score":
                round(final_score, 1),

                "recommendation":
                recommendation
            }


  # Remove Duplicate Jobs
  

            if job_data not in matched_jobs:

                matched_jobs.append(
                    job_data
                )


# Sort Jobs
 

    matched_jobs = sorted(

        matched_jobs,

        key=lambda x: x[
            "recommendation"
        ],

        reverse=True
    )

    return matched_jobs
