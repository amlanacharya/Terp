# GT Enhancement Sprint — Full Implementation Plan
## All 13 REQs from BRD-GT-Enhancement-Sprint.md

### Context
Gayatri Travels (GT) has requested enhancements across all master modules, trips, collections, navigation, and annexures. This plan covers every REQ from the BRD in implementation order, grouped into phases by dependency and risk.

---

## Implementation Order

| Phase | REQs | Scope | Risk |
|-------|------|-------|------|
| 1 | DB Migration 011 | Add new columns: customer PAN/SAC/vendor_code, owner aadhaar, driver aadhaar | Low |
| 2 | REQ-03, 05, 07, 08, 12 | Auto-code generation for all masters + trips + receipts | Low |
| 3 | REQ-02 | Customer: expose existing + new fields in form | Low |
| 4 | REQ-04, 06 | Owner/Driver: PAN + Aadhaar in form | Low |
| 5 | REQ-01 | Inactive visual indicator (all masters) | Low |
| 6 | REQ-09 | Vehicle → GT Category cascade + brand/model | Low |
| 7 | REQ-11 | Menu tab reload | Low |
| 8 | REQ-10B | Parent-only trip list | Low |
| 9 | REQ-10C | Trip edit dialog sub-tab layout | Medium |
| 10 | REQ-13 | Standalone Annexures filter/billing page | Medium |
| 11 | REQ-10A | Data model migration (deferred) | High |

---

## Phase 1: DB Migration 011 — New Columns

**New file: `server/db/migrations/011_gt_field_additions.sql`**

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

Also update `server/db/schema.sql` to include these columns in the canonical CREATE TABLE statements so fresh DB setups include them.

---

## Phase 2: Auto-Code Generation (REQ-03, 05, 07, 08, 12)

All five follow the same pattern: backend generates a formatted code at INSERT time; frontend makes the code field read-only.

### Shared utility: `server/src/utils/auto-code.ts` (NEW)

```ts
import { PoolClient } from 'pg';

interface AutoCodeConfig {
  table: string;
  column: string;
  prefix: string;
  padLength: number;
  separator?: string;  // default '-'
}

export async function generateNextCode(client: PoolClient, config: AutoCodeConfig): Promise<string> {
  const sep = config.separator ?? '-';
  const prefixPattern = `${config.prefix}${sep}%`;
  const splitPart = config.prefix.split(sep).length + 1; // segment after last separator
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(${config.column}, '${sep}', ${splitPart}) AS INTEGER)), 0) + 1 AS next
     FROM ${config.table}
     WHERE ${config.column} LIKE $1`,
    [prefixPattern]
  );
  return `${config.prefix}${sep}${String(rows[0].next).padStart(config.padLength, '0')}`;
}

// Special case for trip numbers (plain numeric, no prefix)
export async function generateNextTripNumber(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(CAST(trip_number AS INTEGER)), 0) + 1 AS next
     FROM trips WHERE trip_number ~ '^[0-9]+$'`
  );
  return String(rows[0].next).padStart(5, '0');
}
```

### REQ-03: Customer Code (`GT-CUST-NNNN`)

**`server/src/routes/customers.routes.ts`** — POST handler (~line 73-130):
- Import `generateNextCode` from `auto-code.ts`
- After `BEGIN`, generate: `const customerCode = await generateNextCode(client, { table: 'customers', column: 'customer_code', prefix: 'GT-CUST', padLength: 4 });`
- Replace `req.body.customer_code` with `customerCode` in the INSERT params
- Remove `customer_code` from required field validation

**`src/components/Customers/CustomerList.tsx`**:
- Find the `customer_code` input field (~line 263-270 area)
- Create mode: replace with read-only placeholder "Auto-generated on save"
- Edit mode: display as read-only text

### REQ-05: Owner Code (`GT-OWN-NNNN`)

**`server/src/routes/owners.routes.ts`** — POST handler (~line 36-79):
- Same pattern: `generateNextCode(client, { table: 'owners_vendors', column: 'code', prefix: 'GT-OWN', padLength: 4 })`
- Remove `code` from required validation

**`src/components/Owners/OwnerList.tsx`**:
- Make `code` field read-only (placeholder on create, value on edit)

