# Credit Note Fixes — Design Spec

**Date:** 2026-03-23
**Branch:** GT-Dev
**Status:** Approved

---

## Problem Statement

Two bugs exist in the invoice void / credit note flow:

1. **Rebilling blocked after void**: After voiding an invoice for a direct-billed trip, the trip's `invoice_items` record is left as an orphan. Although the `direct_invoice_id` query correctly filters by `invoice_status = 'active'` (so the trip is technically rebillable), the orphan row creates data integrity risk and may cause the trip to appear as "billed" in list filters that do not apply the active-status guard.

2. **Credit note consumes invoice number**: `generateInvoiceNumber` counts all invoices matching `LIKE 'GT-INV-YYYY-%'`. Credit notes stored as `GT-INV-2025-00001-CN` match this pattern, inflating the count by one per credit note and causing gaps in the invoice number series.

---

## Scope

- `server/src/routes/invoices.routes.ts` — void handler
- `server/src/utils/invoice-gt.ts` — number generation
- `server/db/migrations/20260323_cn_sequence.sql` — system_settings seed for CN counter
- No frontend changes
- No schema changes to core tables

---

## Out of Scope

`generateInvoiceNumber` uses a `COUNT(*)`-based approach that has a pre-existing theoretical concurrency race (two simultaneous invoice creations can read the same count and collide on the UNIQUE constraint). This is a pre-existing risk not introduced by these fixes and is not addressed here. Fix 2A only narrows the count to exclude credit notes; the race condition on the invoice series itself is tracked separately.

---

## Design

### Fix 1: Clean up `invoice_items` on void

**Pattern (SAP-inspired):** When SAP cancels a billing document (VF11), the cancellation removes the document from the delivery's document flow. The delivery's billing status is then re-derived as "Not Billed." TravelERP's equivalent is deleting the `invoice_items` rows so the trip's computed `direct_invoice_id` subquery returns null.

**Change:** In the void handler transaction (`POST /:id/void`), the correct operation order is:

1. Query `invoice_items` to collect all `annexure_id` values for the voided invoice
2. Reset those annexures (`is_billed = false`, `invoice_id = NULL`) — existing behaviour
3. Delete all `invoice_items` rows for the voided invoice:

```sql
DELETE FROM invoice_items WHERE invoice_id = $1
```

> **Important:** `$1` here is `invoiceId` (the voided invoice), NOT the credit note's ID. The credit note is created after this step and its own `invoice_items` row (if any) is inserted with `invoice_id = creditNoteId`. These are distinct variables and the DELETE does not affect the credit note's items.

This:
- Cleans up orphan `invoice_items` for direct-trip invoices
- Mirrors the existing annexure cleanup for consistency
- Makes the trip immediately rebillable — the `direct_invoice_id` subquery returns null with no orphan rows

Annexure trips are already handled: the void handler resets `annexures.is_billed = false` and `invoice_id = NULL`. Users who need to rebill past-month annexures will manually adjust the date range filter in AnnexureListPage.

---

### Fix 2: Separate credit note number series

**Pattern (SAP SNRO / Finnone doc_sequence):** Enterprise ERPs assign each document type its own number range object. Credit memos never share a sequence with invoices.

**Part A — Fix `generateInvoiceNumber`:**

Add `AND invoice_type = 'invoice'` to the COUNT query so credit notes are excluded:

```typescript
'SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1 AND invoice_type = \'invoice\''
```

This closes the gap — existing credit notes no longer inflate future invoice counts.

**Part B — Add `generateCreditNoteNumber`:**

Store a per-year counter in `system_settings`:

| key | value |
|---|---|
| `cn_sequence_2025` | `0` |
| `cn_sequence_2026` | `0` |

New function `generateCreditNoteNumber(db, prefix, year)`:

1. Inside the existing `BEGIN` transaction, read and lock the counter row:
   ```sql
   SELECT setting_value FROM system_settings WHERE setting_key = $1 FOR UPDATE
   ```
   The `FOR UPDATE` row lock ensures two concurrent void operations cannot both read the same counter value and produce duplicate credit note numbers.

2. Increment the value and write it back:
   ```sql
   UPDATE system_settings SET setting_value = $2 WHERE setting_key = $1
   ```

3. Return the formatted number: `GT-CN-2026-00001`

The void handler calls `generateCreditNoteNumber` instead of the current hardcoded `${invoice_number}-CN` pattern.

**Credit note format:** `GT-CN-2026-00001`
**Invoice format unchanged:** `GT-INV-2026-00001`

---

## Data Flow

```
User voids Invoice GT-INV-2026-00042
  └─ BEGIN transaction
      ├─ UPDATE invoices SET invoice_status = 'void' WHERE id = invoiceId
      ├─ SELECT annexure_ids FROM invoice_items WHERE invoice_id = invoiceId   ← step 1
      ├─ UPDATE annexures SET is_billed=false ... (existing)                   ← step 2
      ├─ DELETE FROM invoice_items WHERE invoice_id = invoiceId                ← step 3 (NEW)
      ├─ SELECT setting_value FROM system_settings WHERE key='cn_seq' FOR UPDATE
      ├─ UPDATE system_settings SET setting_value = N+1 ...
      ├─ generateCreditNoteNumber() → GT-CN-2026-00001                        ← NEW
      └─ INSERT INTO invoices (invoice_type='credit_note',
                               invoice_number='GT-CN-2026-00001', ...)
  └─ COMMIT

Trip query: direct_invoice_id subquery → NULL (no active invoice_items)
Trip list: "Bill Trip" button appears again
```

---

## Files Changed

| File | Change |
|---|---|
| `server/src/routes/invoices.routes.ts` | Reorder void handler: query annexures → reset annexures → DELETE invoice_items; call generateCreditNoteNumber |
| `server/src/utils/invoice-gt.ts` | Fix generateInvoiceNumber WHERE clause to add `AND invoice_type = 'invoice'`; add generateCreditNoteNumber with FOR UPDATE locking |
| `server/db/migrations/20260323_cn_sequence.sql` | INSERT cn_sequence_YYYY rows into system_settings |

---

## Non-Goals

- No change to AnnexureListPage date filter behaviour — users adjust manually
- No change to how existing credit notes are displayed
- No backfill of existing credit note numbers (existing `-CN` suffix records remain as-is)
- No fix to the pre-existing concurrency race in `generateInvoiceNumber` (tracked separately)

---

## Success Criteria

1. After voiding an invoice for a direct-billed trip, the "Bill Trip" button reappears on the trip
2. After voiding an invoice with annexures, the annexures appear as unbilled (`is_billed = false`); users find them by adjusting the date range
3. New credit notes receive numbers from the `GT-CN-YYYY-NNNNN` series
4. New invoices created after the fix have no gaps caused by credit notes (credit notes no longer match the invoice COUNT query)
5. `generateInvoiceNumber` count excludes all `invoice_type = 'credit_note'` rows
6. Concurrent void operations produce unique credit note numbers (guaranteed by FOR UPDATE row lock on system_settings)
