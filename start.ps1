# Iniciar API FastAPI e Servidor Web do EduTrack
Write-Host "Iniciando API FastAPI (Porta 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "Iniciando Servidor Web Frontend (Porta 8080)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m http.server 8080 --directory frontend"

Write-Host "`nEduTrack iniciado com sucesso!" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:8080"
Write-Host "API & Docs: http://127.0.0.1:8000/docs"
