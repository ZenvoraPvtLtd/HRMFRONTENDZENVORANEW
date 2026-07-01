from datetime import datetime
from typing import Any, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import db, employees_collection, employees_list_collection, trainings_collection, users_collection
from app.core.jwt_auth import TokenPayload, get_current_user

router = APIRouter(prefix="/api/trainings", tags=["trainings"])


class ParticipantPayload(BaseModel):
    id: int
    name: str
    attendance: str = "Pending"
    completion: str = "Not Started"
    certificate: str = ""
    feedback: str = "-"
    rating: int = 0


class TrainingPayload(BaseModel):
    title: str
    type: str
    audience: str
    startDate: str
    endDate: str = ""
    time: str = ""
    mode: str
    venue: str = ""
    trainerName: str = ""
    trainerEmail: str = ""
    provider: str = ""
    status: str = "Planned"
    participants: List[ParticipantPayload] = []


def ensure_collection():
    if trainings_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected")


def completion_percent(participants: list[dict]) -> int:
    if not participants:
        return 0
    completed = len([p for p in participants if p.get("completion") == "Completed"])
    return round((completed / len(participants)) * 100)


def serialize_training(training: dict) -> dict:
    training["id"] = str(training["_id"])
    training.pop("_id", None)
    return training


def collection_or_db(handle: Any, name: str):
    if handle is not None:
        return handle
    if db is None:
        return None
    return db[name]


def serialize_employee(employee: dict) -> dict:
    oid = str(employee.get("_id", ""))
    employee_id = str(employee.get("employee_id") or employee.get("id") or oid)
    role = str(employee.get("role") or employee.get("user_role") or "Employee")
    name = (
        employee.get("name")
        or employee.get("employee_name")
        or employee.get("fullName")
        or employee.get("email")
        or employee_id
        or "Unnamed Employee"
    )

    return {
        "id": employee_id,
        "_id": oid,
        "employee_id": employee_id,
        "name": name,
        "email": employee.get("email", ""),
        "department": employee.get("department") or "Unassigned",
        "role": role,
        "status": employee.get("status") or "Active",
    }


def employee_seen_keys(employee: dict) -> set[str]:
    keys = set()
    for key in ("_id", "id", "employee_id", "email"):
        value = employee.get(key)
        if value:
            keys.add(str(value).strip().lower())
    return {key for key in keys if key}


def list_training_employees() -> list[dict]:
    sources = [
        (collection_or_db(employees_list_collection, "employees_list"), "name"),
        (collection_or_db(employees_collection, "employees"), "employee_name"),
        (collection_or_db(users_collection, "users"), "fullName"),
    ]
    employees: list[dict] = []
    seen: set[str] = set()
    projection = {"face_encoding": 0, "password": 0}

    for collection, sort_field in sources:
        if collection is None:
            continue

        for doc in collection.find({}, projection).sort(sort_field, 1):
            employee = serialize_employee(doc)
            if employee["role"].strip().lower() == "candidate":
                continue

            keys = employee_seen_keys(employee)
            if keys and seen.intersection(keys):
                continue

            employees.append(employee)
            seen.update(keys)

    return employees


@router.get("")
def get_trainings(current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()
    trainings = trainings_collection.find().sort("created_at", -1)
    return [serialize_training(training) for training in trainings]


@router.get("/employees")
def get_training_employees(current_user: TokenPayload = Depends(get_current_user)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    employees = list_training_employees()
    return {"success": True, "count": len(employees), "data": employees}


@router.post("")
def create_training(payload: TrainingPayload, current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()

    data = payload.model_dump()
    data["completion"] = completion_percent(data["participants"])
    data["created_by"] = current_user.sub
    data["created_at"] = datetime.utcnow()
    data["updated_at"] = datetime.utcnow()

    result = trainings_collection.insert_one(data)
    data["_id"] = result.inserted_id
    return serialize_training(data)


@router.put("/{training_id}")
def update_training(training_id: str, payload: TrainingPayload, current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()

    if not ObjectId.is_valid(training_id):
        raise HTTPException(status_code=400, detail="Invalid training id")

    data = payload.model_dump()
    data["completion"] = completion_percent(data["participants"])
    data["updated_at"] = datetime.utcnow()

    result = trainings_collection.update_one(
        {"_id": ObjectId(training_id)},
        {"$set": data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Training not found")

    training = trainings_collection.find_one({"_id": ObjectId(training_id)})
    return serialize_training(training)


@router.patch("/{training_id}/participants")
def update_training_participants(
    training_id: str,
    participants: List[ParticipantPayload],
    current_user: TokenPayload = Depends(get_current_user),
):
    ensure_collection()

    if not ObjectId.is_valid(training_id):
        raise HTTPException(status_code=400, detail="Invalid training id")

    participant_data = [participant.model_dump() for participant in participants]

    result = trainings_collection.update_one(
        {"_id": ObjectId(training_id)},
        {
            "$set": {
                "participants": participant_data,
                "completion": completion_percent(participant_data),
                "updated_at": datetime.utcnow(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Training not found")

    training = trainings_collection.find_one({"_id": ObjectId(training_id)})
    return serialize_training(training)


@router.delete("/{training_id}")
def delete_training(training_id: str, current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()

    if not ObjectId.is_valid(training_id):
        raise HTTPException(status_code=400, detail="Invalid training id")

    result = trainings_collection.delete_one({"_id": ObjectId(training_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Training not found")

    return {"message": "Training deleted successfully"}
