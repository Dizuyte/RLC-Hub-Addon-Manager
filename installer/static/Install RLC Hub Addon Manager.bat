@echo off
setlocal EnableExtensions
title RLC Hub Addon Manager installer - by Milan
cd /d "%~dp0"
echo.
echo  ===============================================================
echo      RLC Hub Addon Manager v1.1 for RL Career Hub - by Milan
echo  ===============================================================
echo.
if exist "%~dp0files\install.js" goto unzipped
echo ERROR: extract the whole zip first, then run this file again.
echo ERREUR : dezippe tout le dossier avant de lancer ce fichier.
echo.
pause
exit /b 1

:unzipped
set "GAME="
for %%D in ("%ProgramFiles%\RL Career Hub" "%LOCALAPPDATA%\Programs\RL Career Hub" "%LOCALAPPDATA%\Programs\rl-career-hub") do (
  if not defined GAME if exist "%%~D\RL Career Hub.exe" set "GAME=%%~D"
)
if defined GAME goto found
echo RL Career Hub was not found automatically.
echo RL Career Hub n'a pas ete trouve automatiquement.
echo.
echo Paste the folder that contains "RL Career Hub.exe", then press Enter.
echo Colle le dossier qui contient "RL Career Hub.exe", puis appuie sur Entree.
set /p "GAME=> "

:found
if not defined GAME goto notfound
set "GAME=%GAME:"=%"
if "%GAME:~-1%"=="\" set "GAME=%GAME:~0,-1%"
if not exist "%GAME%\RL Career Hub.exe" goto notfound
echo Game found / Jeu trouve : %GAME%
echo.
echo Import your current saves, settings and bots into RLC Hub Addon Manager? Recommended.
echo Importer tes saves, reglages et bots actuels dans RLC Hub Addon Manager ? Conseille.
choice /c YN /n /m "[Y/N] "
set "SAVES=Y"
if errorlevel 2 set "SAVES=N"
echo.
set "ELECTRON_RUN_AS_NODE=1"
"%GAME%\RL Career Hub.exe" "%~dp0files\install.js" "%GAME%" %SAVES%
set "RC=%errorlevel%"
set "ELECTRON_RUN_AS_NODE="
echo.
pause
exit /b %RC%

:notfound
echo.
echo ERROR: "RL Career Hub.exe" was not found. Install RL Career Hub first.
echo ERREUR : "RL Career Hub.exe" introuvable. Installe d'abord RL Career Hub.
echo.
pause
exit /b 1
