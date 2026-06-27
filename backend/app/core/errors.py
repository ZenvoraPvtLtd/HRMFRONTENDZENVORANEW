from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from fastapi import Request
from fastapi.responses import JSONResponse


@dataclass
class ApiException(Exception):
    status_code: int
    payload: Dict[str, Any]


def api_exception_handler(_request: Request, exc: ApiException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.payload)

