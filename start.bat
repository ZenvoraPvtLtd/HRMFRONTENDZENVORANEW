@echo off
title Zenvora HRM - Startup
color 0A

echo ============================================
echo   Zenvora HRM - Starting All Services
echo ============================================
echo.

:: ── Backend ──────────────────────────────────
echo [1/2] Starting Backend (FastAPI on port 8000)...
start "Zenvora Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt --quiet && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait 4 seconds for backend to boot before frontend
timeout /t 4 /nobreak >nul

:: ── Frontend ─────────────────────────────────
echo [2/2] Starting Frontend (Vite on port 5173)...
start "Zenvora Frontend" cmd /k "cd /d %~dp0frontend && npm install --silent && npm run dev"

echo.
echo ============================================
echo   Both services are starting in new windows
echo   Backend  -> http://localhost:8000
echo   Frontend -> http://localhost:5173
echo   API Docs -> http://localhost:8000/docs
echo ============================================
echo.
pause
