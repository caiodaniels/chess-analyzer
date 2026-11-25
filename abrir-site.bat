@echo off
cd /d "%~dp0"
echo ===================================================
echo   Analisador de Xadrez Pos-Jogo - Servidor Local
echo ===================================================
echo.
where python >nul 2>nul
if %errorlevel%==0 (
    echo Iniciando servidor local na porta 8000...
    echo Abrindo http://127.0.0.1:8000 no seu navegador...
    echo Mantenha esta janela aberta enquanto usar o site.
    echo.
    start "" "http://127.0.0.1:8000"
    python -m http.server 8000 --bind 127.0.0.1
    goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
    echo Python nao encontrado. Iniciando servidor com Node.js...
    echo Abrindo http://127.0.0.1:8000 no seu navegador...
    echo Mantenha esta janela aberta enquanto usar o site.
    echo.
    start "" "http://127.0.0.1:8000"
    call npx --yes serve -l tcp://127.0.0.1:8000 .
    goto :eof
)

echo [AVISO] Python ou Node.js nao foram encontrados neste computador.
echo Mas voce pode publicar esta pasta inteira de graca em segundos no Netlify Drop:
echo https://app.netlify.com/drop
echo.
pause
