import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { createAnnexureFromParent } from '../utils/annexure-builder';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { createGtInvoice, formatDutyTypeLabel, getGtInvoiceSettings } from '../utils/invoice-gt';
import { buildAnnexurePdf } from '../utils/pdf-annexure';
import { pickDefinedFields } from '../utils/sql';

const router = Router();
const annexureUpdateFields = ['annexure_number'] as const;

interface AnnexureDetailRow {
  id: string;
  annexure_number: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  start_km: number | string;
  end_km: number | string;
  total_km: number | string;
  total_hours: number | string;
  night_halts: number;
  calculated_amount: number | string;
  is_billed: boolean;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  invoice_number: string | null;
  parent_trip: {
    id: string;
    trip_number: string;
    trip_date: string;
    duty_type: string | null;
    from_location: string;
    to_location: string;
  };
  customer: {
    id: string;
    name: string;
    customer_code: string;
  };
  vehicle: {
    id: string;
    vehicle_number: string;
    vehicle_type: string;
  };
  vehicle_category: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  } | null;
  source_metric_ids: string[];
}

interface AnnexureBillingRow {
  id: string;
  annexure_number: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  total_km: string;
  total_hours: string;
  calculated_amount: string;
  is_billed: boolean;
  trip_number: string;
  trip_date: string;
  duty_type: string | null;
  from_location: string;
  to_location: string;
  customer_id: string;
  customer_name: string;
  customer_address: string | null;
  customer_gstin: string | null;
  customer_credit_days: number | null;
  vehicle_number: string;
  vehicle_type_label: string;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapAnnexureRow(row: AnnexureDetailRow) {
  return {
    ...row,
    parent_trip_id: row.trip_id,
    start_km: Number(row.start_km),
    end_km: Number(row.end_km),
    total_km: Number(row.total_km),
    total_hours: Number(row.total_hours),
    calculated_amount: Number(row.calculated_amount),
  };
}

function getAnnexureSelect(whereClause = ''): string {
  return `
    SELECT
      a.id,
      a.annexure_number,
      a.trip_id,
      a.start_date::text,
      a.end_date::text,
      a.start_km::text,
      a.end_km::text,
      a.total_km::text,
      a.total_hours::text,
      a.night_halts,
      a.calculated_amount::text,
      a.is_billed,
      a.invoice_id,
      a.created_at,
      a.updated_at,
      inv.invoice_number,
      json_build_object(
        'id', t.id,
        'trip_number', t.trip_number,
        'trip_date', t.trip_date::text,
        'duty_type', t.duty_type,
        'from_location', t.from_location,
        'to_location', t.to_location
      ) AS parent_trip,
      json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
      json_build_object('id', v.id, 'vehicle_number', v.vehicle_number, 'vehicle_type', v.vehicle_type) AS vehicle,
      CASE
        WHEN vc.id IS NULL THEN NULL
        ELSE json_build_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active)
      END AS vehicle_category,
      COALESCE((
        SELECT json_agg(am.metric_id ORDER BY am.seq)
        FROM annexure_metrics am
        WHERE am.annexure_id = a.id
      ), '[]'::json) AS source_metric_ids
    FROM annexures a
    JOIN trips t ON t.id = a.trip_id
    JOIN customers c ON c.id = t.customer_id
    JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
    LEFT JOIN invoices inv ON inv.id = a.invoice_id AND inv.invoice_status = 'active'
    ${whereClause}
  `;
}

async function getAnnexureById(annexureId: string): Promise<AnnexureDetailRow | null> {
  const result = await query<AnnexureDetailRow>(`${getAnnexureSelect('WHERE a.id = $1')} LIMIT 1`, [annexureId]);
  return result.rows[0] ?? null;
}

async function loadAnnexureBillingRows(ids: string[]): Promise<AnnexureBillingRow[]> {
  const result = await query<AnnexureBillingRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date::text,
        a.end_date::text,
        a.total_km::text,
        a.total_hours::text,
        a.calculated_amount::text,
        a.is_billed,
        t.trip_number,
        t.trip_date::text,
        t.duty_type,
        t.from_location,
        t.to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.vehicle_number,
        COALESCE(vc.name, v.vehicle_type::text) AS vehicle_type_label
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      WHERE a.id = ANY($1::uuid[])
      ORDER BY a.start_date ASC, a.created_at ASC
    `,
    [ids]
  );

  return result.rows;
}

async function resolveBulkBillRows(body: Record<string, unknown>): Promise<AnnexureBillingRow[]> {
  const annexureIds = Array.isArray(body.annexure_ids)
    ? body.annexure_ids.filter((value): value is string => typeof value === 'string')
    : [];
  const tripId = typeof body.parent_trip_id === 'string' && body.parent_trip_id.trim().length > 0
    ? body.parent_trip_id.trim()
    : typeof body.trip_id === 'string' && body.trip_id.trim().length > 0
      ? body.trip_id.trim()
      : null;
  const startDate = typeof body.start_date === 'string' && body.start_date.trim().length > 0 ? body.start_date.trim() : null;
  const endDate = typeof body.end_date === 'string' && body.end_date.trim().length > 0 ? body.end_date.trim() : null;

  if (annexureIds.length > 0) {
    return loadAnnexureBillingRows(annexureIds);
  }

  if (!tripId) {
    throw new Error('Trip is required when annexure IDs are not supplied.');
  }

  const values: unknown[] = [tripId];
  let whereClause = 'WHERE a.trip_id = $1 AND a.is_billed = false';

  if (startDate) {
    values.push(startDate);
    whereClause += ` AND a.start_date >= $${values.length}`;
  }
  if (endDate) {
    values.push(endDate);
    whereClause += ` AND a.end_date <= $${values.length}`;
  }

  const result = await query<AnnexureBillingRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date::text,
        a.end_date::text,
        a.total_km::text,
        a.total_hours::text,
        a.calculated_amount::text,
        a.is_billed,
        t.trip_number,
        t.trip_date::text,
        t.duty_type,
        t.from_location,
        t.to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.vehicle_number,
        COALESCE(vc.name, v.vehicle_type::text) AS vehicle_type_label
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      ${whereClause}
      ORDER BY a.start_date ASC, a.created_at ASC
    `,
    values
  );

