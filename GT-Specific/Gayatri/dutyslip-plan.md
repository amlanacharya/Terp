# GT Duty Slip PDF Split: External Open/Closed + Internal Snapshot

## Context

The current `GET /api/trips/:id/duty-slip-pdf` always generates one PDF that exposes internal ops data (rate chart, package, calculated amount, charge breakdown). GT needs two distinct document types:

- **External (hirer-facing)**: matches the GT paper pad — no billing figures exposed
  - *Open*: dispatch slip with blank movement rows (pre-trip or in-progress)
  - *Closed*: completed slip with populated movement rows and recorded out-of-pocket expenses
- **Internal**: the current ops/calculation-heavy snapshot (unchanged, just renamed variant)

The trip expense table also needs a `is_billable_to_hirer` flag so individual expenses can later be included or excluded from invoicing.

---

## Files to Create

| File | Purpose |
|---|---|
| `server/db/migrations/add_expense_billable_flag.sql` | Add `is_billable_to_hirer` column to `trip_expenses` |

---

## Files to Modify

| File | Change |
|---|---|
| `server/src/utils/pdf-duty-slip.ts` | Add `DutySlipExpense` type; add `buildOpenExternalDutySlipPdf` and `buildClosedExternalDutySlipPdf`; keep existing logic as `buildInternalDutySlipPdf`; export dispatcher `buildDutySlipPdf(data, settings, variant)` |
| `server/src/routes/trips.routes.ts` | Read `?variant` query param; add `is_billable_to_hirer` to `expenseFields` and expense INSERT/UPDATE; pass expenses to PDF data; call correct builder; set filename to reflect variant |
| `server/db/schema.sql` | Add `is_billable_to_hirer boolean NOT NULL DEFAULT false` to `trip_expenses` table definition |
| `src/lib/types.ts` | Add `is_billable_to_hirer: boolean` to `TripExpense` interface |
| `src/components/Trips/TripList.tsx` | Replace single PDF button with split UI (External / Internal); add `is_billable_to_hirer` checkbox to expense form |

---

## Step-by-Step Implementation

### 1. DB Migration

Create `server/db/migrations/add_expense_billable_flag.sql`:
```sql
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS is_billable_to_hirer boolean NOT NULL DEFAULT false;
```

Also update `server/db/schema.sql` `trip_expenses` definition to include the column.

---

### 2. `pdf-duty-slip.ts` — New types and renderers

**Add** `DutySlipExpense` interface (beside existing interfaces):
```ts
export interface DutySlipExpense {
  expense_type: string;
  amount: number;
  description: string | null;
}
```

**Add** `expenses` field to `DutySlipPdfData`:
```ts
expenses: DutySlipExpense[];
```

**Add variant type** (used by route, not strictly needed in this file but clean to export):
```ts
export type DutySlipVariant = 'open_external' | 'closed_external' | 'internal';
```

**Rename** existing `buildDutySlipPdf` → `buildInternalDutySlipPdf` (keep identical body).

**Add `buildOpenExternalDutySlipPdf`**:
- Header card: title `DUTY SLIP` (same `drawHeaderCard`)
- Two info boxes: "Trip Party" (customer name, booked_by, report_to, nature of duty/purpose, car number) and "Duty Summary" (slip number = trip_number, date, duty_type, vehicle_number, driver_name)
- Section: "Movement Record" → call `drawExternalMovementGrid(doc, [], blank=true)` — renders the 6-column grid with empty rows (start date, start time, start KM, closing time, closing KM, closing date) for physical fill-in
- Section: "Advances" → show only `advance_hirer` and `advance_travels`
- Blank client signature area (a labelled box: "Client Signature")
- If `data.remarks`: print remarks
- Footer: `Computer-generated duty slip`

**Add `buildClosedExternalDutySlipPdf`**:
- Same header and booking info boxes as open external
- Section: "Movement Record" → call `drawExternalMovementGrid(doc, metrics, blank=false)` — populated from metrics with columns: Starting Date, Starting Time, Starting KM, Closing Time, Closing KM, Closing Date
- Section: "Out-of-Pocket Expenses" → table from `data.expenses` (expense_type, description, amount). If empty, show "No recorded expenses."
- Section: "Advances" → show only `advance_hirer` and `advance_travels`
- Blank client signature area
- If `data.remarks`: print remarks
- Footer: same

