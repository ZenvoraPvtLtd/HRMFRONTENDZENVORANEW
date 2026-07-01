import re

# PROJECT EXTRACTION


def extract_projects(text):

    projects = []

    lines = text.split("\n")

    inside_project_section = False

    current_project = {}

    for line in lines:

        clean_line = line.strip()

        if len(clean_line) == 0:
            continue

     
        # START PROJECT SECTION
  

        if (
            "major project" in clean_line.lower()
            or
            "minor project" in clean_line.lower()
            or
            "projects" in clean_line.lower()
        ):

            inside_project_section = True

            continue

     
        # STOP PROJECT SECTION
   

        if (
            "certification" in clean_line.lower()
            or
            "personal details" in clean_line.lower()
            or
            "strengths" in clean_line.lower()
        ):

            inside_project_section = False

        if not inside_project_section:
            continue

     
        # PROJECT TITLE
     

        if "title:" in clean_line.lower():

            # Save previous project
            if current_project:
                projects.append(current_project)

            title = clean_line.split(":")[-1].strip()

            current_project = {

                "project_name": title,

                "description": "",

                "technologies_used": [],

                "project_duration_months": 0
            }

    
        # DESCRIPTION
      

        elif "description:" in clean_line.lower():

            if current_project:

                description = (
                    clean_line.split(":")[-1].strip()
                )

                current_project[
                    "description"
                ] = description

     
        # TECHNOLOGIES
      

        elif (
            "technology:" in clean_line.lower()
            or
            "technologies:" in clean_line.lower()
            or
            "tech stack:" in clean_line.lower()
        ):

            if current_project:

                technologies = (
                    clean_line.split(":")[-1]
                )

                tech_list = re.split(
                    r',|/',
                    technologies
                )

                current_project[
                    "technologies_used"
                ] = [

                    tech.strip()

                    for tech in tech_list
                ]

    
        # DURATION
    

        elif "duration:" in clean_line.lower():

            if current_project:

                duration_match = re.search(
                    r'(\\d+)',
                    clean_line
                )

                if duration_match:

                    current_project[
                        "project_duration_months"
                    ] = int(
                        duration_match.group(1)
                    )

    # Save last project
    if current_project:

        projects.append(current_project)

    return projects


# CERTIFICATION EXTRACTION


def extract_certifications(text):

    certifications = []

    certification_keywords = [
        "certified",
        "certification",
        "certificate",
        "aws",
        "google cloud",
        "azure",
        "nptel",
        "coursera",
        "udemy"
    ]

    lines = text.split("\n")

    for line in lines:

        clean_line = line.strip()

        if len(clean_line) < 5:
            continue

        for keyword in certification_keywords:

            if keyword.lower() in clean_line.lower():

                certifications.append({

                    "certificate_name": clean_line,

                    "issued_by": "",

                    "year": 0
                })

                break

    return certifications