  return result.rows;
}

async function loadAnnexureMetricSnapshot(client: { query: typeof query }, annexureId: string) {
  const result = await client.query<{
    start_date: string;
    end_date: string;
    start_km: string;
    end_km: string;
    total_km: string;
    total_hours: string;
    night_halts: number;
  }>(
    `
      SELECT
        MIN(ttm.start_date)::text AS start_date,
        MAX(COALESCE(ttm.end_date, ttm.start_date))::text AS end_date,
        MIN(ttm.start_km)::text AS start_km,
        MAX(COALESCE(ttm.end_km, ttm.start_km))::text AS end_km,
        COALESCE(SUM(COALESCE(ttm.end_km, ttm.start_km) - ttm.start_km), 0)::text AS total_km,
        COALESCE(SUM(
          CASE
            WHEN ttm.end_date IS NOT NULL AND ttm.end_time IS NOT NULL
              THEN EXTRACT(EPOCH FROM ((ttm.end_date + ttm.end_time) - (ttm.start_date + ttm.start_time))) / 3600
            ELSE 0
          END
        ), 0)::text AS total_hours,
        GREATEST(0, (MAX(COALESCE(ttm.end_date, ttm.start_date)) - MIN(ttm.start_date)))::integer AS night_halts
      FROM annexure_metrics am
      JOIN trip_travel_metrics ttm ON ttm.id = am.metric_id
      WHERE am.annexure_id = $1
    `,
    [annexureId]
  );

  return result.rows[0] ?? null;
}

