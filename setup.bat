@echo off
echo ===========================================
echo  P&ID Blueprint Analyzer - Windows Setup
echo ===========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 16+ from https://nodejs.org
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=v." %%i in ('node -v') do set NODE_MAJOR=%%i
for /f "tokens=2 delims=v." %%i in ('node -v') do set NODE_MAJOR=%%i

echo [OK] Node.js %NODE_VERSION% detected

REM Check if npm is installed
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo [OK] npm detected
echo.

echo Installing dependencies...
call npm install

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    echo.
    echo If you encounter Python/build tool errors, this is likely due to:
    echo - Missing Visual Studio Build Tools
    echo - Missing Python installation
    echo.
    echo The application should still work without native dependencies.
    echo Try running: npm run dev
    pause
    exit /b 1
)

echo [SUCCESS] Setup completed successfully!
echo.
echo Next steps:
echo 1. Run: npm run dev
echo 2. Open: http://localhost:3000
echo 3. Upload P&ID files from the sample-data folder
echo.
echo Press any key to continue...
pause >nul
