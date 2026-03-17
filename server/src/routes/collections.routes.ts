import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const collectionFields = [
  'collection_number',
  'collection_date',
  'invoice_id',
  'amount',
  'payment_mode',
  'reference_number',
  'bank_name',
  'remarks',
] as const;

async function ensureInvoiceCollectable(invoiceId: string): Promise<boolean> {
  const result = await query<{ invoice_status: string }>('SELECT invoice_status FROM invoices WHERE id = $1 LIMIT 1', [invoiceId]);
  if (!result.rows[0]) {
    throw new Error('Invoice not found.');
  }

  return result.rows[0].invoice_status === 'active';
}

async function syncInvoicePaymentStatus(invoiceId: string): Promise<void> {
  await query(
    `
      UPDATE invoices
      SET
        payment_status = CASE
          WHEN summary.collected_amount <= 0 THEN 'pending'::payment_status
          WHEN summary.collected_amount < invoices.total_amount THEN 'partial'::payment_status
          ELSE 'completed'::payment_status
        END,
        updated_at = now()
      FROM (
        SELECT i.id, COALESCE(SUM(c.amount), 0) AS collected_amount
        FROM invoices i
        LEFT JOIN collections c ON c.invoice_id = i.id
        WHERE i.id = $1
        GROUP BY i.id
      ) AS summary
      WHERE invoices.id = summary.id AND invoices.invoice_status = 'active'
    `,
    [invoiceId]
  );
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          col.*,
          json_build_object(
            'id', inv.id,
            'invoice_number', inv.invoice_number,
            'total_amount', inv.total_amount,
            'payment_status', inv.payment_status,
            'customer', json_build_object('id', cust.id, 'name', cust.name, 'customer_code', cust.customer_code)
          ) AS invoice
        FROM collections col
        JOIN invoices inv ON inv.id = col.invoice_id
        JOIN customers cust ON cust.id = inv.customer_id
        ORDER BY col.collection_date DESC, col.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching collections failed:', error);
    res.status(500).json({ message: 'Unable to fetch collections.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, collectionFields);
  if (!payload.collection_number || !payload.collection_date || !payload.invoice_id || !payload.amount || !payload.payment_mode) {
    res.status(400).json({ message: 'Missing required collection fields.' });
    return;
  }

  try {
    if (!(await ensureInvoiceCollectable(String(payload.invoice_id)))) {
      res.status(409).json({ message: 'Collections are blocked for void invoices.' });
      return;
    }

    const result = await query(
      `
        INSERT INTO collections (
          collection_number, collection_date, invoice_id, amount, payment_mode,
          reference_number, bank_name, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9
        )
        RETURNING *
      `,
      [
        payload.collection_number,
        payload.collection_date,
        payload.invoice_id,
        payload.amount,
        payload.payment_mode,
        payload.reference_number ?? null,
        payload.bank_name ?? null,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    await syncInvoicePaymentStatus(String(payload.invoice_id));
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating collection failed:', error);
    res.status(error instanceof Error && error.message === 'Invoice not found.' ? 404 : 500).json({
      message: error instanceof Error ? error.message : 'Unable to create collection.',
    });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, collectionFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No collection fields supplied for update.' });
    return;
  }

  try {
    const existing = await query<{ invoice_id: string }>(
      'SELECT invoice_id FROM collections WHERE id = $1 LIMIT 1',
      [req.params.id]
    );

    if (!existing.rows[0]) {
      res.status(404).json({ message: 'Collection not found.' });
      return;
    }

    if (payload.invoice_id && !(await ensureInvoiceCollectable(String(payload.invoice_id)))) {
      res.status(409).json({ message: 'Collections are blocked for void invoices.' });
      return;
    }

    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE collections SET ${update.clause} WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    await syncInvoicePaymentStatus(existing.rows[0].invoice_id);
    if (payload.invoice_id && payload.invoice_id !== existing.rows[0].invoice_id) {
      await syncInvoicePaymentStatus(String(payload.invoice_id));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating collection failed:', error);
    res.status(error instanceof Error && error.message === 'Invoice not found.' ? 404 : 500).json({
      message: error instanceof Error ? error.message : 'Unable to update collection.',
    });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM collections WHERE id = $1 RETURNING id, invoice_id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Collection not found.' });
      return;
    }

    await syncInvoicePaymentStatus(result.rows[0].invoice_id);
    res.status(204).send();
  } catch (error) {
    console.error('Deleting collection failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('collection', error) });
  }
});

export default router;

