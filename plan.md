# Plan: TravelERP — Migrate from Supabase Cloud to Local PostgreSQL + Create Documentation

## Context

TravelERP is a React+TypeScript+Vite travel/fleet management app originally built for Supabase (cloud PostgreSQL). The user wants to:
1. Run it locally on Windows with a local SQL database
2. Create `skill.md` (project documentation)
3. Create `installation_guide.md` (Windows setup instructions)

The app currently has **no backend** — the React frontend talks directly to Supabase. Migration requires adding an Express.js backend to replace Supabase's auth and query APIs.

---

## Architecture Decision

**Database: Local PostgreSQL** — The existing schema uses PostgreSQL-specific features (enums, uuid-ossp, timestamptz, jsonb, numeric precision, ON CONFLICT). Using local PostgreSQL means near-zero SQL rewrite.

**Backend: Express.js + TypeScript + `pg` driver** — Lightweight, no ORM overhead. Supabase queries translate directly to SQL JOINs.

**Auth: JWT + bcrypt** — Replaces Supabase Auth. Simple, stateless, no external dependencies.

---

## Implementation Plan

### Phase 1: Create Express Backend (`server/`)

**Step 1.1: Initialize server project**
- Create `server/package.json` with: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`
- Create `server/tsconfig.json`

**Step 1.2: Create `server/src/config/db.ts`**
- PostgreSQL connection pool via `pg.Pool`
- Reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` from `.env`

**Step 1.3: Create `server/db/schema.sql`**
- Adapt from `supabase/migrations/20260312171253_create_travel_erp_schema.sql`
- Remove ALL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements
- Change `profiles` table: remove `REFERENCES auth.users(id)`, add `password_hash text NOT NULL`
- Keep all enums, tables, indexes, default data as-is

**Step 1.4: Create `server/db/seed.sql`**
- Adapt from `supabase/migrations/20260313101919_insert_sample_data.sql`
- Add default admin user with pre-hashed bcrypt password

**Step 1.5: Create auth middleware (`server/src/middleware/auth.ts`)**
- JWT verification from `Authorization: Bearer` header
- `roleCheck(allowedRoles[])` middleware for role-based access

**Step 1.6: Create route files** (one per entity)
- `auth.routes.ts` — POST `/login`, `/signup`, GET `/me`
- `dashboard.routes.ts` — GET `/stats` (5 count queries in parallel)
- `trips.routes.ts` — GET with JOINs to customers/drivers/vehicles + optional status filter
- `drivers.routes.ts`, `vehicles.routes.ts`, `customers.routes.ts`, `owners.routes.ts` — CRUD
- `invoices.routes.ts` — GET with customer JOIN
- `collections.routes.ts` — GET with nested invoice→customer JOIN
- `settlements.routes.ts` — GET driver (with driver JOIN) + GET owner (with owner+vehicle JOIN)
- `reports.routes.ts`, `settings.routes.ts`

**Step 1.7: Create `server/src/index.ts`**
- Express app with CORS, mount all routes under `/api`, listen on port 3001

**Step 1.8: Create `server/db/init.bat`** (Windows batch script)
- `createdb travelerp` → `psql -d travelerp -f schema.sql` → `psql -d travelerp -f seed.sql`

### Phase 2: Modify Frontend

**Step 2.1: Create `src/lib/api.ts`** (replaces `src/lib/supabase.ts`)
- Fetch wrapper: prepends `http://localhost:3001/api`, attaches JWT from localStorage
- Exports `api.get()`, `api.post()`, `api.put()`, `api.delete()`
- Handles 401 → redirect to login

**Step 2.2: Modify `src/contexts/AuthContext.tsx`**
- Remove all `@supabase/supabase-js` imports
- `signIn` → `api.post('/auth/login')`, store JWT in localStorage
- `signUp` → `api.post('/auth/signup')`
- `signOut` → clear localStorage
- On mount: read token from localStorage, call `api.get('/auth/me')`

**Step 2.3: Modify all 11 component files**
Mechanical replacement of `supabase.from(...)` → `api.get('/endpoint')`.

Backend must return data shaped **exactly** like Supabase nested objects (e.g. `{ customer: { name: "ABC" } }`) so JSX template code stays untouched.

| Component | Old Call | New Call |
|---|---|---|
| Dashboard | 5x `supabase.from(...).select({count})` | `api.get('/dashboard/stats')` |
| TripList | `supabase.from('trips').select('*, customer:..., driver:..., vehicle:...')` | `api.get('/trips?status=X')` |
| DriverList | `supabase.from('drivers').select('*')` | `api.get('/drivers')` |
| VehicleList | `supabase.from('vehicles').select('*, owner:...')` | `api.get('/vehicles')` |
| CustomerList | `supabase.from('customers').select('*')` | `api.get('/customers')` |
| OwnerList | `supabase.from('owners_vendors').select('*')` | `api.get('/owners')` |
| InvoiceList | `supabase.from('invoices').select('*, customer:...')` | `api.get('/invoices')` |
| CollectionList | `supabase.from('collections').select('*, invoice:invoices(..., customer:...)')` | `api.get('/collections')` |
| DriverSettlements | `supabase.from('driver_settlements').select('*, driver:...')` | `api.get('/settlements/drivers')` |
| OwnerSettlements | `supabase.from('owner_settlements').select('*, owner:..., vehicle:...')` | `api.get('/settlements/owners')` |

