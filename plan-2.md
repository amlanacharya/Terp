# TravelERP - MVP Gap-Fill Plan

## Context

TravelERP has 12 working modules but key business workflows are disconnected: trips don't auto-generate invoices, settlements are manual, there's no PDF output, and no delete buttons in the UI. The goal is to close the minimum gaps needed so the product works as a real end-to-end travel ERP before SaaS launch.

---

## Implementation Order: 7 features across 5 phases

### Phase 1: GST Auto-Calc + Auto-Invoice from Trips

**Feature 6: GST Auto-Calculation on Invoices**

| Action | File |
|--------|------|
| Create `calculateGst(subtotal, isInterState)` utility | `server/src/utils/gst.ts` (NEW) |
| Create `GET /api/gst-rates` endpoint | `server/src/routes/gst.routes.ts` (NEW) |
| Mount gst routes | `server/src/index.ts` |
| Auto-fill CGST/SGST/total when subtotal changes in invoice form | `src/components/Invoices/InvoiceList.tsx` |
| Add `GstRate` type | `src/lib/types.ts` |

**Feature 1: Auto-Invoice Generation on Trip Completion**

| Action | File |
|--------|------|
| In PUT handler, when status -> "completed": auto-create invoice + invoice_item | `server/src/routes/trips.routes.ts` |
| Idempotency: skip if `invoice_items` already has this `trip_id` | same |
| Auto-generate invoice_number from `invoice_prefix` setting + sequence | same |
| Use `calculateGst()` for tax amounts, default HSN 9964 | same |
| Set `due_date = invoice_date + customer.credit_days` | same |
| Add `GET /api/invoices/:id` (single invoice + items) | `server/src/routes/invoices.routes.ts` |

**Logic:**
- `subtotal = trip_amount`
- Default intra-state: CGST 2.5% + SGST 2.5% (from gst_rates HSN 9964)
- `total_amount = subtotal + cgst + sgst`
- `invoice_item.description = "Trip {trip_number}: {from} to {to}"`
- `invoice_item.trip_id = trip.id` (prevents duplicates)

---

### Phase 2: Trip Expenses UI

**Feature 7: Trip Expenses Management**

The `trip_expenses` table already exists (trip_id, expense_type, amount, description, receipt_number). Need API + UI.

| Action | File |
|--------|------|
| Create CRUD endpoints: `GET /api/trips/:id/expenses`, `POST /api/trips/:id/expenses`, `PUT /api/trips/:id/expenses/:expenseId`, `DELETE /api/trips/:id/expenses/:expenseId` | `server/src/routes/trips.routes.ts` |
| Add inline expenses section to the trip edit form - show expenses list with add/edit/delete below trip details | `src/components/Trips/TripList.tsx` |
| Add `TripExpense` type: `{ id, trip_id, expense_type, amount, description, receipt_number }` | `src/lib/types.ts` |
| Expense types: fuel, toll, parking, food, other (simple text dropdown) | frontend only |
| Show total expenses on trip card/row for quick visibility | `src/components/Trips/TripList.tsx` |

**Design:** Expenses are managed as a sub-list within the trip edit modal/form. No separate page needed. When editing a trip, an "Expenses" section appears below with an inline table + "Add Expense" button.

---

### Phase 3: Delete Buttons

**Feature 5: Add delete with confirmation to all list views**

Files to modify (same pattern in each - add `handleDelete` + red button + `window.confirm`):

1. `src/components/Trips/TripList.tsx`
2. `src/components/Invoices/InvoiceList.tsx`
3. `src/components/Collections/CollectionList.tsx`
4. `src/components/Settlements/DriverSettlements.tsx`
5. `src/components/Settlements/OwnerSettlements.tsx`
6. `src/components/Customers/CustomerList.tsx`
7. `src/components/Drivers/DriverList.tsx`
8. `src/components/Vehicles/VehicleList.tsx`
9. `src/components/Owners/OwnerList.tsx`

Backend: Add missing DELETE endpoints for settlements in `server/src/routes/settlements.routes.ts`.

Handle FK errors gracefully (e.g., "Cannot delete trip - it has an associated invoice").

---

### Phase 4: Dashboard & Reports Enhancement

**Feature 2: Financial visibility**

