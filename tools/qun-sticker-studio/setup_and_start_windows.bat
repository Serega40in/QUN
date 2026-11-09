@echo off
setlocal
cd /d "%~dp0"
title QUN Sticker Studio - Setup

echo.
echo  QUN Sticker Studio
echo  This helper checks Python, installs it only after confirmation,
echo  and then starts the local browser Studio.
echo.

where py >nul 2>nul
if not errorlevel 1 (
    py -3 --version >nul 2>nul
    if not errorlevel 1 goto launch
)
where python >nul 2>nul
if not errorlevel 1 (
    python --version >nul 2>nul
    if not errorlevel 1 goto launch
)

where winget >nul 2>nul
if errorlevel 1 goto manual

echo Python 3 was not found. The Studio needs Python 3.10 or newer.
choice /C YN /M "Install Python 3.12 from the official Python package via winget"
if errorlevel 2 goto manual

winget install --id Python.Python.3.12 --exact --scope user --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto manual

set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%LOCALAPPDATA%\Programs\Python\Launcher;%PATH%"
where py >nul 2>nul
if errorlevel 1 (
    where python >nul 2>nul
    if errorlevel 1 goto manual
)

:launch
call "%~dp0start_windows.bat"
goto end

:manual
echo.
echo Automatic installation was unavailable or declined.
echo Install Python 3.10 or newer from:
echo https://www.python.org/downloads/windows/
echo During installation enable "Add python.exe to PATH".
echo Then double-click setup_and_start_windows.bat again.
start "" "https://www.python.org/downloads/windows/"
pause

:end
endlocal
