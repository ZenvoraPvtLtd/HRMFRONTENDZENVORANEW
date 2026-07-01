import os
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient
from app.utils.pdf_documents import create_shortlist_report_pdf, public_upload_url

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/candidates", tags=["candidates"])

from app.core.database import db

if db is not None:
    candidates_col = db["candidates"]
    applications_col = db["applications"]
else:
    candidates_col = None
    applications_col = None


class CandidateShortlist(BaseModel):
    candidate_id: str = Field(..., min_length=1)
    candidate_name: str = Field(..., min_length=2)
    candidate_phone: str = Field(..., min_length=5)
    candidate_email: str = Field(..., min_length=5)
    position: str = Field(..., min_length=2)
    reason: Optional[str] = None
    round_number: int = Field(default=1)


def _db_check():
    if candidates_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _build_shortlist_next_round(round_number: int) -> str:
    return {
        1: "Technical Interview",
        2: "Managerial Interview",
        3: "HR Interview",
    }.get(round_number, f"Round {round_number}")


def _send_shortlist_notification(candidate: dict):
    """Send WhatsApp notification when candidate is shortlisted"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    candidate_name = candidate.get("candidate_name", "Candidate")
    candidate_phone = candidate.get("candidate_phone")
    position = candidate.get("position", "")
    round_number = candidate.get("round_number", 1)
    
    if not candidate_phone:
        return
    
    try:
        whatsapp_service.queue_message(
            recipient_name=candidate_name,
            phone=candidate_phone,
            notification_type="candidate_shortlisting",
            template_data={
                "position": position,
                "next_round": _build_shortlist_next_round(round_number),
                "date": candidate.get("scheduled_at", "TBD") or "TBD",
            }
        )
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue candidate shortlist notification: {e}")


def _send_hr_shortlist_report(hr_phone: str, candidates_summary: str, report_url: Optional[str] = None):
    """Send HR a summary report of shortlisted candidates"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    if not hr_phone:
        return
    
    try:
        whatsapp_service.queue_message(
            recipient_name="HR Team",
            phone=hr_phone,
            notification_type="employee_announcements",
            template_data={
                "title": "Shortlist Report",
                "content": candidates_summary
            }
        )
        if report_url:
            whatsapp_service.send_media_message(
                phone=hr_phone,
                media_url=report_url,
                caption="Candidate shortlisting report PDF"
            )
    except Exception as e:
        print(f"[WHATSAPP] Failed to send HR shortlist report: {e}")


