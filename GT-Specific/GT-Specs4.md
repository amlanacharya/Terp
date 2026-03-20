# GT Detailed Specs - Phase 4 Invoicing And Annexures

## Purpose
This document expands Phase 4 from [GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md): annexures, GT-specific invoice data, and GT-branded invoice output. The goal of this phase is to replace the current generic one-trip-one-invoice flow with an explicit billing workflow that supports GT long-trip annexures without breaking simple single-trip billing.

GT reference notes in [Invoices and Annexures.md](/C:/travelerp/GT-Specific/Gayatri/Invoices%20and%20Annexures.md), [Long Trip Invoices-Can contain Subinvoice aka Annexures.md](/C:/travelerp/GT-Specific/Gayatri/Long%20Trip%20Invoices-Can%20contain%20Subinvoice%20aka%20Annexures.md), and [Invoice Sample Temple format.md](/C:/travelerp/GT-Specific/Gayatri/Invoice%20Sample%20Temple%20format.md) confirm four business requirements that Phase 4 must satisfy:

- annexures are billed from customer rates and actual trip usage
- one invoice may contain one annexure or multiple annexures
- long trips must support individual, grouped, and whole-trip billing
- GT invoice PDFs require client-specific header and charge fields beyond the base product invoice layout

Phase 4 must produce three stable outcomes:

- an annexure lifecycle on top of Phase 3 duty slips
- GT-aware invoice storage and invoice source linkage
- GT invoice and annexure PDF outputs that reflect the stored billing snapshot

## Current Baseline
Based on the current codebase after Phase 3 execution:

- [schema.sql](/C:/travelerp/server/db/schema.sql) includes the Phase 3 duty-slip columns on `trips`, including `parent_trip_id` and `annexure_number`, but there is still no `annexures` table.
- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts) calculates trips and generates duty-slip PDFs, but it still auto-creates a generic invoice on trip completion from `trip_amount`.
- [invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts) still exposes a generic manual invoice CRUD layer and generic PDF download.
- [pdf-invoice.ts](/C:/travelerp/server/src/utils/pdf-invoice.ts) renders the base product tax invoice layout, not the GT format.
- [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx) is still a generic invoice register and form with subtotal plus GST amounts.
- [types.ts](/C:/travelerp/src/lib/types.ts) does not yet model annexures or GT-specific invoice fields.
- [pdf-duty-slip.ts](/C:/travelerp/server/src/utils/pdf-duty-slip.ts) already exists from Phase 3, so Phase 4 should reuse that duty-slip foundation instead of reintroducing it.

## Critical Design Clarifications
Phase 4 needs a few concrete decisions beyond the high-level plan so annexures, billing, and GT invoice PDFs are internally consistent.

### 1. Annexure Is A Billable Child Duty Slip, Not Just A Note Row
The Phase 3 fields `parent_trip_id` and `annexure_number` now become active.

Phase 4 rule:

- a long or multi-day parent trip remains the operational master record
- each annexure is backed by a child trip row with `parent_trip_id = parent trip id`
- that child trip stores its own metric subset, calculation snapshot, and editable `trip_amount`
- the new `annexures` table is the billing wrapper that points to both the parent trip and the child annexure trip

This makes annexures auditable, recalculable through the existing Phase 3 trip flow, and linkable to invoices without inventing a second billing model.

### 2. Annexure Totals Must Come From Actual Selected Segments
GT notes explicitly state that annexures are calculated from customer rates and actuals.

Phase 4 rule:

- annexure totals are derived from the selected travel-metric rows copied from the parent trip into the child annexure trip
- the child trip is then calculated through the Phase 3 rate engine flow
- `annexures.calculated_amount` stores the billing snapshot copied from that calculated child trip

Phase 4 must not create arbitrary proportional splits of the parent trip amount.

### 3. No Partial Travel-Metric Row Splitting In Phase 4
Annexure creation needs deterministic boundaries.