router.get('/annexures', authRequired, async (req, res) => {
  try {
    const values: unknown[] = [];
    const filters: string[] = [];
    const tripId = typeof req.query.parent_trip_id === 'string' && req.query.parent_trip_id.trim().length > 0
      ? req.query.parent_trip_id.trim()
      : typeof req.query.trip_id === 'string' && req.query.trip_id.trim().length > 0
        ? req.query.trip_id.trim()
        : null;
    const customerId = typeof req.query.customer_id === 'string' && req.query.customer_id.trim().length > 0 ? req.query.customer_id.trim() : null;
    const dateFrom = typeof req.query.date_from === 'string' && req.query.date_from.trim().length > 0 ? req.query.date_from.trim() : null;
    const dateTo = typeof req.query.date_to === 'string' && req.query.date_to.trim().length > 0 ? req.query.date_to.trim() : null;
    const isBilled = typeof req.query.is_billed === 'string'
      ? req.query.is_billed === 'true'
        ? true
        : req.query.is_billed === 'false'
          ? false
          : null
      : null;

    if (tripId) {
      values.push(tripId);
      filters.push(`a.trip_id = $${values.length}`);
    }
    if (customerId) {
      values.push(customerId);
      filters.push(`t.customer_id = $${values.length}`);
    }
    if (dateFrom) {
      values.push(dateFrom);
      filters.push(`a.start_date >= $${values.length}`);
    }
    if (dateTo) {
      values.push(dateTo);
      filters.push(`a.end_date <= $${values.length}`);
    }
    if (isBilled !== null) {
      values.push(isBilled);
      filters.push(`a.is_billed = $${values.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await query<AnnexureDetailRow>(`${getAnnexureSelect(whereClause)} ORDER BY t.trip_date DESC, a.start_date DESC, a.created_at DESC`, values);
    res.json(result.rows.map(mapAnnexureRow));
  } catch (error) {
    console.error('Fetching annexures failed:', error);
    res.status(500).json({ message: 'Unable to fetch annexures.' });
  }
});

router.get('/trips/:id/annexures', authRequired, async (req, res) => {
  try {
    const result = await query<AnnexureDetailRow>(`${getAnnexureSelect('WHERE a.trip_id = $1')} ORDER BY a.start_date DESC, a.created_at DESC`, [req.params.id]);
    res.json(result.rows.map(mapAnnexureRow));
  } catch (error) {
    console.error('Fetching trip annexures failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip annexures.' });
  }
});

router.post('/trips/:id/annexures', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const created = await createAnnexureFromParent(client, {
      trip_id: String(req.params.id),
      annexure_number: typeof req.body.annexure_number === 'string' ? req.body.annexure_number : null,
      selection_mode: req.body.selection_mode === 'date_range' ? 'date_range' : 'metric_rows',
      metric_ids: Array.isArray(req.body.metric_ids) ? req.body.metric_ids.filter((value: unknown): value is string => typeof value === 'string') : undefined,
      start_date: typeof req.body.start_date === 'string' ? req.body.start_date : undefined,
      end_date: typeof req.body.end_date === 'string' ? req.body.end_date : undefined,
    });

    const annexureResult = await client.query<AnnexureDetailRow>(`${getAnnexureSelect('WHERE a.id = $1')} LIMIT 1`, [created.annexure_id]);
    await client.query('COMMIT');
    res.status(201).json(mapAnnexureRow(annexureResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating annexure failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create annexure.' });
  } finally {
    client.release();
  }
});

router.post('/annexures/bulk-bill', authRequired, roleCheck(['admin', 'manager', 'accountant', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const rows = await resolveBulkBillRows(req.body as Record<string, unknown>);
    if (rows.length === 0) {
      throw new Error('No unbilled annexures matched the selected criteria.');
    }
    if (rows.some((row) => row.customer_id !== rows[0].customer_id)) {
      throw new Error('Grouped billing must use annexures from the same customer.');
    }
    if (rows.some((row) => row.is_billed)) {
      throw new Error('One or more selected annexures are already billed.');
    }

    const invoiceDate = typeof req.body.invoice_date === 'string' && req.body.invoice_date.trim().length > 0 ? req.body.invoice_date.trim() : todayDateOnly();
    const remarks = typeof req.body.remarks === 'string' && req.body.remarks.trim().length > 0 ? req.body.remarks.trim() : `Annexure billing for ${rows[0].customer_name}`;
    const distinctDutyTypes = Array.from(new Set(rows.map((row) => row.duty_type).filter((value): value is string => Boolean(value))));
    const distinctVehicles = Array.from(new Set(rows.map((row) => row.vehicle_number)));
    const distinctVehicleLabels = Array.from(new Set(rows.map((row) => row.vehicle_type_label)));
    const distinctTrips = Array.from(new Set(rows.map((row) => row.trip_number)));
    const bookingDate = rows.map((row) => row.trip_date).sort()[0] ?? null;

    const invoice = await createGtInvoice(
      client,
      {
        customer_id: rows[0].customer_id,
        billing_address: rows[0].customer_address,
        customer_gstin: rows[0].customer_gstin,
        invoice_date: invoiceDate,
        booking_date: bookingDate,
        duty_type_label: distinctDutyTypes.length === 1 ? formatDutyTypeLabel(distinctDutyTypes[0]) : 'Mixed',
        nature_of_journey: distinctDutyTypes.length === 1 ? formatDutyTypeLabel(distinctDutyTypes[0]) : 'Mixed',
        vehicle_number: distinctVehicles.length === 1 ? distinctVehicles[0] : 'Multiple',
        vehicle_type_label: distinctVehicleLabels.length === 1 ? distinctVehicleLabels[0] : 'Multiple',
        duty_slip_number: distinctTrips.length === 1 ? distinctTrips[0] : 'Multiple',
        total_km: rows.reduce((sum, row) => sum + Number(row.total_km), 0),
        total_hours: rows.reduce((sum, row) => sum + Number(row.total_hours), 0),
        payment_terms_days: rows[0].customer_credit_days,
        interest_note: null,
        remarks,
        created_by: req.user?.id ?? null,
      },
      rows.map((row) => ({
        trip_id: row.trip_id,
        annexure_id: row.id,
        description: `Annexure ${row.annexure_number}: ${row.from_location} to ${row.to_location}`,
        amount: Number(row.calculated_amount),
      }))
    );

    await client.query(
      `UPDATE annexures SET is_billed = true, invoice_id = $1, updated_at = now() WHERE id = ANY($2::uuid[])`,
      [invoice.id, rows.map((row) => row.id)]
    );

    await client.query('COMMIT');
    res.status(201).json(invoice);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk billing annexures failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to bill annexures.' });
  } finally {
    client.release();
  }
});

router.get('/annexures/:id/pdf', authRequired, async (req, res) => {
  try {
    const [annexure, settings] = await Promise.all([getAnnexureById(String(req.params.id)), getGtInvoiceSettings({ query })]);
    if (!annexure) {
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }

    const pdf = await buildAnnexurePdf(
      {
        annexure_number: annexure.annexure_number,
        duty_slip_number: annexure.parent_trip.trip_number,
        customer_name: annexure.customer.name,
        vehicle_number: annexure.vehicle.vehicle_number,
        vehicle_type_label: annexure.vehicle_category?.name ?? annexure.vehicle.vehicle_type,
        vehicle_category_name: annexure.vehicle_category?.name ?? null,
        start_date: annexure.start_date,
        end_date: annexure.end_date,
        start_km: Number(annexure.start_km),
        end_km: Number(annexure.end_km),
        total_km: Number(annexure.total_km),
        total_hours: Number(annexure.total_hours),
        night_halts: annexure.night_halts,
        calculated_amount: Number(annexure.calculated_amount),
        is_billed: annexure.is_billed,
        invoice_number: annexure.invoice_number,
      },
      settings as unknown as Record<string, string>
    );

    const fileName = `${annexure.annexure_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating annexure PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate annexure PDF.' });
  }
});

router.get('/annexures/:id', authRequired, async (req, res) => {
  try {
    const annexure = await getAnnexureById(String(req.params.id));
    if (!annexure) {
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }

    res.json(mapAnnexureRow(annexure));
  } catch (error) {
    console.error('Fetching annexure detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch annexure detail.' });
  }
});

router.put('/annexures/:id/bill', authRequired, roleCheck(['admin', 'manager', 'accountant', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const rows = await loadAnnexureBillingRows([String(req.params.id)]);
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    if (row.is_billed) {
      throw new Error('Annexure is already billed.');
    }

    const invoiceDate = typeof req.body.invoice_date === 'string' && req.body.invoice_date.trim().length > 0 ? req.body.invoice_date.trim() : todayDateOnly();
    const remarks = typeof req.body.remarks === 'string' && req.body.remarks.trim().length > 0 ? req.body.remarks.trim() : `Annexure billing for ${row.annexure_number}`;

    const invoice = await createGtInvoice(
      client,
      {
        customer_id: row.customer_id,
        billing_address: row.customer_address,
        customer_gstin: row.customer_gstin,
        invoice_date: invoiceDate,
        booking_date: row.trip_date,
        duty_type_label: formatDutyTypeLabel(row.duty_type),
        nature_of_journey: formatDutyTypeLabel(row.duty_type),
        vehicle_number: row.vehicle_number,
        vehicle_type_label: row.vehicle_type_label,
        duty_slip_number: row.trip_number,
        total_km: Number(row.total_km),
        total_hours: Number(row.total_hours),
        payment_terms_days: row.customer_credit_days,
        interest_note: null,
        remarks,
        created_by: req.user?.id ?? null,
      },
      [{
        trip_id: row.trip_id,
        annexure_id: row.id,
        description: `Annexure ${row.annexure_number}: ${row.from_location} to ${row.to_location}`,
        amount: Number(row.calculated_amount),
      }]
    );

    await client.query('UPDATE annexures SET is_billed = true, invoice_id = $1, updated_at = now() WHERE id = $2', [invoice.id, row.id]);
    await client.query('COMMIT');
    res.status(201).json(invoice);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Billing annexure failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to bill annexure.' });
  } finally {
    client.release();
  }
});

router.put('/annexures/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, annexureUpdateFields);
  const syncFromMetrics = req.body.sync_from_metrics === true || req.body.sync_from_trip === true;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const currentResult = await client.query<{ id: string; is_billed: boolean }>('SELECT id, is_billed FROM annexures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    if (current.is_billed) {
      throw new Error('Billed annexures cannot be edited.');
    }

    if (typeof payload.annexure_number === 'string' && payload.annexure_number.trim().length > 0) {
      await client.query('UPDATE annexures SET annexure_number = $1, updated_at = now() WHERE id = $2', [payload.annexure_number.trim(), req.params.id]);
    }

    if (syncFromMetrics) {
      const snapshot = await loadAnnexureMetricSnapshot(client, String(req.params.id));
      if (snapshot) {
        await client.query(
          `
            UPDATE annexures
            SET
              start_date = $1,
              end_date = $2,
              start_km = $3,
              end_km = $4,
              total_km = $5,
              total_hours = $6,
              night_halts = $7,
              updated_at = now()
            WHERE id = $8
          `,
          [snapshot.start_date, snapshot.end_date, snapshot.start_km, snapshot.end_km, snapshot.total_km, snapshot.total_hours, snapshot.night_halts, req.params.id]
        );
      }
    }

    const annexureResult = await client.query<AnnexureDetailRow>(`${getAnnexureSelect('WHERE a.id = $1')} LIMIT 1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(mapAnnexureRow(annexureResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating annexure failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update annexure.' });
  } finally {
    client.release();
  }
});

router.delete('/annexures/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string; is_billed: boolean }>('SELECT id, is_billed FROM annexures WHERE id = $1 FOR UPDATE', [req.params.id]);
    const annexure = result.rows[0];
    if (!annexure) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    if (annexure.is_billed) {
      throw new Error('Billed annexures cannot be deleted.');
    }

    await client.query('DELETE FROM annexures WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deleting annexure failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('annexure', error) });
  } finally {
    client.release();
  }
});

export default router;
