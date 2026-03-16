import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const invoiceFields = [
  'invoice_number',
  'invoice_date',
  'customer_id',
  'billing_address',
  'customer_gstin',
  'subtotal',
  'cgst_amount',
  'sgst_amount',
  'igst_amount',
  'total_amount',
  'payment_status',
  'due_date',
  'remarks',
] as const;

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          i.*,
          json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        ORDER BY i.invoice_date DESC, i.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching invoices failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoices.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  if (!payload.invoice_number || !payload.invoice_date || !payload.customer_id || !payload.subtotal || !payload.total_amount) {
    res.status(400).json({ message: 'Missing required invoice fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO invoices (
          invoice_number, invoice_date, customer_id, billing_address, customer_gstin,
          subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
          payment_status, due_date, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        )
        RETURNING *
      `,
      [
        payload.invoice_number,
        payload.invoice_date,
        payload.customer_id,
        payload.billing_address ?? null,
        payload.customer_gstin ?? null,
        payload.subtotal,
        payload.cgst_amount ?? 0,
        payload.sgst_amount ?? 0,
        payload.igst_amount ?? 0,
        payload.total_amount,
        payload.payment_status ?? 'pending',
        payload.due_date ?? null,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating invoice failed:', error);
    res.status(500).json({ message: 'Unable to create invoice.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No invoice fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE invoices SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating invoice failed:', error);
    res.status(500).json({ message: 'Unable to update invoice.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting invoice failed:', error);
    res.status(500).json({ message: 'Unable to delete invoice.' });
  }
});

export default router;
