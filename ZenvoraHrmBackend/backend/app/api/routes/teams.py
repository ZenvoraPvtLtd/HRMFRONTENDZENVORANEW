from collections import defaultdict
from datetime import datetime
import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.database import users_collection
from app.core.jwt_auth import TokenPayload, get_current_user

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


class TeamMemberAddRequest(BaseModel):
    name: str
    email: str
    employeeId: Optional[str] = None
    contact: Optional[str] = None
    projects: Optional[str] = None
    skills: Optional[str] = None
    shift: Optional[str] = None


pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


@router.post("/add-member")
async def add_team_member(
    body: TeamMemberAddRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    if users_collection is None:
        raise HTTPException(
            status_code=503,
            detail="Database offline"
        )

    # 1. Fetch current manager details
    manager = users_collection.find_one({"_id": ObjectId(current_user.sub)})
    if not manager:
        raise HTTPException(
            status_code=404,
            detail="Manager not found"
        )

    manager_email = str(manager.get("email", "")).lower().strip()
    manager_id_str = str(manager.get("_id"))

    # Validate Name
    name = body.name.strip() if body.name else ""
    if not name or not re.match(r"^[a-zA-Z\s]{2,50}$", name):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Full Name (letters and spaces only, 2-50 characters)."
        )

    # Validate Email
    email = body.email.lower().strip() if body.email else ""
    email_pattern = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
    if not email or not email_pattern.match(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address (e.g. employee@company.com)."
        )

    # Validate Employee ID
    employee_id = body.employeeId.strip() if body.employeeId else ""
    if not employee_id or not re.match(r"^(EMP|emp)\d{3,}$", employee_id):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Employee ID (e.g. EMP101, EMP001)."
        )

    # Validate Contact
    contact = body.contact.strip() if body.contact else ""
    if not contact or not re.match(r"^[0-9]{10}$", contact):
        raise HTTPException(
            status_code=400,
            detail="Contact number must be exactly 10 digits."
        )

    # Validate Shift
    shift = body.shift.strip() if body.shift else ""
    if not shift or shift.lower() not in {"day", "night", "morning", "evening"}:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid shift (e.g. Day, Night, Morning, Evening)."
        )

    # Check if user already exists
    existing_user = users_collection.find_one({"email": email})

    # Parse skills
    skills_list = []
    if body.skills:
        skills_list = [s.strip() for s in body.skills.split(",") if s.strip()]

    # Parse projects
    projects_list = []
    if body.projects:
        projects_list = [p.strip() for p in body.projects.split(",") if p.strip()]

    if existing_user:
        # Update existing user to associate with this manager and update details
        update_data = {
            "manager_id": manager_id_str,
            "managerId": manager_id_str,
            "manager_email": manager_email,
            "managerEmail": manager_email,
            "manager": manager_email,
            "role": "employee",  # Make sure they are employee
        }
        if body.name:
            update_data["fullName"] = body.name.strip()
            update_data["name"] = body.name.strip()
        if body.employeeId:
            update_data["employeeId"] = body.employeeId.strip()
        if body.contact:
            update_data["phoneNumber"] = body.contact.strip()
            update_data["contact"] = body.contact.strip()
        if projects_list:
            update_data["projects"] = projects_list
        if skills_list:
            update_data["skills"] = skills_list
        if body.shift:
            update_data["shift"] = body.shift.strip()

        users_collection.update_one(
            {"_id": existing_user["_id"]},
            {"$set": update_data}
        )
        updated_member = users_collection.find_one({"_id": existing_user["_id"]})
    else:
        # Create new user
        default_pwd = pwd_context.hash("Zenvora@123")
        new_user = {
            "fullName": body.name.strip(),
            "name": body.name.strip(),
            "email": email,
            "phoneNumber": str(body.contact or "").strip(),
            "contact": str(body.contact or "").strip(),
            "employeeId": str(body.employeeId or "").strip(),
            "role": "employee",
            "department": manager.get("department") or "General",
            "password": default_pwd,
            "createdAt": datetime.utcnow().isoformat(),
            "manager_id": manager_id_str,
            "managerId": manager_id_str,
            "manager_email": manager_email,
            "managerEmail": manager_email,
            "manager": manager_email,
            "projects": projects_list,
            "skills": skills_list,
            "shift": str(body.shift or "").strip()
        }
        result = users_collection.insert_one(new_user)
        new_user["_id"] = result.inserted_id
        updated_member = new_user

    # Create summary for response
    summary = {
        "_id": str(updated_member.get("_id", "")),
        "name": updated_member.get("fullName") or updated_member.get("name") or "",
        "email": updated_member.get("email", ""),
        "role": updated_member.get("role", "employee"),
        "employeeId": updated_member.get("employeeId") or "",
        "contact": updated_member.get("phoneNumber") or updated_member.get("contact") or "",
        "projects": updated_member.get("projects") or [],
        "skills": updated_member.get("skills") or [],
        "shift": updated_member.get("shift") or "",
    }

    return {"success": True, "message": "Member added successfully", "data": summary}
