import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.ai import TextFixRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/fix_description")
async def fix_description(req: TextFixRequest):
    try:
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "GEMINI_API_KEY is not set in the backend environment.",
                },
            )

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "Fix the grammar and spelling of the following job description text. "
            "If it is in Hindi, translate it to professional English. "
            "Do not add commentary or markdown, only return the corrected text:\n\n"
            f"{req.text}"
        )

        response = model.generate_content(prompt)
        return {"success": True, "fixed_text": response.text.strip()}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": str(exc)})
