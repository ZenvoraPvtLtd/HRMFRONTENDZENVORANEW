from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.database import db
from app.utils.onboarding_checklist import (
    checklist_stats,
    merge_checklist,
    update_checklist_item,
)
from app.utils.profile_completion import calculate_profile_completion

router = APIRouter(prefix="/api/employees", tags=["employees"])


def get_col():
    if db is None:
        return None
    return db["employees_list"]


def get_users_col():
    if db is None:
        return None
    return db["users"]


def find_by_id(collection, item_id: str):
    if not ObjectId.is_valid(str(item_id)):
        return None
    return collection.find_one({"_id": ObjectId(item_id)})


def is_employee_record(doc: dict) -> bool:
    role = str(doc.get("role") or "").strip().lower()
    return role not in {"admin", "superadmin", "hr", "candidate"}


class EmployeePayload(BaseModel):
    name: str
    email: str
    employeeId: Optional[str] = None
    department: str
    role: str
    productivity: Optional[int] = 0
    status: Optional[str] = "Active"
    phoneNumber: Optional[str] = None
    joinDate: Optional[str] = None
    hireDate: Optional[str] = None
    manager: Optional[str] = None
    jobTitle: Optional[str] = None
    skills: Optional[list[str]] = None
    dateOfBirth: Optional[str] = None
    address: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    salary: Optional[str] = None
    uanNumber: Optional[str] = None
    simNumber: Optional[str] = None
    probationPeriodDays: Optional[int] = Field(default=None, ge=0)
    noticePeriodDays: Optional[int] = Field(default=None, ge=0)
    fnfDueDays: Optional[int] = Field(default=None, ge=0)
    reportingTime: Optional[str] = None
    workingHoursPerDay: Optional[int] = Field(default=None, ge=1, le=24)
    onboardingStatus: Optional[str] = "Completed"


class OnboardingTaskStatusPayload(BaseModel):
    status: str


