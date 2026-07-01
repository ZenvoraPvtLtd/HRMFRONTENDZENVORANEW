# from fastapi import APIRouter, HTTPException
# from bson import ObjectId

# # from schemas.project import ProjectCreate
# from app.schemas.project import ProjectCreate
# from database import project_collection

# router = APIRouter(prefix="/projects", tags=["Projects"])


# @router.post("/create")
# async def create_project(project: ProjectCreate):

#     project_data = {
#         "code": project.code,
#         "project_name": project.project_name,
#         "type": project.type,
#         "status": project.status,
#         "manager": project.manager,
#         "members": project.members,
#         "duration": project.duration
#     }

#     result = project_collection.insert_one(project_data)

#     return {
#         "message": "Project created successfully",
#         "project_id": str(result.inserted_id)
#     }















from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import projects_collection
from app.schemas.project import ProjectCreate


class ProjectUpdate(BaseModel):
    code: Optional[str] = None
    project_name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    manager: Optional[str] = None
    members: Optional[str] = None
    duration: Optional[str] = None

router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"]
)

legacy_router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


def serialize_project(project: dict) -> dict:
    project["_id"] = str(project["_id"])
    project["id"] = project["_id"]
    return project


def create_project_record(project: ProjectCreate):
    if projects_collection is None:
        return JSONResponse(
            status_code=503,
            content={"success": False, "message": "Database offline"},
        )

    project_data = project.model_dump()
    project_data["createdAt"] = datetime.utcnow().isoformat()

    result = projects_collection.insert_one(project_data)
    project_data["_id"] = str(result.inserted_id)
    project_data["id"] = project_data["_id"]

    return {
        "success": True,
        "message": "Project created successfully",
        "data": project_data,
    }


@router.get("")
async def get_projects():
    try:
        if projects_collection is None:
            return JSONResponse(
                status_code=503,
                content={"success": False, "message": "Database offline"},
            )

        projects = [
            serialize_project(project)
            for project in projects_collection.find({}).sort("createdAt", -1)
        ]

        return {"success": True, "data": projects}
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch projects",
                "error": str(exc),
            },
        )


@legacy_router.get("")
async def get_projects_legacy():
    return await get_projects()


@router.post("/create")
async def create_project(project: ProjectCreate):
    try:
        return create_project_record(project)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to create project",
                "error": str(exc),
            },
        )


@legacy_router.post("/create")
async def create_project_legacy(project: ProjectCreate):
    return await create_project(project)


@router.put("/{project_id}")
async def update_project(project_id: str, project: ProjectUpdate):
    try:
        if projects_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        update_data = {k: v for k, v in project.model_dump().items() if v is not None}
        if not update_data:
            return JSONResponse(status_code=400, content={"success": False, "message": "No fields to update"})

        update_data["updatedAt"] = datetime.utcnow().isoformat()
        result = projects_collection.update_one({"_id": ObjectId(project_id)}, {"$set": update_data})

        if result.matched_count == 0:
            return JSONResponse(status_code=404, content={"success": False, "message": "Project not found"})

        updated = projects_collection.find_one({"_id": ObjectId(project_id)})
        return {"success": True, "message": "Project updated", "data": serialize_project(updated)}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": "Failed to update project", "error": str(exc)})


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    try:
        if projects_collection is None:
            return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

        result = projects_collection.delete_one({"_id": ObjectId(project_id)})
        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"success": False, "message": "Project not found"})

        return {"success": True, "message": "Project deleted"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": "Failed to delete project", "error": str(exc)})
