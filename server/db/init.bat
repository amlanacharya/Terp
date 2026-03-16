@echo off
setlocal

set DB_NAME=travelerp
set SCRIPT_DIR=%~dp0

echo Creating database %DB_NAME% if needed...
createdb %DB_NAME% 2>nul

echo Applying schema...
psql -d %DB_NAME% -f "%SCRIPT_DIR%schema.sql"
if errorlevel 1 goto :error

echo Applying seed data...
psql -d %DB_NAME% -f "%SCRIPT_DIR%seed.sql"
if errorlevel 1 goto :error

echo Database initialization complete.
exit /b 0

:error
echo Database initialization failed.
exit /b 1
