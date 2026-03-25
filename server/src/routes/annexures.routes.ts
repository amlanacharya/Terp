import { randomUUID } from 'crypto';
import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { formatDutyTypeLabel } from '../utils/invoice-gt';
import { calculateGst } from '../utils/gst';
import { buildAnnexurePdf } from '../utils/pdf-annexure';
import { pickDefinedFields } from '../utils/sql';
import { aggregateTripTravelMetrics, TripTravelMetricRecord } from '../utils/trip-metrics';
import { loadActiveRateChartDetail, calculateRateFromChart, type DutyType, type Queryable } from '../utils/rate-engine';

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

interface AnnexureQueryRow {
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
  is_billed: boolean | number;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  invoice_number: string | null;
  parent_trip_id: string;
  parent_trip_number: string;
  parent_trip_date: string;
  parent_trip_duty_type: string | null;
  parent_trip_from_location: string;
  parent_trip_to_location: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  customer_address: string | null;
  customer_gstin: string | null;
  customer_credit_days: number | null;
  vehicle_id: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_category_id: string | null;
  vehicle_category_name: string | null;
  vehicle_category_description: string | null;
  vehicle_category_is_active: boolean | number | null;
  source_metric_ids: string | null;
}

interface AnnexureMetricSnapshot {
  start_date: string;
  end_date: string;
  start_km: number;
  end_km: number;
  total_km: number;
  total_hours: number;
  night_halts: number;
}

interface LocalInvoiceSettings {
  invoice_prefix: string;
  company_gstin: string;
  company_name: string;
  company_address: string;
  company_pan: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
}

interface LocalInvoiceItemInput {
  trip_id: string | null;
  annexure_id: string | null;
  description: string;
  amount: number;
}

interface LocalInvoiceHeaderInput {
  customer_id: string;
  billing_address: string | null;
  customer_gstin: string | null;
  invoice_date: string;
  booking_date: string | null;
  duty_type_label: string | null;
  nature_of_journey: string | null;
  vehicle_number: string | null;
  vehicle_type_label: string | null;
  duty_slip_number: string | null;
  total_km: number | null;
  total_hours: number | null;
  payment_terms_days: number | null;
  interest_note: string | null;
  remarks: string | null;
  created_by: string | null;
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

function isInterState(companyGstin: string | null, customerGstin: string | null): boolean {
  if (!companyGstin || !customerGstin) {
    return false;
  }

  return companyGstin.slice(0, 2) !== customerGstin.slice(0, 2);
}

function makePlaceholders(count: number): string {
  return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(', ');
}

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function getDateDiffInDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

function mapAnnexureRow(row: AnnexureQueryRow): AnnexureDetailRow {
  return {
    id: row.id,
    annexure_number: row.annexure_number,
    trip_id: row.trip_id,
    start_date: row.start_date,
    end_date: row.end_date,
    start_km: Number(row.start_km),
    end_km: Number(row.end_km),
    total_km: Number(row.total_km),
    total_hours: Number(row.total_hours),
    night_halts: row.night_halts,
    calculated_amount: Number(row.calculated_amount),
    is_billed: Boolean(row.is_billed),
    invoice_id: row.invoice_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    invoice_number: row.invoice_number,
    parent_trip: {
      id: row.parent_trip_id,
      trip_number: row.parent_trip_number,
      trip_date: row.parent_trip_date,
      duty_type: row.parent_trip_duty_type,
      from_location: row.parent_trip_from_location,
      to_location: row.parent_trip_to_location,
    },
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      customer_code: row.customer_code,
    },
    vehicle: {
      id: row.vehicle_id,
      vehicle_number: row.vehicle_number,
      vehicle_type: row.vehicle_type,
    },
    vehicle_category: row.vehicle_category_id
      ? {
          id: row.vehicle_category_id,
          name: row.vehicle_category_name ?? '',
          description: row.vehicle_category_description,
          is_active: Boolean(row.vehicle_category_is_active),
        }
      : null,
    source_metric_ids: parseJsonArray(row.source_metric_ids),
  };
}