### REQ-07: Driver Code (`GT-DRV-NNNN`)

**`server/src/routes/drivers.routes.ts`** — POST handler (~line 73-131):
- Same pattern: `generateNextCode(client, { table: 'drivers', column: 'driver_code', prefix: 'GT-DRV', padLength: 4 })`
- Remove `driver_code` from required validation

**`src/components/Drivers/DriverList.tsx`**:
- Make `driver_code` field read-only

### REQ-08: Trip Number (`00001`)

**`server/src/routes/trips.routes.ts`** — POST handler (~line 1185):
- Import `generateNextTripNumber` from `auto-code.ts`
- After `BEGIN`, call `const tripNumber = await generateNextTripNumber(client);`
- Replace `payload.trip_number` ($1 param ~line 1213) with `tripNumber`
- `validateTripPayload` (~line 541): Remove `trip_number` from required fields; remove lines 552-554 validation

**`server/src/utils/annexure-builder.ts`** (~line 252):
- Import `generateNextTripNumber`, use it for child trip `trip_number` too

**`src/components/Trips/DutySlipForm.tsx`** (line 336):
- Create mode: read-only placeholder "Auto-generated on save"
- Edit mode: read-only display of `trip.trip_number`
- Remove `trip_number` from `handleSubmit` payload (line 248)

### REQ-12: Receipt Number (`GT-RCPT-NNNN`)

**`server/src/routes/collections.routes.ts`** — POST handler (~line 265-328):
- Same pattern: `generateNextCode(client, { table: 'collections', column: 'collection_number', prefix: 'GT-RCPT', padLength: 4 })`
- Remove `collection_number` from required validation (~line 267)

**`src/components/Collections/CollectionList.tsx`** (~line 196-201):
- Make `collection_number` field read-only

---

## Phase 3: REQ-02 — Customer Additional Fields

### Backend

**`server/src/routes/customers.routes.ts`**:
- POST handler INSERT query (~line 93-122): Add `pan`, `sac_code`, `vendor_code` to column list and params
- PUT handler UPDATE query (~line 132-166): Add same columns to SET clause
- GET handler: Already uses `SELECT *` so new columns are returned automatically

### Frontend

**`src/components/Customers/CustomerList.tsx`**:

Fields to ADD to the form (currently missing from UI):
- `gstin` — exists in DB + backend, just not in the form. Add text input, max 15 chars
- `pan` — new DB column. Text input, 10 chars, pattern validation `^[A-Z]{5}[0-9]{4}[A-Z]$`
- `address` — exists in DB + backend. Add textarea
- `pincode` — exists in DB + backend. Add text input
- `sac_code` — new DB column. Text input
- `vendor_code` — new DB column. Text input

Note: `city` and `state` are already in the form. `address` and `pincode` need to be added alongside them as an address block.

Form state interface: Add `gstin`, `pan`, `address`, `pincode`, `sac_code`, `vendor_code` to the form state and initial state.

---

## Phase 4: REQ-04, 06 — Owner/Driver Aadhaar + PAN in Form

### REQ-04: Vehicle Owner

**Backend `server/src/routes/owners.routes.ts`**:
- POST/PUT: Add `aadhar_number` to INSERT and UPDATE queries
- `pan` is already in the queries

**Frontend `src/components/Owners/OwnerList.tsx`**:
- Add to form: `pan` (exists in DB, missing from UI), `aadhar_number` (new column)
- Also surface missing fields that exist in DB: `address`, `pincode`, `bank_name`, `bank_account`, `ifsc_code`
- Aadhaar validation: 12 digits, numeric only (`^[0-9]{12}$`)

### REQ-06: Driver

**Backend `server/src/routes/drivers.routes.ts`**:
- POST/PUT: Add `aadhar_number` to INSERT and UPDATE queries
- `pan` is already in the queries

**Frontend `src/components/Drivers/DriverList.tsx`**:
- Add to form: `pan` (exists in DB, missing from UI), `aadhar_number` (new column)
- Same aadhaar validation as owners

---

## Phase 5: REQ-01 — Inactive Record Visual Indicator

**Frontend only** — affects Customers, Vehicle Owners, Drivers list pages.

### Pattern (apply to all 3 modules)

