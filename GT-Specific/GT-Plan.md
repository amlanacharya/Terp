# GT Customization Plan — Gayatri Travels ERP Adaptation

## Context
Gayatri Travels (GT) is a new client whose Travel ERP needs differ significantly from the base system. The core gap is a **customer-specific rate chart engine** that drives trip billing, along with **duty slips**, **annexures for multi-day trips**, and **GT-branded PDF outputs**. All changes must be modular and dynamic so future clients can be onboarded with configuration, not code changes. All work targets the `GT` branch.

---

## Phase 1: Foundation — New Tables & Schema Extensions

### 1.1 New Table: `vehicle_categories`
Decouples customer-facing vehicle names (CRYSTA, 4AIR BAG, DEZIRE) from the system `vehicle_type` enum.
- Columns: id, name, description, is_active, created_at, updated_at

### 1.2 New Table: `vehicle_category_mappings`
Maps actual vehicles to categories (M:1).
- Columns: id, vehicle_id (FK vehicles), vehicle_category_id (FK vehicle_categories), UNIQUE(vehicle_id)

### 1.3 New Enum: `duty_type`
Values: `local`, `outstation`, `drop_pickup`, `station_drop`, `long`
- **Note:** "Airport" is NOT a separate duty type — it's a plan/route name. Keep duty types lean; route-specific charges go in `rate_chart_fixed_routes`.

### 1.4 ALTER `drivers` — Add per-driver charge fields
- `default_vehicle_id` (FK vehicles), `night_halt_rate`, `ot_per_hour`

### 1.5 ALTER `customers` — Add duty timing defaults
- `default_duty_start_time` (time), `default_duty_end_time` (time), `default_duty_hours` (numeric)

### 1.6 Sidebar label change: "Vendors" → "Vehicle Owners"
- File: `src/components/Layout/Sidebar.tsx`

**Migration file:** `server/db/migrations/001_gt_foundation.sql`

---

## Phase 2: Rate Chart Engine (Most Complex)

### 2.1 New Table: `rate_charts` (header)
- Columns: id, customer_id (FK), name, effective_from, effective_to, is_active, notes, created_by

### 2.2 New Table: `rate_chart_items` (core pricing rules)
Handles ALL observed patterns:
| Pattern | Fields |
|---|---|
| Base package (8Hr/80KM = Rs.3000) | base_hours, base_km, base_amount |
| Extra KM/HR rates | extra_km_rate, extra_hr_rate |
| Fuel formula (KM/10 x 102.15) | fuel_divisor, fuel_price_per_unit |
| Night halt | night_halt_rate |
| Fixed amount (drops) | fixed_amount |
| Whichever is higher | use_higher_of_km_hr (boolean) |
| Long trip per-KM | per_km_rate, ot_rate |
| KM threshold for long | long_km_threshold |
| No KM limit cap | no_km_limit_cap |
| Long day hours | long_day_hours, long_night_halt_hours |

- Keyed by: rate_chart_id + vehicle_category_id + duty_type

### 2.3 New Table: `rate_chart_fixed_routes`
For customer-specific fixed route charges (e.g., TSM TO BBSR = Rs.4000).
- Columns: id, rate_chart_id, vehicle_category_id, from_location, to_location, fixed_amount, description

### 2.4 Rate Calculation Engine — `server/src/utils/rate-engine.ts`
**Algorithm:**
1. Find active rate_chart for customer + date
2. Check for fixed route match first → return fixed_amount
3. Find matching rate_chart_item (customer + vehicle_category + duty_type)
4. If local and total_km > long_km_threshold → upgrade to long
5. Calculate: base_charge + extra_km + extra_hr + night_halt + fuel
6. If `use_higher_of_km_hr`: take MAX(km-based total, hr-based total)
7. Return breakdown with each line item

### 2.5 API Endpoints — `server/src/routes/rate-charts.routes.ts`
- CRUD for rate charts, items, and fixed routes
- `POST /api/rate-charts/:id/duplicate` — clone for another customer
- `GET /api/customers/:id/rate-chart` — shortcut to active rate chart

### 2.6 Frontend — `src/components/RateCharts/`
- `RateChartList.tsx` — list grouped by customer
- `RateChartDetail.tsx` — tabbed by vehicle category, rows per duty type
- `RateChartItemForm.tsx` — dynamic form showing/hiding fields based on duty_type

---

## Phase 3: Duty Slips / Enhanced Trips

### 3.1 ALTER `trips` — Add duty slip fields
- duty_type, booked_by, report_to, vehicle_category_id
- rate_chart_item_id (which rate was applied)
- total_hours, night_halts
- advance_hirer, advance_travels, fuel_advance, cash_advance
- base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge
- calculated_amount (engine-computed; trip_amount remains editable for override)
- is_long_trip, parent_trip_id (for annexure linking), annexure_number

### 3.2 New Table: `trip_travel_metrics`
Multiple start/end rows per trip (the duty slip table).
- Columns: id, trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km

### 3.3 API Changes — `server/src/routes/trips.routes.ts`
- `POST /api/trips/:id/calculate` — invoke rate engine, return breakdown
- `GET /api/trips/:id/duty-slip-pdf` — generate duty slip PDF
- CRUD for travel metrics sub-resource

### 3.4 Frontend — Enhanced Trip Form as Duty Slip
- `src/components/Trips/DutySlipForm.tsx` — replaces/extends current trip form
  - Duty type selector, customer dropdown → auto-load rate chart
  - Vehicle filtered by rate chart categories, driver with default mapping
  - Travel Metrics table (add/edit rows)
  - Advances section
  - "Calculate" button → shows breakdown
  - Editable trip_amount for override
- `src/components/Trips/TripCalculationBreakdown.tsx` — shows rate engine result

