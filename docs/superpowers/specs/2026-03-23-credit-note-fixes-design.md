# Credit Note Fixes — Design Spec

**Date:** 2026-03-23
**Branch:** GT-Dev
**Status:** Approved

---

## Problem Statement

Two bugs exist in the invoice void / credit note flow:

1. **Rebilling blocked after void**: After voiding an invoice for a direct-billed trip, the trip's `invoice_items` record is left as an orphan. Although the `direct_invoice_id` query correctly filters by `invoice_status = 'active'` (so the trip is technically rebillable), the orphan row creates data integrity risk and may cause the trip to appear as "billed" in list filters that don't apply the active-status guard.

2. **Credit note consumes invoice number**: `generateInvoiceNumber` counts all invoices matching `LIKE 'GT-INV-YYYY-%'`. Credit notes are stored as `GT-INV-2025-00001-CN`, which matches this pattern, inflating the count by one per credit note and causing gaps in the invoice number series.

---

## Scope

- `server/src/routes/invoices.routes.ts` — void handler
- `server/src/utils/invoice-gt.ts` — number generation
- `server/db/migrations/` — system_settings seed for CN counter
- No frontend changes
- No schema changes to core tables

---

## Design

### Fix 1: Clean up `invoice_items` on void

**Pattern (SAP-inspired):** When SAP cancels a billing document (VF11), the cancellation removes the document from the delivery's document flow. The delivery's billing status is then re-derived as "Not Billed." TravelERP's equivalent is deleting the `invoice_items` rows so the trip's computed `direct_invoice_id` subquery returns null.

**Change:** In the void handler transaction (`POST /:id/void`), after marking the invoice as void, add:

```sql
DELETE FROM invoice_items WHERE invoice_id = $1
```

This:
- Cleans up orphan `invoice_items` for direct-trip invoices
- Mirrors the existing annexure cleanup (`is_billed = false` reset) for consistency
- Makes the trip immediately rebillable without any query logic changes

Annexure trips are already handled: the void handler resets `annexures.is_billed = false` and `invoice_id = NULL`. Users who need to rebill past-month annexures will manually adjust the date range filter in AnnexureListPage.

---

### Fix 2: Separate credit note number series

**Pattern (SAP SNRO / Finnone doc_sequence):** Enterprise ERPs assign each document type its own number range object. Credit memos never share a sequence with invoices.

**Part A — Fix `generateInvoiceNumber`:**

Add `AND invoice_type = 'invoice'` to the COUNT query so credit notes are excluded:

```typescript
'SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1 AND invoice_type = \'invoice\''
```

This closes the gap retroactively — existing credit notes no longer inflate future invoice counts.

**Part B — Add `generateCreditNoteNumber`:**

Store a per-year counter in `system_settings`:

| key | value |
|---|---|
| `cn_sequence_2025` | `0` |
| `cn_sequence_2026` | `0` |

New function `generateCreditNoteNumber(db, prefix, year)`:
- Reads `cn_sequence_YYYY` from `system_settings`
- Increments atomically within the void handler transaction
- Returns `GT-CN-YYYY-NNNNN` (e.g., `GT-CN-2026-00001`)

The void handler calls `generateCreditNoteNumber` instead of the current hardcoded `${invoice_number}-CN` pattern.

**Credit note format:** `GT-CN-2026-00001`
**Invoice format unchanged:** `GT-INV-2026-00001`

---

## Data Flow

```
User voids Invoice GT-INV-2026-00042
  └─ BEGIN transaction
      ├─ UPDATE invoices SET invoice_status = 'void' WHERE id = $1
      ├─ DELETE FROM invoice_items WHERE invoice_id = $1        ← NEW
      ├─ UPDATE annexures SET is_billed = false ... (existing)
      ├─ generateCreditNoteNumber() → GT-CN-2026-00001          ← NEW
      └─ INSERT INTO invoices (invoice_type='credit_note', invoice_number='GT-CN-2026-00001', ...)
  └─ COMMIT

Trip query: direct_invoice_id subquery → NULL (no active invoice_items)
Trip list: "Bill Trip" button appears again
```

---

## Files Changed

| File | Change |
|---|---|
| `server/src/routes/invoices.routes.ts` | Add DELETE invoice_items in void handler; call generateCreditNoteNumber |
| `server/src/utils/invoice-gt.ts` | Fix generateInvoiceNumber WHERE clause; add generateCreditNoteNumber |
| `server/db/migrations/YYYYMMDD_cn_sequence.sql` | INSERT cn_sequence_YYYY into system_settings |

---

## Non-Goals

- No change to AnnexureListPage date filter behaviour — users adjust manually
- No change to how existing credit notes are displayed
- No backfill of existing credit note numbers (existing `-CN` suffix records remain as-is)

---

## Success Criteria

1. After voiding an invoice for a direct-billed trip, the "Bill Trip" button reappears on the trip
2. After voiding an invoice with annexures, the annexures appear as unbilled (is_billed = false); users find them by adjusting the date range
3. New credit notes receive numbers from the `GT-CN-YYYY-NNNNN` series
4. New invoices created after the fix have sequential numbers with no gaps
5. `generateInvoiceNumber` count excludes all `invoice_type = 'credit_note'` rows
