import re

from datetime import datetime


MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12
}


def calculate_month_difference(start, end):

    start_month = MONTHS[start[:3].lower()]
    end_month = MONTHS[end[:3].lower()]

    start_year = int(start[-4:])
    end_year = int(end[-4:])

    return (end_year - start_year) * 12 + (end_month - start_month)


def extract_experience(text):

    text = text.lower()

    detected_experience = ""

    total_months = 0

    # -----------------------------------
    # Explicit Experience Detection
    # -----------------------------------

    exp_pattern = r'(\d+\s*(?:year|years|yr|yrs)?\s*\d*\s*(?:month|months|mo|mos)?)'

    exp_matches = re.findall(exp_pattern, text)

    max_exp_months = 0

    for match in exp_matches:

        detected_experience = match.strip()

        year_match = re.search(
            r'(\d+)\s*(?:year|years|yr|yrs)',
            match
        )

        month_match = re.search(
            r'(\d+)\s*(?:month|months|mo|mos)',
            match
        )

        years = int(year_match.group(1)) if year_match else 0

        months = int(month_match.group(1)) if month_match else 0

        total = years * 12 + months

        if total > max_exp_months:

            max_exp_months = total

    # -----------------------------------
    # Date Range Detection
    # -----------------------------------

    date_pattern = r'([a-zA-Z]{3,9}\s?\d{4})\s*[–-]\s*([a-zA-Z]{3,9}\s?\d{4}|present)'

    date_matches = re.findall(date_pattern, text)

    calculated_months = 0

    for start, end in date_matches:

        try:

             # Store detected date range
            detected_experience = f"{start} - {end}"

            if end.lower() == "present":

                current = datetime.now()

                end = current.strftime("%b%Y")

            months = calculate_month_difference(start, end)

            calculated_months += months

        except:
            pass

    # -----------------------------------
    # Final Logic
    # -----------------------------------

    total_months = max(max_exp_months, calculated_months)

    return {

        "experience_text": detected_experience,

        "total_experience_years": round(total_months / 12, 1),

        "total_experience_months": total_months,

        "experience_details": []
    }