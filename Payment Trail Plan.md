# Payment Landscape Hardening: Money Trail + Credit Note Settlement Semantics

## Context

The first pass solved missing figures and missing audit trail, but it still modeled every
`collections` row as a customer receipt. That breaks down for void-driven credit notes.

Example:
- Original invoice: `₹3,717`
- Receipt recorded before void: `₹2,000`
- Invoice later voided

The correct record is:
- the original invoice remains `₹3,717`
- the original receipt of `₹2,000` remains in history
- the unpaid `₹1,717` is cancelled by the void
- the auto-issued credit note should be only `₹2,000`
- if we pay the customer back, that event is a `refund`, not a `payment received`

So this phase hardens the model further:
- credit notes become customer-credit documents, not normal receivable invoices
- `collections` is reused as the settlement table for both receipts and refunds
- the financial ledger becomes document-aware
- invoice and collections UI copy becomes document-aware

## Core Business Rules

### Normal invoice
- `total_amount` = amount customer owes
- `collections` against it are customer receipts
- list labels:
  - `collected`
  - `due`
  - `fully collected`

### Credit note
- `total_amount` = amount we owe back to the customer or can apply as customer credit
- `collections` against it represent refunds paid
- list labels:
  - `refunded`
  - `credit pending`
  - `fully refunded`

### Void with prior receipt
If invoice `INV-X` is voided after receiving money:
- keep the original receipt history on `INV-X`
- create credit note `INV-X-CN` for exactly the amount already received
- do not create a credit note for the unpaid balance
- unpaid balance is cancelled by the void itself

## Phase 1: Fix Void Credit Note Amount

### Files
- `server/src/routes/invoices.routes.ts`

### Changes
- In `POST /api/invoices/:id/void`, when `total_collected > 0`:
  - create the credit note for `total_collected`, not `total_amount`
  - set new credit note `payment_status = 'pending'`
  - create a single manual-style credit-note line item such as:
    - `Refund credit for voided invoice INV-X`
  - do not clone the original invoice item/tax snapshot rows
- Keep the original invoice amount unchanged and mark it `void`

### Ledger effect
- original invoice timeline keeps:
  - `invoice_issued`
  - `payment_received`
  - `invoice_voided`
- credit note timeline gets:
  - `credit_note_issued`
  - later `refund_paid` when cash is returned

## Phase 2: Make Collections Document-Aware

No new `collections` table is needed. Reuse the existing table and make the meaning depend on
`invoice.invoice_type`.

### Files
- `server/src/routes/collections.routes.ts`
- `src/components/Collections/CollectionList.tsx`
- `src/lib/types.ts`

### Backend rules
- Allow active `credit_note` rows in collection create/update/delete flows.
- `syncInvoicePaymentStatus` must update both:
  - active normal invoices
  - active credit notes
- The numeric math stays the same:
  - `settled_amount = SUM(collections.amount)`
  - `remaining_amount = max(0, total_amount - settled_amount)`
- Only the UI meaning changes by document type.

### Frontend rules
- Collections module becomes a document-aware settlement screen.
- If selected document is a normal invoice:
  - show receipt wording
- If selected document is a credit note:
  - show refund wording

Recommended copy:
- Page heading: `Receipts & Refunds`
- Create button: `Record Settlement`
- Modal title:
  - invoice -> `Record Payment Receipt`
  - credit note -> `Record Refund`
- Amount label:
  - invoice -> `Amount Received`
  - credit note -> `Amount Refunded`

## Phase 3: Ledger Event Taxonomy

### Problem
`payment_received` and `payment_reversed` are wrong for credit-note cash settlements.

### New event types
Add to `financial_ledger.event_type`:
- `refund_paid`
- `refund_amended`
- `refund_reversed`

Keep existing types:
- `invoice_issued`
- `invoice_deleted`
- `payment_received`
- `payment_amended`
- `payment_reversed`
- `invoice_voided`
- `credit_note_issued`
- `credit_note_applied`
- `write_off`

### Direction model
Keep the internal `direction` field AR-balance oriented:
- invoice receipt:
  - `payment_received` -> `AR_DECREASE`
