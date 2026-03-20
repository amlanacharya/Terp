# Business Requirements Document (BRD)
## TravelERP — Gayatri Travels (GT) Enhancement Sprint
**Version:** 1.0
**Date:** 2026-03-19
**Client:** Gayatri Travels (GT)
**Branch:** `feature/payment-related-enhancements` → merge target `GT`

---

## 1. Document Purpose

This document formalises the enhancement requirements collected on 2026-03-19 for the TravelERP GT deployment. Each requirement is traced to a specific module, has clear acceptance criteria, and notes any database / backend / frontend impact.

---

## 2. Requirements Summary

| Req ID | Module         | Title                                                                 | Priority |
|--------|----------------|-----------------------------------------------------------------------|----------|
| REQ-01 | All Masters    | Inactive record visual indicator in list/grid                         | High     |
| REQ-02 | Customer       | Additional fields: PAN, SAC Code, Vendor Code                         | High     |
| REQ-03 | Customer       | Auto-generated Customer Code (`GT-CUST-NNNN`)                         | High     |
| REQ-04 | Vehicle Owner  | Additional field: Aadhaar Number                                      | Medium   |
| REQ-05 | Vehicle Owner  | Auto-generated Owner Code (`GT-OWN-NNNN`)                             | High     |
| REQ-06 | Driver         | Additional field: Aadhaar Number                                      | Medium   |
| REQ-07 | Driver         | Auto-generated Driver Code (`GT-DRV-NNNN`)                            | High     |
| REQ-08 | Trip / Duty Slip | Auto-generated Trip Number (5-digit sequential)                     | High     |
| REQ-09 | Trip / Duty Slip | Vehicle → GT Category cascaded lookup                               | High     |
| REQ-10 | Trip / Duty Slip | Sub-tab layout (Details / Charges / Rate Breakdown / Expenses / Annexures) + parent-only trip list | Medium   |
| REQ-11 | Navigation     | Active menu item click reloads/refreshes the tab                      | Medium   |
| REQ-12 | Collections    | Auto-generated Receipt Number                                         | High     |
| REQ-13 | Annexures      | Standalone filter/billing page (Customer, Date Range, Billing Status) — view + bulk bill only | High     |

---

## 3. Detailed Requirements

---

### REQ-01 — Inactive Record Visual Indicator (All Masters)

**Modules affected:** Customers, Vehicle Owners, Drivers

**Current State:**
Inactive records (`is_active = false`) are fetched and displayed in the grid but are visually identical to active records. Users cannot distinguish them at a glance.

**Required Behaviour:**
- Inactive rows/cards must be visually dimmed (e.g. `opacity-50`) OR shown with a distinct background (light red/grey stripe).
- A badge/pill labelled **"Inactive"** must appear alongside the record name.
- Each list page must default to showing **Active records only**, with an **"Include Inactive"** toggle/checkbox filter at the top.
- When the toggle is **off** (default): inactive records are hidden.
- When the toggle is **on**: inactive records appear with the dimmed styling above.

**Acceptance Criteria:**
- [ ] Default view shows only active records.
- [ ] "Include Inactive" toggle reveals inactive records with visual differentiation.
- [ ] Badge "Inactive" visible on each inactive record row/card.
- [ ] Toggle state resets to active-only on re-navigation (not persisted).

**Impact:** Frontend only — filter applied client-side on already-fetched data, or add `?includeInactive=true` query param to API if preferred.

---

### REQ-02 — Customer: Additional Fields

**Current fields missing from the UI form** (some exist in DB, some are new):

| Field | DB Column | Status | Notes |
|-------|-----------|--------|-------|
| GST Number | `gstin` | Exists in DB, missing from UI form | Show in form and list |
| Customer PAN | `pan` | **New — not in DB** | Add to `customers` table |
| Address | `address`, `city`, `state`, `pincode` | Exists in DB, missing from UI form | Add address block to form |
| SAC Code | `sac_code` | **New — not in DB** | Service Accounting Code for GST invoicing |
| Vendor Code | `vendor_code` | **New — not in DB** | GT internal debtor code for accounting integration |