| Action | File |
|--------|------|
| Add SUM queries for invoiced/collected/outstanding to stats endpoint | `server/src/routes/dashboard.routes.ts` |
| Add recent outstanding invoices query (top 10, pending/partial/overdue) | same |
| Add `GET /api/reports/customer-outstanding` (per-customer breakdown) | `server/src/routes/reports.routes.ts` |
| Show 3 financial cards (Invoiced, Collected, Outstanding) on dashboard | `src/components/Dashboard/Dashboard.tsx` |
| Show "Recent Outstanding Invoices" table on dashboard | same |
| Add "Customer-wise Outstanding" table to reports | `src/components/Reports/Reports.tsx` |
| Add new types: `OutstandingInvoice`, `CustomerOutstanding` | `src/lib/types.ts` |

---

### Phase 5: PDF Generation

**Feature 3: Invoice PDF**

| Action | File |
|--------|------|
| Install `pdfkit` + `@types/pdfkit` in server | `server/package.json` |
| Create invoice PDF generator (company header, customer block, line items, GST breakdown, totals, bank details) | `server/src/utils/pdf-invoice.ts` (NEW) |
| Add `GET /api/invoices/:id/pdf` endpoint | `server/src/routes/invoices.routes.ts` |
| Add `downloadBlob()` helper for authenticated file downloads | `src/lib/api.ts` |
| Add "PDF" download button on invoice list | `src/components/Invoices/InvoiceList.tsx` |
| Add bank detail settings (`bank_name`, `bank_account`, `bank_ifsc`) | seed/migration |

**Feature 4: Settlement PDFs**

| Action | File |
|--------|------|
| Create driver/owner settlement PDF generators (header, period, trip summary, deductions, net payable) | `server/src/utils/pdf-settlement.ts` (NEW) |
| Add `GET /api/settlements/drivers/:id/pdf` and `owners/:id/pdf` | `server/src/routes/settlements.routes.ts` |
| Add "PDF" button to driver & owner settlement lists | `src/components/Settlements/DriverSettlements.tsx`, `OwnerSettlements.tsx` |

**PDF content for invoices:**
- Company name, address, GSTIN, PAN (from system_settings)
- Customer name, address, GSTIN
- Invoice #, date, due date
- Line items table: Description | HSN | Qty | Rate | Amount | CGST | SGST | Total
- Subtotal, CGST total, SGST total, Grand Total
- Bank details (if configured)
- Footer: "Computer-generated invoice"

**PDF content for settlements:**
- Company header
- Driver/Owner details + bank info
- Period (from - to)
- Trip summary table for that period
- Gross amount, allowances/deductions/TDS, net payable
- Payment mode + reference if paid

---

### Phase 6: Business Reports

**Feature 8: Owner/Vendor-wise Settlement Report**

| Action | File |
|--------|------|
| Add `GET /api/reports/owner-settlements` — grouped by owner: name, vehicle(s), total trips, total km, gross amount, TDS, other deductions, net paid, payment mode, reference number | `server/src/routes/reports.routes.ts` |
| Add report UI table with owner rows, expandable to show individual settlements | `src/components/Reports/Reports.tsx` |
| Add date range filter (period_from / period_to) and status filter (pending/approved/paid) | same |
| Add `OwnerSettlementReport` type | `src/lib/types.ts` |

**Feature 9: Driver-wise Salary/Settlement Report**

| Action | File |
|--------|------|
| Add `GET /api/reports/driver-settlements` — grouped by driver: name, total trips, total km, total allowance, advances, deductions, net paid, payment mode, reference number | `server/src/routes/reports.routes.ts` |
| Add report UI table with driver rows, expandable to show individual settlements | `src/components/Reports/Reports.tsx` |
| Add date range filter and status filter | same |
| Add `DriverSettlementReport` type | `src/lib/types.ts` |

**Feature 10: Collection Register**

| Action | File |
|--------|------|
| Add `GET /api/reports/collections` — all collections with: collection_number, collection_date, invoice_number, customer_name, amount, payment_mode, bank_name, reference_number, remarks | `server/src/routes/reports.routes.ts` |
| Add Collection Register table in reports UI with date range filter and payment mode filter | `src/components/Reports/Reports.tsx` |
| Show totals row: total collected, breakdown by payment mode (cash/cheque/bank/UPI/card) | same |
| Add `CollectionRegisterEntry` type | `src/lib/types.ts` |

**Feature 11: Customer-wise Income/Profitability Report**

