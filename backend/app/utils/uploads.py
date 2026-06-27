import os
import shutil

from fastapi import UploadFile

from app.core.config import UPLOAD_DIR


def save_upload_file(upload_file: UploadFile, prefix: str = "") -> str:
    safe_name = os.path.basename(upload_file.filename or "uploaded-file")
    file_path = UPLOAD_DIR / f"{prefix}{safe_name}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return str(file_path)
