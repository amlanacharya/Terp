# GT Detailed Specs - Phase 5 Dynamic Tax Configuration

## Purpose
This document expands Phase 5 from [GT-Plan.md](/C:/travelerp/GT-Specific/GT-Plan.md): dynamic tax configuration. The goal of this phase is to replace the current fixed `gst_rates + CGST/SGST/IGST` flow with a reusable tax-component engine that can absorb law changes without code changes while preserving invoice audit history.

The GT tax requirement in [GST.md](/C:/travelerp/GT-Specific/Gayatri/GST.md) is short but clear: tax settings must be customizable, support percentage and flat charges, and adapt to changing law. Phase 5 therefore has to solve two distinct problems:

- configurable tax definition for future invoices
- immutable tax snapshots for already-created invoices

Phase 5 must not recalculate old invoices from live configuration.

## Current Baseline
Based on the current GT branch after Phase 4:

- [schema.sql](/C:/travelerp/server/db/schema.sql) still contains the fixed `gst_rates` table.
- [gst.ts](/C:/travelerp/server/src/utils/gst.ts) calculates only `cgst_amount`, `sgst_amount`, and `igst_amount`.
- [gst.routes.ts](/C:/travelerp/server/src/routes/gst.routes.ts) only exposes `GET /api/gst/rates`.
- [invoice-gt.ts](/C:/travelerp/server/src/utils/invoice-gt.ts) loads one active GST row from `gst_rates` and writes fixed GST amounts into `invoices` and `invoice_items`.
- [invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts) and [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx) still assume fixed CGST, SGST, and IGST fields.
- [pdf-invoice.ts](/C:/travelerp/server/src/utils/pdf-invoice.ts) and [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts) still render hardcoded tax rows.
- [types.ts](/C:/travelerp/src/lib/types.ts) models invoices with fixed GST amounts, not arbitrary tax components.

That baseline means Phase 5 is not just a master-data screen. It is a controlled refactor of invoice calculation, invoice storage, invoice API shape, and PDF rendering.

## Critical Design Clarifications
Phase 5 needs a few explicit rules beyond the short plan so the data model stays stable.

### 1. Tax Configuration Is Master Data, Invoice Tax Is Snapshot Data
The new `tax_components` table defines how taxes should be applied to future invoices. It does not replace invoice history.

Phase 5 rule:

- active tax components are read only during invoice creation or invoice preview
- once an invoice is created, the exact applied tax lines are stored on invoice snapshot tables
- editing a tax component later must not alter any existing invoice

### 2. Dynamic Tax Requires Snapshot Tables, Not Just A Master Table
A master table alone cannot explain what rate was applied to a specific invoice after laws change.

Phase 5 rule:

- create a tax master table: `tax_components`
- create invoice-level tax snapshots: `invoice_tax_components`
- create invoice-item-level tax snapshots: `invoice_item_tax_components`

This is the minimum required to preserve tax auditability.

### 3. Legacy GST Columns Stay For Compatibility In Phase 5
The current product, reports, types, and PDFs still read `cgst_amount`, `sgst_amount`, `igst_amount`, and related invoice-item fields.

Phase 5 rule:

- do not drop the existing GST columns in this phase
- for invoices whose applied components map to `CGST`, `SGST`, or `IGST`, continue populating those legacy columns as derived compatibility fields
- the new snapshot tax tables become the authoritative source for new tax rendering and future expansion

This avoids a breaking rewrite of every existing invoice consumer in one phase.

### 4. Tax Scope Still Depends On Intra-State Vs Inter-State
The current logic correctly decides between intra-state and inter-state using company GSTIN and customer GSTIN.

Phase 5 rule:

- retain the current state-resolution logic from invoice creation
- tax components may apply to `intra_state`, `inter_state`, or `all`
- the engine filters tax components by invoice scope before calculation

### 5. Tax Resolution Must Support HSN-Specific And Generic Components
The plan includes `hsn_code` on tax components. That implies component selection is not always global.

Phase 5 rule:

- invoice tax is resolved per invoice item, not just once per invoice
- if item-specific tax components exist for the item HSN code, use that component set
- otherwise fall back to components with `hsn_code is null`
- do not combine exact-HSN and generic rows for the same component key in the same calculation pass

This allows GT to keep a generic base tax set while introducing HSN-specific overrides only where needed.

### 6. Component Identity Cannot Depend Only On Display Name
If operators rename `CGST` to `Central GST`, logic based on free-text labels becomes fragile.

Phase 5 rule:

- add a stable `component_code` field to `tax_components`
- examples: `CGST`, `SGST`, `IGST`, `CESS`, `ROUNDOFF`
- `name` remains the printable display label

This lets the system derive compatibility columns and render PDFs safely even if display labels change.

### 7. Percentage And Flat Taxes Must Be Mutually Exclusive Per Component
The plan mentions both percentage-based and flat-amount taxes.

