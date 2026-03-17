-- Phase 6: Invoice Lifecycle Management
-- Replaces simple is_void boolean with invoice_type + invoice_status model

-- Remove old is_void column (replaced by invoice_status)
ALTER TABLE invoices
  DROP COLUMN IF EXISTS is_void;

-- Invoice type: regular invoice vs auto-issued credit note
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'invoice'
    CHECK (invoice_type IN ('invoice', 'credit_note'));

-- Reference back to original invoice (for credit notes)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reference_invoice_id uuid REFERENCES invoices(id);

-- Lifecycle status (replaces is_void boolean)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'active'
    CHECK (invoice_status IN ('active', 'void', 'written_off'));

-- Void / write-off audit trail (kept from previous migration if already run)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES profiles(id);

-- Collections FK: prevent hard-delete of invoices that have collections
ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS collections_invoice_id_fkey;
ALTER TABLE collections
  ADD CONSTRAINT collections_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_type_status ON invoices(invoice_type, invoice_status);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference_invoice_id);
