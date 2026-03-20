# GT Detailed Specs - Phase 2 Rate Chart Engine

## Purpose
This document expands Phase 2 from [GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md): the GT rate chart engine. The goal of this phase is to make customer-specific pricing configurable and reusable before any trip-form or duty-slip refactor starts.

Phase 2 must produce three stable foundations:

- a customer-linked rate chart data model
- a deterministic rate calculation engine
- admin UI to maintain rate charts, packages, and fixed routes

This phase must not break the current manual trip amount and auto-invoice flow. That integration happens in Phase 3.

## Current Baseline
Based on the current codebase after Phase 1 work:

- [schema.sql](/C:/travelerp/server/db/schema.sql) now has `duty_type`, `vehicle_categories`, and GT defaults, but still has no rate chart tables.
- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts) still treats `trip_amount` as a manual amount and auto-generates invoices from that amount.
- [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) still uses the basic trip form with no package selection, no duty type, and no rate breakdown.
- [invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts) still uses the current GST invoice flow with no GT rate engine dependency.
- The Phase 1 UI now has vehicle categories and GT master defaults, which Phase 2 can reuse.

## Critical Design Clarifications
Phase 2 needs a few design refinements beyond the high-level plan so the implementation can handle GT's actual pricing patterns.

### 1. Multiple Packages Require Package Identity
The plan says the operator manually selects package tiers such as `8HR/80KM` vs `4HR/40KM`. That means `rate_chart_items` cannot be unique only by `rate_chart_id + vehicle_category_id + duty_type`.

Phase 2 must therefore add:

- `package_code`
- `package_label`
- `sort_order`
- `is_default`

Uniqueness becomes:

- `rate_chart_id + vehicle_category_id + duty_type + package_code`

### 2. Fixed Routes Must Be Scoped By Duty Type
The plan listed fixed routes by chart, category, and locations only. That is too loose because the same route text could exist in more than one billing context.

Phase 2 must therefore include `duty_type` on fixed routes so route-based overrides only apply within the requested billing context.

### 3. Route Matching Must Be Exact And Normalized
Fixed route matching must not rely on fuzzy or partial text matching. The backend must normalize location text by trimming, collapsing spaces, and uppercasing before matching.

Phase 2 matching rule:

- exact normalized `from_location`
- exact normalized `to_location`
- exact `duty_type`
- exact `vehicle_category_id`

Reverse direction is not automatic. If both directions have different or same prices, both rows must exist.

### 4. The IFFCO KM Cap Rule Is Still Ambiguous
The plan's `no_km_limit_cap` idea is not precise enough because GT's open question references a numeric threshold like `450KM`.

Phase 2 must therefore store this as:

- `no_km_limit_cap_km numeric(10,2) null`

Behavior:

- `null` means no special cap rule configured
- a numeric value means the config is stored and exposed
- the engine must not invent custom math for this field until GT confirms the business meaning

### 5. Some Long-Trip Fields Are Configuration Now, Full Usage Later
`long_day_hours` and `long_night_halt_hours` should be stored in Phase 2 because they belong to the pricing model, but their full use depends on Phase 3 duty-slip metrics and Phase 4 annexures.

Phase 2 rule:

- store and validate these fields now
- allow the engine to use `long_day_hours` only when enough aggregate input exists
- do not derive night halts from `long_night_halt_hours` yet

## Scope Of Phase 2
This phase includes:

1. database tables for rate charts, items, and fixed routes
2. backend CRUD for those entities
3. an internal rate engine utility for deterministic calculation
4. frontend admin screens to create and maintain charts
5. duplication flow for copying one customer's chart to another customer
6. active-rate-chart lookup for a given customer and date

## Explicitly Out Of Scope
The following remain out of scope for Phase 2:

- altering `trips` table
- replacing the current trip form with duty slip fields
- auto-calculating trip amount during trip creation
- duty-slip PDF generation
- annexure logic
- GT invoice PDF logic
- tax component refactor

