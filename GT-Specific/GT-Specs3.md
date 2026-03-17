
# GT Detailed Specs - Phase 3 Duty Slips And Enhanced Trips

## Purpose
This document expands Phase 3 from [GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md): GT duty slips and the trip-form enhancement layer. The goal of this phase is to turn the current trip module into a rate-chart-backed duty-slip workflow without breaking the existing trip completion and auto-invoice behavior.

Phase 3 must produce three stable foundations:

- a trip schema that stores duty-slip context and a calculation snapshot
- a travel-metrics subresource for multi-row duty movement capture
- frontend and backend flows to calculate, save, and print GT duty slips

Phase 3 must integrate the Phase 2 rate engine, but it must not yet generate annexure rows or GT invoice PDFs. Those remain Phase 4 work.

## Current Baseline
Based on the current codebase after Phase 2 work:

- [schema.sql](/C:/travelerp/server/db/schema.sql) now has `vehicle_categories`, `duty_type`, `rate_charts`, `rate_chart_items`, and `rate_chart_fixed_routes`, but the `trips` table is still the older manual structure.
- [rate-engine.ts](/C:/travelerp/server/src/utils/rate-engine.ts) exists and can resolve active charts, fixed routes, packages, and long-trip fallback logic, but no trip endpoint invokes it yet.
- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts) still creates and updates trips with a manual `trip_amount`, plus the existing trip-expense CRUD and auto-invoice-on-completion behavior.
- [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) still uses the basic trip form with customer, driver, vehicle, route text, status, amount, and inline expenses only.
- [types.ts](/C:/travelerp/src/lib/types.ts) now contains Phase 2 rate-chart types, but the trip interfaces still do not expose duty-slip fields, metrics, or rate breakdown snapshots.

## Critical Design Clarifications
Phase 3 needs a few design refinements beyond the high-level plan so the trip module can consume Phase 2 pricing safely and keep historical billing auditability intact.

### 1. Rate Source Lineage Must Support Fixed Routes
The plan listed only `rate_chart_item_id`, but a trip can price from a fixed route without a package item. Phase 3 must therefore store enough source lineage to explain exactly what happened.

Phase 3 should add to `trips`:

- `rate_chart_id`
- `rate_chart_item_id`
- `rate_chart_fixed_route_id`

Rules:

- `rate_chart_id` identifies which chart was used during calculation
- `rate_chart_item_id` is nullable when a fixed route fully overrides package pricing
- `rate_chart_fixed_route_id` is nullable for package-driven trips and required only when a fixed route match is applied

### 2. Vehicle Category Must Be Stored On The Trip
The mapped vehicle category on the vehicle master is only the default. Historical trip pricing must not change if a vehicle is later remapped to another GT category.

Phase 3 rule:

- `vehicle_category_id` is stored on `trips` as a pricing snapshot
- frontend may default it from the selected vehicle's current mapping
- operators may adjust it before calculation when operational assignment and billing category differ

### 3. Travel Metrics Totals Must Be Summed Per Row
Duty slips can contain multiple travel rows across a single trip. Totals must not be derived only from the first start and the last end values.

Phase 3 aggregation rule:

- each `trip_travel_metrics` row is a movement segment
- `segment_km = max(0, end_km - start_km)`
- `segment_hours = end_timestamp - start_timestamp`
- `total_km = sum(segment_km)` across completed rows
- `total_hours = sum(segment_hours)` across completed rows

Compatibility rule:

- existing `trips.start_time`, `trips.end_time`, `trips.start_km`, `trips.end_km`, and `trips.actual_km` remain populated as compatibility snapshots derived from the metrics table

### 4. Night Halts Stay Explicit In Phase 3
Phase 2 intentionally did not derive `night_halts` from `long_night_halt_hours`. Phase 3 must keep the same discipline.

Phase 3 rule:

- `night_halts` is an explicit operator-entered integer on the trip
- the backend must not invent night-halt counts from travel metrics or long-hour configuration
- `long_night_halt_hours` remains a stored configuration field for later annexure logic, not a derivation rule yet

### 5. Calculated Amount And Final Bill Amount Are Different Things
The GT workflow needs both the calculated rate-engine result and an editable final bill value. The existing invoice flow already depends on `trip_amount`, so Phase 3 must preserve that contract.

Phase 3 rule:

