@echo off
echo Starting NetoMate Flask Server...
timeout /t 2 >nul
start http://localhost:1947
python app.py
pause