**Required Behaviour:**
- All fields must appear in the Customer Add/Edit modal form.
- **GST Number:** text input, max 15 chars, alphanumeric.
- **Customer PAN:** text input, 10 chars, pattern `AAAAA9999A` — validate format on save.
- **Address:** multi-line block — Address Line, City, State, Pincode as 4 separate fields.
- **SAC Code:** free-text input (e.g. `996411`). Structured lookup deferred to a future sprint.
- **Vendor Code:** free-text input, used for ledger export cross-reference.
- All new fields are optional (nullable).

**Acceptance Criteria:**
- [ ] GST Number field visible and saved correctly.
- [ ] PAN field visible, basic 10-char pattern validation, saved correctly.
- [ ] Address block (4 fields) visible and saved correctly.
- [ ] SAC Code field visible and saved correctly.
- [ ] Vendor Code field visible and saved correctly.
- [ ] All fields pre-populated when editing an existing customer.

**Impact:**
- **DB:** `ALTER TABLE customers ADD COLUMN pan VARCHAR(10), ADD COLUMN sac_code VARCHAR(20), ADD COLUMN vendor_code VARCHAR(50)`
- **Backend:** Update INSERT/UPDATE in `customers.routes.ts`
- **Frontend:** Update `CustomerList.tsx` form and display

---

### REQ-03 — Customer: Auto-Generated Customer Code

**Format:** `GT-CUST-NNNN` where `NNNN` is a zero-padded, auto-incrementing integer (e.g. `GT-CUST-0001`, `GT-CUST-0002`).

**Required Behaviour:**
- Customer Code field must be **read-only in the UI** — system-generated on record creation.
- Backend generates the code at INSERT time.
- The code is unique and never reused (even if the customer is deleted).
- Add form shows placeholder: *"Auto-generated on save"*.
- Edit form shows the generated code as read-only text.

**Sequence Logic (Backend):**
```sql
SELECT COALESCE(MAX(CAST(SPLIT_PART(customer_code, '-', 3) AS INTEGER)), 0) + 1
FROM customers
WHERE customer_code LIKE 'GT-CUST-%';
```
Format result as `GT-CUST-` + zero-padded to 4 digits.

**Acceptance Criteria:**
- [ ] Customer Code auto-assigned on creation, never editable.
- [ ] First customer gets `GT-CUST-0001`.
- [ ] Existing customers with manually entered codes are unaffected.

**Impact:** Backend `customers.routes.ts` POST handler; Frontend `CustomerList.tsx` form field made read-only.

---

### REQ-04 — Vehicle Owner: Aadhaar Number Field

**Current State:** `pan` already exists in `owners_vendors`. `aadhar_number` does not.

**Required Behaviour:**
- Add **Aadhaar Number** field (12-digit numeric) to the Vehicle Owner Add/Edit form.
- Field is optional (nullable).
- Display alongside PAN in the form.

**Acceptance Criteria:**
- [ ] Aadhaar Number field visible in Add/Edit form.
- [ ] Validation: 12 digits, numeric only.
- [ ] Saved and pre-populated on edit.

**Impact:**
- **DB:** `ALTER TABLE owners_vendors ADD COLUMN aadhar_number VARCHAR(12)`
- **Backend:** `owners.routes.ts`
- **Frontend:** `OwnerList.tsx`

---

### REQ-05 — Vehicle Owner: Auto-Generated Owner Code

**Format:** `GT-OWN-NNNN` (zero-padded, e.g. `GT-OWN-0001`)

**Required Behaviour:** Identical pattern to REQ-03.
- System-generated at INSERT time, read-only in UI.
- Add form: placeholder *"Auto-generated on save"*. Edit form: read-only display.
- Never reused.

**Sequence Logic (Backend):**
```sql
SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0) + 1
FROM owners_vendors
WHERE code LIKE 'GT-OWN-%';
```

**Acceptance Criteria:**
- [ ] Owner Code auto-assigned on creation, read-only in UI.
- [ ] First owner gets `GT-OWN-0001`.
- [ ] Existing owners with manually entered codes unaffected.

