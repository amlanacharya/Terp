import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb, query as sqliteQuery } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { generateNextCode } from '../utils/auto-code';
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
  'pan',
  'sac_code',
  'vendor_code',
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

function isPanValid(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

function getCustomerById(id: string) {
  return getDb()
    .prepare('SELECT * FROM customers WHERE id = $id LIMIT 1')
    .get({ id }) as Record<string, unknown> | undefined;
}

router.get('/', authRequired, (_req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    res.json(rows);
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
    const rateChart = await loadActiveRateChartDetail(String(req.params.id), selectedDate, { query: sqliteQuery });

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
  if (!payload.name) {
    res.status(400).json({ message: 'Customer name is required.' });
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

  if (payload.pan !== undefined && payload.pan !== null && payload.pan !== '' && !isPanValid(payload.pan)) {
    res.status(400).json({ message: 'Customer PAN must be in AAAAA9999A format.' });
    return;
  }

  try {
    const db = getDb();
    const customerCode = await generateNextCode(db, {
      table: 'customers',
      column: 'customer_code',
      prefix: 'GT-CUST',
      padLength: 4,
    });
    const id = randomUUID();

    db.prepare(
      `
        INSERT INTO customers (
          id, customer_code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, pan, sac_code, vendor_code, credit_limit, credit_days,
          default_duty_start_time, default_duty_end_time, default_duty_hours, invoice_pdf_mode, is_active
        ) VALUES (
          $id, $customer_code, $name, $contact_person, $phone, $email, $address, $city, $state,
          $pincode, $gstin, $pan, $sac_code, $vendor_code, $credit_limit, $credit_days,
          $default_duty_start_time, $default_duty_end_time, $default_duty_hours, $invoice_pdf_mode, $is_active
        )
      `
    ).run({
      id,
      customer_code: customerCode,
      name: payload.name,
      contact_person: payload.contact_person ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      pincode: payload.pincode ?? null,
      gstin: payload.gstin ?? null,
      pan: payload.pan ?? null,
      sac_code: payload.sac_code ?? null,
      vendor_code: payload.vendor_code ?? null,
      credit_limit: payload.credit_limit ?? 0,
      credit_days: payload.credit_days ?? 0,
      default_duty_start_time: payload.default_duty_start_time ?? null,
      default_duty_end_time: payload.default_duty_end_time ?? null,
      default_duty_hours: payload.default_duty_hours ?? null,
      invoice_pdf_mode: payload.invoice_pdf_mode ?? 'invoice_with_annexures',
      is_active: payload.is_active ?? 1,
    });

    const created = getCustomerById(id);
    res.status(201).json(created);
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

  if (payload.pan !== undefined && payload.pan !== null && payload.pan !== '' && !isPanValid(payload.pan)) {
    res.status(400).json({ message: 'Customer PAN must be in AAAAA9999A format.' });
    return;
  }

  const clientVersion = Number((req.body as { version?: unknown }).version);
  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'Customer version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, version FROM customers WHERE id = $id LIMIT 1').get({ id: req.params.id }) as { id: string; version: number } | undefined;

    if (!existing) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    if (existing.version !== clientVersion) {
      res.status(409).json({ message: 'Customer was modified by another user.' });
      return;
    }

    const update = buildUpdateClause(payload);
    const result = db.prepare(
      `UPDATE customers SET ${update.clause}, updated_at = datetime('now'), version = version + 1 WHERE id = $id AND version = $version`
    ).run({
      ...update.params,
      id: req.params.id,
      version: clientVersion,
    });

    if (result.changes === 0) {
      res.status(409).json({ message: 'Customer was modified by another user.' });
      return;
    }

    const updated = getCustomerById(String(req.params.id));
    res.json(updated);
  } catch (error) {
    console.error('Updating customer failed:', error);
    res.status(500).json({ message: 'Unable to update customer.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = getDb().prepare('DELETE FROM customers WHERE id = $id').run({ id: req.params.id });
    if (result.changes === 0) {
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
