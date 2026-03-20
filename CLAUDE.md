# TravelERP — Agent Instructions

> This file is read by Claude Code (CLAUDE.md) and Codex (agents.md symlink). Keep it as the single source of truth.

## Project Context

Primary languages: TypeScript, Python, Markdown. Primary project: TravelERP (full-stack). Secondary: RAG/LLM evaluation pipelines, portfolio cookbooks. Always use these tech stacks unless told otherwise.

## Workflow Rules

- Always present a plan/outline BEFORE writing code or making changes. Wait for user approval before proceeding with implementation.
- Before making any changes, outline your plan as a numbered list. Include which files you'll read, what you'll change, and in what order. Wait for approval before proceeding.
- When user asks for a document (BRD, plan, cookbook, report), write it to disk immediately using Write tool. Confirm the file path before and after writing.
- After completing each major step, create a git commit with a descriptive message. Use conventional commit format: feat/fix/docs(scope): description.

## Code Review

- When reviewing code or auditing against specs, always check the LATEST state of files before flagging issues. Do not flag issues that have already been fixed.

## Technical Guidelines

- Use only verified, currently-available libraries and APIs. Do not assume tools/models exist — check docs or ask the user. For LLM work, verify model names are current before using them.

## Project Overview

TravelERP is a multi-module travel business management system. It manages the full lifecycle: leads, trips (duty slips), invoices, collections, driver/owner settlements, and reporting.

**Current client customization:** Gayatri Travels (GT) — branch `GT`.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Express 4 + TypeScript (tsx for dev) |
| Database | PostgreSQL — raw SQL via `pg` driver (no ORM) |
| PDF | PDFKit |
| Auth | JWT (jsonwebtoken) + bcryptjs |

## Project Structure

```
travelerp/
├── src/                          # Frontend (React)
│   ├── App.tsx                   # Router — page-key based navigation
│   ├── lib/types.ts              # ALL TypeScript interfaces
│   └── components/
│       ├── Auth/                 # Login, ProtectedRoute
│       ├── Dashboard/
│       ├── Leads/
│       ├── Trips/
│       ├── Drivers/
│       ├── Vehicles/
│       ├── Customers/
│       ├── Owners/
│       ├── Invoices/
│       ├── Collections/
│       ├── Settlements/          # DriverSettlements + OwnerSettlements
│       ├── Reports/
│       ├── Settings/
│       └── Layout/               # Sidebar, Header
├── server/
│   ├── db/
│   │   ├── schema.sql            # Full schema (tables, enums, indexes, seeds)
│   │   └── migrations/           # Incremental migration scripts
│   └── src/
│       ├── index.ts              # Express app entry, route mounting
│       ├── routes/               # One file per module: *.routes.ts
│       └── utils/                # PDF generators, rate engine (planned)
└── GT-Specific/                  # Client requirements, sample images
```

## Conventions

### Database
- All tables use `uuid` primary keys via `uuid_generate_v4()`
- Raw SQL queries — no ORM. Use parameterized queries (`$1, $2...`) always.
- Naming: snake_case for tables and columns
- Foreign keys with `ON DELETE CASCADE` for child tables
- `is_active` soft-delete pattern on master tables
- `created_at` / `updated_at` timestamps on all tables

### Backend
- Route files: `server/src/routes/<module>.routes.ts`
- Each route file exports an Express Router
- Routes mounted in `server/src/index.ts` under `/api/<module>`
- Error handling: try/catch in each handler, return `{ error: message }` with appropriate status
- No middleware abstractions — auth check inline where needed
- PDF generation utilities in `server/src/utils/pdf-*.ts` using PDFKit

### Frontend
- Single-page app with page-key routing (no react-router)
- `PageKey` type in `App.tsx` controls navigation
- All types in `src/lib/types.ts` — keep this as the single type file
- Components: one main `*List.tsx` per module (includes list + modal forms)
- Tailwind for all styling — no CSS files
- API calls use `fetch` with `Authorization: Bearer <token>` header
- Role-based access: `UserRole` = admin | manager | accountant | operator | viewer

### General
- No test framework set up yet — when adding tests, use Vitest
- Commit messages: concise, imperative mood
- Branch `GT` for all Gayatri Travels customizations
- Branch `main` for base product

## Key Business Concepts

- **Trip = Duty Slip**: A trip record represents a duty slip in GT terminology
- **Duty Types**: local (overtime, no night halts), outstation (night halts counted)
- **Rate Charts**: Per-customer, per-vehicle-category, per-duty-type pricing. This is the core billing engine.
- **Annexures**: Sub-invoices for multi-day outstation trips (one per day). Can be billed individually, grouped, or as whole invoice.
- **Vehicle Categories**: Customer-facing vehicle names (CRYSTA, DEZIRE, 4AIR BAG) decoupled from system vehicle types
- **Vendor = Vehicle Owner**: GT uses "Vehicle Owner" terminology
- **GST**: CGST 2.5% + SGST 2.5% intra-state, IGST 5% inter-state. Tax system must be dynamic/configurable.

## Rate Chart Patterns to Support

The rate engine must handle all of these (from real GT client data):
1. **Base package**: 8Hr/80KM = Rs.3000 (flat base rent)
2. **Extra KM/HR**: Rs.18/km, Rs.180/hr beyond base
3. **Fuel formula**: charge = (KM / divisor) x fuel_price_per_unit
4. **Fixed route drops**: TSM TO BBSR = Rs.4000 (fixed amount for specific routes)
5. **Night halt**: per-customer, per-vehicle-category rate
6. **Whichever is higher**: MAX(km-based total, hr-based total) — configurable per item
7. **Long trip per-KM**: total_km x per_km_rate for outstation
8. **Multiple tiers**: same customer may have 8HR/80KM and 4HR/40KM packages (operator selects)
9. **KM threshold**: above X km, local becomes long/outstation pricing

## Commands

```bash
# Frontend
npm run dev          # Vite dev server
npm run build        # Production build
npm run typecheck    # TypeScript check

# Backend
cd server
npm run dev          # tsx watch mode
npm run build        # Compile TypeScript
npm start            # Run compiled JS
```

## Do NOT

- Use an ORM — stick with raw `pg` queries
- Create separate CSS files — use Tailwind classes
- Add react-router — the app uses a custom PageKey navigation system
- Hardcode GST rates — use the tax configuration system
- Create new type files — all types go in `src/lib/types.ts`
- Skip parameterized queries — never concatenate SQL strings