**Impact:** Backend `owners.routes.ts` POST; Frontend `OwnerList.tsx`.

---

### REQ-06 — Driver: Aadhaar Number Field

**Current State:** `pan` already exists in `drivers`. `aadhar_number` does not.

**Required Behaviour:** Same as REQ-04 — add Aadhaar Number (12-digit) field to the Driver Add/Edit form.

**Acceptance Criteria:**
- [ ] Aadhaar field visible in form, validates 12 digits, saved and pre-populated correctly.

**Impact:**
- **DB:** `ALTER TABLE drivers ADD COLUMN aadhar_number VARCHAR(12)`
- **Backend:** `drivers.routes.ts`
- **Frontend:** `DriverList.tsx`

---

### REQ-07 — Driver: Auto-Generated Driver Code

**Format:** `GT-DRV-NNNN` (zero-padded, e.g. `GT-DRV-0001`)

**Required Behaviour:** Same pattern as REQ-03 and REQ-05.

**Sequence Logic (Backend):**
```sql
SELECT COALESCE(MAX(CAST(SPLIT_PART(driver_code, '-', 3) AS INTEGER)), 0) + 1
FROM drivers
WHERE driver_code LIKE 'GT-DRV-%';
```

**Acceptance Criteria:**
- [ ] Driver Code auto-assigned on creation, read-only in UI.
- [ ] First driver gets `GT-DRV-0001`.
- [ ] Existing drivers with manually entered codes unaffected.

**Impact:** Backend `drivers.routes.ts` POST; Frontend `DriverList.tsx`.

---

### REQ-08 — Trip / Duty Slip: Auto-Generated Trip Number

**Format:** 5-digit zero-padded integer (e.g. `00001`, `00002`, … `99999`).

**Current State:** `trip_number` is a unique text column, currently manually entered.

**Required Behaviour:**
- Trip Number is system-generated on creation — read-only in the UI.
- Backend generates at INSERT time using `MAX(CAST(trip_number AS INTEGER)) + 1`.
- Add form shows placeholder *"Auto-generated on save"*; Edit form shows value as read-only.
- The trip number is printed on the Duty Slip PDF as the Duty Slip Number.

**Sequence Logic (Backend):**
```sql
SELECT COALESCE(MAX(CAST(trip_number AS INTEGER)), 0) + 1
FROM trips
WHERE trip_number ~ '^[0-9]+$';
```
Format as zero-padded 5-digit string.

**Acceptance Criteria:**
- [ ] Trip Number auto-assigned on creation, read-only in UI.
- [ ] First trip gets `00001`.
- [ ] Trip number appears on the duty slip PDF.
- [ ] Existing trips with non-numeric trip numbers are not broken by the cast query (WHERE guard handles this).

**Impact:** Backend `trips.routes.ts` POST; Frontend `TripList.tsx`.

---

### REQ-09 — Trip / Duty Slip: Vehicle → GT Category Cascaded Lookup

**Current State:** Vehicle and Vehicle Category are selected independently. The `vehicle_category_mappings` table links vehicles to categories but the UI does not cascade the selection.

**Required Behaviour:**
- In the Trip/Duty Slip form, **Vehicle** is the primary dropdown.
- On vehicle selection, **GT Category** auto-populates from `vehicle_category_mappings` (read-only, derived).
- If the vehicle has no category mapping, the field shows *"Not mapped"* and allows manual override.
- **Vehicle Brand** (`vehicles.make`) and **Vehicle Model** (`vehicles.model`) also auto-fill as read-only informational fields after vehicle selection.

**UI Flow:**
1. User selects Vehicle → system looks up mapped category.
2. GT Category field auto-fills.
3. Vehicle Brand and Model display.
4. Rate Chart lookup uses the (auto or manual) category.

**Acceptance Criteria:**
- [ ] Selecting a vehicle auto-populates GT Category if mapped.
- [ ] Vehicle Brand and Model display correctly.
- [ ] Category can be manually overridden when not mapped.
- [ ] Rate chart filtering uses the resolved category.