## Deliverable Summary
Phase 2 is complete only when an admin or operator can:

- create a rate chart for a specific customer and effective period
- maintain multiple package rows per duty type and vehicle category
- maintain duty-type-specific fixed route overrides
- duplicate an existing rate chart to another customer
- fetch the active chart for a customer on a given date
- run the internal rate engine against known GT fixtures and get deterministic results

## Database Specification

### 1. New Table: `rate_charts`
Purpose: chart header scoped to a customer and an effective date range.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `customer_id uuid not null references customers(id)`
- `name text not null`
- `effective_from date not null`
- `effective_to date null`
- `is_active boolean not null default true`
- `notes text null`
- `created_by uuid null references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- check: `effective_to is null or effective_to >= effective_from`
- index on `customer_id`
- index on `(customer_id, is_active, effective_from, effective_to)`
- application-level validation must block overlapping active date ranges for the same customer
- database-level exclusion constraint is recommended if implemented cleanly

Active chart resolution rule:

- a customer should have at most one active chart for any given date

### 2. New Table: `rate_chart_items`
Purpose: package-level pricing rules for one chart, one vehicle category, one duty type.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `rate_chart_id uuid not null references rate_charts(id) on delete cascade`
- `vehicle_category_id uuid not null references vehicle_categories(id)`
- `duty_type duty_type not null`
- `package_code text not null`
- `package_label text not null`
- `sort_order integer not null default 0`
- `is_default boolean not null default false`
- `base_hours numeric(6,2) null`
- `base_km numeric(10,2) null`
- `base_amount numeric(12,2) null`
- `extra_km_rate numeric(12,2) null`
- `extra_hr_rate numeric(12,2) null`
- `fuel_divisor numeric(10,4) null`
- `fuel_price_per_unit numeric(12,4) null`
- `night_halt_rate numeric(12,2) null`
- `fixed_amount numeric(12,2) null`
- `use_higher_of_km_hr boolean not null default false`
- `per_km_rate numeric(12,2) null`
- `ot_rate numeric(12,2) null`
- `long_km_threshold numeric(10,2) null`
- `no_km_limit_cap_km numeric(10,2) null`
- `long_day_hours numeric(6,2) null`
- `long_night_halt_hours numeric(6,2) null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique on `rate_chart_id, vehicle_category_id, duty_type, package_code`
- optional partial unique rule so only one `is_default = true` item exists per `rate_chart_id + vehicle_category_id + duty_type`
- indexes on `rate_chart_id` and `vehicle_category_id`
- numeric fields must be `null` or non-negative

Required semantics:

- `package_code` is a stable internal identifier such as `8HR80KM`, `4HR40KM`, `LONG_STD`
- `package_label` is the GT-facing display text shown in the dropdown and admin UI
- `is_default` is used for ordering and fallback resolution only; it must not bypass explicit operator selection when multiple packages exist

