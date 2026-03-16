import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildInvoicePdf } from '../utils/pdf-invoice';
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

async function getInvoiceSettings(): Promise<Record<string, string>> {
  const result = await query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key = ANY($1)
    `,
    [['company_name', 'company_address', 'company_gstin', 'company_pan', 'bank_name', 'bank_account', 'bank_ifsc']]
  );

  return Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string>;
}

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

router.get('/:id/pdf', authRequired, async (req, res) => {
  try {
    const [invoiceResult, itemResult, settings] = await Promise.all([
      query<{
        id: string;
        invoice_number: string;
        invoice_date: string;
        due_date: string | null;
        subtotal: string;
        cgst_amount: string;
        sgst_amount: string;
        igst_amount: string;
        total_amount: string;
        billing_address: string | null;
        customer_gstin: string | null;
        customer_name: string;
      }>(
        `
          SELECT
            i.id,
            i.invoice_number,
            i.invoice_date::text,
            i.due_date::text,
            i.subtotal::text,
            i.cgst_amount::text,
            i.sgst_amount::text,
            i.igst_amount::text,
            i.total_amount::text,
            i.billing_address,
            i.customer_gstin,
            c.name AS customer_name
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
      query<{
        description: string;
        hsn_code: string | null;
        quantity: string;
        rate: string;
        amount: string;
        cgst_amount: string;
        sgst_amount: string;
        igst_amount: string;
        total_amount: string;
      }>(
        `
          SELECT
            description,
            hsn_code,
            quantity::text,
            rate::text,
            amount::text,
            cgst_amount::text,
            sgst_amount::text,
            igst_amount::text,
            total_amount::text
          FROM invoice_items
          WHERE invoice_id = $1
          ORDER BY created_at ASC
        `,
        [req.params.id]
      ),
      getInvoiceSettings(),
    ]);

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    const pdf = await buildInvoicePdf(
      {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        cgst_amount: Number(invoice.cgst_amount),
        sgst_amount: Number(invoice.sgst_amount),
        igst_amount: Number(invoice.igst_amount),
        total_amount: Number(invoice.total_amount),
        items: itemResult.rows.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          amount: Number(item.amount),
          cgst_amount: Number(item.cgst_amount),
          sgst_amount: Number(item.sgst_amount),
          igst_amount: Number(item.igst_amount),
          total_amount: Number(item.total_amount),
        })),
      },
      settings
    );

    const fileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating invoice PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate invoice PDF.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const [invoiceResult, itemResult] = await Promise.all([
      query(
        `
          SELECT
            i.*,
            json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
      query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC', [req.params.id]),
    ]);

    if (!invoiceResult.rows[0]) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.json({
      ...invoiceResult.rows[0],
      items: itemResult.rows,
    });
  } catch (error) {
    console.error('Fetching invoice detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoice detail.' });
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
    res.status(500).json({ message: getDeleteErrorMessage('invoice', error) });
  }
});

export default router;