**Impact:**
- **Backend:** Ensure `GET /vehicles` returns `make`, `model`, and mapped category (via JOIN on `vehicle_category_mappings` + `vehicle_categories`).
- **Frontend:** `TripList.tsx` — DutySlipForm — add cascade logic on vehicle select event.

---

### REQ-10 — Trip / Duty Slip: Data Model Clarification + Trip List + Sub-Tab Layout

---

#### 10A — Data Model: Trips and Annexures Are Separate Tables

**Architectural Decision (2026-03-19):**

Annexures are **not trips**. They must not be stored as child records in the `trips` table. The correct model is:

| Table | Role |
|-------|------|
| `trips` | One row per duty slip (parent trip). No child/sub-trip rows. |
| `annexures` | One row per annexure. Has `trip_id` FK pointing to the parent trip in `trips`. |

**Current State (Problem):**
The existing schema has `parent_trip_id` on the `trips` table, and the `annexures` table has both `parent_trip_id` and a separate `trip_id` pointing to a child trip record. This creates dual representation — an annexure exists both as a row in `trips` AND a row in `annexures` — leading to confusion and bloat.

**Target Model:**
- Remove (or stop using) `parent_trip_id` from the `trips` table.
- `annexures` table holds all annexure-specific data directly, with `trip_id` as the FK to the parent trip.
- No child trip rows in `trips`. The `trips` table contains only true duty slips.
- The `annexures` table columns capture all per-day/per-segment data needed for billing: `annexure_number`, `trip_id` (FK), `start_date`, `end_date`, `start_km`, `end_km`, `total_km`, `total_hours`, `night_halts`, `calculated_amount`, `is_billed`, `invoice_id`.

**`annexures` Table (target structure):**
```
annexures
  id                uuid PK
  annexure_number   text unique
  trip_id           uuid FK → trips.id ON DELETE CASCADE
  start_date        date
  end_date          date
  start_km          numeric
  end_km            numeric
  total_km          numeric
  total_hours       numeric
  night_halts       integer default 0
  calculated_amount numeric
  is_billed         boolean default false
  invoice_id        uuid FK → invoices.id (null until billed)
  created_at        timestamptz
  updated_at        timestamptz
```

**Migration note:** Existing child trip rows in `trips` (where `parent_trip_id IS NOT NULL`) must be migrated into the `annexures` table before the `parent_trip_id` column is dropped. This migration must be scripted and reviewed before execution.

**Acceptance Criteria:**
- [ ] `trips` table contains only parent duty slips — no rows with `parent_trip_id` populated going forward.
- [ ] All annexure data lives in the `annexures` table with `trip_id` FK.
- [ ] Migration script moves existing child trip data into `annexures` cleanly.

**Impact:**
- **DB:** Migration to move child trips → annexures rows; drop or deprecate `parent_trip_id` from `trips` after migration.
- **Backend:** All annexure CRUD routes use `annexures` table directly; remove any routes that create child trip records.
- **Frontend:** No behavioural change visible to user once 10B is implemented.

---

#### 10B — Trip List: Parent Trips Only

**Required Behaviour:**
- The Trips list shows only rows from the `trips` table (which, after 10A, contains only parent duty slips).
- No filter for `parent_trip_id IS NULL` needed once the data model is clean — but add it as a safety guard during the migration period.
- Annexures are accessed exclusively through the **Annexures tab** inside the trip's edit dialog (10C).

**Acceptance Criteria:**
- [ ] Trip list never shows annexure records.
- [ ] Safety guard query: `WHERE parent_trip_id IS NULL` during migration period.

**Impact:** Backend `GET /trips`; Frontend `TripList.tsx`.

---

#### 10C — Trip Edit Dialog: Sub-Tab Layout

**Required Behaviour:**
Reorganise the Trip edit dialog into **5 sub-tabs**:

| Tab | Contents |
|-----|----------|
| **Details** | Customer, vehicle, driver, dates, route, duty type, KM/HR, locations, passengers, status |
| **Charges** | Base charge, extra KM/HR, night halt, fuel, OT, fixed route, advances, calculated total |
| **Rate Breakdown** | Read-only display of the selected rate chart item parameters (base hours/km, extra rates, divisors, thresholds) |
| **Expenses** | Toll, parking, driver allowance, ad-hoc expenses — inline list with small add/edit dialogs |
| **Annexures** | Records from the `annexures` table for this `trip_id` — inline list with small add/edit dialogs + bill action |