Phase 4 rule:

- annexure generation may select metric rows explicitly or by date range
- only whole metric rows may be copied into an annexure child trip
- the backend must not split one metric row across two annexures

Operational consequence:

- if GT needs one annexure per day, the parent trip metrics must be captured day-wise in Phase 3

### 4. Grouped Billing Must Stay Within One Parent Trip
GT notes mention billing a whole long trip, individual annexures, or grouped annexures by date.

Phase 4 rule:

- grouped annexure billing is allowed only for annexures belonging to the same `parent_trip_id`
- those annexures will therefore also share the same customer, duty context, and core vehicle context
- whole-trip billing is simply grouped billing for all unbilled annexures of one parent trip

This keeps invoice header fields like vehicle number, duty slip number, and nature of journey coherent.

### 5. GT Billing Becomes An Explicit Action, Not Completion Side Effect
The current trip completion logic auto-generates one generic invoice item per completed trip. That directly conflicts with annexure billing.

Phase 4 rule:

- parent trips that have annexures must not auto-generate invoices on completion
- annexure child trips must not auto-generate invoices on completion
- GT duty-slip trips should move to explicit billing actions through the trip or annexure billing UI
- legacy non-GT manual trips may keep the current auto-invoice fallback until that path is intentionally retired

### 6. Invoice Header Fields Must Be Stored As Snapshots
The GT invoice sample needs fields like booking date, duty type, vehicle details, nature of journey, duty slip number, totals, and payment note text.

Phase 4 rule:

- those GT invoice header values must be stored on `invoices`
- PDFs must render the stored snapshot, not recompute values from current trip data at download time

This protects invoice history when duty slips are edited later.

### 7. Billing Source Linkage Must Be Explicit
Annexures need a reliable billed/unbilled state and invoice traceability.

Phase 4 rule:

- invoice items created from annexures must link back to the annexure row
- invoice items created from direct trip billing must continue linking to `trip_id`
- billed annexures must store `invoice_id` and become read-only except for controlled unbill or invoice reversal flows

### 8. GST Logic Remains The Current Snapshot Model In Phase 4
[GST.md](/C:/travelerp/GT-Specific/Gayatri/GST.md) confirms tax percentages must become configurable, but that is Phase 5.

Phase 4 rule:

- invoice creation still uses the current CGST, SGST, and IGST snapshot model
- GT invoice PDF renders stored tax amounts and stored interest note text
- no dynamic tax-component refactor happens in this phase

## Scope Of Phase 4
This phase includes:

1. creating the `annexures` table and activating parent/child annexure trip behavior
2. extending invoices and invoice items to support GT snapshot fields and annexure linkage
3. replacing GT trip auto-billing with explicit direct-trip and annexure billing flows
4. generating GT-branded invoice PDFs and annexure PDFs
5. building annexure management UI and GT invoice display updates

## Explicitly Out Of Scope
The following remain out of scope for Phase 4:

- dynamic tax components and tax configuration UI
- redesigning driver or owner settlements around annexure billing
- automatic midnight-based metric splitting
- cross-customer grouped invoicing
- replacing the existing generic invoice flow for non-GT legacy manual usage

## Deliverable Summary
Phase 4 is complete only when an operator can:

- take a completed long-trip parent duty slip and generate annexure child trips from selected metrics
- bill one annexure, multiple selected annexures, or all annexures of one parent trip
- generate a direct GT invoice for a simple non-annexured trip
- download GT invoice PDFs and annexure PDFs
- see billed state, invoice linkage, and source totals without losing the existing billing audit trail

## Database Specification