| Action | File |
|--------|------|
| Add `GET /api/reports/customer-profitability` — per customer: total invoiced, total collected, outstanding, total trip expenses incurred (from trip_expenses via trips), net income (invoiced - expenses) | `server/src/routes/reports.routes.ts` |
| Add report UI table with customer rows showing invoiced, collected, outstanding, expenses, net income columns | `src/components/Reports/Reports.tsx` |
| Add date range filter | same |
| Add `CustomerProfitabilityReport` type | `src/lib/types.ts` |

**SQL logic for customer profitability:**
```sql
SELECT c.id, c.name,
  COALESCE(SUM(DISTINCT i.total_amount), 0) as total_invoiced,
  COALESCE(SUM(col.amount), 0) as total_collected,
  (invoiced - collected) as outstanding,
  COALESCE(SUM(te.amount), 0) as total_expenses,
  (invoiced - expenses) as net_income
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
LEFT JOIN collections col ON col.invoice_id = i.id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN trip_expenses te ON te.trip_id = ii.trip_id
GROUP BY c.id
```

---

### Phase 6 (contd): CSV Export for All Reports

**Feature 12: CSV Export**

| Action | File |
|--------|------|
| Create `arrayToCsv(data, columns)` utility — takes array of objects + column config, returns CSV string with headers | `src/lib/csv-export.ts` (NEW) |
| Create `downloadCsv(csvString, filename)` helper — triggers browser download | same |
| Add "Export CSV" button to each report tab (Owner Settlements, Driver Settlements, Collection Register, Customer Profitability, Customer Outstanding) | `src/components/Reports/Reports.tsx` |
| CSV uses the same data already fetched for the report table — no extra API calls needed | frontend only |

**Column mappings per report CSV:**
- **Owner Settlements**: Owner Name, Vehicle(s), Total Trips, Total KM, Gross Amount, TDS, Deductions, Net Paid, Payment Mode, Reference
- **Driver Settlements**: Driver Name, Total Trips, Total KM, Allowance, Advances, Deductions, Net Paid, Payment Mode, Reference
- **Collection Register**: Collection #, Date, Invoice #, Customer, Amount, Payment Mode, Bank Name, Reference #, Remarks
- **Customer Profitability**: Customer Name, Total Invoiced, Total Collected, Outstanding, Total Expenses, Net Income

---

## New Files Summary

| File | Purpose |
|------|---------|
| `server/src/utils/gst.ts` | GST calculation utility |
| `server/src/routes/gst.routes.ts` | GST rates API |
| `server/src/utils/pdf-invoice.ts` | Invoice PDF generator |
| `server/src/utils/pdf-settlement.ts` | Settlement PDF generator |
| `src/lib/csv-export.ts` | CSV generation + browser download utility |

## Key Risks & Mitigations

- **Invoice number races**: Use simple COUNT+1 for MVP (single-user); upgrade to DB sequence later for multi-tenant
- **FK on delete**: Catch postgres FK errors, return friendly message ("Cannot delete - linked records exist")
- **Rupee symbol in PDF**: Use "Rs." prefix if Unicode rupee glyph doesn't render in default PDFKit font
- **Old invoices without items**: PDF generator falls back to single line from invoice subtotal if no invoice_items

## Verification

1. Create a trip, assign customer/driver/vehicle, set amount
2. Edit trip -> add expenses (fuel, toll, etc.) -> verify they save and display
3. Change trip status to "completed" -> verify invoice auto-created with correct GST
3. Check invoice list -> verify new invoice appears with correct totals
4. Download invoice PDF -> verify all details render correctly
5. Record a collection against the invoice -> verify payment_status updates
6. Check dashboard -> verify financial cards show correct totals
7. Check reports -> verify customer-outstanding breakdown
8. Delete a record from each module -> verify confirmation + deletion works
9. Create driver/owner settlement -> download PDF -> verify content
10. Check Reports -> Owner Settlement Report: verify owner-wise grouping with payment details
11. Check Reports -> Driver Settlement Report: verify driver-wise salary breakdown
12. Check Reports -> Collection Register: verify all collections with bank refs, payment modes, totals by mode
13. Check Reports -> Customer Profitability: verify invoiced vs expenses vs net income per customer
14. Click "Export CSV" on any report -> verify CSV downloads with correct columns and data