**Step 2.4: Update `vite.config.ts`**
- Add proxy: `/api` → `http://localhost:3001` (avoids CORS in dev)

**Step 2.5: Remove Supabase dependency**
- Remove `@supabase/supabase-js` from `package.json`
- Delete `src/lib/supabase.ts`

**Step 2.6: Update root `.env`**
- Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Add `VITE_API_URL=http://localhost:3001/api` (optional, for production)

### Phase 3: Create Documentation

**Step 3.1: Create `skill.md`**
- Project overview (Indian travel/fleet ERP)
- Tech stack (React + Express + PostgreSQL)
- Architecture diagram (frontend:5173 → backend:3001 → PostgreSQL:5432)
- Database schema (16 tables summary)
- Auth system (JWT + bcrypt, 5 roles)
- Feature list with file paths
- API endpoint reference
- Coding conventions

**Step 3.2: Create `installation_guide.md`** (Windows-focused)
- Prerequisites: Node.js 18+, PostgreSQL 15+ (EDB installer link)
- Step-by-step PostgreSQL Windows installation
- Database creation and schema setup
- Backend setup (`cd server && npm install && npm run dev`)
- Frontend setup (`npm install && npm run dev`)
- Default admin login credentials
- Environment variable configuration
- Troubleshooting (port conflicts, PostgreSQL PATH, service issues)

---

## Files to Create (New)

| File | Purpose |
|---|---|
| `server/package.json` | Backend dependencies |
| `server/tsconfig.json` | Backend TypeScript config |
| `server/.env` | DB connection + JWT secret |
| `server/src/index.ts` | Express entry point |
| `server/src/config/db.ts` | PostgreSQL connection pool |
| `server/src/middleware/auth.ts` | JWT + role middleware |
| `server/src/routes/auth.routes.ts` | Login/signup/me endpoints |
| `server/src/routes/dashboard.routes.ts` | Dashboard stats |
| `server/src/routes/trips.routes.ts` | Trip CRUD |
| `server/src/routes/drivers.routes.ts` | Driver CRUD |
| `server/src/routes/vehicles.routes.ts` | Vehicle CRUD |
| `server/src/routes/customers.routes.ts` | Customer CRUD |
| `server/src/routes/owners.routes.ts` | Owner CRUD |
| `server/src/routes/invoices.routes.ts` | Invoice CRUD |
| `server/src/routes/collections.routes.ts` | Collection CRUD |
| `server/src/routes/settlements.routes.ts` | Driver + Owner settlements |
| `server/src/routes/reports.routes.ts` | Report queries |
| `server/src/routes/settings.routes.ts` | System settings |
| `server/db/schema.sql` | Local PostgreSQL schema |
| `server/db/seed.sql` | Sample data + admin user |
| `server/db/init.bat` | Windows DB setup script |
| `src/lib/api.ts` | Frontend API fetch wrapper |
| `skill.md` | Project documentation |
| `installation_guide.md` | Windows installation guide |

## Files to Modify (Existing)

| File | Change |
|---|---|
| `src/contexts/AuthContext.tsx` | Replace Supabase auth with JWT/API calls |
| `src/App.tsx` | Update imports (supabase → api) |
| `src/components/Dashboard/Dashboard.tsx` | Replace supabase queries with api calls |
| `src/components/Trips/TripList.tsx` | Replace supabase queries with api calls |
| `src/components/Drivers/DriverList.tsx` | Replace supabase queries with api calls |
| `src/components/Vehicles/VehicleList.tsx` | Replace supabase queries with api calls |
| `src/components/Customers/CustomerList.tsx` | Replace supabase queries with api calls |
| `src/components/Owners/OwnerList.tsx` | Replace supabase queries with api calls |
| `src/components/Invoices/InvoiceList.tsx` | Replace supabase queries with api calls |
| `src/components/Collections/CollectionList.tsx` | Replace supabase queries with api calls |
| `src/components/Settlements/DriverSettlements.tsx` | Replace supabase queries with api calls |
| `src/components/Settlements/OwnerSettlements.tsx` | Replace supabase queries with api calls |
| `vite.config.ts` | Add API proxy config |
| `package.json` | Remove `@supabase/supabase-js` |
| `.env` | Replace Supabase vars with local config |

## Files to Delete

| File | Reason |
|---|---|
| `src/lib/supabase.ts` | Replaced by `src/lib/api.ts` |

---

## Verification

1. Install PostgreSQL locally, run `server/db/init.bat` to create DB
2. Start backend: `cd server && npm run dev` (port 3001)
3. Start frontend: `npm run dev` (port 5173)
4. Login with `admin@travelerp.com` / `Admin@123456`
5. Verify: Dashboard loads with stats, navigate each module (trips, drivers, vehicles, etc.)
6. Test: Create a new trip, verify it appears in the list
7. Test: Role-based access — viewer should not see invoices/settings
