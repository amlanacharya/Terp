ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS invoice_pdf_mode text;

UPDATE customers
SET invoice_pdf_mode = 'invoice_with_annexures'
WHERE invoice_pdf_mode IS NULL;

ALTER TABLE customers
  ALTER COLUMN invoice_pdf_mode SET DEFAULT 'invoice_with_annexures';

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_invoice_pdf_mode_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_invoice_pdf_mode_check
    CHECK (invoice_pdf_mode IN ('invoice_only', 'invoice_with_annexures'));

ALTER TABLE customers
  ALTER COLUMN invoice_pdf_mode SET NOT NULL;