---

## Phase 4: Invoicing & Annexures

### 4.1 New Table: `annexures`
- Columns: id, annexure_number, parent_trip_id, trip_id, start_date, end_date, start_km, end_km, total_km, total_hours, night_halts, calculated_amount, is_billed, invoice_id

### 4.2 ALTER `invoices` — Add GT fields
- nature_of_journey, vehicle_number, vehicle_type_label, duty_slip_number
- total_km, total_hours, payment_terms_days, interest_note

### 4.3 API — `server/src/routes/annexures.routes.ts`
- CRUD for annexures
- `PUT /api/annexures/:id/bill` — mark billed, link invoice
- Bulk billing endpoint for grouped annexures

### 4.4 PDF Generation
- `server/src/utils/pdf-duty-slip.ts` — GT-branded duty slip
- `server/src/utils/pdf-invoice-gt.ts` — GT-branded invoice (local/outstation sections, dynamic tax, amount in words)
- `server/src/utils/pdf-annexure.ts` — single-day annexure PDF

### 4.5 Frontend — `src/components/Annexures/AnnexureList.tsx`
- List annexures for a long trip
- Create/edit, mark as billed, group billing

---

## Phase 5: Dynamic Tax Configuration

### 5.1 New Table: `tax_components`
Replaces rigid CGST/SGST/IGST model.
- Columns: id, name, rate, is_percentage, flat_amount, applies_to ('intra_state'/'inter_state'/'all'), hsn_code, is_active, sort_order

### 5.2 API — `server/src/routes/tax-components.routes.ts`
- CRUD for tax components

### 5.3 Frontend — `src/components/TaxConfig/TaxComponentList.tsx`

### 5.4 Refactor invoice generation to use dynamic tax_components instead of hardcoded GST logic

---

## Critical Files to Modify
| File | Changes |
|---|---|
| `server/db/schema.sql` | New tables, enums, ALTERs |
| `server/src/index.ts` | Mount new route files |
| `server/src/routes/trips.routes.ts` | Major: rate engine integration, travel metrics, duty slip PDF |
| `server/src/routes/invoices.routes.ts` | GT PDF, new fields |
| `server/src/routes/drivers.routes.ts` | New charge fields |
| `server/src/routes/customers.routes.ts` | Duty timing fields |
| `src/lib/types.ts` | All new interfaces |
| `src/App.tsx` | New page routes |
| `src/components/Layout/Sidebar.tsx` | New nav items, label change |

## New Files to Create
| File | Purpose |
|---|---|
| `server/db/migrations/001_gt_foundation.sql` | Phase 1 migration |
| `server/db/migrations/002_rate_charts.sql` | Phase 2 migration |
| `server/db/migrations/003_duty_slips.sql` | Phase 3 migration |
| `server/db/migrations/004_annexures_invoices.sql` | Phase 4 migration |
| `server/db/migrations/005_tax_components.sql` | Phase 5 migration |
| `server/src/utils/rate-engine.ts` | Rate calculation engine |
| `server/src/utils/pdf-duty-slip.ts` | Duty slip PDF |
| `server/src/utils/pdf-invoice-gt.ts` | GT invoice PDF |
| `server/src/utils/pdf-annexure.ts` | Annexure PDF |
| `server/src/routes/rate-charts.routes.ts` | Rate chart API |
| `server/src/routes/vehicle-categories.routes.ts` | Vehicle categories API |
| `server/src/routes/annexures.routes.ts` | Annexures API |
| `server/src/routes/tax-components.routes.ts` | Tax config API |
| `src/components/RateCharts/RateChartList.tsx` | Rate chart UI |
| `src/components/RateCharts/RateChartDetail.tsx` | Rate chart detail |
| `src/components/RateCharts/RateChartItemForm.tsx` | Rate item form |
| `src/components/VehicleCategories/VehicleCategoryList.tsx` | Vehicle categories UI |
| `src/components/Trips/DutySlipForm.tsx` | Enhanced trip form |
| `src/components/Trips/TripCalculationBreakdown.tsx` | Rate breakdown display |
| `src/components/Annexures/AnnexureList.tsx` | Annexure management |
| `src/components/TaxConfig/TaxComponentList.tsx` | Tax config UI |

---

## Verification Plan
1. **Rate Engine Unit Tests**: Test all 5 customer patterns (RBI, TSM, UNIT-4, NTPC, IFFCO) with known inputs/outputs
2. **End-to-End Flow**: Create customer → set up rate chart → create duty slip → calculate amount → complete trip → generate invoice → verify PDF
3. **Annexure Flow**: Create multi-day trip → generate annexures → bill individually and grouped → verify invoice linkage
4. **Tax Config**: Change tax rates → create new invoice → verify new rates applied
5. **Edge Cases**: Whichever-is-higher rule, long KM threshold upgrade, fuel formula, fixed route matching

---

## BA Decisions (Confirmed)
1. **Package tier selection**: Operator selects manually from dropdown (e.g., 8HR/80KM vs 4HR/40KM)
2. **Invoice fields**: BD = Booking Date, DT = Duty Type
3. **Annexure grouping**: Support BOTH custom date range AND manual checkbox selection
4. **IFFCO KM limit**: Pending confirmation from GT team — implement as configurable `no_km_limit_cap` field
5. **Whichever-is-higher rule**: Configurable per rate chart item (toggle flag)
6. **Driver settlements**: Auto-calculate from trips with manual override before finalizing
7. **Invoice numbering**: Configurable prefix via system_settings (most flexible)
8. **Airport/plan names**: Not a duty type — just a route/plan name. Keep all fields configurable via master data.

## Open Item
- IFFCO "NO KM LIMIT EXP = 450KM" interpretation — user will confirm with GT team. Field is built in regardless.