- refund against credit note:
  - `refund_paid` -> `AR_INCREASE`

Reason:
- issuing the credit note reduces AR / creates customer credit
- paying that refund settles the customer credit and brings the net balance back toward zero

The UI must not expose raw `AR Increase / AR Decrease` labels for users. It should show
event-specific language instead.

### Collection route mapping

Create:
- against `invoice` -> `payment_received`
- against `credit_note` -> `refund_paid`

Update with amount/invoice reallocation change:
- old side:
  - `invoice` -> `payment_amended`
  - `credit_note` -> `refund_amended`
- new side:
  - `invoice` -> `payment_amended`
  - `credit_note` -> `refund_amended`

Delete:
- against `invoice` -> `payment_reversed`
- against `credit_note` -> `refund_reversed`

Suggested descriptions:
- `Payment RCP-X of Rs.2,000 received against INV-X.`
- `Refund RFND-X of Rs.2,000 paid against INV-X-CN.`
- `Refund RFND-X of Rs.2,000 reversed (deleted).`

## Phase 4: Invoice History and List Copy

### Files
- `src/components/Invoices/InvoiceList.tsx`
- `src/lib/types.ts`

### Invoice list amount cell
For normal invoices:
- partial -> `₹X collected · ₹Y due`
- completed -> `Fully collected`
- pending/overdue -> `Nothing collected`

For credit notes:
- partial -> `₹X refunded · ₹Y credit pending`
- completed -> `Fully refunded`
- pending -> `No refund recorded`

### Timeline panel
- Rename `Payment History` to `Financial History`
- Timeline label mapping:
  - `payment_received` -> `Payment Received`
  - `payment_amended` -> `Payment Amended`
  - `payment_reversed` -> `Payment Reversed`
  - `refund_paid` -> `Refund Paid`
  - `refund_amended` -> `Refund Amended`
  - `refund_reversed` -> `Refund Reversed`
  - `credit_note_issued` -> `Credit Note Issued`
- Replace raw `AR Increase / AR Decrease` badge text with event-aware copy such as:
  - `Cash Inflow`
  - `Cash Outflow`
  - `Customer Credit Raised`
  - `AR Cancelled`
  - `Memo`

## Phase 5: Protect Dashboard and Reports From Refund Pollution

Once refunds live in `collections`, any report that blindly sums `collections.amount` becomes wrong.

### Files
- `server/src/routes/dashboard.routes.ts`
- `server/src/routes/reports.routes.ts`

### Changes
- Dashboard `collectedAmount` must sum only collections linked to `invoice_type = 'invoice'`
- Dashboard outstanding invoice widgets must exclude credit notes
- Reports summary `collectedValue` must sum only collections for normal invoices
- Customer outstanding must only consider normal invoices
- Customer profitability `total_collected` must only count receipts on normal invoices
- Collection register can stay receipt-oriented for now by filtering to normal invoices only

## Migration Sequence

1. Add migration `010_credit_note_refund_ledger.sql`
2. Extend `financial_ledger` check constraint to include:
   - `refund_paid`
   - `refund_amended`
   - `refund_reversed`
3. Update `server/db/schema.sql` accordingly

## Verification

1. Create invoice `₹3,717` -> `invoice_issued` exists.
2. Record receipt `₹2,000` on invoice -> `payment_received` exists.
3. Void that invoice:
   - invoice stays `₹3,717`
   - credit note auto-created for `₹2,000`
   - `invoice_voided` exists on original invoice trail
   - `credit_note_issued` exists on credit note trail
4. Record settlement `₹2,000` on the credit note:
   - ledger row is `refund_paid`, not `payment_received`
   - credit note shows `₹2,000 refunded`
   - remaining credit becomes `₹0`
5. Delete that refund:
   - original `refund_paid` stays
   - `refund_reversed` is appended
   - credit note returns to pending/partial correctly
6. Dashboard/report collected totals do not increase because of refunds on credit notes.
7. Invoice list timeline reads `Financial History`, not `Payment History`.
