CREATE TABLE IF NOT EXISTS financial_ledger (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type text NOT NULL CHECK (event_type IN (
    'invoice_issued',
    'invoice_deleted',
    'payment_received',
    'payment_amended',
    'payment_reversed',
    'invoice_voided',
    'credit_note_issued',
    'credit_note_applied', -- Reserved for future customer-credit knockoff flow
    'write_off'
  )),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  invoice_id uuid,
  invoice_number text NOT NULL,
  collection_id uuid,
  amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  direction text NOT NULL CHECK (direction IN ('AR_INCREASE', 'AR_DECREASE')),
  description text NOT NULL,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_invoice ON financial_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_customer ON financial_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_created_at_desc ON financial_ledger(created_at DESC);