1. **Add state**: `const [showInactive, setShowInactive] = useState(false);`

2. **Filter records**:
   ```ts
   const filteredRecords = showInactive ? records : records.filter(r => r.is_active !== false);
   ```

3. **Toggle UI** (above the list):
   ```tsx
   <label className="flex items-center gap-2 text-sm text-slate-600">
     <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
     Include Inactive
   </label>
   ```

4. **Row styling** (on each row/card):
   ```tsx
   className={`... ${!record.is_active ? 'opacity-50' : ''}`}
   ```

5. **Badge** on inactive records:
   ```tsx
   {!record.is_active && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Inactive</span>}
   ```

### Files to modify
- `src/components/Customers/CustomerList.tsx` — table rows
- `src/components/Owners/OwnerList.tsx` — card layout
- `src/components/Drivers/DriverList.tsx` — table rows

---

## Phase 6: REQ-09 — Vehicle → GT Category Cascade + Brand/Model

**Frontend only** — backend already returns vehicle.make, vehicle.model, vehicle.vehicle_category.

**`src/components/Trips/DutySlipForm.tsx`**:

1. **Derive selected vehicle** (add near line 237):
   ```ts
   const selectedVehicle = vehicles.find(v => v.id === formState.vehicle_id) ?? null;
   const vehicleHasCategory = !!selectedVehicle?.vehicle_category;
   ```

2. **GT Category field** (line 343): Conditionally render:
   - If `vehicleHasCategory`: read-only div showing `selectedVehicle.vehicle_category.name`
   - If not: keep the editable `<select>` for manual override

3. **Vehicle Brand & Model** — two new read-only display fields after GT Category:
   ```tsx
   <div className="text-sm font-semibold text-slate-800">
     Vehicle Brand
     <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
       {selectedVehicle?.make ?? '—'}
     </div>
   </div>
   ```
   Same for Model with `selectedVehicle?.model`.

4. **Vehicle onChange** (line 341): Already cascades `vehicle_category_id` — no change needed.

---

## Phase 7: REQ-11 — Menu Tab Reload

**`src/App.tsx`** (lines 29, 78, 80, 81):
- Add state: `const [tabKey, setTabKey] = useState(0);`
- Create wrapper:
  ```ts
  const handleNavigate = (page: PageKey) => {
    setCurrentPage(page);
    setTabKey(k => k + 1);
  };
  ```
- Pass `handleNavigate` to `<Sidebar>` and `<Header>` instead of `setCurrentPage`
- Apply key to content: `<main key={tabKey} className="...">{renderContent()}</main>`

---

## Phase 8: REQ-10B — Parent-Only Trip List

**`server/src/routes/trips.routes.ts`**, GET `/` handler (~line 892-913):
- Add `AND t.parent_trip_id IS NULL` to the query WHERE clause:
  ```ts
  const baseFilter = 'WHERE t.parent_trip_id IS NULL';
  const whereClause = status ? `${baseFilter} AND t.status = $1` : baseFilter;
  ```

**`src/components/Trips/TripList.tsx`** (line 720):
- Remove the "Annexure child" label since child trips won't appear

---

## Phase 9: REQ-10C — Trip Edit Dialog Sub-Tab Layout

The current `DutySlipForm.tsx` is a single flat form. Reorganize into 5 tabs and extract expenses + annexures into new components.

### New file structure

```
src/components/Trips/
  DutySlipForm.tsx              — Refactored: tab container, Details + Charges inline
  DutySlipRateTab.tsx           — NEW: wraps TripCalculationBreakdown
  DutySlipExpensesTab.tsx       — NEW: expense CRUD extracted from TripList.tsx
  DutySlipAnnexuresTab.tsx      — NEW: annexure list + small dialogs
  TripCalculationBreakdown.tsx  — Existing, no change
  TripList.tsx                  — Simplified: remove inline expenses/annexures/breakdown
```

### DutySlipForm.tsx refactoring

**Tab state:**
```ts
type DutySlipTab = 'details' | 'charges' | 'rate' | 'expenses' | 'annexures';
const [activeTab, setActiveTab] = useState<DutySlipTab>('details');
```

