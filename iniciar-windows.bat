@echo off
chcp 65001 >nul
title Sistema do Motel
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^) e rode de novo.
  pause
  exit /b 1
)

echo.
echo === 1/4 Configuracao ===
node scripts\criar-env.mjs
if errorlevel 1 goto erro

echo.
echo === 2/4 Instalando dependencias ^(a primeira vez leva alguns minutos^) ===
call npm install --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo === 3/4 Preparando o banco de dados ===
call npx prisma migrate deploy
if errorlevel 1 goto erro_banco
call npm run db:seed
if errorlevel 1 goto erro_seed

echo.
echo === 4/4 Iniciando o sistema ===
echo O navegador vai abrir em http://localhost:3000
echo Login: admin@motel.com / admin123
echo Para desligar, feche esta janela.
echo.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"
call npm run dev
goto fim

:erro_banco
echo.
echo [ERRO] Nao consegui acessar o PostgreSQL.
echo Verifique se ele esta instalado e se a senha esta correta.
echo Para digitar a senha de novo, apague o arquivo .env desta pasta e rode este script outra vez.
pause
exit /b 1

:erro_seed
echo.
echo [ERRO] O banco foi criado, mas os dados de exemplo nao puderam ser carregados.
echo Se a mensagem acima falar de "query_engine" ou ".dll.node", instale o
echo Microsoft Visual C++ Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe
echo reinicie o computador e rode este script de novo.
pause
exit /b 1

:erro
echo.
echo [ERRO] Algo deu errado. Veja a mensagem acima.
pause
exit /b 1

:fim