Phase 5 rule:

- each component is either percentage-based or flat-amount-based
- the DB must enforce that exactly one mode is active
- flat components are applied per invoice item unless a later phase adds explicit invoice-level-only components

### 8. Phase 5 Refactors Tax Calculation, Not Invoice Reversal Or Collections
Dynamic tax changes do not alter invoice lifecycle rules from Phase 4.

Phase 5 does not include:

- invoice voiding or unbilling
- collection allocation changes
- settlement recalculation changes

## Scope Of Phase 5
This phase includes:

1. adding dynamic tax master data and tax snapshot tables
2. replacing hardcoded GST calculation with a reusable tax engine
3. adding CRUD and preview APIs for tax components
4. updating invoice creation flows to use configured tax components
5. updating invoice APIs, types, and PDFs to expose dynamic tax lines
6. building an admin tax-configuration screen

## Explicitly Out Of Scope
The following remain out of scope for Phase 5:

- retroactively rebuilding historical invoices from the new tax engine
- invoice unbill or void workflows
- customer-specific tax overrides beyond HSN and scope matching
- compound tax-on-tax calculations
- settlement/report redesign around tax analytics

## Deliverable Summary
Phase 5 is complete only when the system can:

- define active tax components in admin UI without code changes
- preview tax for an invoice amount before invoice creation
- create GT invoices and legacy manual invoices using active tax components
- store invoice tax breakdown as immutable snapshot rows
- render invoice PDFs using stored tax breakdown rows
- preserve old invoices even if tax configuration changes later

## Database Specification

### 1. New Enum: `tax_application_scope`
Values:

- `intra_state`
- `inter_state`
- `all`

Purpose: normalize which components apply under which GST state condition.

### 2. New Table: `tax_components`
Purpose: master definitions for configurable tax rules.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `component_code text not null unique`
- `name text not null`
- `rate numeric(8,4) null`
- `is_percentage boolean not null default true`
- `flat_amount numeric(15,2) null`
- `applies_to tax_application_scope not null default 'all'`
- `hsn_code text null`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required constraints:

- `length(btrim(component_code)) > 0`
- `length(btrim(name)) > 0`
- `rate is null or rate >= 0`
- `flat_amount is null or flat_amount >= 0`
- exactly one mode active:
  - `(is_percentage = true and rate is not null and flat_amount is null)`
  - or `(is_percentage = false and rate is null and flat_amount is not null)`

Required indexes:

- `(is_active, applies_to, sort_order)`
- `(is_active, hsn_code)`
- optional composite `(is_active, applies_to, hsn_code, sort_order)`

Recommended seed rows:

- `CGST`, `CGST`, `2.5%`, `intra_state`, `9964`
- `SGST`, `SGST`, `2.5%`, `intra_state`, `9964`
- `IGST`, `IGST`, `5%`, `inter_state`, `9964`

### 3. New Table: `invoice_tax_components`
Purpose: invoice-level tax snapshot rows.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `invoice_id uuid not null references invoices(id) on delete cascade`
- `tax_component_id uuid null references tax_components(id)`
- `component_code text not null`
- `component_name text not null`
- `applies_to tax_application_scope not null`
- `hsn_code text null`
- `taxable_base numeric(15,2) not null default 0`
- `rate numeric(8,4) null`
- `is_percentage boolean not null`
- `flat_amount numeric(15,2) null`
- `tax_amount numeric(15,2) not null default 0`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Required semantics:

- one row per invoice per applied component per HSN bucket
- this table is the printable summary source for new invoices
- `tax_component_id` may be null if a component is later removed; snapshot labels must remain sufficient on their own

### 4. New Table: `invoice_item_tax_components`
Purpose: invoice-item-level tax snapshot rows.

Required columns:

- `id uuid primary key default uuid_generate_v4()`
- `invoice_item_id uuid not null references invoice_items(id) on delete cascade`
- `invoice_id uuid not null references invoices(id) on delete cascade`
- `tax_component_id uuid null references tax_components(id)`
- `component_code text not null`
- `component_name text not null`
- `applies_to tax_application_scope not null`
- `hsn_code text null`
- `taxable_base numeric(15,2) not null default 0`
- `rate numeric(8,4) null`
- `is_percentage boolean not null`
- `flat_amount numeric(15,2) null`
- `tax_amount numeric(15,2) not null default 0`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Required semantics:

- each invoice item stores the exact component rows used during creation
- invoice-level rows are aggregated from item-level rows, not recalculated independently

### 5. Legacy GST Table Handling
Phase 5 should not drop `gst_rates` immediately.

Required rule:

- keep `gst_rates` in the schema for backward compatibility during migration
- stop using it for new GT invoice creation after the tax engine is switched over
- keep one controlled fallback path only if no active `tax_components` exist

