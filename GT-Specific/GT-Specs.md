# GT Detailed Specs - Phase 1 Foundation

## Purpose
This document expands the first implementation slice from [GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md): Phase 1 foundation work. This phase must land first because every later GT feature depends on three new primitives that do not exist today:

- customer-facing vehicle categories
- a reusable `duty_type` enum
- GT-specific driver and customer defaults

The objective is to add those foundations without destabilizing current trip, invoice, settlement, or owner flows.

## Current Baseline
Based on the current codebase:

- [schema.sql](/C:/travelerp/server/db/schema.sql) has no `duty_type`, no vehicle category master, no vehicle-to-category mapping, and no GT default fields on `drivers` or `customers`.
- [vehicles.routes.ts](/C:/travelerp/server/src/routes/vehicles.routes.ts) and [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx) only support the operational `vehicle_type` enum.
- [drivers.routes.ts](/C:/travelerp/server/src/routes/drivers.routes.ts) and [DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx) do not support default vehicle, night halt, or OT rates.
- [customers.routes.ts](/C:/travelerp/server/src/routes/customers.routes.ts) and [CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx) do not support duty timing defaults.
- The UI still uses "Vendors" terminology in [Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx) and [OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx), while the persisted table is `owners_vendors`.

## Scope Of The First Deliverable
This first deliverable includes only the minimum foundation needed to unblock rate charts and duty slips:

1. Database schema additions and migration.
2. Backend support to maintain the new master data.
3. Frontend support to view and edit the new fields.
4. Terminology cleanup from "Vendors" to "Vehicle Owners" at the UI layer.

## Explicitly Out Of Scope
The following are not part of this first slice:

- rate chart tables and rate engine logic
- duty slip calculations
- trip travel metrics
- annexures
- GT PDF generation
- dynamic tax components
- invoice logic changes beyond terminology consistency

## Deliverable Summary
Phase 1 is complete only when an operator can:

- create and maintain vehicle categories
- assign exactly one vehicle category to a vehicle
- maintain GT defaults on driver master and customer master
- see "Vehicle Owners" terminology in the primary UI instead of "Vendors"

## Database Specification

### 1. New Enum: `duty_type`
Add a new PostgreSQL enum:

- `local`
- `outstation`
- `drop_pickup`
- `station_drop`
- `long`

Rules:

- Do not add `airport` as a duty type.
- Route or plan names remain free-text or route-master driven later in the rate chart phase.
- This enum is foundational only in Phase 1; no trip columns will consume it yet.