class EmployeeUpdatePayload(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    employeeId: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    productivity: Optional[int] = None
    status: Optional[str] = None
    phoneNumber: Optional[str] = None
    joinDate: Optional[str] = None
    hireDate: Optional[str] = None
    manager: Optional[str] = None
    jobTitle: Optional[str] = None
    skills: Optional[list[str]] = None
    dateOfBirth: Optional[str] = None
    address: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    salary: Optional[str] = None
    uanNumber: Optional[str] = None
    simNumber: Optional[str] = None
    probationPeriodDays: Optional[int] = Field(default=None, ge=0)
    noticePeriodDays: Optional[int] = Field(default=None, ge=0)
    fnfDueDays: Optional[int] = Field(default=None, ge=0)
    reportingTime: Optional[str] = None
    workingHoursPerDay: Optional[int] = Field(default=None, ge=1, le=24)
    onboardingStatus: Optional[str] = None


def generate_employee_id(name: str, phone: str, role: str, col) -> str:
    name_parts = name.strip().split()
    first_name = name_parts[0] if name_parts else "X"
    last_name = name_parts[-1] if len(name_parts) > 1 else "X"

    name_initials = (first_name[0] + last_name[0]).upper()
    phone_digits = "".join(c for c in (phone or "0000000000") if c.isdigit())
    if len(phone_digits) < 4:
        phone_digits = phone_digits.ljust(4, "0")
    phone_part = phone_digits[:2] + phone_digits[-2:]
    role_part = (role or "EM")[:2].upper()
    count = col.count_documents({}) + 1 if col else 1
    emp_number = str(count).zfill(2)
    return f"{name_initials}{phone_part}{role_part}{emp_number}"


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    if doc.get("userId"):
        doc["userId"] = str(doc["userId"])

    doc["name"] = doc.get("fullName") or doc.get("name") or "Employee"
    doc["email"] = doc.get("email") or ""
    doc["employeeId"] = doc.get("employeeId") or doc.get("employee_id") or ""

    role_val = str(doc.get("role") or "employee").strip()
    doc["role"] = role_val
    doc["department"] = doc.get("department") or "Unassigned"
    doc["status"] = doc.get("status") or "Active"
    doc["phoneNumber"] = doc.get("phoneNumber") or ""
    doc["joinDate"] = doc.get("joinDate") or doc.get("hireDate") or doc.get("createdAt") or ""
    doc["hireDate"] = doc.get("hireDate") or doc.get("joinDate") or doc.get("createdAt") or ""
    doc["manager"] = doc.get("manager") or doc.get("managerName") or ""
    doc["jobTitle"] = doc.get("jobTitle") or doc.get("designation") or role_val
    doc["skills"] = doc.get("skills") or []
    doc["onboardingStatus"] = doc.get("onboardingStatus") or "Completed"
    doc["profileCompletion"] = doc.get("profileCompletion")
    if doc["profileCompletion"] is None:
        doc["profileCompletion"] = calculate_profile_completion(doc)
    doc["reportingTime"] = doc.get("reportingTime") or "09:00 AM"
    doc["workingHoursPerDay"] = doc.get("workingHoursPerDay") or 8
    return doc


def sync_user_record(existing: dict, data: dict) -> None:
    users_col = get_users_col()
    if users_col is None:
        return

    user_filter = None
    if existing.get("userId") and ObjectId.is_valid(str(existing["userId"])):
        user_filter = {"_id": ObjectId(str(existing["userId"]))}
    elif existing.get("email"):
        user_filter = {"email": str(existing["email"]).lower()}

    if not user_filter:
        return

    user_update = {
        key: value
        for key, value in {
            "fullName": data.get("name"),
            "name": data.get("name"),
            "email": data.get("email"),
            "phoneNumber": data.get("phoneNumber"),
            "role": data.get("role"),
            "employeeId": data.get("employeeId"),
            "department": data.get("department"),
            "status": data.get("status"),
            "managerName": data.get("manager"),
            "designation": data.get("jobTitle"),
            "dateOfBirth": data.get("dateOfBirth"),
            "address": data.get("address"),
            "emergencyContactName": data.get("emergencyContactName"),
            "emergencyContactPhone": data.get("emergencyContactPhone"),
            "skills": data.get("skills"),
            "uanNumber": data.get("uanNumber"),
            "reportingTime": data.get("reportingTime"),
            "workingHoursPerDay": data.get("workingHoursPerDay"),
        }.items()
        if value is not None
    }
    if user_update:
        users_col.update_one(user_filter, {"$set": user_update})


@router.get("")
def get_employees():
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    print("DEBUG GET /api/employees - collection:", col.name)
    if db is not None:
        try:
            print("DEBUG GET /api/employees - db['employees'] count:", db["employees"].count_documents({}))
            print("DEBUG GET /api/employees - db['employees'] first document:", db["employees"].find_one({}))
        except Exception as exc:
            print("DEBUG GET /api/employees - failed db['employees'] inspection:", str(exc))

    return [serialize(e) for e in col.find({}).sort("createdAt", -1) if is_employee_record(e)]


@router.get("/stats/summary")
def get_stats():
    col = get_col()
    if col is None:
        return {
            "totalEmployees": 0,
            "activeEmployees": 0,
            "inactiveEmployees": 0,
            "remoteEmployees": 0,
            "onboardingDone": 0,
            "avgProductivity": 0,
            "avgProfileCompletion": 0,
        }

    employees = [serialize(employee) for employee in col.find({}) if is_employee_record(employee)]
    total = len(employees)
    active = sum(1 for e in employees if str(e.get("status", "")).lower() == "active")
    inactive = sum(1 for e in employees if str(e.get("status", "")).lower() == "inactive")
    remote = sum(1 for e in employees if "remote" in str(e.get("status", "")).lower() or "remote" in str(e.get("department", "")).lower())
    onboarding_done = sum(1 for e in employees if str(e.get("onboardingStatus", "Completed")).lower() == "completed")
    avg_prod = round(sum(int(e.get("productivity") or 0) for e in employees) / total) if total else 0
    avg_profile = round(sum(int(e.get("profileCompletion") or 0) for e in employees) / total) if total else 0

    return {
        "totalEmployees": total,
        "activeEmployees": active,
        "inactiveEmployees": inactive,
        "remoteEmployees": remote,
        "onboardingDone": onboarding_done,
        "avgProductivity": avg_prod,
        "avgProfileCompletion": avg_profile,
    }


def get_employee_checklist_doc(col, employee_id: str):
    doc = find_by_id(col, employee_id)
    if not doc:
        return None, None
    checklist = merge_checklist(doc.get("onboardingChecklist"))
    return doc, checklist


@router.get("/{employee_id}/onboarding-checklist")
def get_employee_onboarding_checklist(employee_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    doc, checklist = get_employee_checklist_doc(col, employee_id)
    if not doc:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    stats = checklist_stats(checklist)
    employee = serialize(doc)
    return {
        "employeeId": employee.get("id"),
        "name": employee.get("name"),
        "email": employee.get("email"),
        "checklist": checklist,
        "stats": stats,
    }


@router.patch("/{employee_id}/onboarding-checklist/{task_id}")
def update_employee_onboarding_task(employee_id: str, task_id: str, payload: OnboardingTaskStatusPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    doc, checklist = get_employee_checklist_doc(col, employee_id)
    if not doc:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    try:
        updated_checklist = update_checklist_item(checklist, task_id, payload.status.strip())
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"message": str(exc)})

    completed_count = sum(1 for item in updated_checklist if item.get("status") == "Completed")
    onboarding_status = "Completed" if completed_count == len(updated_checklist) else "In Progress"

    col.update_one(
        {"_id": ObjectId(employee_id)},
        {
            "$set": {
                "onboardingChecklist": updated_checklist,
                "onboardingStatus": onboarding_status,
                "updatedAt": datetime.utcnow().isoformat(),
            }
        },
    )

    stats = checklist_stats(updated_checklist)
    return {
        "message": "Onboarding task updated",
        "checklist": updated_checklist,
        "stats": stats,
        "onboardingStatus": onboarding_status,
    }


@router.get("/{employee_id}")
def get_employee(employee_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    doc = find_by_id(col, employee_id)
    if not doc:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})
    return serialize(doc)