The desired steady state is that `tax_components` becomes the active source of truth and `gst_rates` becomes legacy-only.

### 6. Existing Invoice Table Compatibility
Do not remove these fields in Phase 5:

- `invoices.cgst_amount`
- `invoices.sgst_amount`
- `invoices.igst_amount`
- `invoice_items.cgst_rate`
- `invoice_items.sgst_rate`
- `invoice_items.igst_rate`
- `invoice_items.cgst_amount`
- `invoice_items.sgst_amount`
- `invoice_items.igst_amount`

Required semantics:

- when `CGST`, `SGST`, and `IGST` components exist, keep these fields populated as compatibility mirrors
- for future non-GST components, the new snapshot tables are authoritative

### 7. Migration Files
Create:

- [005_tax_components.sql](/C:/travelerp/server/db/migrations/005_tax_components.sql)

Also update:

- [schema.sql](/C:/travelerp/server/db/schema.sql)

## Backend Specification

### 1. Primary Files
Create:

- [tax-components.routes.ts](/C:/travelerp/server/src/routes/tax-components.routes.ts)
- [tax-engine.ts](/C:/travelerp/server/src/utils/tax-engine.ts)

Update:

- [index.ts](/C:/travelerp/server/src/index.ts)
- [invoice-gt.ts](/C:/travelerp/server/src/utils/invoice-gt.ts)
- [gst.ts](/C:/travelerp/server/src/utils/gst.ts)
- [gst.routes.ts](/C:/travelerp/server/src/routes/gst.routes.ts)
- [invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts)
- [pdf-invoice.ts](/C:/travelerp/server/src/utils/pdf-invoice.ts)
- [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts)
- [trips.routes.ts](/C:/travelerp/server/src/routes/trips.routes.ts)

### 2. New Tax Engine Responsibilities
[tax-engine.ts](/C:/travelerp/server/src/utils/tax-engine.ts) should become the shared calculator for all invoice creation paths.

Required functions:

- `resolveInvoiceTaxScope(companyGstin, customerGstin)`
- `loadActiveTaxComponents(db, { appliesTo, hsnCode })`
- `resolveTaxComponentSet(db, { appliesTo, hsnCode })`
- `calculateTaxForItem({ amount, hsnCode, appliesTo, components })`
- `calculateInvoiceTaxes({ items, companyGstin, customerGstin })`
- `summarizeLegacyGstFields(taxLines)`

Required behavior:

1. determine invoice scope: `intra_state` or `inter_state`
2. for each invoice item, resolve active component set by HSN and scope
3. apply each component in `sort_order`
4. return item-level tax lines, invoice-level aggregated lines, compatibility GST totals, and final total

### 3. Tax Resolution Algorithm
For each invoice item:

1. determine target HSN code from the invoice item
2. determine scope from company GSTIN versus customer GSTIN
3. load active components where:
   - `is_active = true`
   - `applies_to in (scope, 'all')`
4. choose component set using precedence:
   - exact `hsn_code = item.hsn_code`
   - otherwise `hsn_code is null`
5. order by `sort_order asc, component_code asc`
6. calculate component amount:
   - percentage mode: `round(amount * rate / 100, 2)`
   - flat mode: `flat_amount`
7. aggregate all item component rows into invoice-level component rows
8. derive `cgst_amount`, `sgst_amount`, `igst_amount` for compatibility from component codes

### 4. Invoice Creation Refactor
[invoice-gt.ts](/C:/travelerp/server/src/utils/invoice-gt.ts) must stop loading `gst_rates` directly.

Required Phase 5 behavior:

- GT direct trip billing and annexure billing use the shared tax engine
- manual invoice creation also uses the shared tax engine when subtotal or items are supplied
- invoice creation persists:
  - invoice row
  - invoice items
  - invoice tax component snapshot rows
  - invoice item tax component snapshot rows
  - legacy GST compatibility totals where applicable

### 5. API Routes
#### `server/src/routes/tax-components.routes.ts`
Required endpoints:

- `GET /api/tax-components`
- `GET /api/tax-components/:id`
- `POST /api/tax-components`
- `PUT /api/tax-components/:id`
- `DELETE /api/tax-components/:id`
- `POST /api/tax-components/preview`

Recommended role access:

- read: `admin`, `manager`, `accountant`
- write: `admin`, `accountant`

#### Preview endpoint behavior
Input:

- customer GSTIN or customer id
- one or more invoice items with `amount` and optional `hsn_code`

Output:

- resolved scope
- item-level component lines
- invoice-level component totals
- derived compatibility GST totals
- grand total

This endpoint should drive frontend preview rather than duplicating tax logic in React.

### 6. Invoice API Shape
[invoices.routes.ts](/C:/travelerp/server/src/routes/invoices.routes.ts) should return tax breakdown arrays in both list detail and invoice detail responses.

