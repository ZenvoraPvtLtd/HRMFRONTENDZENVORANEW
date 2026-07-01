from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from app.core.database import db
from fastapi import APIRouter, HTTPException, Header, Depends
from jose import JWTError, jwt
from pydantic import BaseModel

from app.attendance.auth import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/api/announcements", tags=["announcements"])

# In-memory fallback (used when MongoDB is unavailable)
_memory_store: List[Dict[str, Any]] = []


def _col():
    return db["announcements"] if db is not None else None


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.get("_id") or doc.get("id", ""))
    doc.pop("_id", None)
    return doc


# ─────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────
class Announcement(BaseModel):
    title: str
    message: str
    priority: str = "Medium"      # High | Medium | Low
    status: str = "Draft"         # Draft | Published
    target: str = "All Employees"
    expires: Optional[str] = None
    is_pinned: bool = False



# GET ALL ANNOUNCEMENTS

@router.get("/")
def get_announcements(role: str = Header(default="employee")) -> List[Dict[str, Any]]:
    role_lower = role.lower()
    col = _col()

    if col is not None:
        query = {} if role_lower in ["hr", "admin", "superadmin"] else {"status": "Published"}
        docs = [_serialize(d) for d in col.find(query).sort("created_at", -1)]
    else:
        docs = _memory_store if role_lower in ["hr", "admin", "superadmin"] else [
            a for a in _memory_store if a["status"] == "Published"
        ]

    return sorted(docs, key=lambda x: (not x.get("is_pinned", False), x.get("created_at", "")))



# GET SINGLE ANNOUNCEMENT

@router.get("/{announcement_id}")
def get_announcement(
    announcement_id: str,
    role: str = Header(default="employee"),
) -> Dict[str, Any]:
    col = _col()

    if col is not None:
        query = {"_id": ObjectId(announcement_id)} if ObjectId.is_valid(announcement_id) else {"id": announcement_id}
        doc = col.find_one(query)
        if not doc:
            raise HTTPException(status_code=404, detail="Announcement not found")
        a = _serialize(doc)
    else:
        matches = [x for x in _memory_store if x["id"] == announcement_id]
        if not matches:
            raise HTTPException(status_code=404, detail="Announcement not found")
        a = matches[0]

    if a["status"] == "Draft" and role.lower() not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    return a



# HELPERS


def get_user_role(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization:
        return "employee"

    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("role", "employee").lower()
    except JWTError:
        return "employee"


def require_hr_or_admin(role: str = Depends(get_user_role)) -> str:
    if role not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="HR/Admin only")
    return role



# CREATE ANNOUNCEMENT

@router.post("/")
def create_announcement(
    data: Announcement,
    role: str = Header(default="employee"),
) -> Dict[str, Any]:
    if role.lower() not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="HR/Admin only")

    new_announcement: Dict[str, Any] = {
        "id": str(uuid4()),
        "title": data.title,
        "message": data.message,
        "priority": data.priority,
        "status": data.status,
        "target": data.target,
        "expires": data.expires,
        "is_pinned": data.is_pinned,
        "created_at": datetime.utcnow().isoformat(),
    }
    new_doc = new_announcement

    col = _col()
    if col is not None:
        result = col.insert_one(new_doc)
        new_doc["_id"] = result.inserted_id
        announcement = _serialize(new_doc)
    else:
        new_doc["id"] = str(uuid4())
        _memory_store.insert(0, new_doc)
        announcement = new_doc

    return {"message": "Announcement created successfully", "announcement": announcement}



# UPDATE ANNOUNCEMENT

@router.put("/{announcement_id}")
def update_announcement(
    announcement_id: str,
    data: Announcement,
    role: str = Header(default="employee"),
) -> Dict[str, Any]:
    if role.lower() not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="HR/Admin only")

    update_fields = data.model_dump()
    col = _col()

    if col is not None:
        query = {"_id": ObjectId(announcement_id)} if ObjectId.is_valid(announcement_id) else {"id": announcement_id}
        result = col.find_one_and_update(
            query,
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Announcement not found")
        announcement = _serialize(result)
    else:
        for i, a in enumerate(_memory_store):
            if a["id"] == announcement_id:
                _memory_store[i].update(update_fields)
                announcement = _memory_store[i]
                break
        else:
            raise HTTPException(status_code=404, detail="Announcement not found")

    return {"message": "Updated successfully", "announcement": announcement}



# PUBLISH ANNOUNCEMENT

@router.patch("/{announcement_id}/publish")
def publish_announcement(
    announcement_id: str,
    role: str = Header(default="employee"),
) -> Dict[str, Any]:
    if role.lower() not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="HR/Admin only")

    col = _col()

    if col is not None:
        query = {"_id": ObjectId(announcement_id)} if ObjectId.is_valid(announcement_id) else {"id": announcement_id}
        result = col.find_one_and_update(
            query,
            {"$set": {"status": "Published"}},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Announcement not found")
        announcement = _serialize(result)
    else:
        for a in _memory_store:
            if a["id"] == announcement_id:
                a["status"] = "Published"
                announcement = a
                break
        else:
            raise HTTPException(status_code=404, detail="Announcement not found")

    return {"message": "Published successfully", "announcement": announcement}



# DELETE ANNOUNCEMENT

@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: str,
    role: str = Header(default="employee"),
) -> Dict[str, Any]:
    if role.lower() not in ["hr", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="HR/Admin only")

    col = _col()

    if col is not None:
        query = {"_id": ObjectId(announcement_id)} if ObjectId.is_valid(announcement_id) else {"id": announcement_id}
        deleted = col.find_one_and_delete(query)
        if not deleted:
            raise HTTPException(status_code=404, detail="Announcement not found")
        announcement = _serialize(deleted)
    else:
        for i, a in enumerate(_memory_store):
            if a["id"] == announcement_id:
                announcement = _memory_store.pop(i)
                break
        else:
            raise HTTPException(status_code=404, detail="Announcement not found")

    return {"message": "Deleted successfully", "announcement": announcement}
