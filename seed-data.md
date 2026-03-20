# GT Demo Seed Data

## Purpose
This is the internal walkthrough for the GT demo dataset seeded by [server/db/seed.sql](/C:/travelerp/server/db/seed.sql).

It covers GT Phase 1 through Phase 5 with ready-made data for:
- master data and leads
- rate-chart patterns from the GT plan and test fixtures
- duty-slip travel metrics and expenses
- direct trip billing and annexure billing
- dynamic tax configuration and tax snapshots

## Important Note
If you run this against a DB that already contains the old generic sample rows, those rows will still exist.

For the GT demo, filter by these prefixes:
- customer codes: `GT-CUST-*`
- trip numbers: `GT-TRP-*`
- lead numbers: `GT-LEAD-*`
- invoice numbers: `GTINV-*`
- collection numbers: `GTCOL-*`
- settlement numbers: `GTDST-*`, `GTOST-*`

## How To Load This Data
Fresh Docker volume:
```powershell
docker compose down -v
docker compose up -d postgres
```

Existing DB:
```powershell
Get-Content .\server\db\seed.sql -Raw | docker compose exec -T postgres psql -U postgres -d travelerp
```

## Demo Logins
- `admin@travelerp.com` / `Admin@123456`
- `manager.gt@travelerp.com` / `GTDemo@123`
- `accountant.gt@travelerp.com` / `GTDemo@123`
- `operator.gt@travelerp.com` / `GTDemo@123`
- `viewer.gt@travelerp.com` / `GTDemo@123`

## Company Settings Seeded
- company: `Gayatri Travels`
- GSTIN: `21AABCT1332L1ZN`
- invoice prefix: `GTINV`
- trip prefix: `GT-TRP`
- lead prefix: `GT-LEAD`

## Master Data Seeded
### Customers
- `GT-CUST-RBI` - RBI Bhubaneswar Office
- `GT-CUST-TSM` - TSM Logistics Hub
- `GT-CUST-UNIT4` - UNIT-4 Secretariat
- `GT-CUST-NTPC` - NTPC Western Region, Mumbai
- `GT-CUST-IFFCO` - IFFCO Paradeep Operations
- `GT-CUST-MCL` - MCL Mining Division

### Vehicle Categories
- `CRYSTA`
- `DEZIRE`
- `4AIR BAG`
- `6AIR BAG`

### Vehicles
- `OD02AB1234` mapped to `CRYSTA`
- `OD02CD5678` mapped to `DEZIRE`
- `OD02EF2468` mapped to `4AIR BAG`
- `OD02GH1357` mapped to `6AIR BAG`

### Drivers
- `GTDRV001` Suresh Nayak, default vehicle `OD02AB1234`, NH `500`, OT `120`
- `GTDRV002` Amit Das, default vehicle `OD02CD5678`, NH `450`, OT `100`
- `GTDRV003` Pradip Swain, default vehicle `OD02EF2468`, NH `400`, OT `90`
- `GTDRV004` Manoj Behera, default vehicle `OD02GH1357`, NH `450`, OT `110`

## Phase 1 Walkthrough
### Sidebar labels and masters
Use `admin` and open:
- `Vehicle Categories`
- `Vehicles`
- `Drivers`
- `Customers`
- `Leads`

### Phase 1 records to call out
- customer defaults are filled on all `GT-CUST-*` rows
- drivers have default vehicles, night halt rates, and OT per hour
- vehicles are mapped to GT vehicle categories
- leads exist with follow-up history and status mix

### Lead examples
- `GT-LEAD-0001` converted repeat-customer lead for RBI
- `GT-LEAD-0002` annexure-focused negotiating lead for MCL
- `GT-LEAD-0003` quoted threshold case for NTPC

## Phase 2 Walkthrough
Open `Rate Charts` and use these charts.

### `RBI FY26 Active Chart`
Use to show:
- multiple local packages
- manual package selection
- higher-of KM vs HR

Packages:
- `8HR80KM` = `3000`, extra KM `18`, extra HR `180`, higher-of enabled
- `4HR40KM` = `2000`, extra KM `18`, extra HR `180`, higher-of enabled

### `TSM FY26 Active Chart`
Use to show:
- fuel formula local chart
- fixed route override

Rules:
- local fuel formula = `KM / 10 x 102.15`
- fixed route `TSM -> BBSR` = `4000`

### `UNIT-4 FY26 Active Chart`
Use to show category-specific fuel pricing.

Rules:
- `4AIR BAG` = `KM / 12 x 102.15`
- `6AIR BAG` = `KM / 10 x 102.15`

### `NTPC FY26 Active Chart`
Use to show local-to-long threshold.

Rules:
- local `8HR80KM` = `2800`, extra KM `16`, extra HR `160`
- above `250 KM`, apply long package at `22/KM`

### `IFFCO FY26 Active Chart`
Use to show:
- outstation per-KM pricing
- night halts
- OT on long day hours
- no-km-cap field present

