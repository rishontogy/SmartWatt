@echo off
echo ============================================
echo  SmartWatt Server - Clean Start
echo ============================================

:: Kill existing processes first
echo Stopping all backend processes...
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force"
timeout /t 3 /nobreak >nul

:: Clear port 3001 if still in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING 2^>nul') do (
    echo Killing process on port 3001 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Clear port 3005 if still in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3005 " ^| findstr LISTENING 2^>nul') do (
    echo Killing process on port 3005 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Launch Python proxy on port 3001 (bypasses node.exe firewall block)
echo Launching TCP Proxy on port 3001...
start "SmartWatt-Proxy" python backend/proxy.py

:: Launch YOLO AI detection server on port 5001
echo Launching YOLO Detector...
start "SmartWatt-YOLO" python backend/detector.py

:: Wait until proxy is actually listening on 3001 (up to 10 seconds)
echo Waiting for proxy to start...
set /a tries=0
:WAIT_PROXY
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3001 " | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    set /a tries+=1
    if %tries% LSS 10 goto WAIT_PROXY
    echo ERROR: Proxy failed to start on port 3001!
    exit /b 1
)
echo [OK] Proxy is ready on port 3001.

:: Start the Node.js server on port 3005 (hidden from firewall)
echo Starting backend Node.js server on port 3005...
node backend/server.js