async function loadAnnexureDetailRow(db: Queryable, annexureId: string): Promise<AnnexureQueryRow | null> {
  const result = await db.query<AnnexureQueryRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date,
        a.end_date,
        a.start_km,
        a.end_km,
        a.total_km,
        a.total_hours,
        a.night_halts,
        a.calculated_amount,
        a.is_billed,
        a.invoice_id,
        a.created_at,
        a.updated_at,
        inv.invoice_number,
        t.id AS parent_trip_id,
        t.trip_number AS parent_trip_number,
        t.trip_date AS parent_trip_date,
        t.duty_type AS parent_trip_duty_type,
        t.from_location AS parent_trip_from_location,
        t.to_location AS parent_trip_to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.customer_code AS customer_code,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.id AS vehicle_id,
        v.vehicle_number,
        v.vehicle_type,
        vc.id AS vehicle_category_id,
        vc.name AS vehicle_category_name,
        vc.description AS vehicle_category_description,
        vc.is_active AS vehicle_category_is_active,
        (
          SELECT json_group_array(metric_id)
          FROM (
            SELECT am.metric_id
            FROM annexure_metrics am
            WHERE am.annexure_id = a.id
            ORDER BY am.seq
          )
        ) AS source_metric_ids
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      LEFT JOIN invoices inv ON inv.id = a.invoice_id AND inv.invoice_status = 'active'
      WHERE a.id = $1
      LIMIT 1
    `,
    [annexureId]
  );

  return result.rows[0] ?? null;
}

async function loadAnnexureRows(
  db: Queryable,
  whereClause: string,
  values: unknown[]
): Promise<AnnexureQueryRow[]> {
  const result = await db.query<AnnexureQueryRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date,
        a.end_date,
        a.start_km,
        a.end_km,
        a.total_km,
        a.total_hours,
        a.night_halts,
        a.calculated_amount,
        a.is_billed,
        a.invoice_id,
        a.created_at,
        a.updated_at,
        inv.invoice_number,
        t.id AS parent_trip_id,
        t.trip_number AS parent_trip_number,
        t.trip_date AS parent_trip_date,
        t.duty_type AS parent_trip_duty_type,
        t.from_location AS parent_trip_from_location,
        t.to_location AS parent_trip_to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.customer_code AS customer_code,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.id AS vehicle_id,
        v.vehicle_number,
        v.vehicle_type,
        vc.id AS vehicle_category_id,
        vc.name AS vehicle_category_name,
        vc.description AS vehicle_category_description,
        vc.is_active AS vehicle_category_is_active,
        (
          SELECT json_group_array(metric_id)
          FROM (
            SELECT am.metric_id
            FROM annexure_metrics am
            WHERE am.annexure_id = a.id
            ORDER BY am.seq
          )
        ) AS source_metric_ids
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      LEFT JOIN invoices inv ON inv.id = a.invoice_id AND inv.invoice_status = 'active'
      ${whereClause}
      ORDER BY t.trip_date DESC, a.start_date DESC, a.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function loadBillingRowsByIds(db: Queryable, ids: string[]): Promise<AnnexureBillingRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = makePlaceholders(ids.length);
  const rows = await db.query<AnnexureBillingRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date,
        a.end_date,
        a.total_km,
        a.total_hours,
        a.calculated_amount,
        a.is_billed,
        t.trip_number,
        t.trip_date,
        t.duty_type,
        t.from_location,
        t.to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.vehicle_number,
        COALESCE(vc.name, v.vehicle_type) AS vehicle_type_label
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      WHERE a.id IN (${placeholders})
      ORDER BY a.start_date ASC, a.created_at ASC
    `,
    ids
  );

  return rows.rows;
}

async function loadBillingRowsByTrip(
  db: Queryable,
  tripId: string,
  startDate: string | null,
  endDate: string | null
): Promise<AnnexureBillingRow[]> {
  const values: unknown[] = [tripId];
  const clauses = ['a.trip_id = $1', 'a.is_billed = 0'];

  if (startDate) {
    values.push(startDate);
    clauses.push(`a.start_date >= $${values.length}`);
  }

  if (endDate) {
    values.push(endDate);
    clauses.push(`a.end_date <= $${values.length}`);
  }

  const result = await db.query<AnnexureBillingRow>(
    `
      SELECT
        a.id,
        a.annexure_number,
        a.trip_id,
        a.start_date,
        a.end_date,
        a.total_km,
        a.total_hours,
        a.calculated_amount,
        a.is_billed,
        t.trip_number,
        t.trip_date,
        t.duty_type,
        t.from_location,
        t.to_location,
        c.id AS customer_id,
        c.name AS customer_name,
        c.address AS customer_address,
        c.gstin AS customer_gstin,
        c.credit_days AS customer_credit_days,
        v.vehicle_number,
        COALESCE(vc.name, v.vehicle_type) AS vehicle_type_label
      FROM annexures a
      JOIN trips t ON t.id = a.trip_id
      JOIN customers c ON c.id = t.customer_id
      JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.start_date ASC, a.created_at ASC
    `,
    values
  );

  return result.rows;
}

