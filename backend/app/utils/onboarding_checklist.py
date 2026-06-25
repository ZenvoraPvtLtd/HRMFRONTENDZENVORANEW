from datetime import datetime, timezone
from typing import Optional

DEFAULT_ONBOARDING_TASKS = [
    "Pre-joining documentation",
    "Background verification",
    "Document collection",
    "Offer letter signing",
    "Company introduction",
    "SIM allotment",
    "Email and signature creation",
    "System access provisioning",
    "HR orientation",
    "Team introduction",
    "Policy acknowledgment",
    "Probation setup",
]

ONBOARDING_TASK_STATUSES = {"Pending", "In Progress", "Completed"}


def build_default_checklist() -> list[dict]:
    return [
        {
            "id": f"task-{index + 1}",
            "title": title,
            "status": "Pending",
            "completedAt": None,
        }
        for index, title in enumerate(DEFAULT_ONBOARDING_TASKS)
    ]


def merge_checklist(stored: Optional[list]) -> list[dict]:
    defaults = build_default_checklist()
    if not stored:
        return defaults

    stored_by_id = {str(item.get("id")): item for item in stored if item.get("id")}
    merged: list[dict] = []

    for default in defaults:
        existing = stored_by_id.get(default["id"], {})
        status = str(existing.get("status") or default["status"])
        if status not in ONBOARDING_TASK_STATUSES:
            status = "Pending"
        merged.append(
            {
                "id": default["id"],
                "title": default["title"],
                "status": status,
                "completedAt": existing.get("completedAt"),
            }
        )

    return merged


def checklist_stats(checklist: list[dict]) -> dict:
    total = len(checklist)
    completed = sum(1 for item in checklist if item.get("status") == "Completed")
    percent = round((completed / total) * 100) if total else 0
    return {
        "total": total,
        "completed": completed,
        "pending": total - completed,
        "percent": percent,
    }


def update_checklist_item(checklist: list[dict], task_id: str, status: str) -> list[dict]:
    if status not in ONBOARDING_TASK_STATUSES:
        raise ValueError("Invalid onboarding task status")

    updated: list[dict] = []
    found = False
    now = datetime.now(timezone.utc).isoformat()

    for item in checklist:
        if str(item.get("id")) != task_id:
            updated.append(item)
            continue

        found = True
        completed_at = item.get("completedAt")
        if status == "Completed":
            completed_at = completed_at or now
        elif status != "Completed":
            completed_at = None

        updated.append(
            {
                **item,
                "status": status,
                "completedAt": completed_at,
            }
        )

    if not found:
        raise ValueError("Onboarding task not found")

    return updated
