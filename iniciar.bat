@echo off
title EduTrack Provas - Inicializando...
color 0A
echo.
echo  ========================================
echo    EduTrack Provas - Iniciando Servidor
echo  ========================================
echo.
echo  [1/2] Iniciando backend (porta 8000)...
start "EduTrack - Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo  [2/2] Iniciando frontend (porta 8080)...
start "EduTrack - Frontend" cmd /k "python -m http.server 8080 --directory %~dp0frontend"
timeout /t 2 /nobreak >nul
echo.
echo  ========================================
echo    Acesse: http://localhost:8080
echo  ========================================
echo.
start "" "http://localhost:8080"
pause
