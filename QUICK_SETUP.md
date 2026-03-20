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
