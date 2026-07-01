from fastapi import APIRouter
from app.services.email_service import send_interview_link

router = APIRouter()

@router.get("/test-email")
async def test_email():
    await send_interview_link(
        candidate_email="sahilsher931@gmail.com",
        candidate_name="Sahil",
        interview_link="https://meet.google.com/test-link"
    )

    return {"message": "Email sent"}