**Tab bar** (follows Reports.tsx pattern):
- Pill buttons with active state `bg-slate-900 text-white`
- Badge counts on Expenses and Annexures tabs

**Tab content distribution:**

| Tab | Content |
|-----|---------|
| **Details** | Customer, vehicle, driver, dates, route, duty type, trip_number (RO), GT category (RO), brand/model, package, booked_by, report_to, from/to, purpose, passengers, night_halts, remarks, **Save button** |
| **Charges** | trip_amount, advances, charges, **Calculate button**, Travel Metrics form + table |
| **Rate Breakdown** | Read-only `<TripCalculationBreakdown>` |
| **Expenses** | `<DutySlipExpensesTab>` — self-contained CRUD |
| **Annexures** | `<DutySlipAnnexuresTab>` — table + small dialogs + bill |

**Form structure:** `<form>` wraps Details + Charges (shared submit). Expenses/Annexures render outside `<form>`.

### New props for DutySlipForm
```ts
canManage: boolean;
onRefreshTrip: (tripId: string) => Promise<TripDetail>;
```

### DutySlipExpensesTab.tsx (NEW)

Extracted from TripList.tsx lines 531-650:
```ts
interface DutySlipExpensesTabProps {
  tripId: string;
  expenses: TripExpense[];
  canManage: boolean;
  onRefresh: () => void;
}
```
- Self-contained: manages own form state, saving/deleting state
- Same API: `POST/PUT/DELETE /trips/:id/expenses/:eid`

### DutySlipAnnexuresTab.tsx (NEW)

Adapted from AnnexureList.tsx embedded mode:
```ts
interface DutySlipAnnexuresTabProps {
  parentTrip: TripDetail;
  canManage: boolean;
  onRefresh: () => void;
}
```
- Compact table of annexures for this trip
- "Add Annexure" opens small `Modal size="md"` for metric/date selection
- Edit opens same small modal pre-filled (unbilled only)
- Bill / Bill Selected actions
- Uses existing API: `GET/POST/DELETE /trips/:id/annexures`, `PUT /annexures/:id/bill`

### DutySlipRateTab.tsx (NEW)

Thin wrapper around existing TripCalculationBreakdown.

### TripList.tsx simplification

Remove from selectedTrip panel:
- `TripCalculationBreakdown` (line 485) → Rate tab
- `AnnexureList` embed (line 528) → Annexures tab
- Expense form + table (lines 531-650) → Expenses tab
- Expense state vars, handlers, ConfirmModal → all removed

selectedTrip panel retains: header card + billing status card (summary-only).

---

## Phase 10: REQ-13 — Standalone Annexures Filter/Billing Page

**This is a view + billing page only.** No create/edit/delete. All annexure management done via Trip edit dialog (Phase 9).

### Backend

**`server/src/routes/annexures.routes.ts`** — add new global GET endpoint:

```
GET /annexures?customer_id=X&date_from=Y&date_to=Z&is_billed=true|false
```

Query JOINs: `annexures` → `trips` (for customer_id, trip_number, trip_date) → `customers` (for name) → `invoices` (for invoice_number when billed).

### Frontend

**New file: `src/components/Annexures/AnnexureListPage.tsx`**

- Filter panel: Customer dropdown, Date From/To pickers, Billing Status segmented control (All/Billed/Unbilled)
- Default: Unbilled, current month, all customers
- Read-only grid: Annexure No., Parent Trip No., Customer, Date Range, KM, Hours, Amount, Billed badge, Invoice No.
- Parent Trip No. click navigates to trip page
- Checkbox selection on unbilled rows → "Bill Selected (N)" button
- Single "Bill" button per unbilled row
- Multi-customer selection disables bulk bill with tooltip

**`src/App.tsx`**: The `annexures` PageKey already exists (line 51-52). Replace `<AnnexureList />` with `<AnnexureListPage />`.

**`src/components/Layout/Sidebar.tsx`**: 'annexures' entry already exists (line 23). No change needed.

---

## Phase 11: REQ-10A — Data Model Migration (Deferred)

> Designed but **not implemented this sprint**. The UI built in Phases 9-10 works with the existing data model. Apply once UI is verified.

### Migration SQL: `server/db/migrations/012_annexures_consolidation.sql`