- Active tab persists while the dialog is open; resets on next open.
- Expenses and Annexures tab labels show a count badge (e.g. **Expenses (2)**, **Annexures (3)**).

#### Expenses Tab — Small Edit Dialogs
- Shown as a compact inline table.
- **Add Expense** opens a small focused dialog: expense type, amount, receipt reference, description, billable flag.
- **Edit** icon opens the same dialog pre-filled.
- **Delete** icon triggers the standard confirmation dialog.

#### Annexures Tab — Small Edit Dialogs
- Fetches `annexures` where `trip_id = <current trip>`.
- Shown as a compact inline table: Annexure No., Date Range, Total KM, Total Hours, Amount, Billed badge, Invoice No.
- **Add Annexure** opens a small focused dialog: start/end date, start/end KM, total hours, night halts, calculated amount preview.
- **Edit** icon on an unbilled annexure opens the same dialog pre-filled.
- Billed annexures are **read-only** — no edit or delete allowed; display linked invoice number.
- **Delete** icon on unbilled annexures triggers the standard confirmation dialog.
- **Bill** button on an unbilled row creates an invoice for that single annexure.
- **Bill Selected (N)** (when multiple unbilled rows are checked) creates a grouped invoice.

**Acceptance Criteria:**
- [ ] 5 tabs render correctly.
- [ ] Tab switching uses already-loaded state — no re-fetch.
- [ ] Expenses tab badge shows live count.
- [ ] Annexures tab badge shows live count.
- [ ] Annexures tab reads from `annexures` table (not from child trip rows).
- [ ] Add/Edit Expense uses a small dialog.
- [ ] Add/Edit Annexure uses a small dialog.
- [ ] Billed annexures are read-only in the dialog.
- [ ] Bill and Bill Selected create invoices correctly.
- [ ] Rate Breakdown tab displays rate chart item parameters.

**Impact:** Frontend — `TripList.tsx` layout restructure; new small-dialog sub-components for Expense and Annexure editing. Backend — Annexure CRUD endpoints scoped to `trip_id` (not child trip records).

---

### REQ-11 — Navigation: Active Menu Item Click Reloads Tab

**Current State:** Clicking an already-highlighted sidebar menu item does nothing — the page-key is already set and React does not re-render.

**Required Behaviour:**
- Clicking the currently active menu item must **force a refresh** of the module component.
- This clears any open modals, detail panels, filters, or unsaved state.
- **Implementation approach:** Maintain a `tabKey` counter in App state. Each click of the same (or any) menu item increments `tabKey`, which is passed as the React `key` prop to the page component — causing React to unmount and cleanly remount it.

**Acceptance Criteria:**
- [ ] Clicking the active menu item resets the module to its default state (list view, no modal, default filters).
- [ ] Clicking a different menu item and returning also resets state (existing behaviour preserved).

**Impact:** Frontend only — `App.tsx` or the Sidebar component.

---

### REQ-12 — Collections / Payment Receipts: Auto-Generated Receipt Number

**Format:** `GT-RCPT-NNNN` (zero-padded, e.g. `GT-RCPT-0001`)

> **Open Question OQ-1:** Confirm preferred format with GT Accountant — `GT-RCPT-NNNN`, plain `NNNN`, or financial-year-prefixed `FY26-NNNN`?

**Current State:** `collection_number` is a unique text field, currently user-entered.

**Required Behaviour:**
- Receipt Number is system-generated on creation — read-only in the UI.
- Add Collection form shows placeholder *"Auto-generated on save"*.
- The generated number appears in the list and on any future receipt PDF.

**Sequence Logic (Backend):**
```sql
SELECT COALESCE(MAX(CAST(SPLIT_PART(collection_number, '-', 3) AS INTEGER)), 0) + 1
FROM collections
WHERE collection_number LIKE 'GT-RCPT-%';
```