### 1. New Table: `annexures`
Purpose: represent billable annexure units for one long or multi-day parent trip.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `annexure_number text not null`
- `parent_trip_id uuid not null references trips(id) on delete cascade`
- `trip_id uuid not null unique references trips(id) on delete cascade`
- `start_date date not null`
- `end_date date not null`
- `start_km numeric(10,2) not null`
- `end_km numeric(10,2) not null`
- `total_km numeric(10,2) not null`
- `total_hours numeric(8,2) not null`
- `night_halts integer not null default 0`
- `calculated_amount numeric(15,2) not null default 0`
- `is_billed boolean not null default false`
- `invoice_id uuid null references invoices(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique on `parent_trip_id, annexure_number`
- check `length(btrim(annexure_number)) > 0`
- check `end_date >= start_date`
- check `start_km >= 0`
- check `end_km >= start_km`
- check `total_km >= 0`
- check `total_hours >= 0`
- check `night_halts >= 0`
- check `calculated_amount >= 0`
- check `(is_billed = false and invoice_id is null) or (is_billed = true and invoice_id is not null)`
- indexes on `parent_trip_id`, `invoice_id`, and `is_billed`

Required semantics:

- `trip_id` points to the annexure child trip, not the parent trip
- the child trip must carry the same `annexure_number`
- deleting an unbilled annexure must also delete its child trip in one transaction
- billed annexures cannot be edited or deleted through standard operator flows

### 2. Update `invoices`
Purpose: store the GT invoice header snapshot required by the sample format and annexure billing flow.

Required new columns:

- `booking_date date null`
- `duty_type_label text null`
- `nature_of_journey text null`
- `vehicle_number text null`
- `vehicle_type_label text null`
- `duty_slip_number text null`
- `total_km numeric(10,2) null`
- `total_hours numeric(8,2) null`
- `payment_terms_days integer null`
- `interest_note text null`

Constraints:

- `total_km` must be null or non-negative
- `total_hours` must be null or non-negative
- `payment_terms_days` must be null or non-negative

Required semantics:

- `booking_date` is the GT `BD` field from the sample invoice
- `duty_type_label` is the GT `DT` field from the sample invoice
- `nature_of_journey` stores the printable journey label such as `Local` or `Outstation`
- `duty_slip_number` stores the parent duty slip number for grouped annexure invoices and the trip number for direct trip invoices
- `payment_terms_days` and `interest_note` are printable invoice snapshot fields, not just UI helpers

### 3. Update `invoice_items`
Purpose: preserve exact invoice source linkage.

Required new columns:

- `annexure_id uuid null references annexures(id)`

Constraints and indexes:

- index on `annexure_id`
- partial unique index on `annexure_id` where `annexure_id is not null`
- application validation that at least one of `trip_id` or `annexure_id` is supplied

Required semantics:

- direct trip invoices use `trip_id` and leave `annexure_id` null
- annexure invoices use both `trip_id = annexure child trip id` and `annexure_id = annexure id`
- grouped annexure invoices create one invoice item per annexure

### 4. Migration Files
Create:

- [004_annexures_invoices.sql](/C:/travelerp/server/db/migrations/004_annexures_invoices.sql)

Also update:

- [schema.sql](/C:/travelerp/server/db/schema.sql)

## Backend Specification

### 1. Primary Route And Utility Files
Create:

- [annexures.routes.ts](/C:/travelerp/server/src/routes/annexures.routes.ts)
- [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts)
- [pdf-annexure.ts](/C:/travelerp/server/src/utils/pdf-annexure.ts)

Update:

- [index.ts](/C:/travelerp/server/src/index.ts)
- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts)
- [invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts)

Recommended support utilities:

- `server/src/utils/annexure-builder.ts`
- `server/src/utils/invoice-gt.ts`

### 2. Required Endpoints

#### Annexure Management
- `GET /api/trips/:id/annexures`
- `POST /api/trips/:id/annexures`
- `GET /api/annexures/:id`
- `PUT /api/annexures/:id`
- `DELETE /api/annexures/:id`
- `GET /api/annexures/:id/pdf`

#### Annexure Billing
- `PUT /api/annexures/:id/bill`
- `POST /api/annexures/bulk-bill`

#### Direct Trip Billing
- `POST /api/trips/:id/bill`

#### Invoice Read And PDF
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `GET /api/invoices/:id/pdf`

The existing manual `POST /api/invoices` and `PUT /api/invoices/:id` routes may remain for legacy usage, but GT billing should flow through explicit trip or annexure billing endpoints so source linkage stays correct.

### 3. Annexure Creation Behavior
`POST /api/trips/:id/annexures`

Recommended request body:

```ts
{
  annexure_number?: string | null,
  selection_mode: 'metric_rows' | 'date_range',
  metric_ids?: string[],
  start_date?: string,
  end_date?: string,
  force_sync_trip_amount?: boolean
}
```

Required backend flow:

1. load the parent trip and verify it is eligible for annexure creation
2. require a saved parent trip with at least one matching travel-metric row
3. resolve the metric subset either from explicit row ids or the requested date range
4. reject creation if any selected metric row already belongs to another annexure child trip
5. create a child trip by copying the parent trip's GT context and setting `parent_trip_id`
6. copy the selected metric rows into the child trip's `trip_travel_metrics`
7. set the child trip `annexure_number`
8. calculate the child trip through the existing Phase 3 calculation endpoint or shared calculation service
9. insert the `annexures` row with the calculated snapshot
10. return the annexure detail plus the child trip detail

Numbering rule:

- if `annexure_number` is omitted, default to `<parent trip number>/ANX-01`, `ANX-02`, and so on within that parent trip

Eligibility rule:

- annexures are intended for GT long or multi-day billing flows
- the backend may reject annexure creation when the parent trip has neither long-trip context nor multi-day metrics

### 4. Annexure Update And Delete Behavior
`PUT /api/annexures/:id`

Allowed updates:

- annexure number before billing
- recalc or resync snapshot fields from the child trip

`DELETE /api/annexures/:id`

Required rules:

- allowed only when `is_billed = false`
- delete the annexure row and its child trip in one transaction
- free the copied metric ownership so another annexure can be generated from those rows later

### 5. Direct Trip Billing Behavior
`POST /api/trips/:id/bill`

Purpose: create a GT invoice for a saved trip that is billed as one invoice and has no annexure workflow.

Required backend flow:

1. load the trip and reject if it is an annexure child trip
2. reject if the trip already has billed annexures
3. reject if a direct invoice item for that trip already exists
4. build GT invoice snapshot fields from the trip
5. calculate GST using the current snapshot GST flow
6. insert `invoices`
7. insert one `invoice_items` row linked to the trip
8. return invoice detail

Phase 4 rule:

- GT direct billing becomes an explicit action instead of completion side effect

### 6. Single And Grouped Annexure Billing Behavior
`PUT /api/annexures/:id/bill`

Purpose: create one GT invoice from one annexure.

Required behavior:

- reject if the annexure is already billed
- load the annexure child trip and parent trip
- create one invoice with one invoice item linked to that annexure
- mark the annexure billed and store `invoice_id`

`POST /api/annexures/bulk-bill`

Recommended request body:

```ts
{
  parent_trip_id?: string,
  annexure_ids?: string[],
  start_date?: string,
  end_date?: string,
  invoice_date?: string,
  remarks?: string | null
}
```

Required behavior:

- resolve the annexure set either from explicit ids or by date range within one parent trip
- reject mixed-parent selections
- reject already billed annexures
- create one invoice header using the parent trip snapshot
- create one invoice item per annexure
- mark every selected annexure billed and attach the same `invoice_id`

Whole-trip billing rule:

- whole-trip annexure billing is implemented by selecting all unbilled annexures for one parent trip

### 7. Trip Completion Guardrails
Update [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts).

Required behavior:

- when a GT trip is completed, do not auto-generate a generic invoice if the trip is an annexure child trip
- when a GT trip is completed, do not auto-generate a generic invoice if the trip already has annexures
- preserve the current legacy auto-invoice flow only for non-GT or explicitly legacy manual trips

### 8. Invoice Detail Response Shape
`GET /api/invoices/:id` should return the existing invoice data plus GT snapshot fields and enough source context to explain how the invoice was created.

Recommended shape:

```ts
{
  id,
  invoice_number,
  invoice_date,
  booking_date,
  duty_type_label,
  nature_of_journey,
  vehicle_number,
  vehicle_type_label,
  duty_slip_number,
  total_km,
  total_hours,
  payment_terms_days,
  interest_note,
  subtotal,
  cgst_amount,
  sgst_amount,
  igst_amount,
  total_amount,
  customer,
  items: [
    {
      id,
      trip_id,
      annexure_id,
      description,
      amount,
      total_amount,
      annexure: { id, annexure_number, start_date, end_date } | null
    }
  ]
}
```

### 9. GT Invoice PDF Behavior
`GET /api/invoices/:id/pdf`

Required GT fields from the sample format:

- invoice number and invoice date
- client name
- `BD` as booking date
- `DT` as duty type label
- vehicle number
- vehicle type label
- duty slip number
- nature of journey
- total km covered
- total hours and km charge context
- outstation charges including night halt and parking or toll where applicable
- subtotal
- tax breakup
- total and gross bill amount
- amount in words
- interest note

Required behavior:

- GT invoice PDFs should use [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts)
- generic legacy invoices may continue using [pdf-invoice.ts](/C:/travelerp/server/src/utils/pdf-invoice.ts)
- grouped annexure invoices must show a schedule table with one row per annexure
- the PDF must use stored invoice snapshot fields plus stored tax amounts, not fresh live calculations

### 10. Annexure PDF Behavior
`GET /api/annexures/:id/pdf`

Required content:

- annexure number
- parent duty slip number
- annexure child trip number
- customer
- vehicle number and type
- date range
- start and end km
- total km
- total hours
- night halts
- calculated amount
- billed state
- linked invoice number when billed

Phase 4 rule:

- annexure PDF is a billing-support document, not the main invoice

### 11. Validation Rules
The API must reject:

- annexure creation for unsaved or missing parent trips
- mixed-parent bulk billing
- annexure creation from zero selected metric rows
- annexure creation from metric rows already allocated to another annexure
- edit or delete attempts on billed annexures
- single or bulk billing attempts on already billed annexures
- direct trip billing when the trip already has an invoice item
- direct trip billing when billed annexures already exist for that parent trip
- invoice creation when GT header snapshot prerequisites are missing

## Frontend Specification

### 1. Shared Types
Update:

- [types.ts](/C:/travelerp/src/lib/types.ts)

Add or extend:

- `Annexure`
- `AnnexureDetail`
- `AnnexureBillingRequest`
- GT fields on `Invoice`
- `InvoiceItem.annexure_id`

### 2. Trip UI Changes
Update the Phase 3 trip UI so a saved parent trip can surface annexure actions.

Required behavior:

- parent trips should show an annexure summary card or section
- annexure child trips should clearly display that they belong to a parent trip
- direct GT billing button should appear only when the trip is not an annexure child and has no annexures
- once annexures exist, the trip UI should point operators to annexure billing instead of direct billing

### 3. Annexure UI Strategy
Create:

- [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx)

Recommended usage:

- as a standalone page reachable from the sidebar
- and as a contextual panel reachable from the Trips page for a selected parent trip

Required UI capabilities:

- list annexures for one parent trip
- create annexures by metric selection or date range
- show annexure number, date range, km, hours, amount, billed state, and invoice number
- open the child trip or annexure detail
- delete unbilled annexures
- download annexure PDF
- bill one annexure or multiple selected annexures

### 4. Annexure Create Flow
The create UI must support:

- annexure number override
- selection mode toggle: metric rows or date range
- checkbox selection of eligible parent-trip metric rows
- date range inputs for grouped day selection
- preview of derived totals before final save when possible

UX rules:

- date-range create should show which metric rows will be included
- already allocated rows must be visibly unavailable
- billed annexures should be visually locked

### 5. GT Invoice UI Changes
Update [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx).

Required behavior:

- show GT fields like duty slip number, journey nature, and total km or hours in the list or detail view
- show whether the invoice source is a direct trip or grouped annexures
- continue supporting PDF download
- avoid exposing raw manual subtotal editing for GT invoices created from trip or annexure billing flows

The manual generic invoice form may remain for legacy usage, but GT invoices should be created through trip or annexure actions.

## Suggested Files To Create
- [004_annexures_invoices.sql](/C:/travelerp/server/db/migrations/004_annexures_invoices.sql)
- [annexures.routes.ts](/C:/travelerp/server/src/routes/annexures.routes.ts)
- [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts)
- [pdf-annexure.ts](/C:/travelerp/server/src/utils/pdf-annexure.ts)
- [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx)

Recommended support files:

- `server/src/utils/annexure-builder.ts`
- `server/src/utils/invoice-gt.ts`

## Acceptance Criteria

### Annexure Lifecycle
- an operator can create annexures from a completed parent trip using either metric-row selection or date-range selection
- each annexure creates a child trip with `parent_trip_id` and `annexure_number`
- each annexure stores km, hours, night halts, and calculated amount as a stable snapshot
- billed annexures become read-only

### Billing
- a simple GT trip can be billed directly into one GT invoice
- one annexure can be billed into one invoice
- multiple selected annexures of the same parent trip can be billed into one grouped invoice
- whole-trip annexure billing works by selecting all unbilled annexures of the same parent trip
- direct trip billing is blocked when annexures already exist

### PDFs
- GT invoice PDF renders the required GT header fields and tax summary
- grouped annexure invoices include one row per annexure in the invoice schedule
- annexure PDF downloads with invoice linkage when billed

### Regression Safety
- legacy manual invoices still load
- legacy non-GT trip auto-invoice behavior still works if intentionally preserved
- Phase 3 duty-slip PDF still works
- current GST storage and calculation behavior remains unchanged until Phase 5

## Suggested Implementation Order
1. Add the Phase 4 migration and update `schema.sql`.
2. Implement annexure child-trip generation and annexure CRUD.
3. Refactor trip completion so GT billing stops auto-creating generic invoices.
4. Implement direct trip billing and single or grouped annexure billing.
5. Build GT invoice PDF and annexure PDF utilities.
6. Build the annexure UI and update the invoice UI for GT billing visibility.
7. Verify direct trip billing, single annexure billing, grouped billing, and invoice linkage end to end.

## Verification Checklist
- create a multi-day parent trip in the Phase 3 duty-slip flow with day-wise metric rows
- generate two or more annexures from that parent trip
- confirm each annexure created a child trip with copied GT context and metric subset
- bill one annexure and confirm `is_billed = true` plus `invoice_id` linkage
- bill multiple annexures together and confirm one invoice with multiple invoice items
- try to delete a billed annexure and confirm the API blocks it
- bill a simple non-annexured GT trip directly and confirm one GT invoice is created
- download GT invoice PDF and confirm `BD`, `DT`, vehicle details, duty slip number, taxes, and amount-in-words render
- download annexure PDF and confirm billed state plus invoice number render
- complete a parent trip with annexures and confirm no generic auto-invoice is created

## Phase 4 Exit Condition
Phase 4 is done when GT billing supports explicit direct trip invoicing plus annexure-based invoicing for long trips, with child-trip-backed annexure snapshots, grouped billing, GT invoice PDFs, annexure PDFs, and clear invoice linkage, while Phase 3 duty-slip behavior remains intact and Phase 5 dynamic tax work remains deferred.
