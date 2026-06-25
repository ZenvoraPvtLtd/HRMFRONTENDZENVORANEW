import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient
from app.utils.pdf_documents import create_offer_letter_pdf, public_upload_url

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/offer-letters", tags=["offer-letters"])

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    _db = _client[DATABASE_NAME]
    offers_col = _db["offer_letters"]
except Exception as e:
    print(f"[OFFER LETTERS] MongoDB connection failed: {e}")
    offers_col = None


class OfferLetter(BaseModel):
    candidate_id: str = Field(..., min_length=1)
    candidate_name: str = Field(..., min_length=2)
    candidate_phone: str = Field(..., min_length=5)
    candidate_email: str = Field(..., min_length=5)
    position: str = Field(..., min_length=2)
    department: str = Field(..., min_length=2)
    salary: float = Field(..., gt=0)
    joining_date: str  # ISO 8601 format
    employment_type: str = Field(default="Full-time")  # Full-time, Part-time, Contract
    deadline_days: int = Field(default=7)
    offer_letter_url: Optional[str] = None  # URL to PDF offer letter


def _db_check():
    if offers_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_offer_notification(offer: dict):
    """Send WhatsApp notification when offer letter is generated with details"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    candidate_name = offer.get("candidate_name", "Candidate")
    candidate_phone = offer.get("candidate_phone")
    position = offer.get("position", "")
    
    if not candidate_phone:
        return
    
    try:
        deadline = datetime.fromisoformat(offer.get("deadline_to_accept", ""))
        deadline_str = deadline.strftime("%Y-%m-%d")
    except:
        deadline_str = "See email for details"
    
    try:
        whatsapp_service.queue_message(
            recipient_name=candidate_name,
            phone=candidate_phone,
            notification_type="offer_letters",
            template_data={
                "position": position,
                "department": offer.get("department", ""),
                "salary": f"{offer.get('salary', 0):.2f}",
                "joining_date": offer.get("joining_date", ""),
                "employment_type": offer.get("employment_type", "Full-time"),
                "deadline": deadline_str
            }
        )
        
        offer_url = offer.get("offer_letter_url")
        if offer_url:
            try:
                whatsapp_service.send_media_message(
                    phone=candidate_phone,
                    media_url=offer_url,
                    caption=f"Your offer letter for {position} position at Zenvora Pvt Ltd"
                )
            except Exception as e:
                print(f"[WHATSAPP] Failed to send offer letter PDF: {e}")
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue offer letter notification: {e}")


@router.post("/generate")
async def generate_offer_letter(offer: OfferLetter):
    _db_check()
    
    try:
        offer_dict = offer.model_dump()
        offer_dict["created_at"] = datetime.utcnow().isoformat()
        offer_dict["status"] = "generated"
        
        # Calculate deadline
        deadline = datetime.utcnow() + timedelta(days=offer.deadline_days)
        offer_dict["deadline_to_accept"] = deadline.isoformat()
        if not offer_dict.get("offer_letter_url"):
            pdf_path = create_offer_letter_pdf(offer_dict)
            offer_dict["offer_letter_url"] = public_upload_url(pdf_path)
        
        result = offers_col.insert_one(offer_dict)
        offer_dict["_id"] = str(result.inserted_id)
        
        # Send WhatsApp notification
        _send_offer_notification(offer_dict)
        
        return {
            "success": True,
            "message": "Offer letter generated successfully",
            "data": offer_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate offer letter: {str(exc)}")


@router.get("/all")
async def get_all_offers(
    status: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        offers = []
        for doc in offers_col.find(query).sort("created_at", -1).limit(limit):
            doc["_id"] = str(doc["_id"])
            offers.append(doc)
        
        return {"success": True, "data": offers}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch offer letters: {str(exc)}")


@router.get("/{offer_id}")
async def get_offer(offer_id: str):
    _db_check()
    
    try:
        oid = ObjectId(offer_id)
        offer = offers_col.find_one({"_id": oid})
        
        if not offer:
            raise HTTPException(status_code=404, detail="Offer letter not found")
        
        offer["_id"] = str(offer["_id"])
        return {"success": True, "data": offer}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch offer letter: {str(exc)}")


@router.patch("/{offer_id}/accept")
async def accept_offer(
    offer_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(offer_id)
        
        updates = {
            "status": "accepted",
            "accepted_at": datetime.utcnow().isoformat()
        }
        
        offers_col.update_one({"_id": oid}, {"$set": updates})
        
        updated = offers_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Offer accepted successfully", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to accept offer: {str(exc)}")


@router.patch("/{offer_id}/reject")
async def reject_offer(
    offer_id: str,
    reason: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        oid = ObjectId(offer_id)
        
        updates = {
            "status": "rejected",
            "rejected_at": datetime.utcnow().isoformat()
        }
        if reason:
            updates["rejection_reason"] = reason
        
        offers_col.update_one({"_id": oid}, {"$set": updates})
        
        updated = offers_col.find_one({"_id": oid})
        updated["_id"] = str(updated["_id"])
        
        return {"success": True, "message": "Offer rejected", "data": updated}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to reject offer: {str(exc)}")
