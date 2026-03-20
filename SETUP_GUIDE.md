# TravelERP Setup Guide

This project now uses a local Express backend and PostgreSQL. Supabase is no longer part of the setup flow.

## Recommended approach

Use Docker Desktop for PostgreSQL.

## Setup steps

1. Start PostgreSQL:

```powershell
cd C:\travelerp
docker compose up -d postgres
```

On a brand-new Docker volume, this also initializes the database automatically from [server/db/schema.sql](/C:/travelerp/server/db/schema.sql) and [server/db/seed.sql](/C:/travelerp/server/db/seed.sql).

If you already have an older database volume, `docker compose up` does not re-run init scripts. In that case, apply the needed migrations manually.

2. Start the backend:

```powershell
cd C:\travelerp\server
npm install
npm run dev
```

3. Start the frontend:

```powershell
cd C:\travelerp
npm install
npm run dev
```

## Default credentials

- Email: `admin@travelerp.com`
- Password: `Admin@123456`

## DBeaver

You can connect DBeaver to the Dockerized database on:

- Host: `localhost`
- Port: `5432`
- Database: `travelerp`
- Username: `postgres`
- Password: `postgres`

## More detail

See [installation_guide.md](/C:/travelerp/installation_guide.md).
