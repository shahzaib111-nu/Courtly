@echo off
REM Restores the Courtly database from a backup made by BackupService (NFR 3.3.1).
REM   1. Stop the backend.   2. scripts\restore-backup.bat backups\courtly-backup-....zip [password]   3. Start the backend.
setlocal
set ROOT=%~dp0..
set BACKUP=%~f1
set PASSWORD=%~2
if "%~1"=="" (echo Usage: %~nx0 ^<backup .zip^> [backup password] & dir /b /o-d "%ROOT%\backups\courtly-backup-*" & exit /b 1)
if not exist "%BACKUP%" (echo Backup not found: %BACKUP% & exit /b 1)

pushd "%ROOT%\src\backend"
call mvnw.cmd -q dependency:build-classpath -DincludeArtifactIds=h2 -Dmdep.outputFile="%TEMP%\courtly-h2-cp.txt" || (popd & exit /b 1)
popd
set /p H2_JAR=<"%TEMP%\courtly-h2-cp.txt"

if exist "%ROOT%\database\courtlydb.mv.db" (
  move "%ROOT%\database\courtlydb.mv.db" "%ROOT%\database\courtlydb.mv.db.before-restore-%RANDOM%" >nul
  echo Current database moved aside in the database folder.
)
if not exist "%ROOT%\database" mkdir "%ROOT%\database"

if "%PASSWORD%"=="" (
  java -cp "%H2_JAR%" org.h2.tools.RunScript -url "jdbc:h2:file:%ROOT%\database\courtlydb" -user sa -password "" -script "%BACKUP%" -options COMPRESSION ZIP
) else (
  java -cp "%H2_JAR%" org.h2.tools.RunScript -url "jdbc:h2:file:%ROOT%\database\courtlydb" -user sa -password "" -script "%BACKUP%" -options COMPRESSION DEFLATE CIPHER AES PASSWORD '%PASSWORD%'
)
echo Restore finished. Start the backend again.
