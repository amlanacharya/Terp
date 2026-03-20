# Payment Landscape Hardening

## Summary
Harden the payment trail so void-driven credit notes behave like customer-credit documents, not
normal receivable invoices.

This revision keeps the original money trail work, but corrects one semantic gap:
- `collections` recorded against normal invoices are receipts
- `collections` recorded against credit notes are refunds

That affects:
- auto-credit-note amount on void
- ledger event names
- invoice list wording
- collections UI wording
- dashboard/report receipt totals

## Locked Decisions

### Void with prior receipt
When an invoice is voided after money has already been received:
- original invoice amount remains unchanged
- original receipt history remains unchanged
- auto credit note amount equals `total_collected`, not original invoice total
- unpaid balance is cancelled by the void, not moved into the credit note

Example:
- invoice = `₹3,717`
- receipt before void = `₹2,000`
- credit note after void = `₹2,000`

### Collections on credit notes
Do not block them.

Instead:
- allow `collections` rows against active credit notes
- interpret them as `refund settlements`
- keep the same table and routes for now to avoid unnecessary schema churn

### Ledger semantics
Add document-aware refund events:
- `refund_paid`
- `refund_amended`
- `refund_reversed`

Keep `direction` internal and AR-oriented for balance math, but do not expose raw
`AR Increase / AR Decrease` labels in the invoice UI.

### UI naming
- Invoice row history panel becomes `Financial History`
- Collections module becomes receipt/refund aware
- Credit note list wording uses `refunded` / `credit pending`, not `collected` / `due`

## Backend Changes

### `server/db/migrations/010_credit_note_refund_ledger.sql`
Create a migration that replaces the `financial_ledger.event_type` check constraint to allow:
- `invoice_issued`
- `invoice_deleted`
- `payment_received`
- `payment_amended`
- `payment_reversed`
- `refund_paid`
- `refund_amended`
- `refund_reversed`
- `invoice_voided`
- `credit_note_issued`
- `credit_note_applied`
- `write_off`

### `server/db/schema.sql`
Update the fresh-install `financial_ledger` table definition to include the same expanded event set.

### `server/src/utils/ledger.ts`
- Extend `FinancialLedgerEventType` with:
  - `refund_paid`
  - `refund_amended`
  - `refund_reversed`
- Keep `formatLedgerAmount()` unchanged.

### `server/src/routes/invoices.routes.ts`

#### Void route
In `POST /api/invoices/:id/void`:
- compute `total_collected`
- if `total_collected > 0`, create the credit note with:
  - `subtotal = total_collected`
  - tax amounts = `0`
  - `total_amount = total_collected`
  - `payment_status = 'pending'`
  - `invoice_type = 'credit_note'`
  - `reference_invoice_id = original invoice id`
- create one line item:
  - description: `Refund credit for voided invoice INV-X`
  - quantity `1`
  - rate `total_collected`
  - amount `total_collected`
  - tax fields `0`
- do not clone original invoice items or tax snapshots

#### Ledger route
Keep `GET /api/invoices/:id/ledger`, but the UI consuming it must present event-specific labels,
not raw direction labels.

#### Invoice figures
Keep `collected_amount` and `outstanding_amount` as generic numeric fields. For credit notes they
represent:
- `collected_amount` = refunded/settled amount
- `outstanding_amount` = remaining credit

### `server/src/routes/collections.routes.ts`

#### Target loading
- Allow active `invoice_type = 'invoice'` and `invoice_type = 'credit_note'`
- continue blocking non-active documents

#### Payment status sync
Update payment status for both invoice types:
- `0` settled -> `pending`
- `0 < settled < total_amount` -> `partial`
- `settled >= total_amount` -> `completed`

#### Ledger writes
On create:
- normal invoice -> `payment_received`, direction `AR_DECREASE`
- credit note -> `refund_paid`, direction `AR_INCREASE`

