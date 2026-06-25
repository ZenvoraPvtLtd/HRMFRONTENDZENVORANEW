"""
Profile API router for FastAPI.
Implements GET and PUT endpoints for user profile management.

Endpoints:
- GET /api/profile/me - Get current user's profile
- PUT /api/profile/me - Update current user's profile
"""

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.jwt_auth import get_current_user, TokenPayload
from app.services.profile_service import ProfileService
from app.schemas.profile import ProfileUpdateRequest, ProfileResponseWrapper
from app.core.database import db, users_collection
from app.utils.onboarding_checklist import (
    checklist_stats,
    merge_checklist,
    update_checklist_item,
)
from pydantic import BaseModel


class OnboardingTaskStatusPayload(BaseModel):
    status: str

# Create router with prefix and tags
router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/me", response_model=ProfileResponseWrapper)
async def get_profile(current_user: TokenPayload = Depends(get_current_user)):
    """
    GET /api/profile/me
    
    Retrieve the current logged-in user's profile.
    
    - Extracts user ID from JWT token
    - Fetches user profile from MongoDB
    - Returns profile with role-specific fields
    
    **Authentication Required:** JWT Bearer token in Authorization header
    
    **Response:**
    - 200 OK: User profile returned successfully
    - 401 Unauthorized: Invalid or missing authentication token
    - 404 Not Found: User profile not found in database
    
    **Example Response:**
    ```json
    {
        "success": true,
        "user": {
            "_id": "507f1f77bcf86cd799439011",
            "name": "John Doe",
            "email": "john@example.com",
            "phoneNumber": "9999999999",
            "role": "employee",
            "provider": "local",
            "avatar": "https://example.com/avatar.jpg",
            "employeeId": "EMP001",
            "department": "Engineering",
            "designation": "Senior Developer",
            "managerName": "Jane Manager",
            "joiningDate": "2022-01-10",
            "createdAt": "2022-01-10T00:00:00Z",
            "updatedAt": "2025-01-15T10:30:00Z"
        }
    }
    ```
    """
    try:
        # Get user ID from JWT token
        user_id = current_user.sub
        
        # Fetch user profile from MongoDB
        user = ProfileService.get_profile_by_id(user_id)
        
        # Return 404 if user not found
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        # Format profile response based on role-specific fields
        formatted_profile = ProfileService.format_profile_response(user)
        
        # Return success response
        return {
            "success": True,
            "user": formatted_profile
        }
        
    except ValueError as e:
        # Invalid user ID format
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid user ID: {str(e)}"
        )
    except Exception as e:
        # Database or unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {str(e)}"
        )


@router.put("/me", response_model=ProfileResponseWrapper)
async def update_profile(
    update_data: ProfileUpdateRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    PUT /api/profile/me
    
    Update the current user's profile.
    
    - Only allows updating name and phoneNumber
    - Other fields are read-only (role, employeeId, department, etc.)
    - Automatically updates the updatedAt timestamp
    
    **Editable Fields:**
    - `name`: User's full name (string, 1-255 characters)
    - `phoneNumber`: Contact phone number (string, optional)
    
    **Read-only Fields:**
    - role, employeeId, department, designation, joiningDate, provider, etc.
    
    **Authentication Required:** JWT Bearer token in Authorization header
    
    **Request Body:**
    ```json
    {
        "name": "Jane Doe",
        "phoneNumber": "+1-800-555-0000"
    }
    ```
    
    **Response:**
    - 200 OK: Profile updated successfully
    - 401 Unauthorized: Invalid or missing authentication token
    - 404 Not Found: User profile not found in database
    - 422 Unprocessable Entity: Invalid request data
    
    **Example Response:**
    ```json
    {
        "success": true,
        "user": {
            "_id": "507f1f77bcf86cd799439011",
            "name": "Jane Doe",
            "email": "john@example.com",
            "phoneNumber": "+1-800-555-0000",
            "role": "employee",
            "provider": "local",
            "avatar": "https://example.com/avatar.jpg",
            "employeeId": "EMP001",
            "department": "Engineering",
            "designation": "Senior Developer",
            "managerName": "Jane Manager",
            "joiningDate": "2022-01-10",
            "createdAt": "2022-01-10T00:00:00Z",
            "updatedAt": "2025-01-16T14:45:30Z"
        }
    }
    ```
    """
    try:
        # Get user ID from JWT token
        user_id = current_user.sub
        
        # Convert request to dictionary
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # Update user profile in MongoDB
        # Only editable fields (name, phoneNumber) are allowed by service layer
        updated_user = ProfileService.update_profile(user_id, update_dict)
        
        # Return 404 if user not found
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        # Format profile response based on role-specific fields
        formatted_profile = ProfileService.format_profile_response(updated_user)
        
        # Return success response with updated profile
        return {
            "success": True,
            "user": formatted_profile
        }
        
    except ValueError as e:
        # Invalid user ID or update data
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request: {str(e)}"
        )
    except Exception as e:
        # Database or unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )


def _find_profile_checklist_record(user_id: str):
    user = ProfileService.get_profile_by_id(user_id)
    if not user:
        return None, None

    employees_col = db["employees_list"] if db is not None else None
    employee_doc = None

    if employees_col is not None:
        email = str(user.get("email") or "").lower().strip()
        if email:
            employee_doc = employees_col.find_one({"email": email})
        if not employee_doc and user.get("employeeId"):
            employee_doc = employees_col.find_one({"employeeId": user.get("employeeId")})

    checklist_source = employee_doc or user
    checklist = merge_checklist(checklist_source.get("onboardingChecklist"))
    return user, {
        "doc": employee_doc or user,
        "collection": employees_col if employee_doc else None,
        "checklist": checklist,
    }


@router.get("/me/onboarding-checklist")
async def get_my_onboarding_checklist(current_user: TokenPayload = Depends(get_current_user)):
    user, context = _find_profile_checklist_record(current_user.sub)
    if not user or not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    checklist = context["checklist"]
    stats = checklist_stats(checklist)
    return {
        "name": user.get("fullName") or user.get("name") or "",
        "email": user.get("email") or "",
        "checklist": checklist,
        "stats": stats,
    }


@router.patch("/me/onboarding-checklist/{task_id}")
async def update_my_onboarding_task(
    task_id: str,
    payload: OnboardingTaskStatusPayload,
    current_user: TokenPayload = Depends(get_current_user),
):
    user, context = _find_profile_checklist_record(current_user.sub)
    if not user or not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    try:
        updated_checklist = update_checklist_item(context["checklist"], task_id, payload.status.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    completed_count = sum(1 for item in updated_checklist if item.get("status") == "Completed")
    onboarding_status = "Completed" if completed_count == len(updated_checklist) else "In Progress"
    update_payload = {
        "onboardingChecklist": updated_checklist,
        "onboardingStatus": onboarding_status,
        "updatedAt": datetime.utcnow().isoformat(),
    }

    if context["collection"] is not None and context["doc"].get("_id"):
        context["collection"].update_one({"_id": context["doc"]["_id"]}, {"$set": update_payload})

    if users_collection is not None:
        user_filter = {"_id": ObjectId(current_user.sub)} if ObjectId.is_valid(current_user.sub) else {"email": user.get("email")}
        users_collection.update_one(user_filter, {"$set": update_payload})

    stats = checklist_stats(updated_checklist)
    return {
        "message": "Onboarding task updated",
        "checklist": updated_checklist,
        "stats": stats,
        "onboardingStatus": onboarding_status,
    }
        
