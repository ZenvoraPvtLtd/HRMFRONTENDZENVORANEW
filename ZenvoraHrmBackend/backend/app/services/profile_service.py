from datetime import datetime
import re
from typing import Any, Dict, Optional

from bson import ObjectId

from app.core.database import db, users_collection
from app.utils.profile_completion import calculate_profile_completion


def _normalize_role(role: str) -> str:
    cleaned = str(role or "").strip().lower()
    if cleaned in {"admin", "superadmin"}:
        return "admin"
    if cleaned == "hr" or "hr" in cleaned:
        return "hr"
    if cleaned in {"manager", "team manager"}:
        return "manager"
    if cleaned == "candidate":
        return "candidate"
    return "employee"


def _name_code(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", str(name or "")).upper()
    return (cleaned[:4] or "USER")


def _employee_id_prefix(role: str, name: str = "") -> str:
    auth_role = _normalize_role(role)
    if auth_role == "hr":
        return f"HR{_name_code(name)}"
    if auth_role == "manager":
        return "MGR"
    if auth_role == "admin":
        return "ADM"
    return "EMP"


def _employee_id_exists(employee_id: str, current_user_id: str = "") -> bool:
    if users_collection is not None:
        query: Dict[str, Any] = {"employeeId": employee_id}
        if ObjectId.is_valid(current_user_id):
            query["_id"] = {"$ne": ObjectId(current_user_id)}
        if users_collection.find_one(query):
            return True

    if db is not None:
        query = {"employeeId": employee_id}
        if current_user_id:
            query["userId"] = {"$ne": current_user_id}
        if db["employees_list"].find_one(query):
            return True

    return False


def _generate_employee_id(role: str, name: str = "", current_user_id: str = "") -> str:
    prefix = _employee_id_prefix(role, name)
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    highest = 0

    if users_collection is not None:
        for user in users_collection.find(
            {"employeeId": {"$regex": f"^{prefix}\\d+$", "$options": "i"}},
            {"employeeId": 1},
        ):
            match = pattern.match(str(user.get("employeeId") or ""))
            if match:
                highest = max(highest, int(match.group(1)))

    if db is not None:
        for employee in db["employees_list"].find(
            {"employeeId": {"$regex": f"^{prefix}\\d+$", "$options": "i"}},
            {"employeeId": 1},
        ):
            match = pattern.match(str(employee.get("employeeId") or ""))
            if match:
                highest = max(highest, int(match.group(1)))

    next_number = highest + 1
    while True:
        employee_id = f"{prefix}{next_number:04d}"
        if not _employee_id_exists(employee_id, current_user_id):
            return employee_id
        next_number += 1


def _ensure_profile_employee_id(user: Dict[str, Any]) -> Dict[str, Any]:
    user_id = str(user.get("_id", ""))
    role = _normalize_role(user.get("role", ""))
    if role == "candidate":
        return user

    name = user.get("fullName") or user.get("name") or ""
    existing_id = str(user.get("employeeId") or user.get("employee_id") or "").strip()
    expected_prefix = _employee_id_prefix(role, name)
    should_replace_id = role == "hr" and (
        not existing_id or not re.match(rf"^{re.escape(expected_prefix)}\d+$", existing_id, re.IGNORECASE)
    )

    if existing_id and not should_replace_id:
        return user

    employee_id = _generate_employee_id(role, name, user_id)
    user["employeeId"] = employee_id

    if users_collection is not None and user.get("_id"):
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"employeeId": employee_id}},
        )

    if db is not None:
        employee_filter: Dict[str, Any] = {"email": str(user.get("email", "")).lower().strip()}
        if user_id:
            employee_filter = {
                "$or": [
                    {"userId": user_id},
                    {"email": str(user.get("email", "")).lower().strip()},
                ]
            }
        db["employees_list"].update_one(employee_filter, {"$set": {"employeeId": employee_id}})

    return user