@router.post("/shortlist")
async def shortlist_candidate(candidate: CandidateShortlist):
    _db_check()
    
    try:
        candidate_dict = candidate.model_dump()
        candidate_dict["created_at"] = datetime.utcnow().isoformat()
        candidate_dict["status"] = "shortlisted"
        
        result = candidates_col.insert_one(candidate_dict)
        candidate_dict["_id"] = str(result.inserted_id)
        
        # Send WhatsApp notification to candidate
        _send_shortlist_notification(candidate_dict)
        
        return {
            "success": True,
            "message": "Candidate shortlisted successfully",
            "data": candidate_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to shortlist candidate: {str(exc)}")


@router.get("/all")
async def get_all_candidates(
    position: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        query = {}
        if position:
            query["position"] = position
        if status:
            query["status"] = status
        
        candidates = []
        for doc in candidates_col.find(query).sort("created_at", -1).limit(limit):
            doc["_id"] = str(doc["_id"])
            candidates.append(doc)
        
        return {"success": True, "data": candidates}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidates: {str(exc)}")


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str):
    _db_check()
    
    try:
        oid = ObjectId(candidate_id)
        candidate = candidates_col.find_one({"_id": oid})
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        candidate["_id"] = str(candidate["_id"])
        return {"success": True, "data": candidate}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidate: {str(exc)}")


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: str,
    status: str = Query(...),
    feedback: Optional[str] = Query(None),
    job_title: Optional[str] = Query(None, description="Job title for rejection email"),
    authorization: Optional[str] = Header(default=None),
):
    print("Status endpoint called")
    print(db.list_collection_names())
    _db_check()

    try:
        oid = ObjectId(candidate_id)

        updates = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if feedback:
            updates["feedback"] = feedback

        # Try both collections — candidates_col (shortlisted) and applications_col
        updated = None
        print("Database:", db.name)
        print("Candidates collection:", candidates_col.name)
        print("Applications collection:", applications_col.name)
        for col in [candidates_col, applications_col]:
            print("Checking collection:", col.name)
            doc = col.find_one({"_id": oid})
            print("Found:", doc)
            if col is None:
                continue
            result = col.update_one({"_id": oid}, {"$set": updates})
            if result.matched_count > 0:
                doc = col.find_one({"_id": oid})
                if doc:
                    doc["_id"] = str(doc["_id"])
                    updated = doc
                break

        if updated is None:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # ── Schedule rejection email 3 days later ─────────────────────────
        if status.lower() == "rejected":
            candidate_email = (
                updated.get("email") or
                updated.get("candidate_email") or
                ""
            )
            candidate_name = (
                updated.get("name") or
                updated.get("candidate_name") or
                f"{updated.get('firstName', '')} {updated.get('lastName', '')}".strip() or
                "Candidate"
            )
            position = (
                job_title or
                updated.get("role") or
                updated.get("jobTitle") or
                updated.get("position") or
                "the applied position"
            )

            if candidate_email:
                async def _send_rejection_after_delay(
                    _email: str, _name: str, _position: str
                ):
                    await asyncio.sleep(3 * 24 * 60 * 60)   # 3 days
                    try:
                        from app.services.email_service import send_rejection_email
                        await send_rejection_email(
                            candidate_email=_email,
                            candidate_name=_name,
                            job_title=_position,
                        )
                        print(f"[EMAIL] ✅ Rejection email sent (after 3 days) to {_email}")
                    except Exception as exc:
                        import traceback
                        print(f"[EMAIL] ❌ Rejection email failed for {_email}: {exc}")
                        traceback.print_exc()

                asyncio.create_task(
                    _send_rejection_after_delay(candidate_email, candidate_name, position)
                )
                print(
                    f"[SCHEDULER] ⏰ Rejection email scheduled for 3 days later → {candidate_email}"
                )
            else:
                print(f"[SCHEDULER] ⚠️ No email found for candidate {candidate_id} — rejection email skipped")

        return {
            "success": True,
            "message": "Candidate status updated successfully",
            "data": updated,
            "rejection_email_scheduled": status.lower() == "rejected",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update candidate: {str(exc)}")


@router.post("/report/send-hr-shortlist")
async def send_hr_shortlist_report(
    position: Optional[str] = Query(None),
    hr_phone: str = Query(...),
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        query = {"status": "shortlisted"}
        if position:
            query["position"] = position
        
        shortlisted = list(candidates_col.find(query).sort("created_at", -1).limit(50))
        
        if not shortlisted:
            return {
                "success": False,
                "message": "No shortlisted candidates found"
            }
        
        report_lines = ["📋 SHORTLIST REPORT\n"]
        if position:
            report_lines.append(f"Position: {position}\n")
        report_lines.append(f"Total Shortlisted: {len(shortlisted)}\n")
        report_lines.append("---\n")
        
        for idx, cand in enumerate(shortlisted, 1):
            report_lines.append(f"{idx}. {cand.get('candidate_name', 'N/A')}")
            report_lines.append(f"   Email: {cand.get('candidate_email', 'N/A')}")
            report_lines.append(f"   Round: {cand.get('round_number', 1)}\n")
        
        candidates_summary = "".join(report_lines)
        report_path = create_shortlist_report_pdf(position, shortlisted)
        report_url = public_upload_url(report_path)
        _send_hr_shortlist_report(hr_phone, candidates_summary, report_url)
        
        return {
            "success": True,
            "message": "Shortlist report sent to HR via WhatsApp",
            "report_count": len(shortlisted),
            "report_url": report_url
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send shortlist report: {str(exc)}")
