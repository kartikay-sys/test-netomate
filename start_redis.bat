@echo off
echo.
echo ========================================
echo   NetoMate Redis Starter
echo ========================================
echo.

:: 1. Check if Redis is already running
netstat -ano | findstr :6379 > nul
if %errorlevel% == 0 (
    echo [OK] Redis is already running on port 6379.
    pause
    exit /b
)

:: 2. Try to start Memurai (Recommended for Windows)
echo [INFO] Attempting to start Memurai service...
net start memurai 2>nul
if %errorlevel% == 0 (
    echo [SUCCESS] Memurai started successfully.
    pause
    exit /b
)

:: 3. Try to start redis-server if in PATH
echo [INFO] Attempting to start redis-server from PATH...
start /b redis-server 2>nul
timeout /t 3 > nul
netstat -ano | findstr :6379 > nul
if %errorlevel% == 0 (
    echo [SUCCESS] redis-server started successfully.
    pause
    exit /b
)

echo.
echo [ERROR] Redis could not be started automatically.
echo.
echo If you don't have Redis installed, I recommend:
echo 1. Download Memurai (Developer Edition) from: https://www.memurai.com/get-memurai
echo 2. Or install via Chocolatey: choco install memurai-developer
echo.
echo NOTE: The application is now using 'progress.json' as a persistent 
echo fallback, so it will work correctly even without Redis!
echo.
pause