### 2. New Table: `vehicle_categories`
Purpose: store customer-facing vehicle labels used by GT, independent of the system `vehicle_type` enum.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `name text not null`
- `description text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique category name, case-insensitive
- index on `is_active`

Behavior:

- `name` is the GT-facing label such as `CRYSTA`, `4 AIR BAG`, `DEZIRE`.
- This table is a reusable master and must not be customer-specific in Phase 1.
- Deactivation is preferred over deletion when already referenced.

### 3. New Table: `vehicle_category_mappings`
Purpose: assign one GT vehicle category to one actual vehicle.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `vehicle_id uuid not null references vehicles(id) on delete cascade`
- `vehicle_category_id uuid not null references vehicle_categories(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- `unique(vehicle_id)` to enforce one category per vehicle
- index on `vehicle_category_id`

Behavior:

- A vehicle may have zero or one GT category after this phase.
- A vehicle category may be linked to many vehicles.
- Mapping must remain separate from `vehicles.vehicle_type`; both fields coexist.

### 4. Alter Table: `drivers`
Add the following nullable columns:

- `default_vehicle_id uuid references vehicles(id)`
- `night_halt_rate numeric(12,2) default 0`
- `ot_per_hour numeric(12,2) default 0`

Behavior:

- `default_vehicle_id` is a convenience default for duty slip creation in later phases.
- Monetary values should never be negative.
- Existing rows should remain valid without backfill.

### 5. Alter Table: `customers`
Add the following nullable columns:

- `default_duty_start_time time`
- `default_duty_end_time time`
- `default_duty_hours numeric(5,2)`

Behavior:

- These are default values only; later trip forms may override them.
- `default_duty_hours` should support fractional hours such as `8.5`.
- Existing rows should remain valid without backfill.

### 6. Migration Files
Create the Phase 1 migration in:

- [001_gt_foundation.sql](/C:/travelerp/server/db/migrations/001_gt_foundation.sql)

Also update:

- [schema.sql](/C:/travelerp/server/db/schema.sql)

Implementation note:

- The current repo already has a date-based migration file, but the GT plan explicitly calls for `001_gt_foundation.sql`. Keep the contents aligned with the plan unless the migration runner requires timestamp ordering. If the filename convention must change, the SQL content and scope stay exactly the same.

## Backend Specification

### 1. New API: Vehicle Categories
Create:

- [vehicle-categories.routes.ts](/C:/travelerp/server/src/routes/vehicle-categories.routes.ts)

Mount it from:

- [index.ts](/C:/travelerp/server/src/index.ts)

Endpoints:

- `GET /api/vehicle-categories`
- `POST /api/vehicle-categories`
- `PUT /api/vehicle-categories/:id`
- `DELETE /api/vehicle-categories/:id`

Validation rules:

- `name` is required and trimmed.
- duplicate names are rejected case-insensitively.
- delete must fail with a clear message if the category is already mapped to any vehicle.
- `is_active` defaults to `true`.

Recommended response shape:

- include raw category fields
- include `vehicle_count` in list responses so operators can safely decide whether to deactivate or delete

### 2. Extend Vehicle API To Maintain Category Mapping
Update:

- [vehicles.routes.ts](/C:/travelerp/server/src/routes/vehicles.routes.ts)

Changes:

- accept `vehicle_category_id` on create and update
- include `vehicle_category` summary in GET list response
- write to `vehicle_category_mappings` inside the same request flow

Persistence rules:

- if `vehicle_category_id` is present, upsert the mapping row for that vehicle
- if `vehicle_category_id` is explicitly `null`, remove the mapping row
- do not duplicate mapping state inside the `vehicles` table

Recommended summary object on vehicle responses:

- `vehicle_category: { id, name, description, is_active } | null`

### 3. Extend Driver API
Update:

- [drivers.routes.ts](/C:/travelerp/server/src/routes/drivers.routes.ts)

Changes:

- add `default_vehicle_id`, `night_halt_rate`, `ot_per_hour` to accepted payloads
- return the new fields from list and create/update responses
- reject negative numeric values

### 4. Extend Customer API
Update:

- [customers.routes.ts](/C:/travelerp/server/src/routes/customers.routes.ts)

Changes:

- add `default_duty_start_time`, `default_duty_end_time`, `default_duty_hours` to accepted payloads
- return the new fields from list and create/update responses
- reject negative `default_duty_hours`

### 5. Backend Non-Goals For Phase 1
Do not:

- add rate-calculation endpoints yet
- alter `trips` table yet
- rename `owners_vendors` table yet

The owner data model rename is intentionally deferred because it would create unnecessary churn across existing routes, joins, and settlement logic. For this phase, terminology changes stay at the UI layer.

## Frontend Specification

### 1. Shared Types
Update:

- [types.ts](/C:/travelerp/src/lib/types.ts)

Add or extend:

- `DutyType` union type
- `VehicleCategory` interface
- `Vehicle.vehicle_category`
- `Driver.default_vehicle_id`
- `Driver.night_halt_rate`
- `Driver.ot_per_hour`
- `Customer.default_duty_start_time`
- `Customer.default_duty_end_time`
- `Customer.default_duty_hours`

### 2. Vehicle Categories Screen
Create:

- [VehicleCategoryList.tsx](/C:/travelerp/src/components/VehicleCategories/VehicleCategoryList.tsx)

Recommended capabilities:

- list categories with active/inactive status
- create category
- edit category
- deactivate category
- hard delete only when unused

Recommended visibility:

- `admin`, `manager`, `operator`

### 3. App Navigation
Update:

- [App.tsx](/C:/travelerp/src/App.tsx)
- [Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx)
- [types.ts](/C:/travelerp/src/lib/types.ts)

Changes:

- add a new page key for vehicle categories
- render the new `VehicleCategoryList` screen
- add a sidebar item for vehicle categories near `Vehicles`
- change the `owners` label from `Vendors` to `Vehicle Owners`

Terminology cleanup in the same phase should also cover obvious GT-facing labels inside:

- [OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx)
- [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx)

This is a presentation-only rename. Internal route keys like `owners` may stay unchanged for now.

### 4. Vehicle Master Screen
Update:

- [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx)

Required UI changes:

- fetch vehicle categories along with owners and vehicles
- add a `Vehicle Category` select in the form
- save selected category through the vehicle API
- show the mapped category in list cards or table output

Important rule:

- `vehicle_type` stays required because it still drives the base ERP workflow
- `vehicle_category` is an additional GT abstraction and must not replace `vehicle_type`

### 5. Driver Master Screen
Update:

- [DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx)

Required UI changes:

- add `Default Vehicle` select
- add `Night Halt Rate` numeric input
- add `OT Per Hour` numeric input
- prefill values on edit
- display the new values in the table or detail area

Vehicle dropdown rules:

- show active vehicles
- allow blank selection

### 6. Customer Master Screen
Update:

- [CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx)

Required UI changes:

- add `Default Duty Start Time`
- add `Default Duty End Time`
- add `Default Duty Hours`
- prefill values on edit
- display the new defaults in the list or detail area

Form rules:

- time fields remain optional
- hours field accepts decimals

## Acceptance Criteria

### Database
- migration runs cleanly on an existing local database
- `schema.sql` matches the new GT foundation model
- existing data remains intact after migration

### Vehicle Categories
- a new category can be created, edited, deactivated, and listed
- duplicate category names are blocked
- a category can be mapped to a vehicle
- deleting an in-use category is blocked with a clear error

### Vehicles
- vehicles can still be created without a GT category
- a vehicle can be assigned exactly one GT category
- updating a vehicle can change or clear the category mapping

### Drivers
- driver master supports default vehicle, night halt rate, and OT per hour
- negative monetary values are rejected

### Customers
- customer master supports default duty start time, end time, and default hours
- decimal duty hours are stored and returned correctly

### Terminology
- sidebar uses `Vehicle Owners` instead of `Vendors`
- owner-related GT-facing screen copy no longer shows inconsistent vendor wording in the touched UI

### Regression Safety
- existing trips, invoices, settlements, and owner APIs continue to work unchanged
- no existing required field is removed or repurposed

## Suggested Implementation Order
Implement in this order to keep the slice small and testable:

1. Add migration SQL and update `schema.sql`.
2. Add backend route for vehicle categories and extend vehicle, driver, and customer routes.
3. Update shared frontend types.
4. Add vehicle category master screen and app navigation.
5. Extend vehicle, driver, and customer master screens.
6. Apply terminology cleanup from `Vendors` to `Vehicle Owners`.
7. Run focused verification on CRUD and regressions.

## Verification Checklist
- create one vehicle category and map it to multiple vehicles
- clear a vehicle-category mapping and verify it is removed from DB and UI
- create a driver with GT defaults and verify values round-trip through API and UI
- create a customer with duty time defaults and verify values round-trip through API and UI
- confirm existing owner creation, vehicle creation, trip listing, and invoice listing still load

## Phase 1 Exit Condition
Phase 1 is done when the GT branch has the foundational master data needed for Phase 2 rate charts, with no manual DB edits required to maintain those masters.