Rules:
- local `10HR80KM` = `3200`, extra KM `20`, extra HR `200`
- outstation = `25/KM`, night halt `500`, OT `200`, long day hours `10`

### `MCL Annexure Demo Chart`
Use to show clean annexure billing at `24/KM`.

## Phase 3 Walkthrough
Open `Trips`.

### `GT-TRP-1001`
Use to show:
- completed duty slip
- 2 travel metric rows
- higher-of package result
- direct billed trip

Expected billing:
- total KM `110`
- total hours `10`
- final amount `3540`

### `GT-TRP-1002`
Use to show fixed route pricing.

Expected billing:
- fixed route `TSM -> BBSR`
- final amount `4000`

### `GT-TRP-1003`
Use to show 4AIR fuel formula.

Expected billing:
- total KM `120`
- final amount `1021.50`

### `GT-TRP-1004`
Use to show in-progress duty-slip behaviour.

Expected state:
- one completed metric row
- one open metric row
- trip status `in_progress`

### `GT-TRP-1005`
Use to show threshold upgrade from local to long.

Expected billing:
- total KM `300`
- applied long pricing `22/KM`
- final amount `6600`
- inter-state customer for IGST billing

### `GT-TRP-1006`
Use to show IFFCO outstation pricing.

Expected billing:
- total KM `400`
- night halts `2`
- base `10000`
- night halt charge `1000`
- final amount `11000`

### Expense examples
- `GT-TRP-1001` has fuel and toll expenses
- `GT-TRP-1006` has parking and food expenses

## Phase 4 Walkthrough
### Direct trip invoices already seeded
Open `Customer Invoices`.

Direct invoices:
- `GTINV-00001` for `GT-TRP-1001`
- `GTINV-00002` for `GT-TRP-1005`

### Pre-billed annexure scenario
Use parent trip `GT-TRP-2001`.

Child trips:
- `GT-TRP-2001-A01`
- `GT-TRP-2001-A02`
- `GT-TRP-2001-A03`

Annexure billing state:
- `ANN-01` billed singly on `GTINV-00003`
- `ANN-02` and `ANN-03` billed together on `GTINV-00004`

Expected amounts:
- `ANN-01` = `2880`
- `ANN-02` = `3360`
- `ANN-03` = `2640`
- grouped invoice subtotal for `ANN-02 + ANN-03` = `6000`

### Live annexure creation demo
Use parent trip `GT-TRP-2002`.

This trip is intentionally left without annexures so we can create them live during the client demo.

Expected parent totals:
- total KM `260`
- total hours `7`
- final amount `6240`

## Phase 5 Walkthrough
### Tax Config
Open `Tax Config` as `admin` or `accountant`.

Rows seeded:
- `CGST` active `2.5%` for intra-state
- `SGST` active `2.5%` for intra-state
- `IGST` active `5%` for inter-state
- `GREENFEE` inactive flat component to show non-percentage config

### Manual invoice and tax snapshots
Use `GTINV-00005` to show a manual invoice with dynamic tax snapshot rows.

Expected tax:
- subtotal `12500`
- IGST `625`
- total `13125`
- source type `manual`

### Intra-state vs inter-state examples
- intra-state invoices: `GTINV-00001`, `GTINV-00003`, `GTINV-00004`
- inter-state invoices: `GTINV-00002`, `GTINV-00005`

## Collections And Settlements
### Collections
- `GTCOL-0001` partial receipt against `GTINV-00001`
- `GTCOL-0002` full receipt against `GTINV-00002`
- `GTCOL-0003` full receipt against `GTINV-00003`

### Settlements
- `GTDST-0001` driver settlement for `GTDRV001`
- `GTOST-0001` owner settlement for `GTOWN001`

## Suggested Demo Order
1. Login as `admin`.
2. Show `Customers`, `Drivers`, `Vehicles`, `Vehicle Categories`, `Leads`.
3. Show each GT rate chart and explain one scenario per customer.
4. Open `GT-TRP-1001`, `GT-TRP-1002`, `GT-TRP-1004`, `GT-TRP-1005`, `GT-TRP-1006`.
5. Open `GT-TRP-2001` for pre-billed annexure examples.
6. Open `GT-TRP-2002` and create annexures live.
7. Open `Customer Invoices` and download one direct invoice plus one grouped annexure invoice PDF.
8. Open `Tax Config` and explain active vs inactive components.
9. Open `GTINV-00005` as the manual invoice example.

## Source References
This seed set was aligned against:
- [GT-Specific/GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md)
- [GT-Specific/GT-Specs4.md](/C:/travelerp/GT-Specific/GT-Specs4.md)
- [GT-Specific/GT-Specs5.md](/C:/travelerp/GT-Specific/GT-Specs5.md)
- [GT-Specific/Test-Results.md](/C:/travelerp/GT-Specific/Test-Results.md)