async function loadAnnexureMetricSnapshot(db: Queryable, annexureId: string): Promise<AnnexureMetricSnapshot | null> {
  const result = await db.query<TripTravelMetricRecord>(
    `
      SELECT
        ttm.id,
        ttm.trip_id,
        ttm.seq,
        ttm.start_date,
        ttm.start_time,
        ttm.start_km,
        ttm.end_date,
        ttm.end_time,
        ttm.end_km,
        ttm.created_at
      FROM annexure_metrics am
      JOIN trip_travel_metrics ttm ON ttm.id = am.metric_id
      WHERE am.annexure_id = $1
      ORDER BY am.seq ASC
    `,
    [annexureId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const aggregation = aggregateTripTravelMetrics(result.rows);
  const firstMetric = aggregation.metrics[0];
  const lastMetric = aggregation.metrics[aggregation.metrics.length - 1];

  if (!firstMetric || !lastMetric) {
    return null;
  }

  return {
    start_date: firstMetric.start_date,
    end_date: lastMetric.end_date ?? lastMetric.start_date,
    start_km: firstMetric.start_km,
    end_km: lastMetric.end_km ?? lastMetric.start_km,
    total_km: aggregation.total_km,
    total_hours: aggregation.total_hours,
    night_halts: getDateDiffInDays(firstMetric.start_date, lastMetric.end_date ?? lastMetric.start_date),
  };
}

async function loadInvoiceSettings(db: Queryable): Promise<LocalInvoiceSettings> {
  const settingKeys = [
    'invoice_prefix',
    'company_gstin',
    'company_name',
    'company_address',
    'company_pan',
    'bank_name',
    'bank_account',
    'bank_ifsc',
  ];
  const result = await db.query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (${makePlaceholders(settingKeys.length)})
    `,
    settingKeys
  );
  const settings = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));

  return {
    invoice_prefix: settings.invoice_prefix || 'INV',
    company_gstin: settings.company_gstin || '',
    company_name: settings.company_name || 'Travel ERP',
    company_address: settings.company_address || '',
    company_pan: settings.company_pan || '',
    bank_name: settings.bank_name || '',
    bank_account: settings.bank_account || '',
    bank_ifsc: settings.bank_ifsc || '',
  };
}

async function getDefaultAnnexureNumber(db: Queryable, tripId: string, tripNumber: string): Promise<string> {
  const result = await db.query<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM annexures WHERE trip_id = $1',
    [tripId]
  );

  const nextIndex = Number(result.rows[0]?.count ?? 0) + 1;
  return `${tripNumber}/ANX-${String(nextIndex).padStart(2, '0')}`;
}

async function generateInvoiceNumber(db: Queryable, prefix: string): Promise<string> {
  const result = await db.query<{ count: number | string }>(
    `
      SELECT COUNT(*) AS count
      FROM invoices
      WHERE invoice_number LIKE $1
        AND invoice_type = 'invoice'
    `,
    [`${prefix}-%`]
  );

  return `${prefix}-${String(Number(result.rows[0]?.count ?? 0) + 1).padStart(5, '0')}`;
}

async function createLocalInvoice(
  db: Queryable,
  header: LocalInvoiceHeaderInput,
  items: LocalInvoiceItemInput[]
): Promise<{ id: string; invoice_number: string; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }> {
  if (items.length === 0) {
    throw new Error('At least one invoice item is required.');
  }

  const settings = await loadInvoiceSettings(db);
  const invoiceNumber = await generateInvoiceNumber(db, settings.invoice_prefix);
  const subtotal = Number(items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
  const gst = calculateGst({
    subtotal,
    isInterState: isInterState(settings.company_gstin, header.customer_gstin),
  });
  const invoiceId = randomUUID();
  const dueDate = header.payment_terms_days == null
    ? null
    : (() => {
        const parsed = new Date(`${header.invoice_date}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime())) {
          return null;
        }
        parsed.setUTCDate(parsed.getUTCDate() + header.payment_terms_days);
        return parsed.toISOString().slice(0, 10);
      })();

  await db.query(
    `
      INSERT INTO invoices (
        id, invoice_number, invoice_date, customer_id, billing_address, customer_gstin,
        booking_date, duty_type_label, nature_of_journey, vehicle_number, vehicle_type_label,
        duty_slip_number, total_km, total_hours, payment_terms_days, interest_note,
        subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
        payment_status, due_date, remarks, created_by, invoice_type, invoice_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, 'invoice', 'active'
      )
    `,
    [
      invoiceId,
      invoiceNumber,
      header.invoice_date,
      header.customer_id,
      header.billing_address,
      header.customer_gstin,
      header.booking_date,
      header.duty_type_label,
      header.nature_of_journey,
      header.vehicle_number,
      header.vehicle_type_label,
      header.duty_slip_number,
      header.total_km,
      header.total_hours,
      header.payment_terms_days,
      header.interest_note,
      gst.subtotal,
      gst.cgst_amount,
      gst.sgst_amount,
      gst.igst_amount,
      gst.total_amount,
      'pending',
      dueDate,
      header.remarks,
      header.created_by,
    ]
  );

  for (const item of items) {
    const itemGst = calculateGst({
      subtotal: item.amount,
      isInterState: isInterState(settings.company_gstin, header.customer_gstin),
    });

    await db.query(
      `
        INSERT INTO invoice_items (
          id, invoice_id, trip_id, annexure_id, description, quantity, rate, amount,
          cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (
          $1, $2, $3, $4, $5, 1, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
      `,
      [
        randomUUID(),
        invoiceId,
        item.trip_id,
        item.annexure_id,
        item.description,
        item.amount,
        item.amount,
        itemGst.cgst_amount > 0 ? 2.5 : 0,
        itemGst.sgst_amount > 0 ? 2.5 : 0,
        itemGst.igst_amount > 0 ? 5 : 0,
        itemGst.cgst_amount,
        itemGst.sgst_amount,
        itemGst.igst_amount,
        itemGst.total_amount,
      ]
    );
  }

  await db.query(
    `
      INSERT INTO financial_ledger (
        id, event_type, customer_id, invoice_id, invoice_number, collection_id,
        amount, direction, description, performed_by
      ) VALUES (
        $1, 'invoice_issued', $2, $3, $4, NULL,
        $5, 'AR_INCREASE', $6, $7
      )
    `,
    [
      randomUUID(),
      header.customer_id,
      invoiceId,
      invoiceNumber,
      gst.total_amount,
      `Invoice ${invoiceNumber} issued`,
      header.created_by,
    ]
  );

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
    subtotal: gst.subtotal,
    cgst_amount: gst.cgst_amount,
    sgst_amount: gst.sgst_amount,
    igst_amount: gst.igst_amount,
    total_amount: gst.total_amount,
  };
}

