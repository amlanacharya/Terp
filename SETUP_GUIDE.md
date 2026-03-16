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

2. Initialize the database:

```powershell
cd C:\travelerp\server\db
.\init-docker.bat
```

3. Start the backend:

```powershell
cd C:\travelerp\server
npm install
npm run dev
```

4. Start the frontend:

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
