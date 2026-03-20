# TravelERP Installation Guide

## Prerequisites

- Windows 10 or 11
- Node.js 18 or newer
- Docker Desktop
- A terminal with `npm` and `docker` available on `PATH`

## Recommended Database Setup: Dockerized PostgreSQL

You do not need a native PostgreSQL install if you use Docker Desktop.

## 1. Start PostgreSQL

From the project root:

```powershell
cd C:\travelerp
docker compose up -d postgres
```

This starts the PostgreSQL service defined in [docker-compose.yml](/C:/travelerp/docker-compose.yml).
On first startup with a brand-new Docker volume, Postgres also auto-runs [server/db/schema.sql](/C:/travelerp/server/db/schema.sql) and [server/db/seed.sql](/C:/travelerp/server/db/seed.sql) through `/docker-entrypoint-initdb.d`.

Default database values:

- Host: `localhost`
- Port: `5432`
- Database: `travelerp`
- Username: `postgres`
- Password: `postgres`

## 2. Configure the Backend Environment

The default Docker setup matches [server/.env](/C:/travelerp/server/.env):

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travelerp
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=replace_this_with_a_long_random_secret
```

Change `JWT_SECRET` before any real deployment.

## 3. Fresh DB vs Existing DB

For a new environment, no extra database init step is needed after `docker compose up -d postgres`.

For an existing Docker volume, Postgres will not re-run init scripts. Use one of these paths instead:

- Apply the latest migration scripts manually.
- If you want a completely fresh local database, delete the Docker volume and bring Postgres up again.

The older helper [server/db/init-docker.bat](/C:/travelerp/server/db/init-docker.bat) is only appropriate for a blank database inside a running container. Do not use it against an already initialized database as a substitute for migrations.

## 4. Run the Backend

```powershell
cd C:\travelerp\server
npm install
npm run dev
```

The API should start on `http://localhost:3001`.

## 5. Run the Frontend

The root [/.env](/C:/travelerp/.env) already points the frontend to the local API:

```env
VITE_API_URL=http://localhost:3001/api
```

Then run:

```powershell
cd C:\travelerp
npm install
npm run dev
```

The frontend should start on `http://localhost:5173`.

## 6. Default Login

- Email: `admin@travelerp.com`
- Password: `Admin@123456`

## 7. Connect DBeaver

Use these values in DBeaver:

- Host: `localhost`
- Port: `5432`
- Database: `travelerp`
- Username: `postgres`
- Password: `postgres`

## 8. If You Already Have Native PostgreSQL

You can reuse it instead of Docker. In that case:

- update [server/.env](/C:/travelerp/server/.env) with that instance's credentials
- create a `travelerp` database there
- run [server/db/init.bat](/C:/travelerp/server/db/init.bat)

## Verification Checklist

1. Open `http://localhost:5173`
2. Sign in with the admin credentials
3. Confirm dashboard stats load
4. Open the main modules
5. Create a trip and verify it appears in the list

## Troubleshooting

### Docker container is not running

Run:

```powershell
docker compose up -d postgres
```

### Port `5432` is already in use

Change the published port in [docker-compose.yml](/C:/travelerp/docker-compose.yml) and update `DB_PORT` in [server/.env](/C:/travelerp/server/.env).

### Backend cannot connect to the database

- Confirm the container is running with `docker ps`
- Confirm [server/.env](/C:/travelerp/server/.env) still matches the database credentials
- Rerun [server/db/init-docker.bat](/C:/travelerp/server/db/init-docker.bat) after the container is healthy

### Frontend cannot reach the backend

- Confirm the backend is running on `http://localhost:3001`
- Confirm [vite.config.ts](/C:/travelerp/vite.config.ts) still proxies `/api` to the backend