@router.post("")
def create_employee(payload: EmployeePayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    print("DEBUG POST /api/employees - collection:", col.name)
    if db is not None:
        try:
            print("DEBUG POST /api/employees - db['employees'] count:", db["employees"].count_documents({}))
            print("DEBUG POST /api/employees - db['employees'] first document:", db["employees"].find_one({}))
        except Exception as exc:
            print("DEBUG POST /api/employees - failed db['employees'] inspection:", str(exc))

    data = payload.model_dump()
    data["createdAt"] = datetime.utcnow().isoformat()
    data["fullName"] = data.get("name")
    existing = col.find_one({"email": data["email"].lower().strip()})
    if existing:
        return JSONResponse(status_code=409, content={"message": "Employee already exists"})
    data["email"] = data["email"].lower().strip()

    if not data.get("employeeId"):
        data["employeeId"] = generate_employee_id(
            name=data.get("name", ""),
            phone=data.get("phoneNumber", ""),
            role=data.get("role", "employee"),
            col=col,
        )
    data["employee_id"] = data["employeeId"]
    data["profileCompletion"] = calculate_profile_completion(data)

    result = col.insert_one(data)
    data["_id"] = str(result.inserted_id)
    data["id"] = data["_id"]
    return {"message": "Employee created", "employee": serialize(data)}


@router.put("/{employee_id}")
def update_employee(employee_id: str, payload: EmployeeUpdatePayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})

    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "email" in data:
        data["email"] = data["email"].lower().strip()
    if "name" in data:
        data["fullName"] = data["name"]
    if "employeeId" in data and data["employeeId"]:
        data["employeeId"] = str(data["employeeId"]).strip()
        data["employee_id"] = data["employeeId"]

    existing = find_by_id(col, employee_id)
    if not existing:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    merged = {**existing, **data}
    data["profileCompletion"] = calculate_profile_completion(merged)
    data["updatedAt"] = datetime.utcnow().isoformat()

    result = col.find_one_and_update({"_id": ObjectId(employee_id)}, {"$set": data}, return_document=True)
    if not result:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    sync_user_record(existing, data)
    return {"message": "Employee updated", "employee": serialize(result)}


@router.delete("/{employee_id}")
def delete_employee(employee_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    existing = find_by_id(col, employee_id)
    if not existing:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    result = col.delete_one({"_id": ObjectId(employee_id)})
    if result.deleted_count == 0:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    users_col = get_users_col()
    if users_col is not None:
        if existing.get("userId") and ObjectId.is_valid(str(existing["userId"])):
            users_col.delete_one({"_id": ObjectId(str(existing["userId"]))})
        elif existing.get("email"):
            users_col.delete_one({"email": str(existing["email"]).lower()})

    return {"message": "Employee deleted"}


@router.post("/{employee_id}/suspend")
def suspend_employee(employee_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    existing = find_by_id(col, employee_id)
    if not existing:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    result = col.find_one_and_update(
        {"_id": ObjectId(employee_id)},
        {"$set": {"status": "Suspended", "updatedAt": datetime.utcnow().isoformat()}},
        return_document=True,
    )
    if not result:
        return JSONResponse(status_code=404, content={"message": "Employee not found"})

    sync_user_record(existing, {"status": "Suspended"})
    return {"message": "Employee suspended", "employee": serialize(result)}
