import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Header, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import db
from app.core.jwt_auth import get_current_user, TokenPayload

from app.core.database import db

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ContactPayload(BaseModel):
    contact_id: str
    name: str
    initials: str
    role: str
    avatar_color: Optional[str] = "#111827"
    is_online: Optional[bool] = True


class MessagePayload(BaseModel):
    text: str
    attachment_name: Optional[str] = None


def get_contacts_col():
    if db is None:
        return None
    return db["chat_contacts"]


def get_messages_col():
    if db is None:
        return None
    return db["chat_messages"]


@router.post("/contacts")
def upsert_contact(contact: ContactPayload):
    col = get_contacts_col()
    if col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
    
    data = contact.model_dump()
    col.update_one({"contact_id": contact.contact_id}, {"$set": data}, upsert=True)
    return data


@router.get("/contacts")
def get_contacts(current_user: TokenPayload = Depends(get_current_user)):
    contacts_col = get_contacts_col()
    messages_col = get_messages_col()
    
    if contacts_col is None or messages_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
        
    current_user_id = str(current_user.sub)
    
    # Auto-discover and sync with users collection
    if db is not None:
        try:
            all_users = list(db["users"].find({}))
            user_ids = []
            for u in all_users:
                u_id = str(u["_id"])
                user_ids.append(u_id)
                name = u.get("fullName") or u.get("name") or "Employee"
                role = u.get("role", "employee")
                initials = "".join([part[0] for part in name.split() if part]).upper()[:2] or "E"
                email = u.get("email", "")
                employee_id = u.get("employeeId", "")
                username = u.get("username", "")
                
                contacts_col.update_one(
                    {"contact_id": u_id},
                    {"$set": {
                        "contact_id": u_id,
                        "name": name,
                        "initials": initials,
                        "role": role,
                        "email": email,
                        "employee_id": employee_id,
                        "username": username,
                        "avatar_color": "#2563eb" if role == "employee" else "#111827",
                        "is_online": True
                    }},
                    upsert=True
                )
            # Delete stale contacts that do not exist in the users collection
            contacts_col.delete_many({"contact_id": {"$nin": user_ids}})
        except Exception as e:
            print(f"[CHAT] Auto-discover users failed: {e}")

    contacts = list(contacts_col.find({}))
    result = []
    
    for contact in contacts:
        contact_id = contact.get("contact_id")
        if contact_id == current_user_id:
            continue
            
        # Find last message
        last_msg = messages_col.find_one(
            {"$or": [
                {"sender_id": current_user_id, "receiver_id": contact_id},
                {"sender_id": contact_id, "receiver_id": current_user_id}
            ]},
            sort=[("created_at", -1)]
        )
        
        if last_msg:
            contact["last_message"] = last_msg.get("text") or "Attachment"
            contact["last_message_at"] = last_msg.get("created_at")
        else:
            contact["last_message"] = "Ready to chat"
            contact["last_message_at"] = None

        # Count unread messages
        unread_count = messages_col.count_documents({
            "sender_id": contact_id,
            "receiver_id": current_user_id,
            "is_read": False
        })
        
        contact["unread_count"] = unread_count
        contact["_id"] = str(contact["_id"])
        result.append(contact)
        
    return result


@router.get("/threads/{contact_id}/messages")
def get_messages(contact_id: str, current_user: TokenPayload = Depends(get_current_user)):
    messages_col = get_messages_col()
    if messages_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
        
    current_user_id = str(current_user.sub)
    
    messages = list(messages_col.find({
        "$or": [
            {"sender_id": current_user_id, "receiver_id": contact_id},
            {"sender_id": contact_id, "receiver_id": current_user_id}
        ]
    }).sort("created_at", 1))
    
    for m in messages:
        m["_id"] = str(m["_id"])
        m["id"] = m["_id"]
        
    return messages


@router.post("/threads/{contact_id}/messages")
def send_message(contact_id: str, payload: MessagePayload, current_user: TokenPayload = Depends(get_current_user)):
    messages_col = get_messages_col()
    if messages_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
        
    current_user_id = str(current_user.sub)
    
    msg = {
        "sender_id": current_user_id,
        "receiver_id": contact_id,
        "text": payload.text,
        "attachment_name": payload.attachment_name,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    }
    
    res = messages_col.insert_one(msg)
    msg["_id"] = str(res.inserted_id)
    msg["id"] = msg["_id"]
    return msg


@router.patch("/threads/{contact_id}/read")
def mark_read(contact_id: str, current_user: TokenPayload = Depends(get_current_user)):
    messages_col = get_messages_col()
    if messages_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
        
    current_user_id = str(current_user.sub)
    
    messages_col.update_many(
        {"sender_id": contact_id, "receiver_id": current_user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"success": True}


@router.delete("/threads/{contact_id}/messages")
def clear_thread(contact_id: str, current_user: TokenPayload = Depends(get_current_user)):
    messages_col = get_messages_col()
    if messages_col is None:
        return JSONResponse(status_code=503, content={"message": "Database offline"})
        
    current_user_id = str(current_user.sub)
    
    messages_col.delete_many({
        "$or": [
            {"sender_id": current_user_id, "receiver_id": contact_id},
            {"sender_id": contact_id, "receiver_id": current_user_id}
        ]
    })
    return {"success": True}
