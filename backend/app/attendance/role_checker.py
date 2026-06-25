from fastapi import Depends, HTTPException
from app.attendance.auth import verify_token

def admin_only(user=Depends(verify_token)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin Access Required")
    return user

def hr_or_admin(user=Depends(verify_token)):
    if user["role"] not in ["admin", "hr"]:
        raise HTTPException(status_code=403, detail="HR/Admin Access Required")
    return user
