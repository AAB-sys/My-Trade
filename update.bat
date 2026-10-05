@echo off
setlocal
cd /d "%~dp0"
echo Fetching the latest My-Trade from GitHub...
echo.
git pull origin main
if errorlevel 1 (
    echo.
    echo The update did not go through. Read the lines above: if they mention "local changes" or a conflict, tell Claude exactly what they say.
) else (
    echo.
    echo Done. This folder now matches GitHub. Run start.bat as usual.
)
echo.
pause