### 3. New Table: `rate_chart_fixed_routes`
Purpose: fixed route override prices such as `TSM TO BBSR = 4000`.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `rate_chart_id uuid not null references rate_charts(id) on delete cascade`
- `vehicle_category_id uuid not null references vehicle_categories(id)`
- `duty_type duty_type not null`
- `from_location text not null`
- `to_location text not null`
- `from_location_key text not null`
- `to_location_key text not null`
- `fixed_amount numeric(12,2) not null`
- `description text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique on `rate_chart_id, vehicle_category_id, duty_type, from_location_key, to_location_key`
- index on `rate_chart_id`
- index on `vehicle_category_id`
- `fixed_amount > 0`

Backend ownership:

- UI sends `from_location` and `to_location`
- backend derives `from_location_key` and `to_location_key`
- normalization logic must be shared between create, update, and engine lookup

### 4. Migration Files
Create:

- [002_rate_charts.sql](/C:/travelerp/server/db/migrations/002_rate_charts.sql)

Also update:

- [schema.sql](/C:/travelerp/server/db/schema.sql)

## Backend Specification

### 1. New Route File
Create:

- [rate-charts.routes.ts](/C:/travelerp/server/src/routes/rate-charts.routes.ts)

Mount it from:

- [index.ts](/C:/travelerp/server/src/index.ts)

### 2. Required Endpoints

#### Chart Header
- `GET /api/rate-charts`
- `GET /api/rate-charts/:id`
- `POST /api/rate-charts`
- `PUT /api/rate-charts/:id`
- `DELETE /api/rate-charts/:id`

#### Rate Chart Items
- `POST /api/rate-charts/:id/items`
- `PUT /api/rate-chart-items/:itemId`
- `DELETE /api/rate-chart-items/:itemId`

#### Fixed Routes
- `POST /api/rate-charts/:id/fixed-routes`
- `PUT /api/rate-chart-fixed-routes/:routeId`
- `DELETE /api/rate-chart-fixed-routes/:routeId`

#### Utility Endpoints
- `POST /api/rate-charts/:id/duplicate`
- `GET /api/customers/:id/rate-chart?date=YYYY-MM-DD`

### 3. Endpoint Response Shape
`GET /api/rate-charts/:id` should return a nested payload like:

```ts
{
  id,
  customer: { id, name, customer_code },
  name,
  effective_from,
  effective_to,
  is_active,
  notes,
  items: RateChartItem[],
  fixed_routes: RateChartFixedRoute[]
}
```

List endpoint should support optional filters:

- `customer_id`
- `active=true|false`
- `date=YYYY-MM-DD`

### 4. Duplicate Endpoint Behavior
`POST /api/rate-charts/:id/duplicate`

Request body:

```ts
{
  customer_id: string,
  name?: string,
  effective_from?: string,
  effective_to?: string | null,
  is_active?: boolean,
  notes?: string | null
}
```

Rules:

- clone the header, items, and fixed routes
- generate new ids and timestamps
- set `created_by` to the current user
- default duplicated chart to `is_active = false` unless explicitly requested otherwise
- if `customer_id` differs, keep all pricing rows unchanged except ids and header ownership

### 5. Active Chart Lookup Rules
`GET /api/customers/:id/rate-chart?date=YYYY-MM-DD`

Rules:

- if `date` is omitted, default to today's date
- find exactly one active chart where `effective_from <= date` and `effective_to is null or effective_to >= date`
- if none exists, return `404`
- if multiple exist because of bad setup, return `409` with a configuration error

### 6. New Utility: `rate-engine.ts`
Create:

- [rate-engine.ts](/C:/travelerp/server/src/utils/rate-engine.ts)

Implementation structure must stay testable:

- one pure calculation layer with no SQL calls
- one small data-resolution layer that fetches chart, item, and fixed-route context

Recommended shape:

```ts
interface RateCalculationInput {
  customer_id: string;
  trip_date: string;
  duty_type: DutyType;
  vehicle_category_id: string;
  package_code?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  total_km: number;
  total_hours: number;
  night_halts?: number;
}

