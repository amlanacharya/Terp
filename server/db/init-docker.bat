@echo off
setlocal

set CONTAINER_NAME=travelerp-postgres
set DB_NAME=travelerp
set DB_USER=postgres
set SCRIPT_DIR=%~dp0

echo Checking Docker container %CONTAINER_NAME%...
for /f "delims=" %%i in ('docker inspect -f "{{.State.Running}}" %CONTAINER_NAME% 2^>nul') do set CONTAINER_RUNNING=%%i
if /I not "%CONTAINER_RUNNING%"=="true" (
  echo Container %CONTAINER_NAME% is not running.
  echo Start it first with: docker compose up -d postgres
  exit /b 1
)

echo Applying schema inside Docker...
docker exec -i %CONTAINER_NAME% psql -U %DB_USER% -d %DB_NAME% < "%SCRIPT_DIR%schema.sql"
if errorlevel 1 goto :error

echo Applying seed data inside Docker...
docker exec -i %CONTAINER_NAME% psql -U %DB_USER% -d %DB_NAME% < "%SCRIPT_DIR%seed.sql"
if errorlevel 1 goto :error

echo Docker database initialization complete.
exit /b 0

:error
echo Docker database initialization failed.
exit /b 1
