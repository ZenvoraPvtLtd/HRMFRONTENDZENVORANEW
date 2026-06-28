import re
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo import ReturnDocument
from pydantic import BaseModel

from app.core.database import performance_reviews_collection, users_collection
from app.core.jwt_auth import TokenPayload, get_current_user

router = APIRouter(prefix="/api/performance-reviews", tags=["performance-reviews"])


class PerformanceReviewPayload(BaseModel):
    employeeId: str
    employeeName: Optional[str] = ""
    reviewType: str
    period: str
    rating: Optional[str] = "-"
    status: Optional[str] = "Draft"
    notes: Optional[str] = None


def serialize_review(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id") or doc.get("id")),
        "employeeId": doc.get("employeeId", ""),
        "employeeName": doc.get("employeeName") or doc.get("employee_name", ""),
        "reviewType": doc.get("reviewType", ""),
        "period": doc.get("period", ""),
        "rating": doc.get("rating", "-"),
        "status": doc.get("status", "Draft"),
        "notes": doc.get("notes"),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


def get_current_user_review_filters(current_user: TokenPayload) -> list[dict]:
    user = None
    if users_collection is not None:
        if ObjectId.is_valid(current_user.sub):
            user = users_collection.find_one({"_id": ObjectId(current_user.sub)})
        if not user:
            user = users_collection.find_one(
                {
                    "$or": [
                        {"email": current_user.sub.lower()},
                        {"employeeId": current_user.sub},
                        {"employee_id": current_user.sub},
                        {"id": current_user.sub},
                    ]
                }
            )

    employee_ids = {current_user.sub}
    emails = set()
    names = set()
    if user:
        if user.get("email"):
            emails.add(str(user["email"]).strip().lower())
        for key in ("fullName", "name"):
            if user.get(key):
                names.add(str(user[key]).strip())
        for key in ("employeeId", "employee_id", "id"):
            if user.get(key):
                employee_ids.add(str(user[key]).strip())

    filters = [{"employeeId": {"$in": list(employee_ids)}}]
    if emails:
        filters.append({"employeeEmail": {"$in": list(emails)}})
    for name in names:
        if name:
            filters.append({"employeeName": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})

    return filters


def _get_employee_email(employee_id: str, employee_name: str) -> Optional[str]:
    if users_collection is None:
        return None
    try:
        emp = None
        if employee_id:
            emp = users_collection.find_one({"employeeId": employee_id})
            if not emp:
                emp = users_collection.find_one({"employee_id": employee_id})
        if not emp and employee_name:
            emp = users_collection.find_one({"fullName": employee_name})
            if not emp:
                emp = users_collection.find_one({"name": employee_name})
        if emp:
            return emp.get("email")
    except Exception:
        pass
    return None


def migrate_performance_reviews():
    if performance_reviews_collection is None or users_collection is None:
        return
    try:
        reviews = list(performance_reviews_collection.find({"employeeEmail": {"$exists": False}}))
        for review in reviews:
            emp_id = review.get("employeeId")
            emp_name = review.get("employeeName") or review.get("employee_name")
            email = _get_employee_email(emp_id, emp_name)
            if email:
                performance_reviews_collection.update_one(
                    {"_id": review["_id"]},
                    {"$set": {"employeeEmail": email.strip().lower()}}
                )
    except Exception as e:
        print(f"[PERFORMANCE] Migration failed: {e}")


@router.get("")
def get_performance_reviews():
    try:
        if performance_reviews_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})

        migrate_performance_reviews()

        reviews = [
            serialize_review(review)
            for review in performance_reviews_collection.find({}).sort("createdAt", -1)
        ]
        return {"reviews": reviews}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("")
def create_performance_review(payload: PerformanceReviewPayload):
    try:
        if performance_reviews_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})

        data = payload.model_dump()
        data["createdAt"] = datetime.utcnow().isoformat()

        email = _get_employee_email(payload.employeeId, payload.employeeName)
        if email:
            data["employeeEmail"] = email.strip().lower()

        result = performance_reviews_collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        data["id"] = data["_id"]

        return {
            "review": data,
            "message": "Performance review created successfully",
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.put("/{review_id}")
def update_performance_review(review_id: str, payload: PerformanceReviewPayload):
    try:
        if performance_reviews_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})

        if not ObjectId.is_valid(review_id):
            return JSONResponse(status_code=400, content={"message": "Invalid review id"})

        data = payload.model_dump()
        data["updatedAt"] = datetime.utcnow().isoformat()

        email = _get_employee_email(payload.employeeId, payload.employeeName)
        if email:
            data["employeeEmail"] = email.strip().lower()

        result = performance_reviews_collection.find_one_and_update(
            {"_id": ObjectId(review_id)},
            {"$set": data},
            return_document=ReturnDocument.AFTER,
        )

        if not result:
            return JSONResponse(status_code=404, content={"message": "Review not found"})

        return {
            "review": serialize_review(result),
            "message": "Performance review updated",
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.delete("/{review_id}")
def delete_performance_review(review_id: str):
    try:
        if performance_reviews_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})

        if not ObjectId.is_valid(review_id):
            return JSONResponse(status_code=400, content={"message": "Invalid review id"})

        result = performance_reviews_collection.delete_one({"_id": ObjectId(review_id)})

        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"message": "Review not found"})

        return {"message": "Performance review deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.get("/my")
def get_my_performance_reviews(current_user: TokenPayload = Depends(get_current_user)):
    try:
        if performance_reviews_collection is None:
            return JSONResponse(status_code=503, content={"message": "Database offline"})

        migrate_performance_reviews()

        reviews = [
            serialize_review(review)
            for review in performance_reviews_collection.find(
                {"$or": get_current_user_review_filters(current_user)}
            ).sort("createdAt", -1)
        ]
        return {"reviews": reviews}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