interface RateCalculationResult {
  rate_chart_id: string;
  rate_chart_item_id: string | null;
  package_code: string | null;
  package_label: string | null;
  requested_duty_type: DutyType;
  applied_duty_type: DutyType;
  applied_fixed_route_id: string | null;
  line_items: Array<{
    code: string;
    label: string;
    amount: number;
    meta?: Record<string, unknown>;
  }>;
  totals: {
    base_charge: number;
    extra_km_charge: number;
    extra_hr_charge: number;
    fuel_charge: number;
    night_halt_charge: number;
    ot_charge: number;
    fixed_amount: number;
    final_amount: number;
  };
  warnings: string[];
}
```

### 7. Rate Engine Resolution Rules

#### Step 1. Resolve Active Chart
Find the active chart for `customer_id + trip_date`.

#### Step 2. Check Fixed Route Override
If `from_location`, `to_location`, `vehicle_category_id`, and `duty_type` are present:

- normalize route keys
- look for an exact fixed route match
- if found, return a single-line fixed route result immediately

#### Step 3. Resolve Candidate Items
Find items for:

- active chart
- selected `vehicle_category_id`
- requested `duty_type`

#### Step 4. Resolve Package Selection
- if zero items exist, return `RATE_ITEM_NOT_FOUND`
- if one item exists and `package_code` is empty, auto-select it
- if multiple items exist and `package_code` is empty, return `PACKAGE_SELECTION_REQUIRED`
- if `package_code` is provided, select by exact match

#### Step 5. Handle Local-To-Long Upgrade
If the selected item is `local` and `long_km_threshold` is set and `total_km > long_km_threshold`:

- prefer using the long-calculation fields already present on the selected item if `per_km_rate` exists
- otherwise fall back to the default `long` item for the same chart and vehicle category
- if neither exists, return `INVALID_RATE_SETUP`

### 8. Calculation Rules

#### Fixed Route Result
If a fixed route matches:

- `final_amount = fixed_amount`
- do not add package extras on top of the fixed route amount in Phase 2
- return one clear breakdown line like `Fixed Route: TSM -> BBSR`

#### Package Calculation
For package-style items:

- `extra_km = max(0, total_km - base_km)`
- `extra_hours = max(0, total_hours - base_hours)`
- `extra_km_charge = extra_km * extra_km_rate`
- `extra_hr_charge = extra_hours * extra_hr_rate`
- `fuel_charge = (total_km / fuel_divisor) * fuel_price_per_unit` when both fields are present
- `night_halt_charge = night_halts * night_halt_rate`

If `use_higher_of_km_hr = true`:

- apply only the larger of `extra_km_charge` and `extra_hr_charge`
- do not add both

If `use_higher_of_km_hr = false`:

- add both charges normally

#### Long Calculation
For long/per-km items:

- `distance_charge = total_km * per_km_rate`
- `night_halt_charge = night_halts * night_halt_rate`
- `fuel_charge` may still apply if the fields are configured
- `ot_charge` applies only when `ot_rate` and `long_day_hours` are present and usable with the provided aggregate input

Phase 2 caution:

- `long_night_halt_hours` is stored but should not be used to derive `night_halts` yet
- if the math would require day-wise segmentation, defer that to Phase 3/4 instead of inventing behavior now

#### Rounding
- keep all internal calculations at normal floating precision
- round monetary line items to 2 decimals before final response
- round `final_amount` to 2 decimals

### 9. Validation Rules
The API must reject:

- empty `package_code` or `package_label`
- duplicate package code within the same chart/category/duty type
- duplicate fixed route key within the same chart/category/duty type
- negative numeric values
- `use_higher_of_km_hr = true` when neither extra rate exists
- `fuel_divisor` without `fuel_price_per_unit`, or vice versa
- `effective_to < effective_from`
- overlapping active charts for the same customer and date range

### 10. Backend Non-Goals For Phase 2
Do not in this phase:

- alter current trip create/update logic
- add `POST /api/trips/:id/calculate`
- write back to `trip_amount`
- change invoice generation to consume the rate engine

## Frontend Specification

### 1. Shared Types
Update:

- [types.ts](/C:/travelerp/src/lib/types.ts)

Add:

- `RateChart`
- `RateChartItem`
- `RateChartFixedRoute`
- `RateCalculationResult`
- `PageKey = 'rate-charts'`

### 2. Navigation
Update:

- [App.tsx](/C:/travelerp/src/App.tsx)
- [Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx)

Changes:

- add a `Rate Charts` page
- place it near `Customers` / `Vehicle Categories`
- no trip-form integration yet

### 3. New Screen: `RateChartList.tsx`
Create:

- [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx)

Required capabilities:

- list charts grouped or filterable by customer
- show active/inactive status
- show effective date range
- create chart header
- edit chart header
- duplicate chart
- open chart detail screen

### 4. New Screen: `RateChartDetail.tsx`
Create:

- [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx)

Required capabilities:

- chart header summary
- tabs or segmented sections by vehicle category
- within each vehicle category, group rows by `duty_type`
- show package label and pricing summary
- fixed routes section for the same category and duty type

### 5. New Form: `RateChartItemForm.tsx`
Create:

- [RateChartItemForm.tsx](/C:/travelerp/src/components/RateCharts/RateChartItemForm.tsx)

Required capabilities:

- create and edit item rows
- dynamic show/hide by `duty_type`
- package code and package label fields
- validation hints when required fields are missing
- separate sections for:
  - base package
  - extra rates
  - fuel formula
  - night halt
  - long-trip config
  - fixed amount

UI rules:

- for `local` and `outstation`, default to showing package fields first
- for `drop_pickup` and `station_drop`, prioritize `fixed_amount` and fixed route sections
- for `long`, prioritize per-km and OT sections
- show `no_km_limit_cap_km` as an advanced field with a note that the exact GT interpretation is pending

### 6. Fixed Route Editing
A separate component is optional, but the UI must support fixed route CRUD somewhere under the chart detail page.

Minimum fields:

- `vehicle_category`
- `duty_type`
- `from_location`
- `to_location`
- `fixed_amount`
- `description`

## Suggested Files To Create
- [002_rate_charts.sql](/C:/travelerp/server/db/migrations/002_rate_charts.sql)
- [rate-charts.routes.ts](/C:/travelerp/server/src/routes/rate-charts.routes.ts)
- [rate-engine.ts](/C:/travelerp/server/src/utils/rate-engine.ts)
- [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx)
- [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx)
- [RateChartItemForm.tsx](/C:/travelerp/src/components/RateCharts/RateChartItemForm.tsx)

Recommended test/support files:

- `server/src/utils/rate-engine.fixtures.ts`
- `server/src/utils/rate-engine.test.ts`

## Acceptance Criteria

### Database
- migration runs cleanly on top of Phase 1
- `schema.sql` reflects final Phase 2 shape
- overlapping active charts are blocked

### Chart CRUD
- a chart can be created for a customer with effective dates
- a chart can be duplicated to another customer
- items can be added for multiple packages under the same duty type and vehicle category
- fixed routes can be added without colliding across different duty types

### Active Chart Lookup
- the correct chart is returned for a customer and date
- `404` is returned when none exists
- `409` is returned when bad overlapping setup exists

### Calculation Engine
- fixed route match overrides package calculation only within the same duty type
- package selection is required when more than one package exists and none is supplied
- `use_higher_of_km_hr` applies only one of the two extra charges
- local-to-long upgrade behaves deterministically and does not silently fall through to wrong pricing
- all returned totals are rounded to 2 decimals

### Frontend
- operators can maintain chart headers, package items, and fixed routes without direct DB access
- package labels are visible and understandable in the UI
- the page can manage at least the five known GT customer patterns without code edits

### Regression Safety
- current trip create/update flow remains manual
- current invoice generation remains unchanged
- no existing Phase 1 master screen regresses

## Suggested Implementation Order
1. Add migration SQL and update `schema.sql`.
2. Implement backend CRUD for chart headers, items, and fixed routes.
3. Implement active-chart lookup and duplicate endpoint.
4. Build the pure rate engine utility and its fixtures/tests.
5. Extend shared frontend types and navigation.
6. Build `RateChartList`, `RateChartDetail`, and `RateChartItemForm`.
7. Run fixture-based verification for all known customer pricing patterns.

## Verification Checklist
- create one customer chart with two local packages for the same vehicle category
- verify duplicate package codes are blocked
- create a fixed route and confirm the normalized route key prevents duplicate variants caused by casing or extra spaces
- duplicate a chart to another customer and confirm all items and fixed routes clone correctly
- run engine fixtures for RBI, TSM, UNIT-4, NTPC, and IFFCO patterns
- confirm no trip or invoice endpoints changed behavior in this phase

## Phase 2 Exit Condition
Phase 2 is done when GT pricing is fully data-driven, testable, and maintainable in admin UI, with a calculation engine ready for trip integration in Phase 3.
