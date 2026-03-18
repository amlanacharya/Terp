import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { RateEngineError, loadActiveRateChartDetail } from '../utils/rate-engine';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const customerFields = [
  'customer_code',
  'name',
  'contact_person',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'gstin',
  'credit_limit',
  'credit_days',
  'default_duty_start_time',
  'default_duty_end_time',
  'default_duty_hours',
  'invoice_pdf_mode',
  'is_active',
] as const;
const invoicePdfModes = ['invoice_only', 'invoice_with_annexures'] as const;

function isNegativeNumber(value: unknown): boolean {
  return value !== null && value !== undefined && Number(value) < 0;
}

function isInvoicePdfMode(value: unknown): value is (typeof invoicePdfModes)[number] {
  return typeof value === 'string' && invoicePdfModes.includes(value as (typeof invoicePdfModes)[number]);
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching customers failed:', error);
    res.status(500).json({ message: 'Unable to fetch customers.' });
  }
});
router.get('/:id/rate-chart', authRequired, async (req, res) => {
  const selectedDate = typeof req.query.date === 'string' && req.query.date.length > 0
    ? req.query.date
    : undefined;

  try {
    const rateChart = await loadActiveRateChartDetail(String(req.params.id), selectedDate, { query });

    if (!rateChart) {
      res.status(404).json({ message: 'No active rate chart found for this customer and date.' });
      return;
    }

    res.json(rateChart);
  } catch (error) {
    if (error instanceof RateEngineError && error.code === 'RATE_CHART_CONFLICT') {
      res.status(409).json({ message: 'Multiple active rate charts exist for this customer and date.' });
      return;
    }

    console.error('Fetching active customer rate chart failed:', error);
    res.status(500).json({ message: 'Unable to fetch active customer rate chart.' });
  }
});


router.post('/', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, customerFields);
  if (!payload.customer_code || !payload.name) {
    res.status(400).json({ message: 'Customer code and name are required.' });
    return;
  }

  if (isNegativeNumber(payload.default_duty_hours)) {
    res.status(400).json({ message: 'Default duty hours cannot be negative.' });
    return;
  }

  if (payload.invoice_pdf_mode !== undefined && !isInvoicePdfMode(payload.invoice_pdf_mode)) {
    res.status(400).json({ message: 'Invalid invoice PDF mode.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO customers (
          customer_code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, credit_limit, credit_days, default_duty_start_time,
          default_duty_end_time, default_duty_hours, invoice_pdf_mode, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17
        )
        RETURNING *
      `,
      [
        payload.customer_code,
        payload.name,
        payload.contact_person ?? null,
        payload.phone ?? null,
        payload.email ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.pincode ?? null,
        payload.gstin ?? null,
        payload.credit_limit ?? 0,
        payload.credit_days ?? 0,
        payload.default_duty_start_time ?? null,
        payload.default_duty_end_time ?? null,
        payload.default_duty_hours ?? null,
        payload.invoice_pdf_mode ?? 'invoice_with_annexures',
        payload.is_active ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating customer failed:', error);
    res.status(500).json({ message: 'Unable to create customer.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, customerFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No customer fields supplied for update.' });
    return;
  }

  if (isNegativeNumber(payload.default_duty_hours)) {
    res.status(400).json({ message: 'Default duty hours cannot be negative.' });
    return;
  }

  if (payload.invoice_pdf_mode !== undefined && !isInvoicePdfMode(payload.invoice_pdf_mode)) {
    res.status(400).json({ message: 'Invalid invoice PDF mode.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE customers SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating customer failed:', error);
    res.status(500).json({ message: 'Unable to update customer.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting customer failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('customer', error) });
  }
});

export default router;






