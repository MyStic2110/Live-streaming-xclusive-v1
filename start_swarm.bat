@echo off
setlocal
title DevOpsGeni Swarm Launcher

echo ===================================================
echo   [SWARM] DevOpsGeni Resource Manager
echo ===================================================
echo Cleaning up old ghost processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo Starting Core Infrastructure (Docker + Node + DevOpsGeni)...
echo. > swarm_master.log
start "Core Infrastructure" cmd /c "npm run core 2>&1 | python-agent\venv\Scripts\python.exe tee.py swarm_master.log"

:: Wait a few seconds to let core infra settle
timeout /t 5 >nul

:MENU
cls
echo ===================================================
echo         SWARM AGENT INTERACTIVE LAUNCHER
echo ===================================================
echo CORE INFRASTRUCTURE IS RUNNING IN BACKGROUND.
echo Which Agent do you want to load into memory?
echo.
echo [1] Lina (Sales)
echo [2] DevOpsGeni (SRE)
echo [3] BI (Cortex)
echo [4] BI2 (Cortex2)
echo [5] Nova (Engineering)
echo [6] Astra (Design)
echo [7] Rehearsal
echo [8] Seva
echo [9] Martech
echo [10] Octane (Telemetry)
echo.
echo [99] ALL AGENTS (WARNING: WILL CONSUME 3GB+ RAM)
echo [0] Exit Launcher
echo ===================================================
set /p choice="Enter your choice (0-99): "

if "%choice%"=="1" start "Lina" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\lina\lina.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="2" start "DevOpsGeni" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\devopsgeni\devopsgeni.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="3" start "BI" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\bi\bi_agent.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="4" start "BI2" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\bi2\bi2_agent.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="5" start "Nova" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\nova\nova.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="6" start "Astra" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\astra\astra.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="7" start "Rehearsal" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\rehearsal\rehearsal.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="8" start "Seva" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\seva\seva.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="9" start "Martech" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\martech\martech_agent.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="10" start "Octane" cmd /c "cd python-agent && .\venv\Scripts\python.exe agents\octane\octane.py dev 2>&1 | .\venv\Scripts\python.exe ..\tee.py ..\swarm_master.log" & goto MENU
if "%choice%"=="99" start "All Agents" cmd /c "npm run swarm-all 2>&1 | python-agent\venv\Scripts\python.exe tee.py swarm_master.log" & goto MENU
if "%choice%"=="0" goto EOF

echo Invalid choice. Try again.
timeout /t 2 >nul
goto MENU

:EOF
echo Exiting Launcher...