**Acceptance Criteria:**
- [ ] Receipt Number auto-assigned on creation, not editable.
- [ ] First receipt gets `GT-RCPT-0001`.
- [ ] Number appears correctly in the list and on PDF (when generated).

**Impact:** Backend `collections.routes.ts` POST; Frontend `CollectionList.tsx`.

---

### REQ-13 — Annexures: Standalone Filter / Billing Page

**Purpose:** This page is a **cross-trip billing and visibility tool** — not an editing interface. All annexure creation and editing is done inside the parent trip's edit dialog (REQ-10B). This page allows accountants/managers to find unbilled annexures across all trips and batch-bill them.

**Current State:** No standalone Annexures page exists. No cross-trip filtering is possible.

#### Page Location
A new **Annexures** page accessible from the left sidebar (under the Trips/Billing section).

#### Filter Panel

| Filter | Input Type | Filters On |
|--------|------------|------------|
| Customer | Dropdown (single select) | Parent trip's `customer_id` |
| Date From | Date picker | `trips.trip_date` >= value |
| Date To | Date picker | `trips.trip_date` <= value |
| Billing Status | Segmented control: All / Billed / Unbilled | `annexures.is_billed` |

- **Default state:** Billing Status = Unbilled, Date Range = current calendar month, Customer = All.

#### Results Grid (Read-Only)

| Column | Source |
|--------|--------|
| Annexure Number | `annexures.annexure_number` |
| Parent Trip No. | `trips.trip_number` — links/navigates to the parent trip on click |
| Customer | `customers.name` |
| Date Range | `annexures.start_date` – `annexures.end_date` |
| Total KM | `annexures.total_km` |
| Total Hours | `annexures.total_hours` |
| Amount | `annexures.calculated_amount` |
| Billed | Yes / No badge |
| Invoice No. | `invoices.invoice_number` (when billed, read-only) |

- **No add/edit/delete actions** on this page. All annexure management is done through the parent trip's edit dialog.
- Rows are selectable (checkbox) for bulk billing.

#### Bulk Bill Action
- Select multiple **unbilled** annexures belonging to the **same customer** → **"Bill Selected (N)"** creates a grouped invoice.
- Selecting annexures from different customers disables the bulk bill button with a tooltip explaining the restriction.
- Single-row **Bill** action also available per unbilled row.

#### New API Endpoint Required
`GET /annexures` (global, not scoped to a trip):
- Query params: `customer_id`, `date_from`, `date_to`, `is_billed` (`true` / `false` / omit for all)
- JOINs: `trips` (for `customer_id`, `trip_number`, `trip_date`), `customers` (for name), `invoices` (for `invoice_number` when billed)

**Acceptance Criteria:**
- [ ] Standalone Annexures page exists in sidebar navigation.
- [ ] Default view shows current month's unbilled annexures across all customers.
- [ ] Customer filter narrows results to that customer's trips.
- [ ] Date range filter works on trip date.
- [ ] Billed / Unbilled / All filter works on `is_billed`.
- [ ] No add/edit/delete controls present on this page.
- [ ] Bulk bill creates a grouped invoice for selected same-customer unbilled annexures.
- [ ] Bulk bill button disabled when selected annexures span multiple customers.
- [ ] Parent Trip No. navigates to the parent trip's edit dialog when clicked.

**Impact:**
- **Backend:** New `GET /annexures` global endpoint in `annexures.routes.ts`.
- **Frontend:** New `AnnexureListPage.tsx` component (view + bill only); new sidebar menu entry.
- **App.tsx:** New `PageKey` for the Annexures page.

---

## 4. Database Migrations Required

### Migration 011 — Field Additions
`server/db/migrations/011_gt_field_additions.sql`

```sql
-- REQ-02: Customer additional fields
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pan         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS sac_code    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50);

-- REQ-04: Vehicle Owner Aadhaar
ALTER TABLE owners_vendors
  ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(12);

-- REQ-06: Driver Aadhaar
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(12);
```

> Note: `pan` already exists in `owners_vendors` and `drivers` — no change needed there.

