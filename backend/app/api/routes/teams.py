from collections import defaultdict

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.database import users_collection

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _role(doc: dict) -> str:
    return str(doc.get("role") or "").strip().lower()


def _name(doc: dict, fallback: str = "User") -> str:
    return doc.get("fullName") or doc.get("name") or doc.get("email") or fallback


def _user_summary(doc: dict) -> dict:
    return {
        "_id": str(doc.get("_id", "")),
        "name": _name(doc),
        "email": doc.get("email", ""),
        "role": doc.get("role", "Employee"),
        "employeeId": doc.get("employeeId") or doc.get("employee_id") or "",
        "contact": doc.get("phoneNumber") or doc.get("contact") or "",
        "projects": doc.get("projects") or [],
        "skills": doc.get("skills") or [],
        "shift": doc.get("shift") or "",
    }


@router.get("")
def get_teams():
    if users_collection is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    users = list(users_collection.find({}))
    managers = [user for user in users if _role(user) == "manager"]
    employees = [user for user in users if _role(user) == "employee"]

    manager_by_id = {str(manager.get("_id")): manager for manager in managers}
    manager_by_email = {
        str(manager.get("email", "")).lower(): manager
        for manager in managers
        if manager.get("email")
    }

    grouped: dict[str, list[dict]] = defaultdict(list)
    unassigned: list[dict] = []

    for employee in employees:
        manager_key = (
            str(employee.get("manager_id") or employee.get("managerId") or "").strip()
            or str(employee.get("manager_email") or employee.get("managerEmail") or "").strip().lower()
            or str(employee.get("manager") or "").strip().lower()
        )
        if manager_key in manager_by_id:
            grouped[manager_key].append(employee)
        elif manager_key in manager_by_email:
            grouped[str(manager_by_email[manager_key].get("_id"))].append(employee)
        else:
            unassigned.append(employee)

    teams = []
    for index, manager in enumerate(managers):
        manager_id = str(manager.get("_id"))
        teams.append(
            {
                "_id": f"team-{manager_id}",
                "name": manager.get("team") or manager.get("department") or f"{_name(manager)} Team",
                "department": manager.get("department") or "Team",
                "leader": _user_summary(manager),
                "members": [_user_summary(member) for member in grouped.get(manager_id, [])],
                "projects": manager.get("projects") or [],
            }
        )

    if unassigned:
        teams.append(
            {
                "_id": "team-unassigned",
                "name": "Unassigned Team",
                "department": "Team",
                "leader": {
                    "_id": "unassigned",
                    "name": "Unassigned",
                    "email": "",
                    "role": "Manager",
                },
                "members": [_user_summary(member) for member in unassigned],
                "projects": [],
            }
        )

    return {"success": True, "teams": teams}