**Add shared helper `drawExternalMovementGrid`** used by both:
```ts
function drawExternalMovementGrid(doc: PdfDoc, metrics: DutySlipPdfMetric[], blank: boolean): void
```
- 6 columns: Starting Date | Starting Time | Starting KM | Closing Time | Closing KM | Closing Date
- Widths to fill page width
- If `blank=true` or `metrics.length === 0`: render 5 empty rows
- If `blank=false` and metrics present: render each metric row populated

**Export dispatcher**:
```ts
export function buildDutySlipPdf(
  data: DutySlipPdfData,
  settings: Record<string, string>,
  variant: DutySlipVariant
): Promise<Buffer> {
  if (variant === 'open_external') return buildOpenExternalDutySlipPdf(data, settings);
  if (variant === 'closed_external') return buildClosedExternalDutySlipPdf(data, settings);
  return buildInternalDutySlipPdf(data, settings);
}
```

---

### 3. `trips.routes.ts` — Route + expense field changes

**Expense fields** (line 34 area):
```ts
const expenseFields = ['expense_type', 'amount', 'description', 'receipt_number', 'is_billable_to_hirer'] as const;
```

**`TripExpenseRow` interface**: add `is_billable_to_hirer: boolean`

**Expense INSERT** (line 1036): include `is_billable_to_hirer` in columns and values.

**Expense UPDATE**: `buildUpdateClause` already handles dynamic fields, so adding to `expenseFields` is sufficient.

**`getTripById` expense query**: add `is_billable_to_hirer` to SELECT (or use `SELECT *` — already does).

**Duty slip PDF route** (`router.get('/:id/duty-slip-pdf', ...)` at line 1417):
```ts
// Resolve variant
const rawVariant = req.query['variant'];
let variant: DutySlipVariant;
if (rawVariant === 'open_external' || rawVariant === 'closed_external' || rawVariant === 'internal') {
  variant = rawVariant;
} else {
  // auto: completed → closed_external, otherwise → open_external
  variant = trip.status === 'completed' ? 'closed_external' : 'open_external';
}

const pdf = await buildDutySlipPdf({
  ...existingFields,
  expenses: trip.expenses.map((e) => ({
    expense_type: e.expense_type,
    amount: Number(e.amount),
    description: e.description,
  })),
}, settings, variant);

const variantSuffix = variant === 'internal' ? '-internal' : '-external';
const fileName = `${trip.trip_number.replace(/[^a-zA-Z0-9-_]/g, '_')}${variantSuffix}-duty-slip.pdf`;
```

---

### 4. `src/lib/types.ts`

`TripExpense` interface: add `is_billable_to_hirer: boolean`

---

### 5. `src/components/Trips/TripList.tsx`

**PDF download function**: rename `handleDutySlipPdf` to `handleDutySlipPdfDownload(variant: 'open_external' | 'closed_external' | 'internal')` and pass `?variant=${variant}` to the URL.

**PDF button area** (near line 247): replace single button with two buttons:
- Primary: `"Duty Slip (External)"` — calls `handleDutySlipPdfDownload(trip.status === 'completed' ? 'closed_external' : 'open_external')`
- Secondary: `"Internal PDF"` — calls `handleDutySlipPdfDownload('internal')`

**Expense form**: add `is_billable_to_hirer` to `ExpenseFormState` (default `false`), add a checkbox `Billable to Hirer` in the form, include in POST/PUT payload.

---

## Key Constraints

- External PDFs must never expose: rate_chart_name, package_label, fixed_route_label, calculated_amount, trip_amount, or any charge-head line items.
- `advance_hirer` and `advance_travels` appear on external slips; `fuel_advance` and `cash_advance` do not.
- Open external slip renders a blank movement grid even if partial metrics exist.
- The existing internal PDF content is unchanged — only renamed internally.
- No billing logic changes; `is_billable_to_hirer` is stored but not yet used in invoice generation this phase.

---

## Verification

1. Non-completed trip → default PDF download → `open_external` variant arrives (no billing data, blank movement grid).
2. Completed trip → default PDF download → `closed_external` arrives (movement rows populated, expenses box present).
3. `?variant=internal` on any trip → existing ops PDF with rate breakdown and charge lines.
4. Expense create/edit with `is_billable_to_hirer=true` → flag saved and returned in GET.
5. `npm run typecheck` passes with no new errors.
6. `npm run build` passes.
