@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :fail
    echo Installing dependencies...
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :fail
)

call ".venv\Scripts\activate.bat"

start "" /b cmd /c "timeout /t 3 /nobreak >nul & start "" http://127.0.0.1:8000/"

echo Starting My-Trade on http://127.0.0.1:8000/  (press Ctrl+C to stop)
python -m uvicorn main:app
goto :eof

:fail
echo.
echo Setup failed. Check that Python is installed and on your PATH.
pause