- `calculated_amount` and the calculation component fields store the engine result snapshot
- `trip_amount` remains the editable billed amount used by current invoice generation
- the calculate flow may suggest or sync `trip_amount`, but operators must still be able to override it before completion

### 6. Existing Manual Trips Must Continue To Work
The current app already supports non-GT manual trips and auto-invoices from `trip_amount`. Phase 3 must not break that path.

Phase 3 rule:

- new GT duty-slip fields must be nullable or safely backfilled for existing rows
- GT calculation endpoints should reject missing GT prerequisites with clear errors instead of breaking manual legacy trips
- non-GT trips may continue using manual `trip_amount` without a duty-slip calculation

### 7. Parent Trip And Annexure Fields Are Storage Only In This Phase
The plan mentioned `is_long_trip`, `parent_trip_id`, and `annexure_number`. Those are needed now for continuity, but annexure generation itself is still a later phase.

Phase 3 rule:

- store and expose `is_long_trip`, `parent_trip_id`, and `annexure_number`
- do not create annexure rows in this phase
- do not add grouped billing logic in this phase

### 8. OT And Fixed-Route Charges Must Be Preserved As Snapshot Fields
The Phase 2 rate engine can return `ot_charge` and a fixed-route amount, but the high-level plan only listed some component fields. Phase 3 must not throw away those values when persisting a calculation snapshot.

Phase 3 must therefore store on `trips`:

- `fixed_route_charge`
- `ot_charge`

This keeps the saved duty-slip breakdown aligned with the Phase 2 engine output.

## Scope Of Phase 3
This phase includes:

1. extending `trips` to store duty-slip data and pricing snapshot fields
2. creating the `trip_travel_metrics` table and subresource CRUD
3. integrating the Phase 2 rate engine into trip calculation
4. updating the trip UI into a GT duty-slip workflow
5. generating a single-trip duty-slip PDF
6. preserving the current invoice-generation flow based on `trip_amount`

## Explicitly Out Of Scope
The following remain out of scope for Phase 3:

- creating annexure rows or annexure billing flows
- GT invoice PDF generation
- invoice tax-component refactor
- grouped multi-day annexure billing
- tax configuration UI
- owner or driver settlement redesign

## Deliverable Summary
Phase 3 is complete only when an operator can:

- create or edit a trip with GT duty-slip fields
- capture multiple travel-metric rows against that trip
- calculate pricing from the active rate chart and save the snapshot on the trip
- override `trip_amount` manually after calculation when needed
- complete the trip and keep current auto-invoice generation working through `trip_amount`
- download a duty-slip PDF for the saved trip

## Database Specification

### 1. Update `trips`
Purpose: store GT duty-slip context, advances, and the calculation snapshot alongside the existing trip record.

Required new columns:

- `duty_type duty_type null`
- `booked_by text null`
- `report_to text null`
- `vehicle_category_id uuid null references vehicle_categories(id)`
- `rate_chart_id uuid null references rate_charts(id)`
- `rate_chart_item_id uuid null references rate_chart_items(id)`
- `rate_chart_fixed_route_id uuid null references rate_chart_fixed_routes(id)`
- `total_hours numeric(8,2) null`
- `night_halts integer null`
- `advance_hirer numeric(15,2) not null default 0`
- `advance_travels numeric(15,2) not null default 0`
- `fuel_advance numeric(15,2) not null default 0`
- `cash_advance numeric(15,2) not null default 0`
- `base_charge numeric(15,2) not null default 0`
- `extra_km_charge numeric(15,2) not null default 0`
- `extra_hr_charge numeric(15,2) not null default 0`
- `night_halt_charge numeric(15,2) not null default 0`
- `fuel_charge numeric(15,2) not null default 0`
- `fixed_route_charge numeric(15,2) not null default 0`
- `ot_charge numeric(15,2) not null default 0`
- `calculated_amount numeric(15,2) null`
- `is_long_trip boolean not null default false`
- `parent_trip_id uuid null references trips(id)`
- `annexure_number text null`

Constraints and indexes:

- numeric snapshot fields must be `0` or positive
- `total_hours` must be `null` or non-negative
- `night_halts` must be `null` or non-negative
- `parent_trip_id` cannot equal the row's own `id` by application validation
- indexes on `vehicle_category_id`, `rate_chart_id`, `rate_chart_item_id`, `rate_chart_fixed_route_id`, and `parent_trip_id`

