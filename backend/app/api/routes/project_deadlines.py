import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/project-deadlines", tags=["project-deadlines"])

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    _db = _client[DATABASE_NAME]
    project_col = _db["projects"]
    employees_col = _db["employees"]
except Exception as e:
    print(f"[PROJECT DEADLINES] MongoDB connection failed: {e}")
    project_col = None
    employees_col = None


class ProjectDeadline(BaseModel):
    project_name: str = Field(..., min_length=2)
    project_description: Optional[str] = None
    deadline: str  # ISO 8601 format
    assignees: list = Field(default=[])  # List of {name, phone, employee_id}
    priority: str = Field(default="Medium")  # High, Medium, Low
    milestone: Optional[str] = None


def _db_check():
    if project_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_project_reminder(project: dict, assignee: dict):
    """Send WhatsApp project deadline reminder scheduled 2 hours before deadline"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    assignee_name = assignee.get("name", "Team Member")
    assignee_phone = assignee.get("phone")
    
    if not assignee_phone:
        return
    
    try:
        deadline_str = project.get("deadline", "")
        deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        scheduled_send_time = deadline_dt - timedelta(hours=2)
        hours_remaining = (deadline_dt - datetime.utcnow()).total_seconds() / 3600
        
        whatsapp_service.queue_message(
            recipient_name=assignee_name,
            phone=assignee_phone,
            notification_type="project_deadlines",
            template_data={
                "project_name": project.get("project_name", "Project"),
                "hours_remaining": int(hours_remaining),
                "priority": project.get("priority", "Medium")
            },
            scheduled_time=scheduled_send_time
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue project deadline reminder: {e}")


@router.post("/create")
async def create_project_deadline(project: ProjectDeadline):
    _db_check()
    
    try:
        project_dict = project.model_dump()
        project_dict["created_at"] = datetime.utcnow().isoformat()
        project_dict["status"] = "active"
        
        result = project_col.insert_one(project_dict)
        project_dict["_id"] = str(result.inserted_id)
        
        # Send reminders to all assignees, scheduled 2 hours before deadline
        for assignee in project_dict.get("assignees", []):
            _send_project_reminder(project_dict, assignee)
        
        return {
            "success": True,
            "message": "Project deadline created successfully",
            "data": project_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create project deadline: {str(exc)}")


@router.get("")
async def get_projects(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        projects = []
        for doc in project_col.find().sort("deadline", 1).limit(limit):
            doc["_id"] = str(doc["_id"])
            projects.append(doc)
        
        return {"success": True, "data": projects}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch projects: {str(exc)}")


@router.get("/{project_id}")
async def get_project(project_id: str):
    _db_check()
    
    try:
        oid = ObjectId(project_id)
        project = project_col.find_one({"_id": oid})
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project["_id"] = str(project["_id"])
        return {"success": True, "data": project}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch project: {str(exc)}")


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    project: ProjectDeadline,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(project_id)
        
        update_dict = project.model_dump()
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        project_col.update_one({"_id": oid}, {"$set": update_dict})
        
        updated = project_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Project updated successfully", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(exc)}")


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(project_id)
        project = project_col.find_one({"_id": oid})
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_col.delete_one({"_id": oid})
        
        return {"success": True, "message": "Project deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(exc)}")
