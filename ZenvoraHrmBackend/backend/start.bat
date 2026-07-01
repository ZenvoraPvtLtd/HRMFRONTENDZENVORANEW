@echo off
echo Starting Zenvora HRM Backend on all network interfaces...
echo Backend will be accessible at:
echo   Desktop : http://localhost:8000
echo   Network : http://192.168.1.48:8000
echo.
cd /d "%~dp0"
call ..\.venv\Scripts\activate.bat 2>nul || call .venv\Scripts\activate.bat 2>nul
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
