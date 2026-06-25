from __future__ import annotations

from typing import Any


PROFILE_COMPLETION_FIELDS = (
    "name",
    "fullName",
    "email",
    "phoneNumber",
    "dateOfBirth",
    "address",
    "department",
    "jobTitle",
    "designation",
    "manager",
    "managerName",
    "hireDate",
    "joinDate",
    "joiningDate",
    "emergencyContactName",
    "emergencyContactPhone",
    "skills",
    "uanNumber",
    "bankAccountDetails",
)


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def calculate_profile_completion(doc: dict | None) -> int:
    if not doc:
        return 0

    checks = {
        "name": _has_value(doc.get("name") or doc.get("fullName")),
        "email": _has_value(doc.get("email")),
        "phone": _has_value(doc.get("phoneNumber")),
        "dob": _has_value(doc.get("dateOfBirth")),
        "address": _has_value(doc.get("address")),
        "department": _has_value(doc.get("department")),
        "job": _has_value(doc.get("jobTitle") or doc.get("designation")),
        "manager": _has_value(doc.get("manager") or doc.get("managerName")),
        "hire": _has_value(doc.get("hireDate") or doc.get("joinDate") or doc.get("joiningDate")),
        "emergency": _has_value(doc.get("emergencyContactName")) and _has_value(doc.get("emergencyContactPhone")),
        "skills": _has_value(doc.get("skills")),
        "statutory": _has_value(doc.get("uanNumber")),
    }

    filled = sum(1 for value in checks.values() if value)
    return round((filled / len(checks)) * 100)