On update where amount or invoice allocation changes:
- old invoice side:
  - invoice -> `payment_amended`, direction `AR_INCREASE`
  - credit note -> `refund_amended`, direction `AR_DECREASE`
- new invoice side:
  - invoice -> `payment_amended`, direction `AR_DECREASE`
  - credit note -> `refund_amended`, direction `AR_INCREASE`

On delete:
- invoice -> `payment_reversed`, direction `AR_INCREASE`
- credit note -> `refund_reversed`, direction `AR_DECREASE`

Suggested descriptions:
- `Payment RCP-01 of Rs.2,000 received against INV-01.`
- `Refund RFND-01 of Rs.2,000 paid against INV-01-CN.`
- `Refund RFND-01 of Rs.2,000 reversed (deleted).`

### `server/src/routes/dashboard.routes.ts`
Protect dashboard receipt totals from refund pollution:
- `invoicedAmount` should consider only normal invoices
- `collectedAmount` should sum collections only where joined invoice type is `invoice`
- outstanding widget should exclude credit notes

### `server/src/routes/reports.routes.ts`
Protect report totals from refund pollution:
- summary `collectedValue` -> receipts on normal invoices only
- customer outstanding -> normal invoices only
- customer profitability `total_collected` -> receipts on normal invoices only
- collection register can remain receipt-oriented for now by filtering joined invoices to `invoice_type = 'invoice'`

## Frontend Changes

### `src/lib/types.ts`
No new numeric fields are required. Continue using:
- `Invoice.collected_amount`
- `Invoice.outstanding_amount`

Add no new invoice list payload fields unless needed for copy selection. Existing
`invoice_type` is sufficient.

### `src/components/Invoices/InvoiceList.tsx`

#### Amount cell copy
For `invoice_type = 'invoice'`:
- `partial` -> `₹X collected · ₹Y due`
- `completed` -> `Fully collected`
- `pending/overdue` -> `Nothing collected`

For `invoice_type = 'credit_note'`:
- `partial` -> `₹X refunded · ₹Y credit pending`
- `completed` -> `Fully refunded`
- `pending` -> `No refund recorded`

#### History panel
- rename toggle/button/panel title from `Payment History` to `Financial History`
- map event labels explicitly:
  - `payment_received` -> `Payment Received`
  - `payment_amended` -> `Payment Amended`
  - `payment_reversed` -> `Payment Reversed`
  - `refund_paid` -> `Refund Paid`
  - `refund_amended` -> `Refund Amended`
  - `refund_reversed` -> `Refund Reversed`
  - `credit_note_issued` -> `Credit Note Issued`
- replace raw direction badge copy with semantic copy:
  - receipt events -> `Cash Inflow`
  - refund events -> `Cash Outflow`
  - `credit_note_issued` -> `Customer Credit Raised`
  - `invoice_deleted` / `write_off` -> `AR Reduced`
  - `invoice_voided` -> `Memo`

### `src/components/Collections/CollectionList.tsx`
Make the form document-aware:
- page title: `Receipts & Refunds`
- create button: `Record Settlement`
- selected normal invoice:
  - modal title `Record Payment Receipt`
  - amount label `Amount Received`
  - submit label `Record Payment`
- selected credit note:
  - modal title `Record Refund`
  - amount label `Amount Refunded`
  - submit label `Record Refund`
- invoice selector option labels should visibly distinguish:
  - `Invoice INV-X - Customer`
  - `Credit Note INV-X-CN - Customer`

## Acceptance Checks
- Void a partially paid invoice and confirm:
  - original invoice total is unchanged
  - credit note total equals amount already received
- Record settlement on that credit note and confirm:
  - timeline event is `Refund Paid`
  - invoice list says `refunded`, not `collected`
- Delete the refund and confirm `Refund Reversed` is appended.
- Dashboard/report collected totals do not increase because of refunds.
- No screen still says `Payment Received` for a credit-note refund.