Required additions on invoice detail:

- `tax_components: InvoiceTaxComponent[]`
- `items[].tax_components: InvoiceItemTaxComponent[]`

List endpoints may optionally return only invoice-level `tax_components` summary or tax totals to keep payload size reasonable.

### 7. PDF Rendering Changes
[pdf-invoice.ts](/C:/travelerp/server/src/utils/pdf-invoice.ts) and [pdf-invoice-gt.ts](/C:/travelerp/server/src/utils/pdf-invoice-gt.ts) must render dynamic tax rows.

Required rules:

- if snapshot rows exist in `invoice_tax_components`, render them in `sort_order`
- if snapshot rows do not exist for an old invoice, fall back to the legacy CGST/SGST/IGST display
- amount-in-words and grand total continue using stored invoice totals, not recomputation

## Frontend Specification

### 1. New Tax Config Screen
Create:

- [TaxComponentList.tsx](/C:/travelerp/src/components/TaxConfig/TaxComponentList.tsx)

Required UI capabilities:

- list configured tax components
- filter active versus inactive
- create and edit percentage or flat components
- set `component_code`, label, HSN, scope, sort order, and active state
- deactivate components safely instead of forcing hard delete
- preview ordering as it will appear on invoice PDF

### 2. App Routing And Navigation
Update:

- [App.tsx](/C:/travelerp/src/App.tsx)
- [Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx)
- [types.ts](/C:/travelerp/src/lib/types.ts)

Recommended page key:

- `tax-config`

Recommended placement:

- visible to `admin` and `accountant`
- grouped near `Settings` or finance modules

### 3. Invoice Frontend Updates
Update:

- [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx)

Required changes:

- replace the hardcoded `inter-state` checkbox + fixed CGST/SGST/IGST assumption with backend tax preview
- show resolved tax rows by component label
- still display compatibility GST totals where present
- allow manual invoice operators to see the tax basis before saving

### 4. Shared Types
Update [types.ts](/C:/travelerp/src/lib/types.ts) with:

- `TaxComponent`
- `TaxApplicationScope`
- `InvoiceTaxComponent`
- `InvoiceItemTaxComponent`
- updated `Invoice` and `InvoiceDetail` tax breakdown arrays

## Data Migration Strategy
Phase 5 affects future invoice calculation first. It should not rewrite history.

Required migration behavior:

1. create new tax tables and seed them with the current GST defaults
2. leave all old invoices untouched
3. leave `gst_rates` in place during transition
4. switch GT invoice creation to `tax_components`
5. keep legacy GST fallback only if the new table is empty

## Acceptance Criteria
Phase 5 is accepted only if all of the following are true:

- active tax components can be created and reordered from UI
- invoice preview reflects configured tax rows without page reload hacks
- GT direct-trip billing uses configured components instead of `gst_rates`
- GT annexure billing uses configured components instead of `gst_rates`
- manual invoice creation uses configured components instead of hardcoded percentages
- invoice detail API returns stored tax snapshot rows
- invoice PDFs render stored tax snapshot rows in configured order
- old invoices created before Phase 5 still open and render correctly
- changing a tax component does not alter any existing invoice totals or tax rows

## Verification Checklist
1. Seed default Phase 5 tax components matching the current GST values.
2. Create one intra-state GT trip invoice and verify `CGST 2.5 + SGST 2.5` from tax components.
3. Create one inter-state GT trip invoice and verify `IGST 5` from tax components.
4. Change one active rate, create a new invoice, and verify only the new invoice uses the changed value.
5. Open an older pre-Phase-5 invoice and verify its PDF remains unchanged.
6. Add one flat component and verify preview plus stored snapshot rows include it.
7. Deactivate one component and verify new invoices stop applying it while historical invoices keep their old snapshot rows.
8. Verify invoice detail API returns invoice-level and item-level tax breakdown arrays.

## Implementation Notes
- Reuse the current GSTIN state-comparison logic rather than inventing a second state resolver.
- Prefer moving logic out of [gst.ts](/C:/travelerp/server/src/utils/gst.ts) into [tax-engine.ts](/C:/travelerp/server/src/utils/tax-engine.ts); keep `gst.ts` only as a thin backward-compatible wrapper if still needed.
- Keep `component_code` stable and machine-oriented even if `name` is changed to a user-friendly label.
- Avoid recalculating PDFs from live tax config; use stored snapshot rows only.

## Open Questions Closed By This Spec
1. Should Phase 5 drop fixed GST columns immediately?
No. Keep them as compatibility mirrors.

2. Is `tax_components` alone enough?
No. Snapshot tables are required.

3. Should tax selection happen once per invoice or per invoice item?
Per invoice item, then aggregate to invoice level.

4. How do HSN-specific rules override generic rules?
Exact HSN match first, otherwise generic null-HSN fallback.
