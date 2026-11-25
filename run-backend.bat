@echo off
echo ============================================
echo  Courtly - Starting Backend (Clean Build)
echo ============================================
cd /d "%~dp0src\backend"
call mvnw.cmd clean spring-boot:run
pause
