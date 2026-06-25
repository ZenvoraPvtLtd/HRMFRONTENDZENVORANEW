from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.core.database import db

try:
    from app.services.notifications import create_notification as _create_notif
except Exception:
    _create_notif = None  # type: ignore


def _notify(title: str, message: str, type_: str):
    if _create_notif:
        try:
            _create_notif(title, message, type_, role="employee")
        except Exception:
            pass

router = APIRouter(prefix="/api/sprints", tags=["sprints"])


def get_col():
    if db is None:
        return None
    return db["sprints"]


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


class SprintPayload(BaseModel):
    name: str
    description: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    owner: Optional[str] = None
    team: Optional[str] = "Zenvora Product Team"


@router.get("")
def get_sprints():
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    sprints = [serialize(s) for s in col.find({}).sort("created_at", -1)]
    return {"success": True, "sprints": sprints}


@router.post("")
def create_sprint(payload: SprintPayload):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    data = {
        **payload.model_dump(),
        "created_at": datetime.utcnow().isoformat(),
        "progress": 0,
        "locked": True,
    }
    result = col.insert_one(data)
    data["_id"] = str(result.inserted_id)
    data["id"] = data["_id"]
    _notify(
        "New Sprint Created",
        f'A new sprint "{payload.name}" has been created. Check your Sprint Board.',
        "sprint_created",
    )
    return {"success": True, "sprint": data}


@router.delete("/{sprint_id}")
def delete_sprint(sprint_id: str):
    col = get_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    sprint = col.find_one({"_id": ObjectId(sprint_id)})
    sprint_name = sprint.get("name", "Sprint") if sprint else "Sprint"
    col.delete_one({"_id": ObjectId(sprint_id)})
    _notify(
        "Sprint Deleted",
        f'The sprint "{sprint_name}" has been removed.',
        "sprint_deleted",
    )
    return {"success": True}