1. Add charge columns to `annexures` (base_charge, extra_km_charge, etc.)
2. Backfill from child trip rows
3. Deprecate `trips.parent_trip_id` with COMMENT (do not drop)
4. Keep child trip rows for `invoice_items.trip_id` FK integrity

### Backend changes (future)
- Rewrite `annexure-builder.ts` to INSERT only into `annexures` (no child trip)
- Update annexure routes to read charge data from `annexures` directly

---

## Verification Checklist

### Masters (REQ-01, 02, 03, 04, 05, 06, 07)
- [ ] Customer: create → code auto-generated `GT-CUST-0001`, all new fields save correctly
- [ ] Customer: edit → code read-only, PAN validates 10-char pattern
- [ ] Customer: list defaults to active-only, toggle shows inactive dimmed with badge
- [ ] Owner: create → code auto-generated `GT-OWN-0001`, PAN + Aadhaar visible
- [ ] Owner: Aadhaar validates 12 digits
- [ ] Driver: create → code auto-generated `GT-DRV-0001`, PAN + Aadhaar visible
- [ ] Driver: list defaults to active-only with toggle

### Trips (REQ-08, 09, 10B, 10C)
- [ ] Create trip → number shows "Auto-generated on save" → after save shows 5-digit number
- [ ] Select vehicle → GT Category auto-fills read-only, Brand/Model display
- [ ] Trip list shows no child/annexure trips
- [ ] Edit dialog shows 5 tabs, all functional
- [ ] Expenses tab: add/edit/delete works inside modal
- [ ] Annexures tab: view/create/bill works inside modal
- [ ] Tab badges show correct counts
- [ ] Duty Slip PDF, Calculate, Bill Trip all still work

### Collections (REQ-12)
- [ ] Create receipt → number auto-generated `GT-RCPT-0001`, read-only

### Navigation (REQ-11)
- [ ] Click active sidebar item → component remounts (loading state visible)

### Annexures Page (REQ-13)
- [ ] Standalone page shows in sidebar, loads with filters
- [ ] Customer/date/billing filters work
- [ ] Bulk bill creates grouped invoice for same-customer unbilled annexures
- [ ] No edit/delete controls on this page

---

## Critical Files

| File | Phases |
|------|--------|
| `server/db/migrations/011_gt_field_additions.sql` | 1: NEW |
| `server/src/utils/auto-code.ts` | 2: NEW — shared auto-code utility |
| `server/src/routes/customers.routes.ts` | 2: auto-code; 3: new fields |
| `server/src/routes/owners.routes.ts` | 2: auto-code; 4: aadhaar |
| `server/src/routes/drivers.routes.ts` | 2: auto-code; 4: aadhaar |
| `server/src/routes/trips.routes.ts` | 2: auto trip number; 8: parent-only filter |
| `server/src/routes/collections.routes.ts` | 2: auto receipt number |
| `server/src/routes/annexures.routes.ts` | 10: global GET endpoint |
| `server/src/utils/annexure-builder.ts` | 2: auto trip number for child trips |
| `src/components/Customers/CustomerList.tsx` | 2: RO code; 3: new fields; 5: inactive |
| `src/components/Owners/OwnerList.tsx` | 2: RO code; 4: PAN+Aadhaar; 5: inactive |
| `src/components/Drivers/DriverList.tsx` | 2: RO code; 4: PAN+Aadhaar; 5: inactive |
| `src/components/Collections/CollectionList.tsx` | 2: RO receipt number |
| `src/components/Trips/DutySlipForm.tsx` | 2: RO trip#; 6: cascade; 9: tabs |
| `src/components/Trips/DutySlipExpensesTab.tsx` | 9: NEW |
| `src/components/Trips/DutySlipAnnexuresTab.tsx` | 9: NEW |
| `src/components/Trips/DutySlipRateTab.tsx` | 9: NEW |
| `src/components/Trips/TripList.tsx` | 8: cleanup; 9: simplify |
| `src/components/Annexures/AnnexureListPage.tsx` | 10: NEW |
| `src/App.tsx` | 7: tabKey; 10: swap annexure component |
| `src/lib/types.ts` | Minor updates as needed |
| `server/db/schema.sql` | 1: add columns to canonical schema |
