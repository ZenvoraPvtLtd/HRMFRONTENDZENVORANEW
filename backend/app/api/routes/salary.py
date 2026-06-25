import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import MongoClient
from app.utils.pdf_documents import create_payslip_pdf, public_upload_url

try:
    from app.services.whatsapp_service import whatsapp_service
    WHATSAPP_AVAILABLE = True
except ImportError:
    whatsapp_service = None
    WHATSAPP_AVAILABLE = False

router = APIRouter(prefix="/api/salary", tags=["salary"])

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "zenvora_ai")

try:
    _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    _db = _client[DATABASE_NAME]
    salary_col = _db["salary_slips"]
    employees_col = _db["employees"]
except Exception as e:
    print(f"[SALARY] MongoDB connection failed: {e}")
    salary_col = None
    employees_col = None


class SalarySlip(BaseModel):
    employee_id: str = Field(..., min_length=1)
    employee_name: str = Field(..., min_length=2)
    employee_phone: str = Field(..., min_length=5)
    month: str  # YYYY-MM format
    gross_salary: float = Field(..., gt=0)
    deductions: float = Field(default=0, ge=0)
    net_salary: float = Field(..., gt=0)
    bonus: Optional[float] = None
    details: Optional[dict] = None
    payslip_url: Optional[str] = None  # URL to PDF payslip


def _db_check():
    if salary_col is None:
        raise HTTPException(status_code=503, detail="Database offline")


def _send_salary_notification(salary: dict):
    """Send WhatsApp notification for salary slip with details"""
    if not WHATSAPP_AVAILABLE or not whatsapp_service:
        return
    
    employee_name = salary.get("employee_name", "Employee")
    employee_phone = salary.get("employee_phone")
    
    if not employee_phone:
        return
    
    try:
        whatsapp_service.queue_message(
            recipient_name=employee_name,
            phone=employee_phone,
            notification_type="salary_notifications",
            template_data={
                "month": salary.get("month", ""),
                "gross_salary": f"{salary.get('gross_salary', 0):.2f}",
                "deductions": f"{salary.get('deductions', 0):.2f}",
                "net_salary": f"{salary.get('net_salary', 0):.2f}"
            }
        )
        
        payslip_url = salary.get("payslip_url")
        if payslip_url:
            try:
                whatsapp_service.send_media_message(
                    phone=employee_phone,
                    media_url=payslip_url,
                    caption=f"Your payslip for {salary.get('month', 'this month')}"
                )
            except Exception as e:
                print(f"[WHATSAPP] Failed to send payslip PDF: {e}")
    except Exception as e:
        print(f"[WHATSAPP] Failed to queue salary notification: {e}")


@router.post("/process")
async def process_salary_slip(salary: SalarySlip):
    _db_check()
    
    try:
        salary_dict = salary.model_dump()
        salary_dict["created_at"] = datetime.utcnow().isoformat()
        salary_dict["status"] = "processed"
        if not salary_dict.get("payslip_url"):
            pdf_path = create_payslip_pdf(salary_dict)
            salary_dict["payslip_url"] = public_upload_url(pdf_path)
        
        result = salary_col.insert_one(salary_dict)
        salary_dict["_id"] = str(result.inserted_id)
        
        # Send WhatsApp notification
        _send_salary_notification(salary_dict)
        
        return {
            "success": True,
            "message": "Salary slip processed successfully",
            "data": salary_dict
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process salary slip: {str(exc)}")


@router.get("/slips/{employee_id}")
async def get_salary_slips(
    employee_id: str,
    year: Optional[int] = None,
    month: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    _db_check()
    
    try:
        query = {"employee_id": employee_id}
        
        if month:
            query["month"] = month
        elif year:
            query["month"] = {"$regex": f"^{year}"}
        
        slips = []
        for doc in salary_col.find(query).sort("created_at", -1).limit(100):
            doc["_id"] = str(doc["_id"])
            slips.append(doc)
        
        return {"success": True, "data": slips}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch salary slips: {str(exc)}")


@router.get("/slip/{slip_id}")
async def get_salary_slip(slip_id: str):
    _db_check()
    
    try:
        oid = ObjectId(slip_id)
        slip = salary_col.find_one({"_id": oid})
        
        if not slip:
            raise HTTPException(status_code=404, detail="Salary slip not found")
        
        slip["_id"] = str(slip["_id"])
        return {"success": True, "data": slip}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch salary slip: {str(exc)}")