---

### Migration 012 — Annexures Data Model Consolidation (REQ-10A)
`server/db/migrations/012_annexures_consolidation.sql`

> **WARNING:** This migration moves data. Run on a backup first. Review output before committing.

```sql
-- Step 1: Ensure annexures table has all required columns
ALTER TABLE annexures
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Step 2: Migrate any child trip rows that don't yet have an annexures record
-- (child trips = trips where parent_trip_id IS NOT NULL)
INSERT INTO annexures (
  id, annexure_number, trip_id,
  start_date, end_date,
  start_km, end_km, total_km, total_hours,
  night_halts, calculated_amount,
  is_billed, invoice_id,
  created_at, updated_at
)
SELECT
  uuid_generate_v4(),
  COALESCE(t.trip_number, 'MIG-' || t.id::text),
  t.parent_trip_id,              -- FK to parent trip
  t.trip_date,   t.trip_date,    -- start/end date (refine if travel_metrics exist)
  t.start_km,    t.end_km,
  t.actual_km,   t.total_hours,
  t.night_halts, t.calculated_amount,
  false, null,
  t.created_at,  t.updated_at
FROM trips t
WHERE t.parent_trip_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM annexures a WHERE a.trip_id = t.parent_trip_id
      AND a.annexure_number = t.trip_number
  );

-- Step 3: After verifying data, deprecate parent_trip_id
-- (do not drop yet — keep for rollback; set a deprecation comment)
COMMENT ON COLUMN trips.parent_trip_id IS 'DEPRECATED 2026-03-19: annexures now stored in annexures table. Drop after verification.';
```

> `parent_trip_id` column is **not dropped in this migration** — it is deprecated and flagged. Drop it in a follow-up migration (013) after verifying the data is correct in `annexures`.

---

## 5. Out of Scope (This Sprint)

- SAC Code dropdown/lookup table — deferred (free-text for now)
- Financial-year-based receipt numbering — deferred pending OQ-1 confirmation
- Bulk inactive/active toggle in list views
- Annexure create/edit/delete from the standalone Annexures page (managed via Trip edit dialog)
- Annexure PDF export from the standalone page
- Receipt PDF generation

---

## 6. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-1 | REQ-12: Preferred receipt number format — `GT-RCPT-NNNN`, plain `NNNN`, or `FY26-NNNN`? | GT Accountant | Before REQ-12 implementation |
| OQ-2 | REQ-13: Annexure date filter — use `annexures.start_date` or parent `trips.trip_date`? | GT Ops | Before REQ-13 implementation |
| OQ-3 | REQ-01: Should inactive records also be excluded from dropdowns (vehicle, driver, customer selectors in the trip form)? | GT Ops | Before REQ-01 implementation |
| OQ-4 | REQ-08: After trip number reaches `99999`, should the system wrap, extend to 6 digits, or block? | GT Admin | Deferred |

---

## 7. Suggested Implementation Order

| Step | Req ID(s) | Rationale |
|------|-----------|-----------|
| 1 | DB Migration (REQ-02, 04, 06) | Run once; enables all field additions |
| 2 | REQ-03, 05, 07, 08, 12 | Auto-code generation — backend POST handlers, high impact, independent |
| 3 | REQ-02 | Customer field additions (UI + backend UPDATE queries) |
| 4 | REQ-04, 06 | Owner/Driver Aadhaar (UI + backend) |
| 5 | REQ-01 | Inactive visual indicator (frontend only, low risk) |
| 6 | REQ-09 | Vehicle → Category cascade (frontend + backend API update) |
| 7 | REQ-11 | Menu tab reload (App.tsx — isolated change) |
| 8 | REQ-10A | Data model migration: move child trip rows → `annexures` table, drop `parent_trip_id` from `trips` |
| 9 | REQ-10B | Trip list: parent-only guard (backend query + frontend) |
| 10 | REQ-10C | Trip edit dialog: sub-tab layout + small expense/annexure dialogs (larger frontend refactor) |
| 11 | REQ-13 | Annexures standalone filter/billing page (new backend endpoint + new frontend page) |