async function createAnnexureFromParentSqlite(
  db: Queryable,
  input: {
    trip_id: string;
    annexure_number?: string | null;
    selection_mode: 'metric_rows' | 'date_range';
    metric_ids?: string[];
    start_date?: string;
    end_date?: string;
  }
): Promise<{ annexure_id: string }> {
  const parentResult = await db.query<{
    id: string;
    trip_number: string;
    customer_id: string;
    trip_date: string;
    parent_trip_id: string | null;
    duty_type: DutyType | null;
    vehicle_category_id: string | null;
    vehicle_id: string;
    from_location: string;
    to_location: string;
    current_package_code: string | null;
  }>(
    `
      SELECT
        t.id,
        t.trip_number,
        t.customer_id,
        t.trip_date,
        t.parent_trip_id,
        t.duty_type,
        t.vehicle_category_id,
        t.vehicle_id,
        t.from_location,
        t.to_location,
        rci.package_code AS current_package_code
      FROM trips t
      LEFT JOIN rate_chart_items rci ON rci.id = t.rate_chart_item_id
      WHERE t.id = $1
      LIMIT 1
    `,
    [input.trip_id]
  );

  const parentTrip = parentResult.rows[0];
  if (!parentTrip) {
    throw new Error('Parent trip not found.');
  }
  if (parentTrip.parent_trip_id) {
    throw new Error('Annexures can only be created from parent trips.');
  }
  if (parentTrip.duty_type === null || !parentTrip.vehicle_category_id) {
    throw new Error('Parent trip requires duty type and GT vehicle category before annexure creation.');
  }

  let selectedMetrics: TripTravelMetricRecord[] = [];
  if (input.selection_mode === 'metric_rows') {
    if (!input.metric_ids?.length) {
      throw new Error('Select at least one travel metric row.');
    }

    const placeholders = makePlaceholders(input.metric_ids.length);
    const result = await db.query<TripTravelMetricRecord>(
      `
        SELECT id, trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km
        FROM trip_travel_metrics
        WHERE trip_id = $1
          AND id IN (${placeholders})
        ORDER BY seq ASC, created_at ASC
      `,
      [input.trip_id, ...input.metric_ids]
    );

    selectedMetrics = result.rows;
  } else {
    if (!input.start_date || !input.end_date) {
      throw new Error('Start date and end date are required for date-range annexures.');
    }

    const result = await db.query<TripTravelMetricRecord>(
      `
        SELECT id, trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km
        FROM trip_travel_metrics
        WHERE trip_id = $1
          AND start_date >= $2
          AND COALESCE(end_date, start_date) <= $3
        ORDER BY seq ASC, created_at ASC
      `,
      [input.trip_id, input.start_date, input.end_date]
    );

    selectedMetrics = result.rows;
  }

  if (selectedMetrics.length === 0) {
    throw new Error('Select at least one travel metric row.');
  }

  const metricIdPlaceholders = makePlaceholders(selectedMetrics.length);
  const allocatedResult = await db.query<{ metric_id: string }>(
    `
      SELECT metric_id
      FROM annexure_metrics
      WHERE metric_id IN (${metricIdPlaceholders})
      LIMIT 1
    `,
    selectedMetrics.map((metric) => metric.id)
  );

  if (allocatedResult.rows[0]) {
    throw new Error('One or more selected travel metric rows already belong to another annexure.');
  }

  const aggregation = aggregateTripTravelMetrics(selectedMetrics);
  if (aggregation.has_incomplete_rows) {
    throw new Error('All selected travel metric rows must be completed before annexure creation.');
  }

  const rateChart = await loadActiveRateChartDetail(parentTrip.customer_id, selectedMetrics[0].start_date, db);
  if (!rateChart) {
    throw new Error('No active rate chart was found for the annexure date.');
  }

  const nightHalts = getDateDiffInDays(selectedMetrics[0].start_date, selectedMetrics[selectedMetrics.length - 1].end_date ?? selectedMetrics[selectedMetrics.length - 1].start_date);
  const calculation = calculateRateFromChart(rateChart, {
    customer_id: parentTrip.customer_id,
    trip_date: selectedMetrics[0].start_date,
    duty_type: parentTrip.duty_type,
    vehicle_category_id: parentTrip.vehicle_category_id,
    package_code: parentTrip.current_package_code,
    from_location: parentTrip.from_location,
    to_location: parentTrip.to_location,
    total_km: aggregation.total_km,
    total_hours: aggregation.total_hours,
    night_halts: nightHalts,
  });

  const annexureNumber = (input.annexure_number ?? '').trim() || await getDefaultAnnexureNumber(db, parentTrip.id, parentTrip.trip_number);
  const annexureId = randomUUID();

  await db.query(
    `
      INSERT INTO annexures (
        id, annexure_number, trip_id, start_date, end_date, start_km, end_km,
        total_km, total_hours, night_halts, calculated_amount, is_billed, invoice_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, 0, NULL
      )
    `,
    [
      annexureId,
      annexureNumber,
      parentTrip.id,
      selectedMetrics[0].start_date,
      selectedMetrics[selectedMetrics.length - 1].end_date ?? selectedMetrics[selectedMetrics.length - 1].start_date,
      Number(selectedMetrics[0].start_km),
      Number(selectedMetrics[selectedMetrics.length - 1].end_km ?? selectedMetrics[selectedMetrics.length - 1].start_km),
      aggregation.total_km,
      aggregation.total_hours,
      nightHalts,
      Number(calculation.totals.final_amount.toFixed(2)),
    ]
  );

  for (const metric of selectedMetrics) {
    await db.query(
      `
        INSERT INTO annexure_metrics (
          id, annexure_id, metric_id, seq
        ) VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), annexureId, metric.id, metric.seq]
    );
  }

  return { annexure_id: annexureId };
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
    const rows = await loadAnnexureRows({ query } as Queryable, whereClause, values);
    res.json(rows.map(mapAnnexureRow));
  } catch (error) {
    console.error('Fetching annexures failed:', error);
    res.status(500).json({ message: 'Unable to fetch annexures.' });
  }
});

router.get('/trips/:id/annexures', authRequired, async (req, res) => {
  try {
    const rows = await loadAnnexureRows({ query } as Queryable, 'WHERE a.trip_id = $1', [req.params.id]);
    res.json(rows.map(mapAnnexureRow));
  } catch (error) {
    console.error('Fetching trip annexures failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip annexures.' });
  }
});

router.post('/trips/:id/annexures', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const created = await createAnnexureFromParentSqlite(client, {
      trip_id: String(req.params.id),
      annexure_number: typeof req.body.annexure_number === 'string' ? req.body.annexure_number : null,
      selection_mode: req.body.selection_mode === 'date_range' ? 'date_range' : 'metric_rows',
      metric_ids: Array.isArray(req.body.metric_ids) ? req.body.metric_ids.filter((value: unknown): value is string => typeof value === 'string') : undefined,
      start_date: typeof req.body.start_date === 'string' ? req.body.start_date : undefined,
      end_date: typeof req.body.end_date === 'string' ? req.body.end_date : undefined,
    });

    const annexureResult = await loadAnnexureDetailRow(client as unknown as Queryable, created.annexure_id);
    await client.query('COMMIT');
    res.status(201).json(annexureResult ? mapAnnexureRow(annexureResult) : null);
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
    const rows = Array.isArray(req.body.annexure_ids) && req.body.annexure_ids.length > 0
      ? await loadBillingRowsByIds(client as unknown as Queryable, req.body.annexure_ids.filter((value: unknown): value is string => typeof value === 'string'))
      : await loadBillingRowsByTrip(
          client as unknown as Queryable,
          typeof req.body.parent_trip_id === 'string' && req.body.parent_trip_id.trim().length > 0
            ? req.body.parent_trip_id.trim()
            : typeof req.body.trip_id === 'string' && req.body.trip_id.trim().length > 0
              ? req.body.trip_id.trim()
              : (() => { throw new Error('Trip is required when annexure IDs are not supplied.'); })(),
          typeof req.body.start_date === 'string' && req.body.start_date.trim().length > 0 ? req.body.start_date.trim() : null,
          typeof req.body.end_date === 'string' && req.body.end_date.trim().length > 0 ? req.body.end_date.trim() : null
        );
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

    const invoice = await createLocalInvoice(
      client as unknown as Queryable,
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
      `UPDATE annexures SET is_billed = 1, invoice_id = $1, updated_at = now() WHERE id IN (${makePlaceholders(rows.length)})`,
      [invoice.id, ...rows.map((row) => row.id)]
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
    const [annexureRow, settings] = await Promise.all([loadAnnexureDetailRow({ query } as Queryable, String(req.params.id)), loadInvoiceSettings({ query } as Queryable)]);
    if (!annexureRow) {
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    const annexure = mapAnnexureRow(annexureRow);

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
    const annexureRow = await loadAnnexureDetailRow({ query } as Queryable, String(req.params.id));
    if (!annexureRow) {
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }

    res.json(mapAnnexureRow(annexureRow));
  } catch (error) {
    console.error('Fetching annexure detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch annexure detail.' });
  }
});

router.put('/annexures/:id/bill', authRequired, roleCheck(['admin', 'manager', 'accountant', 'operator']), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const rows = await loadBillingRowsByIds(client as unknown as Queryable, [String(req.params.id)]);
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

    const invoice = await createLocalInvoice(
      client as unknown as Queryable,
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

    await client.query('UPDATE annexures SET is_billed = 1, invoice_id = $1, updated_at = now() WHERE id = $2', [invoice.id, row.id]);
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
    const currentResult = await client.query<{ id: string; is_billed: boolean | number }>('SELECT id, is_billed FROM annexures WHERE id = $1', [req.params.id]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    if (Boolean(current.is_billed)) {
      throw new Error('Billed annexures cannot be edited.');
    }

    if (typeof payload.annexure_number === 'string' && payload.annexure_number.trim().length > 0) {
      await client.query('UPDATE annexures SET annexure_number = $1, updated_at = now() WHERE id = $2', [payload.annexure_number.trim(), req.params.id]);
    }

    if (syncFromMetrics) {
      const snapshot = await loadAnnexureMetricSnapshot(client as unknown as Queryable, String(req.params.id));
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

    const annexureResult = await loadAnnexureDetailRow(client as unknown as Queryable, String(req.params.id));
    await client.query('COMMIT');
    res.json(annexureResult ? mapAnnexureRow(annexureResult) : null);
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
    const result = await client.query<{ id: string; is_billed: boolean | number }>('SELECT id, is_billed FROM annexures WHERE id = $1', [req.params.id]);
    const annexure = result.rows[0];
    if (!annexure) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Annexure not found.' });
      return;
    }
    if (Boolean(annexure.is_billed)) {
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