class ProfileService:
    @staticmethod
    def get_profile_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        if users_collection is None:
            raise RuntimeError("Database not connected")

        return ProfileService._find_user(user_id)

    @staticmethod
    def update_profile(user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if users_collection is None:
            raise RuntimeError("Database not connected")

        user = ProfileService._find_user(user_id)
        if not user:
            return None

        allowed_updates: Dict[str, Any] = {}
        editable_fields = (
            "name",
            "phoneNumber",
            "dateOfBirth",
            "address",
            "emergencyContactName",
            "emergencyContactPhone",
            "bankAccountDetails",
            "uanNumber",
            "skills",
            "reportingTime",
            "workingHoursPerDay",
            "email",
            "role",
            "provider",
            "employeeId",
            "department",
            "designation",
            "joiningDate",
            "managerName",
            "teamSize",
        )

        for field in editable_fields:
            if field in update_data and update_data[field] is not None:
                if field == "name":
                    allowed_updates["fullName"] = str(update_data["name"]).strip()
                    allowed_updates["name"] = str(update_data["name"]).strip()
                else:
                    allowed_updates[field] = update_data[field]

        if allowed_updates:
            merged = {**user, **allowed_updates}
            allowed_updates["profileCompletion"] = calculate_profile_completion(merged)
            allowed_updates["updatedAt"] = datetime.utcnow().isoformat()
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": allowed_updates},
            )

            if db is not None:
                employee_filter = {
                    "$or": [
                        {"userId": str(user["_id"])},
                        {"email": str(user.get("email", "")).lower().strip()},
                    ]
                }
                db["employees_list"].update_one(employee_filter, {"$set": allowed_updates}, upsert=False)

        updated_user = users_collection.find_one({"_id": user["_id"]})
        return _ensure_profile_employee_id(updated_user) if updated_user else None

    @staticmethod
    def _find_user(identifier: str) -> Optional[Dict[str, Any]]:
        if users_collection is None:
            raise RuntimeError("Database not connected")

        value = str(identifier or "").strip()
        if not value:
            return None

        if ObjectId.is_valid(value):
            user = users_collection.find_one({"_id": ObjectId(value)})
            if user:
                return user

        lowered_value = value.lower()
        return users_collection.find_one(
            {
                "$or": [
                    {"email": lowered_value},
                    {"employeeId": value},
                    {"employee_id": value},
                    {"id": value},
                ]
            }
        )

    @staticmethod
    def format_profile_response(user: Dict[str, Any]) -> Dict[str, Any]:
        user = _ensure_profile_employee_id(user)
        user_id = str(user.get("_id", ""))
        full_name = user.get("fullName") or user.get("name") or ""
        role = _normalize_role(user.get("role") or "employee")
        employee_id = user.get("employeeId") or user.get("employee_id")
        employee_record: Dict[str, Any] = {}

        if db is not None:
            employee_lookup = {
                "$or": [
                    {"userId": user_id},
                    {"email": str(user.get("email", "")).lower().strip()},
                ]
            }
            if employee_id:
                employee_lookup["$or"].extend(
                    [
                        {"employeeId": employee_id},
                        {"employee_id": employee_id},
                    ]
                )
            employee_record = db["employees_list"].find_one(employee_lookup) or {}

        created_at = ProfileService._stringify_date(user.get("createdAt")) or ""
        updated_at = ProfileService._stringify_date(user.get("updatedAt")) or created_at

        manager_name = user.get("managerName") or employee_record.get("managerName") or employee_record.get("manager")
        manager_id = user.get("manager_id") or employee_record.get("manager_id")
        if not manager_name and manager_id and users_collection is not None and ObjectId.is_valid(str(manager_id)):
            manager = users_collection.find_one({"_id": ObjectId(str(manager_id))}, {"fullName": 1, "name": 1})
            if manager:
                manager_name = manager.get("fullName") or manager.get("name")

        return {
            "id": user_id,
            "_id": user_id,
            "name": full_name,
            "fullName": full_name,
            "email": user.get("email", ""),
            "phoneNumber": user.get("phoneNumber", ""),
            "role": role,
            "provider": user.get("provider") or user.get("oauthProvider") or "local",
            "avatar": user.get("avatar") or user.get("picture"),
            "employeeId": employee_id,
            "department": user.get("department") or employee_record.get("department"),
            "designation": (
                user.get("designation")
                or user.get("jobTitle")
                or employee_record.get("designation")
                or employee_record.get("jobTitle")
                or employee_record.get("role")
            ),
            "managerName": manager_name,
            "teamSize": user.get("teamSize") or employee_record.get("teamSize"),
            "joiningDate": ProfileService._stringify_date(
                user.get("joiningDate")
                or user.get("joinDate")
                or employee_record.get("joiningDate")
                or employee_record.get("joinDate")
                or employee_record.get("createdAt")
            ),
            "dateOfBirth": ProfileService._stringify_date(user.get("dateOfBirth") or employee_record.get("dateOfBirth")),
            "address": user.get("address") or employee_record.get("address") or "",
            "emergencyContactName": user.get("emergencyContactName") or employee_record.get("emergencyContactName") or "",
            "emergencyContactPhone": user.get("emergencyContactPhone") or employee_record.get("emergencyContactPhone") or "",
            "bankAccountDetails": user.get("bankAccountDetails") or employee_record.get("bankAccountDetails") or "",
            "uanNumber": user.get("uanNumber") or employee_record.get("uanNumber") or "",
            "skills": user.get("skills") or employee_record.get("skills") or [],
            "reportingTime": user.get("reportingTime") or employee_record.get("reportingTime") or "09:00 AM",
            "workingHoursPerDay": user.get("workingHoursPerDay") or employee_record.get("workingHoursPerDay") or 8,
            "profileCompletion": calculate_profile_completion({**employee_record, **user}),
            "createdAt": created_at,
            "updatedAt": updated_at,
        }

    @staticmethod
    def _stringify_date(value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)
