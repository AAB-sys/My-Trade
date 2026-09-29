@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :fail
    echo Installing dependencies...
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :fail
)

set "HOST=127.0.0.1"
set "PORT=8000"
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="HOST" set "HOST=%%b"
    if /i "%%a"=="PORT" set "PORT=%%b"
)

netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if not errorlevel 1 (
    echo Something is already running on port %PORT% - probably another My-Trade window.
    echo Close that window first, then run start.bat again.
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"

start "" /b cmd /c "timeout /t 3 /nobreak >nul & start "" http://127.0.0.1:%PORT%/"

echo Starting My-Trade on http://127.0.0.1:%PORT%/  (press Ctrl+C to stop)
if "%HOST%"=="0.0.0.0" (
    echo.
    echo Other devices on this network can open it at one of these addresses, followed by :%PORT%/
    ipconfig | findstr /c:"IPv4"
    echo If Windows asks whether to let Python through the firewall, allow it on private networks.
    echo.
)
python -m uvicorn main:app --host %HOST% --port %PORT%
goto :eof

:fail
echo.
echo Setup failed. Check that Python is installed and on your PATH.
pause
