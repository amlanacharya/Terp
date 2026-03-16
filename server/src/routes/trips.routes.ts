import { Router } from 'express';
import { PoolClient } from 'pg';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { calculateGst } from '../utils/gst';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const tripFields = [
  'trip_number',
  'customer_id',
  'route_id',
  'vehicle_id',
  'driver_id',
  'trip_date',
  'start_time',
  'end_time',
  'start_km',
  'end_km',
  'actual_km',
  'from_location',
  'to_location',
  'purpose',
  'passengers',
  'status',
  'trip_amount',
  'driver_allowance',
  'toll_charges',
  'parking_charges',
  'other_charges',
  'remarks',
] as const;
const expenseFields = ['expense_type', 'amount', 'description', 'receipt_number'] as const;

interface TripAutoInvoiceRow {
  id: string;
  trip_number: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  trip_amount: string;
  customer_id: string;
  customer_name: string;
  customer_address: string | null;
  customer_gstin: string | null;
  customer_credit_days: number | null;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isInterState(companyGstin: string | undefined, customerGstin: string | null): boolean {
  if (!companyGstin || !customerGstin) {
    return false;
  }

  return companyGstin.slice(0, 2) !== customerGstin.slice(0, 2);
}

async function generateInvoiceForCompletedTrip(client: PoolClient, tripId: string, userId: string | null): Promise<void> {
  const existingItem = await client.query<{ id: string }>(
    'SELECT id FROM invoice_items WHERE trip_id = $1 LIMIT 1',
    [tripId]
  );

  if (existingItem.rows[0]) {
    return;
  }

  const tripResult = await client.query<TripAutoInvoiceRow>(
    `
      SELECT
        t.id,
        t.trip_number,
        t.trip_date::text,
        t.from_location,
        t.to_location,
        t.trip_amount::text,
        c.id AS customer_id,
        c.name AS customer_name,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days
      FROM trips t
      JOIN customers c ON c.id = t.customer_id
      WHERE t.id = $1
      LIMIT 1
    `,
    [tripId]
  );

  const trip = tripResult.rows[0];
  if (!trip) {
    return;
  }

  const settingRows = await client.query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key = ANY($1)
    `,
    [['invoice_prefix', 'company_gstin']]
  );
  const settings = Object.fromEntries(
    settingRows.rows.map((row) => [row.setting_key, row.setting_value])
  ) as Record<string, string>;
  const invoicePrefix = settings.invoice_prefix || 'INV';

  const gstRow = await client.query<{
    hsn_code: string;
    cgst_rate: string;
    sgst_rate: string;
    igst_rate: string;
  }>(
    `
      SELECT hsn_code, cgst_rate::text, sgst_rate::text, igst_rate::text
      FROM gst_rates
      WHERE hsn_code = '9964' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `
  );

  const gst = gstRow.rows[0] ?? {
    hsn_code: '9964',
    cgst_rate: '2.5',
    sgst_rate: '2.5',
    igst_rate: '5',
  };

  const invoiceCount = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1',
    [`${invoicePrefix}-%`]
  );

  const invoiceNumber = `${invoicePrefix}-${String(Number(invoiceCount.rows[0]?.count || 0) + 1).padStart(5, '0')}`;
  const subtotal = Number(trip.trip_amount || 0);
  const gstAmounts = calculateGst({
    subtotal,
    isInterState: isInterState(settings.company_gstin, trip.customer_gstin),
    cgstRate: Number(gst.cgst_rate),
    sgstRate: Number(gst.sgst_rate),
    igstRate: Number(gst.igst_rate),
  });

  const invoiceDate = new Date(trip.trip_date);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + Number(trip.customer_credit_days || 0));

  const invoiceResult = await client.query<{ id: string }>(
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
      RETURNING id
    `,
    [
      invoiceNumber,
      trip.trip_date,
      trip.customer_id,
      trip.customer_address,
      trip.customer_gstin,
      gstAmounts.subtotal,
      gstAmounts.cgst_amount,
      gstAmounts.sgst_amount,
      gstAmounts.igst_amount,
      gstAmounts.total_amount,
      'pending',
      formatDateOnly(dueDate),
      `Auto-generated from trip ${trip.trip_number}`,
      userId,
    ]
  );

  await client.query(
    `
      INSERT INTO invoice_items (
        invoice_id, trip_id, description, hsn_code, quantity, rate, amount,
        cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
    `,
    [
      invoiceResult.rows[0].id,
      trip.id,
      `Trip ${trip.trip_number}: ${trip.from_location} to ${trip.to_location}`,
      gst.hsn_code,
      1,
      subtotal,
      subtotal,
      Number(gst.cgst_rate),
      Number(gst.sgst_rate),
      Number(gst.igst_rate),
      gstAmounts.cgst_amount,
      gstAmounts.sgst_amount,
      gstAmounts.igst_amount,
      gstAmounts.total_amount,
    ]
  );
}

