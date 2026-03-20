ALTER TABLE financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_event_type_check;

ALTER TABLE financial_ledger
  ADD CONSTRAINT financial_ledger_event_type_check
  CHECK (event_type IN (
    'invoice_issued',
    'invoice_deleted',
    'payment_received',
    'payment_amended',
    'payment_reversed',
    'refund_paid',
    'refund_amended',
    'refund_reversed',
    'invoice_voided',
    'credit_note_issued',
    'credit_note_applied', -- Reserved for future customer-credit knockoff flow
    'write_off'
  ));

