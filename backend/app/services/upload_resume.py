from __future__ import annotations

import os
import time
import random
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import UploadFile


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_SIZE_BYTES = 5 * 1024 * 1024


def get_upload_dir() -> Path:
    # backend/app/services/... => backend
    root = Path(__file__).resolve().parents[2]
    return root / "uploads" / "resumes"


async def save_resume_upload(upload: UploadFile) -> Dict[str, Any]:
    """
    Port of Multer diskStorage + fileFilter + limits from:
      backend/src/middlewares/upload.middleware.ts
    """
    if not upload.content_type or upload.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Only PDF, DOC, and DOCX files are allowed")

    data = await upload.read()
    if len(data) > MAX_SIZE_BYTES:
        raise ValueError("File too large. Maximum size is 5 MB.")

    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_suffix = f"{int(time.time() * 1000)}-{random.randint(0, int(1e9))}"
    original = upload.filename or "resume"
    ext = os.path.splitext(original)[1] or ""
    filename = f"resume-{unique_suffix}{ext}"
    path = upload_dir / filename

    path.write_bytes(data)

    return {
        "filename": filename,
        "originalname": original,
        "mimetype": upload.content_type,
        "path": str(path),
    }

