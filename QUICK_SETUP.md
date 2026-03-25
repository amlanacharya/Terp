# Quick Setup

## Fastest local path

Use Docker for PostgreSQL. You do not need a separate native PostgreSQL install.

## Commands

```powershell
cd C:\travelerp
docker compose up -d postgres
cd .\server
npm install
npm run dev
cd ..
npm install
npm run dev
```

On a brand-new Docker volume, Postgres now auto-loads [server/db/schema.sql](/C:/travelerp/server/db/schema.sql) and [server/db/seed.sql](/C:/travelerp/server/db/seed.sql) during `docker compose up`.

If you already have an older `travelerp_pgdata` volume, `docker compose up` will keep that existing database. Apply migrations manually, or reset the volume if you want a full fresh database.

## URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- PostgreSQL: `localhost:5432`

## FleetSync Lite SQLite Test Run

Use two terminals from the `fslite` worktree.

Backend:

```powershell
cd C:\travelerp\.worktrees\fslite\server
$env:FLEETSYNC_DB_PATH="C:\travelerp\.worktrees\fslite\.tmp\fslite-test.db"
npm.cmd run build
node .\dist\src\index.js
```

Frontend:

```powershell
cd C:\travelerp\.worktrees\fslite
npm.cmd run dev
```

Then open the Vite URL, usually `http://127.0.0.1:5173`.

Suggested test order:

- Sign up
- Log in
- Open Settings
- Open Customers, Drivers, Vehicles, Owners, Leads
- Open Rate Charts, GST, Tax Components
- Open Trips, Annexures, Invoices, Collections
- Open Reports and Dashboard

Current expectations on the `fslite` branch:

- The app should load and authenticate
- Pages through Task 14 should not crash the SQLite backend
- Some deeper workflows may still need seed or manual validation data
- Electron packaging and `.exe` testing are not ready yet

## Default Login

- Email: `admin@travelerp.com`
- Password: `Admin@123456`

## DBeaver Connection

- Host: `localhost`
- Port: `5432`
- Database: `travelerp`
- Username: `postgres`
- Password: `postgres`

## Full instructions

See [installation_guide.md](/C:/travelerp/installation_guide.md).


PS C:\Windows\System32>     echo $env:PGTZ
PS C:\Windows\System32>  $env:JAVA_TOOL_OPTIONS='-Duser.timezone=Asia/Kolkata'                                          
PS C:\Windows\System32>   & "C:\Program Files\DBeaver\dbeaver.exe"
PS C:\Windows\System32>
