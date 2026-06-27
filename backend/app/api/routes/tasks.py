from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, Depends
from fastapi.responses import JSONResponse
from bson import ObjectId

from app.core.jwt_auth import exclude_roles

from app.core.database import tasks_collection, employees_collection

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

from app.schemas.tasks import SprintTask, SprintTaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _send_task_assignment_notification(task: dict):
    """Send WhatsApp notification for task assignment"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    assigned_to = task.get("assignedTo") or task.get("assignee")
    if not assigned_to:
        return
    
    try:
        # Fetch assignee details if ID provided
        assignee = None
        if employees_collection:
            try:
                if ObjectId.is_valid(assigned_to):
                    assignee = employees_collection.find_one({"_id": ObjectId(assigned_to)})
                else:
                    assignee = employees_collection.find_one({"email": assigned_to})
            except:
                pass
        
        assignee_name = assignee.get("name", "Employee") if assignee else "Employee"
        assignee_phone = assignee.get("phone") if assignee else None
        
        if not assignee_phone:
            return
        
        whatsapp_service.queue_message(
            recipient_name=assignee_name,
            phone=assignee_phone,
            notification_type="task_assignments",
            template_data={
                "task_title": task.get("title", task.get("taskName", "New Task")),
                "priority": task.get("priority", "Medium").upper(),
                "due_date": task.get("dueDate", task.get("deadline", "Not specified"))
            }
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue task assignment notification: {e}")

@router.post("")
def create_sprint_task(task: SprintTask, current_user: dict = Depends(exclude_roles(["admin"]))):
    try:
        task_dict = task.model_dump(by_alias=True)
        task_dict["createdAt"] = datetime.now().isoformat()

        if tasks_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        result = tasks_collection.insert_one(task_dict)
        task_dict["_id"] = str(result.inserted_id)
        
        # Send WhatsApp notification to assignee
        _send_task_assignment_notification(task_dict)
        
        return {"success": True, "message": "Task created successfully", "task": task_dict, "data": task_dict}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc), "message": "Failed to create task"})


@router.get("")
def get_sprint_tasks(sprint_id: Optional[str] = Query(None), current_user: dict = Depends(exclude_roles(["admin"]))):
    try:
        if tasks_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        # Filter by sprint_id if provided
        query = {}
        if sprint_id:
            query["sprintId"] = sprint_id

        tasks = []
        for doc in tasks_collection.find(query).sort("createdAt", -1):
            doc["_id"] = str(doc["_id"])
            tasks.append(doc)

        return {"success": True, "data": tasks}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc), "message": "Failed to fetch tasks"})


@router.patch("/{task_id}")
def update_sprint_task(task_id: str, task: SprintTaskUpdate, current_user: dict = Depends(exclude_roles(["admin"]))):
    try:
        if tasks_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        update_data = task.model_dump(by_alias=True, exclude_none=True)
        update_data["updatedAt"] = datetime.now().isoformat()

        query = {"_id": ObjectId(task_id)} if ObjectId.is_valid(task_id) else {"taskId": task_id}
        result = tasks_collection.update_one(query, {"$set": update_data})
        if result.matched_count == 0:
            return JSONResponse(status_code=404, content={"success": False, "message": "Task not found"})

        updated = tasks_collection.find_one(query)
        if not updated:
            return JSONResponse(status_code=404, content={"success": False, "message": "Task not found"})

        updated["_id"] = str(updated["_id"])
        return {"success": True, "message": "Task updated successfully", "task": updated, "data": updated}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc), "message": "Failed to update task"})


@router.delete("/{task_id}")
def delete_sprint_task(task_id: str, current_user: dict = Depends(exclude_roles(["admin"]))):
    try:
        if tasks_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        query = {"_id": ObjectId(task_id)} if ObjectId.is_valid(task_id) else {"taskId": task_id}
        result = tasks_collection.delete_one(query)
        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"success": False, "message": "Task not found"})

        return {"success": True, "message": "Task deleted successfully"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc), "message": "Failed to delete task"})