Required semantics:

- `trip_amount` remains the final editable billed amount
- `calculated_amount` stores the last engine result
- compatibility fields `start_time`, `end_time`, `start_km`, `end_km`, and `actual_km` remain populated from travel metrics for existing reports and invoice flows
- `is_long_trip` reflects the applied billing mode, not just the requested duty type

### 2. New Table: `trip_travel_metrics`
Purpose: capture multiple start/end movement rows for one duty slip.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `trip_id uuid not null references trips(id) on delete cascade`
- `seq integer not null`
- `start_date date not null`
- `start_time time not null`
- `start_km numeric(10,2) not null`
- `end_date date null`
- `end_time time null`
- `end_km numeric(10,2) null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique on `trip_id, seq`
- check `seq > 0`
- check `start_km >= 0`
- check `end_km is null or end_km >= start_km`
- check end fields are either all null or all present
- index on `trip_id`

Backend validation:

- when end fields are present, combined end timestamp must not be earlier than combined start timestamp
- calculation should reject trips with incomplete metric rows rather than silently ignoring them

### 3. Migration Files
Create:

- [003_duty_slips.sql](/C:/travelerp/server/db/migrations/003_duty_slips.sql)

Also update:

- [schema.sql](/C:/travelerp/server/db/schema.sql)
## Backend Specification

### 1. Primary Route File
Update:

- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts)

Create:

- [pdf-duty-slip.ts](/C:/travelerp/server/src/utils/pdf-duty-slip.ts)

A small trip-metric aggregation helper is recommended if that keeps the route file readable.

### 2. Required Endpoints

#### Trip Core
- `GET /api/trips`
- `GET /api/trips/:id`
- `POST /api/trips`
- `PUT /api/trips/:id`
- `DELETE /api/trips/:id`

#### Travel Metrics
- `GET /api/trips/:id/travel-metrics`
- `POST /api/trips/:id/travel-metrics`
- `PUT /api/trips/:id/travel-metrics/:metricId`
- `DELETE /api/trips/:id/travel-metrics/:metricId`

#### Calculation And PDF
- `POST /api/trips/:id/calculate`
- `GET /api/trips/:id/duty-slip-pdf`

#### Existing Subresources That Must Still Work
- `GET /api/trips/:id/expenses`
- `POST /api/trips/:id/expenses`
- `PUT /api/trips/:id/expenses/:expenseId`
- `DELETE /api/trips/:id/expenses/:expenseId`

### 3. Trip Detail Response Shape
`GET /api/trips/:id` should return a nested payload like:

```ts
{
  id,
  trip_number,
  trip_date,
  status,
  duty_type,
  booked_by,
  report_to,
  trip_amount,
  calculated_amount,
  total_hours,
  night_halts,
  is_long_trip,
  annexure_number,
  customer: { id, name, customer_code },
  driver: { id, name, driver_code, phone },
  vehicle: { id, vehicle_number, vehicle_type },
  vehicle_category: { id, name } | null,
  rate_chart_id,
  rate_chart_item_id,
  rate_chart_fixed_route_id,
  advance_hirer,
  advance_travels,
  fuel_advance,
  cash_advance,
  base_charge,
  extra_km_charge,
  extra_hr_charge,
  night_halt_charge,
  fuel_charge,
  fixed_route_charge,
  ot_charge,
  metrics: TripTravelMetric[],
  expenses: TripExpense[]
}
```

List endpoint requirements:

- existing summary list must continue to work
- add enough GT summary fields for operators to scan duty type, vehicle category, calculated amount, and long-trip state without opening each trip
- legacy trips with null GT fields must still serialize cleanly

### 4. Calculation Endpoint Behavior
`POST /api/trips/:id/calculate`

Recommended request body:

```ts
{
  package_code?: string | null,
  force_sync_trip_amount?: boolean
}
```

Required backend flow:

1. load the trip, metrics, and any needed customer / vehicle-category context
2. validate GT prerequisites: `customer_id`, `trip_date`, `duty_type`, and `vehicle_category_id`
3. aggregate `total_km` and `total_hours` from `trip_travel_metrics`
4. use explicit `package_code` when supplied
5. invoke the Phase 2 rate engine
6. persist source ids and snapshot fields on `trips`
7. update compatibility columns such as `actual_km`, `start_km`, `end_km`, `start_time`, and `end_time`
8. return the updated trip detail plus the full calculation breakdown

Required persistence rules:

- set `rate_chart_id`, `rate_chart_item_id`, and `rate_chart_fixed_route_id` from the engine result
- set `base_charge`, `extra_km_charge`, `extra_hr_charge`, `night_halt_charge`, `fuel_charge`, `fixed_route_charge`, `ot_charge`, and `calculated_amount`
- set `is_long_trip = true` when the applied duty type resolves to long pricing
- set `total_hours` from metric aggregation
- set `actual_km` from metric aggregation

`trip_amount` synchronization rule:

- if `force_sync_trip_amount = true`, copy `calculated_amount` into `trip_amount`
- otherwise, sync `trip_amount` only when it is empty or still equal to the prior calculated amount
- do not silently overwrite a clear manual override

### 5. Travel Metric Aggregation Rules
The backend must use deterministic aggregation logic.

Metric ordering rule:

- order by `seq asc`

Derived compatibility snapshots:

- `start_time` comes from the first metric row
- `end_time` comes from the last completed metric row
- `start_km` comes from the first metric row
- `end_km` comes from the last completed metric row
- `actual_km` is the sum of segment KM values, not just `last_end_km - first_start_km`

Calculation gate:

- if there are zero metric rows, return a validation error
- if any metric row is incomplete, calculation must fail with a clear message
- if package selection is required and none is supplied, bubble up the engine's package-selection error cleanly

### 6. Trip Create / Update Behavior
Phase 3 extends the existing trip endpoints instead of replacing them.

Required behavior:

- `POST /api/trips` and `PUT /api/trips/:id` must accept the new GT fields
- GT fields remain optional for legacy trips
- expense CRUD must keep working unchanged
- completing a trip must continue to trigger the current auto-invoice path, which still uses `trip_amount`

Completion guardrail:

- Phase 3 frontend should encourage calculation before marking GT trips completed
- backend must still allow legacy manual completion for non-GT trips

### 7. Duty Slip PDF Behavior
`GET /api/trips/:id/duty-slip-pdf`

Required content:

- company header from system settings
- trip number and trip date
- customer name and contact context
- booked-by and report-to fields
- driver, vehicle, and vehicle category
- duty type and selected package or fixed route source
- travel metrics table in sequence order
- advances section
- rate breakdown section
- final billed amount and calculated amount when overridden
- remarks

Phase 3 rule:

- duty-slip PDF is a single-trip document only
- no annexure pages are generated yet

### 8. Validation Rules
The API must reject:

- negative advance values
- negative snapshot charge values
- negative `night_halts`
- negative `total_hours`
- self-referencing `parent_trip_id`
- invalid or incomplete metric end fields
- end timestamp earlier than start timestamp
- calculation attempts with no active rate chart
- calculation attempts with multiple matching packages and no explicit package selection
- calculation attempts when GT-required fields are missing

### 9. Backend Non-Goals For Phase 3
Do not in this phase:

- create annexure rows
- implement grouped annexure billing
- change invoice PDF generation to GT format
- refactor GST logic to dynamic tax components
- redesign collections, settlements, or reports around duty-slip snapshots yet

## Frontend Specification

### 1. Shared Types
Update:

- [types.ts](/C:/travelerp/src/lib/types.ts)

Add or extend:

- `TripTravelMetric`
- `TripDetail`
- GT duty-slip fields on `Trip`
- `TripCalculationResult` or reuse the Phase 2 rate-calculation type for trip display

### 2. Trip UI Strategy
Phase 3 should keep the current Trips page but upgrade its form experience.

Recommended file plan:

- keep [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) as the page shell
- create [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx) for the enhanced create/edit experience
- create [TripCalculationBreakdown.tsx](/C:/travelerp/src/components/Trips/TripCalculationBreakdown.tsx) for the saved or previewed breakdown

### 3. Duty Slip Form Requirements
The enhanced trip form must support:

- trip number, trip date, and status
- customer selection
- duty type selector
- booked-by and report-to fields
- vehicle category selector
- package selector sourced from the active rate chart when relevant
- vehicle and driver selection
- advances section
- remarks and manual billed amount override
- calculate button
- duty-slip PDF button for saved trips

Data-loading rules:

- when customer and trip date are selected, fetch the active chart using the Phase 2 lookup endpoint
- when duty type and vehicle category are selected, show matching package options
- when a vehicle is selected, default vehicle category from its mapped GT category if available
- when a driver is selected, surface its default vehicle relationship where helpful, but do not force it

### 4. Travel Metrics UX Requirements
The duty-slip UI must include a metrics section with:

- add row
- edit row
- delete row
- explicit `seq` ordering
- start date, start time, start km
- end date, end time, end km
- derived segment KM and segment hours for operator visibility
- aggregate total KM and total hours at the bottom

UX rules:

- default new `seq` to the next available integer
- calculation button should be disabled or blocked when any metric row is incomplete
- open rows may still be saved while the trip is in progress

### 5. Calculation Breakdown Component
`TripCalculationBreakdown.tsx` must show:

- applied chart name
- applied package label or fixed-route description
- requested vs applied duty type
- each returned line item from the rate engine
- warnings from the rate engine
- calculated amount
- current `trip_amount` when manually overridden

### 6. Frontend Save And Calculate Flow
Required operator flow:

1. save the trip shell and metrics
2. run calculate
3. inspect the breakdown
4. optionally adjust `trip_amount`
5. save the trip again if needed
6. complete the trip when ready

Phase 3 rule:

- calculation must not auto-complete the trip
- manual override of `trip_amount` must remain visible and intentional

## Suggested Files To Create
- [003_duty_slips.sql](/C:/travelerp/server/db/migrations/003_duty_slips.sql)
- [pdf-duty-slip.ts](/C:/travelerp/server/src/utils/pdf-duty-slip.ts)
- [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx)
- [TripCalculationBreakdown.tsx](/C:/travelerp/src/components/Trips/TripCalculationBreakdown.tsx)

Recommended support files:

- `server/src/utils/trip-metrics.ts`
- `server/src/utils/duty-slip-pdf.test.ts`

## Acceptance Criteria

### Database
- migration runs cleanly on top of Phase 2
- `trips` stores GT duty-slip context and calculation snapshot fields without breaking existing data
- `trip_travel_metrics` supports multiple rows per trip with deterministic ordering

### Calculation Flow
- calculate endpoint resolves the active chart and selected package correctly
- fixed-route results persist source ids and snapshot charges correctly
- local-to-long upgrades persist `is_long_trip = true` and the right source linkage
- compatibility fields like `actual_km` and `start_time/end_time` stay synchronized from metrics
- `trip_amount` remains editable after calculation

### Frontend
- operators can create and edit duty slips with metrics rows and advances
- package choices appear only when the active chart and duty context support them
- calculation breakdown is visible before trip completion
- duty-slip PDF downloads for saved trips

### Regression Safety
- existing trip expense CRUD still works
- existing trip list still loads legacy trips with null GT fields
- completing a trip still auto-generates invoices from `trip_amount`
- non-GT manual trips are still supported

## Suggested Implementation Order
1. Add the Phase 3 migration and update `schema.sql`.
2. Implement `trip_travel_metrics` CRUD and trip detail loading.
3. Integrate the Phase 2 rate engine through `POST /api/trips/:id/calculate`.
4. Persist calculation snapshot fields and preserve invoice-generation compatibility.
5. Build `DutySlipForm` and `TripCalculationBreakdown`.
6. Add duty-slip PDF generation.
7. Verify legacy manual trip behavior is unchanged.

## Verification Checklist
- create a GT trip with `customer`, `duty_type`, `vehicle_category_id`, and at least two metric rows
- calculate the trip and confirm snapshot fields populate on the trip
- manually change `trip_amount` after calculation and confirm the override remains visible
- complete the trip and confirm invoice generation still uses the current `trip_amount`
- create a fixed-route trip and confirm the fixed-route source is stored
- create a local trip that crosses the long-threshold path and confirm long pricing is applied
- download the duty-slip PDF and confirm metrics plus breakdown render correctly
- open and save a legacy manual trip with no GT fields and confirm it still works

## Phase 3 Exit Condition
Phase 3 is done when trips behave as GT duty slips powered by Phase 2 charts, with travel metrics, saved calculation snapshots, manual bill override support, and duty-slip PDF output, while the existing invoice generation still works through `trip_amount` and annexures remain deferred to Phase 4.
