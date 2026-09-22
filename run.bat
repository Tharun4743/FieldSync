@echo off
setlocal enabledelayedexpansion

:: Ensure script always executes in its project directory
cd /d "%~dp0"

title FieldSync - Offline-First Collaborative Field Inspection
color 0B

echo ====================================================================
echo    FieldSync - Collaborative Field Inspection Platform
echo ====================================================================
echo.

:: 1. Verify Node.js installation
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js was not found in your PATH.
    echo Please install Node.js v18 or newer from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VERSION=%%i
echo [*] Node.js version : %NODE_VERSION%

:: 2. Verify npm installation
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] npm was not found in your PATH.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v 2^>nul') do set NPM_VERSION=%%i
echo [*] npm version     : %NPM_VERSION%

:: 3. Setup environment configuration (.env.local)
if not exist ".env.local" (
    if exist ".env" (
        echo [*] Initializing .env.local from .env...
        copy /y ".env" ".env.local" >nul
    ) else if exist ".env.example" (
        echo [*] Initializing .env.local from .env.example...
        copy /y ".env.example" ".env.local" >nul
    )
)

:: 4. Verify dependencies (node_modules)
if not exist "node_modules\" (
    echo.
    echo [*] node_modules folder not found. Installing dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        color 0C
        echo.
        echo [ERROR] npm install failed. Please check your network connection.
        pause
        exit /b !ERRORLEVEL!
    )
    echo [*] Dependencies installed successfully.
)

:: 5. Display active login credentials
echo.
echo --------------------------------------------------------------------
echo    PREDEFINED LOGIN CREDENTIALS - Live in Supabase Auth:
echo --------------------------------------------------------------------
echo    [ADMIN]       Email: tharun@gmail.com    Password: 123456  (Tharun)
echo    [SUPERVISOR]  Email: abi@gmail.com       Password: 123456  (Abi)
echo    [TECHNICIAN]  Email: elakkiya@gmail.com  Password: 123456  (Elakkiya)
echo --------------------------------------------------------------------
echo.
echo [*] Starting Vite Development Server...
echo [*] URL: http://localhost:5173/login
echo.

:: Launch default browser
start "" http://localhost:5173/login

:: Start development server
call npm run dev

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Application terminated with error code %ERRORLEVEL%.
    pause
)