router.get('/', authRequired, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  try {
    const values: unknown[] = [];
    const whereClause = status ? 'WHERE t.status = $1' : '';
    if (status) {
      values.push(status);
    }

    const result = await query(
      `
        SELECT
          t.*,
          COALESCE(expense_summary.total_expenses, 0) AS total_expenses,
          json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
          json_build_object('id', d.id, 'name', d.name, 'driver_code', d.driver_code, 'phone', d.phone) AS driver,
          json_build_object('id', v.id, 'vehicle_number', v.vehicle_number, 'vehicle_type', v.vehicle_type) AS vehicle
        FROM trips t
        JOIN customers c ON c.id = t.customer_id
        JOIN drivers d ON d.id = t.driver_id
        JOIN vehicles v ON v.id = t.vehicle_id
        LEFT JOIN (
          SELECT trip_id, COALESCE(SUM(amount), 0) AS total_expenses
          FROM trip_expenses
          GROUP BY trip_id
        ) AS expense_summary ON expense_summary.trip_id = t.id
        ${whereClause}
        ORDER BY t.trip_date DESC, t.created_at DESC
      `,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching trips failed:', error);
    res.status(500).json({ message: 'Unable to fetch trips.' });
  }
});

router.get('/:id/expenses', authRequired, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT *
        FROM trip_expenses
        WHERE trip_id = $1
        ORDER BY created_at DESC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching trip expenses failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip expenses.' });
  }
});

router.post('/:id/expenses', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, expenseFields);

  if (!payload.expense_type || payload.amount === undefined) {
    res.status(400).json({ message: 'Expense type and amount are required.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO trip_expenses (trip_id, expense_type, amount, description, receipt_number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        req.params.id,
        payload.expense_type,
        payload.amount,
        payload.description ?? null,
        payload.receipt_number ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating trip expense failed:', error);
    res.status(500).json({ message: 'Unable to create trip expense.' });
  }
});

router.put('/:id/expenses/:expenseId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, expenseFields);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No expense fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `
        UPDATE trip_expenses
        SET ${update.clause}
        WHERE id = $${update.values.length + 1} AND trip_id = $${update.values.length + 2}
        RETURNING *
      `,
      [...update.values, req.params.expenseId, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Trip expense not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating trip expense failed:', error);
    res.status(500).json({ message: 'Unable to update trip expense.' });
  }
});

router.delete('/:id/expenses/:expenseId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM trip_expenses WHERE id = $1 AND trip_id = $2 RETURNING id',
      [req.params.expenseId, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Trip expense not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting trip expense failed:', error);
    res.status(500).json({ message: 'Unable to delete trip expense.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, tripFields);
  const requiredFields = ['trip_number', 'customer_id', 'vehicle_id', 'driver_id', 'trip_date', 'from_location', 'to_location', 'trip_amount'];

  if (requiredFields.some((field) => payload[field] === undefined || payload[field] === '')) {
    res.status(400).json({ message: 'Missing required trip fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO trips (
          trip_number, customer_id, route_id, vehicle_id, driver_id, trip_date, start_time, end_time, start_km,
          end_km, actual_km, from_location, to_location, purpose, passengers, status, trip_amount, driver_allowance,
          toll_charges, parking_charges, other_charges, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23
        )
        RETURNING *
      `,
      [
        payload.trip_number,
        payload.customer_id,
        payload.route_id ?? null,
        payload.vehicle_id,
        payload.driver_id,
        payload.trip_date,
        payload.start_time ?? null,
        payload.end_time ?? null,
        payload.start_km ?? null,
        payload.end_km ?? null,
        payload.actual_km ?? null,
        payload.from_location,
        payload.to_location,
        payload.purpose ?? null,
        payload.passengers ?? null,
        payload.status ?? 'scheduled',
        payload.trip_amount,
        payload.driver_allowance ?? 0,
        payload.toll_charges ?? 0,
        payload.parking_charges ?? 0,
        payload.other_charges ?? 0,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating trip failed:', error);
    res.status(500).json({ message: 'Unable to create trip.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, tripFields);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No trip fields supplied for update.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{ status: string }>(
      'SELECT status FROM trips WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    const update = buildUpdateClause(payload);
    const result = await client.query(
      `UPDATE trips SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (existing.rows[0].status !== 'completed' && result.rows[0]?.status === 'completed') {
      await generateInvoiceForCompletedTrip(client, String(req.params.id), req.user?.id ?? null);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating trip failed:', error);
    res.status(500).json({ message: 'Unable to update trip.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting trip failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('trip', error) });
  }
});

export default router;
