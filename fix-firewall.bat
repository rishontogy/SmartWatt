@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo.
    echo  ERROR: Right-click this file and choose "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo Disabling Windows Firewall for Private + Public profiles...
netsh advfirewall set privateprofile state off
netsh advfirewall set publicprofile state off
echo.
echo SUCCESS - Firewall disabled. ESP32 can now connect.
echo You can re-enable it later in Windows Security settings.
echo.
pause
