import os
from datetime import datetime
from typing import Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.database import documents_collection, users_collection
from app.core.jwt_auth import TokenPayload, get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.path.join("uploads", "documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_STATUSES = {"Pending For Review", "Approved", "Rejected", "Expired"}


def serialize_document(document: dict) -> dict:
    uploaded_at = document.get("uploaded_at")
    if isinstance(uploaded_at, datetime):
        uploaded_at = uploaded_at.isoformat()

    return {
        "id": str(document.get("_id", "")),
        "employee_id": document.get("employee_id", ""),
        "employee_name": document.get("employee_name", ""),
        "email": document.get("email", ""),
        "document_type": document.get("document_type", ""),
        "file_name": document.get("file_name", ""),
        "file_url": document.get("file_url", ""),
        "status": document.get("status", "Pending For Review"),
        "expiry_date": document.get("expiry_date") or "-",
        "uploaded_at": uploaded_at,
    }


def ensure_collection():
    if documents_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not connected",
        )


def get_current_user_document_filters(current_user: TokenPayload) -> list[dict]:
    filters: list[dict] = [
        {
            "$and": [
                {"user_id": current_user.sub},
                {
                    "$or": [
                        {"upload_source": "profile"},
                        {"upload_source": {"$exists": False}},
                    ],
                },
            ],
        }
    ]

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

    emails = set()
    employee_ids = {current_user.sub}
    if user:
        if user.get("email"):
            emails.add(str(user["email"]).strip().lower())
        for key in ("employeeId", "employee_id", "id"):
            if user.get(key):
                employee_ids.add(str(user[key]).strip())

    if emails:
        filters.append({"upload_source": "hr_documents", "email": {"$in": list(emails)}})
    if employee_ids:
        filters.append({"upload_source": "hr_documents", "employee_id": {"$in": list(employee_ids)}})

    return filters


@router.post("")
async def upload_document(
    employee_id: str = Form(...),
    employee_name: str = Form(...),
    email: str = Form(...),
    document_type: str = Form(...),
    expiry_date: str = Form("-"),
    upload_source: str = Form("profile"),
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    ensure_collection()

    original_name = file.filename or "document"
    file_ext = os.path.splitext(original_name)[1]
    stored_file_name = f"{uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_file_name)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    document = {
        "user_id": current_user.sub,
        "employee_id": employee_id.strip(),
        "employee_name": employee_name.strip(),
        "email": email.strip().lower(),
        "document_type": document_type.strip(),
        "file_name": original_name,
        "stored_file_name": stored_file_name,
        "file_path": file_path,
        "file_url": f"/api/documents/{stored_file_name}/download",
        "status": "Pending For Review",
        "expiry_date": expiry_date.strip() or "-",
        "upload_source": upload_source.strip() or "profile",
        "uploaded_at": datetime.utcnow(),
    }

    result = documents_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_document(document)


@router.get("")
def get_documents():
    ensure_collection()
    documents = documents_collection.find().sort("uploaded_at", -1)
    return [serialize_document(document) for document in documents]


@router.get("/my")
def get_my_documents(current_user: TokenPayload = Depends(get_current_user)):
    ensure_collection()
    documents = documents_collection.find({"$or": get_current_user_document_filters(current_user)}).sort("uploaded_at", -1)
    return [serialize_document(document) for document in documents]


@router.patch("/{document_id}/status")
def update_document_status(document_id: str, status_value: str = Form(...)):
    ensure_collection()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document id")

    if status_value not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = documents_collection.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {"status": status_value}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    document = documents_collection.find_one({"_id": ObjectId(document_id)})
    return serialize_document(document)


@router.patch("/{document_id}")
def update_document(
    document_id: str,
    employee_id: Optional[str] = Form(None),
    employee_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    document_type: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    status_value: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    ensure_collection()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document id")

    updates = {}
    if employee_id is not None:
        updates["employee_id"] = employee_id.strip()
    if employee_name is not None:
        updates["employee_name"] = employee_name.strip()
    if email is not None:
        updates["email"] = email.strip().lower()
    if document_type is not None:
        updates["document_type"] = document_type.strip()
    if expiry_date is not None:
        updates["expiry_date"] = expiry_date.strip() or "-"
    if status_value is not None:
        if status_value not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        updates["status"] = status_value
    if file is not None:
        existing_document = documents_collection.find_one({"_id": ObjectId(document_id)})
        if not existing_document:
            raise HTTPException(status_code=404, detail="Document not found")

        old_file_path = existing_document.get("file_path")
        if old_file_path and os.path.exists(old_file_path):
            os.remove(old_file_path)

        original_name = file.filename or "document"
        file_ext = os.path.splitext(original_name)[1]
        stored_file_name = f"{uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, stored_file_name)

        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())

        updates["file_name"] = original_name
        updates["stored_file_name"] = stored_file_name
        updates["file_path"] = file_path
        updates["file_url"] = f"/api/documents/{stored_file_name}/download"
        updates["uploaded_at"] = datetime.utcnow()
        updates["status"] = "Pending For Review"

    if not updates:
        raise HTTPException(status_code=400, detail="No update fields provided")

    result = documents_collection.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": updates},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    document = documents_collection.find_one({"_id": ObjectId(document_id)})
    return serialize_document(document)


@router.delete("/{document_id}")
def delete_document(document_id: str):
    ensure_collection()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document id")

    document = documents_collection.find_one({"_id": ObjectId(document_id)})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    documents_collection.delete_one({"_id": ObjectId(document_id)})
    return {"message": "Document deleted successfully"}


@router.get("/{file_name}/download")
def download_document(file_name: str):
    file_path = os.path.join(UPLOAD_DIR, file_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)
