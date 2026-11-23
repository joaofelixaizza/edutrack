@echo off
chcp 65001 > nul
echo ====================================================
echo        ENVIANDO EDUTRACK PARA O GITHUB
echo ====================================================
echo.
echo Conta de destino: joaofelixaizza
echo Repositorio: https://github.com/joaofelixaizza/edutrack.git
echo.
echo Se abrir uma janela do GitHub ou navegador, autorize o acesso.
echo.
git push -u origin main
echo.
echo ====================================================
if %ERRORLEVEL% equ 0 (
    echo [SUCESSO] Projeto enviado para o GitHub com sucesso!
) else (
    echo [ERRO] Ocorreu um problema ao enviar.
)
echo ====================================================
pause
