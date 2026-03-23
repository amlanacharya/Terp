-- Clean up orphan invoice_items rows left by the void handler before fix
-- (fix/invoice-items-void added DELETE on void going forward; this backfills).
-- Voided invoices should never have active invoice_items. Credit notes are
-- separate invoice records (invoice_type = 'credit_note') and are unaffected.
DELETE FROM invoice_items
WHERE invoice_id IN (
  SELECT id FROM invoices WHERE invoice_status = 'void'
);
