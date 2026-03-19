import { Router } from 'express';
import { PoolClient } from 'pg';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { formatLedgerAmount, writeLedgerEntry } from '../utils/ledger';
import { calculateGst } from '../utils/gst';
import { createGtInvoice, formatDutyTypeLabel } from '../utils/invoice-gt';
import { buildDutySlipPdf, DutySlipVariant } from '../utils/pdf-duty-slip';
import {
  DutyType,
  Queryable,
  RateEngineError,
  calculateRateFromChart,
  loadActiveRateChartDetail,
} from '../utils/rate-engine';
import {
  TripMetricValidationError,
  TripTravelMetricRecord,
  aggregateTripTravelMetrics,
} from '../utils/trip-metrics';
import { generateNextTripNumber } from '../utils/auto-code';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const tripFields = [
  'trip_number', 'customer_id', 'route_id', 'vehicle_id', 'driver_id', 'trip_date', 'duty_type',
  'booked_by', 'report_to', 'vehicle_category_id', 'rate_chart_id', 'rate_chart_item_id',
  'rate_chart_fixed_route_id', 'start_time', 'end_time', 'start_km', 'end_km', 'actual_km',
  'total_hours', 'night_halts', 'from_location', 'to_location', 'purpose', 'passengers', 'status',
  'trip_amount', 'advance_hirer', 'advance_travels', 'fuel_advance', 'cash_advance', 'base_charge',
  'extra_km_charge', 'extra_hr_charge', 'night_halt_charge', 'fuel_charge', 'fixed_route_charge',
  'ot_charge', 'calculated_amount', 'is_long_trip', 'parent_trip_id', 'annexure_number',
  'driver_allowance', 'toll_charges', 'parking_charges', 'other_charges', 'remarks',
] as const;
const expenseFields = ['expense_type', 'amount', 'description', 'receipt_number', 'is_billable_to_hirer'] as const;
const metricFields = ['seq', 'start_date', 'start_time', 'start_km', 'end_date', 'end_time', 'end_km'] as const;
const allowedDutyTypes: DutyType[] = ['local', 'outstation', 'drop_pickup', 'station_drop', 'long'];
const allowedDutySlipVariants: DutySlipVariant[] = ['open_external', 'closed_external', 'internal'];
const nonNegativeTripFields = [
  'trip_amount', 'start_km', 'end_km', 'actual_km', 'total_hours', 'night_halts', 'advance_hirer',
  'advance_travels', 'fuel_advance', 'cash_advance', 'base_charge', 'extra_km_charge',
  'extra_hr_charge', 'night_halt_charge', 'fuel_charge', 'fixed_route_charge', 'ot_charge',
  'calculated_amount', 'driver_allowance', 'toll_charges', 'parking_charges', 'other_charges',
] as const;

interface PgLikeError {
  code?: string;
  constraint?: string;
}

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
  parent_trip_id: string | null;
  duty_type: DutyType | null;
  vehicle_category_id: string | null;
  rate_chart_id: string | null;
  annexure_count: string;
}

interface TripCustomerSummaryRow {
  id: string;
  name: string;
  customer_code: string;
  address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
}

interface TripDriverSummaryRow {
  id: string;
  name: string;
  driver_code: string;
  phone: string;
}

interface TripVehicleSummaryRow {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
}
interface TripParentSummaryRow {
  id: string;
  trip_number: string;
}

interface TripVehicleCategorySummaryRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface TripRateChartSummaryRow {
  id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
}

interface TripRateChartItemSummaryRow {
  id: string;
  package_code: string;
  package_label: string;
  duty_type: DutyType;
}

interface TripRateChartFixedRouteSummaryRow {
  id: string;
  from_location: string;
  to_location: string;
  duty_type: DutyType;
  fixed_amount: number | string;
  description: string | null;
}

interface TripExpenseRow {
  id: string;
  trip_id: string;
  expense_type: string;
  amount: number | string;
  description: string | null;
  receipt_number: string | null;
  is_billable_to_hirer: boolean;
  created_at: string;
}

interface TripDetailRow {
  id: string;
  trip_number: string;
  customer_id: string;
  route_id: string | null;
  vehicle_id: string;
  driver_id: string;
  trip_date: string;
  duty_type: DutyType | null;
  booked_by: string | null;
  report_to: string | null;
  vehicle_category_id: string | null;
  rate_chart_id: string | null;
  rate_chart_item_id: string | null;
  rate_chart_fixed_route_id: string | null;
  start_time: string | null;
  end_time: string | null;
  start_km: number | string | null;
  end_km: number | string | null;
  actual_km: number | string | null;
  total_hours: number | string | null;
  night_halts: number | string | null;
  from_location: string;
  to_location: string;
  purpose: string | null;
  passengers: number | null;
  status: string;
  trip_amount: number | string;
  advance_hirer: number | string;
  advance_travels: number | string;
  fuel_advance: number | string;
  cash_advance: number | string;
  base_charge: number | string;
  extra_km_charge: number | string;
  extra_hr_charge: number | string;
  night_halt_charge: number | string;
  fuel_charge: number | string;
  fixed_route_charge: number | string;
  ot_charge: number | string;
  calculated_amount: number | string | null;
  is_long_trip: boolean;
  parent_trip_id: string | null;
  annexure_number: string | null;
  driver_allowance: number | string;
  toll_charges: number | string;
  parking_charges: number | string;
  other_charges: number | string;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_expenses: number | string;
  annexure_count: number | string;
  billed_annexure_count: number | string;
  direct_invoice_id: string | null;
  customer: TripCustomerSummaryRow;
  driver: TripDriverSummaryRow;
  vehicle: TripVehicleSummaryRow;
  vehicle_category: TripVehicleCategorySummaryRow | null;
  parent_trip: TripParentSummaryRow | null;
  rate_chart: TripRateChartSummaryRow | null;
  rate_chart_item: TripRateChartItemSummaryRow | null;
  rate_chart_fixed_route: TripRateChartFixedRouteSummaryRow | null;
}

interface TripDetailResponse extends TripDetailRow {
  metrics: ReturnType<typeof aggregateTripTravelMetrics>['metrics'];
  expenses: TripExpenseRow[];
}

interface TripCalculationLockRow {
  id: string;
  customer_id: string;
  trip_date: string;
  duty_type: DutyType | null;
  vehicle_category_id: string | null;
  from_location: string;
  to_location: string;
  night_halts: number | string | null;
  trip_amount: number | string;
  calculated_amount: number | string | null;
  current_package_code: string | null;
}

interface TripDirectBillingRow {
  id: string;
  trip_number: string;
  parent_trip_id: string | null;
  trip_date: string;
  duty_type: DutyType | null;
  from_location: string;
  to_location: string;
  trip_amount: string;
  actual_km: string | null;
  total_hours: string | null;
  customer_id: string;
  customer_name: string;
  customer_address: string | null;
  customer_gstin: string | null;
  customer_credit_days: number | null;
  vehicle_number: string;
  vehicle_type_label: string;
  has_annexures: boolean;
  direct_invoice_id: string | null;
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

function isDutyType(value: unknown): value is DutyType {
  return typeof value === 'string' && allowedDutyTypes.includes(value as DutyType);
}

function isDutySlipVariant(value: unknown): value is DutySlipVariant {
  return typeof value === 'string' && allowedDutySlipVariants.includes(value as DutySlipVariant);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeRequiredText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeNullableValue(value: unknown): unknown {
  return value === '' ? null : value;
}

function normalizePackageCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim().toUpperCase();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getTripSettingsKeys(): string[] {
  return ['company_name', 'company_address', 'company_gstin', 'company_pan'];
}

function getTripDetailSelect(): string {
  return `
    SELECT
      t.*,
      COALESCE(expense_summary.total_expenses, 0) AS total_expenses,
      COALESCE(annexure_summary.annexure_count, 0) AS annexure_count,
      COALESCE(annexure_summary.billed_annexure_count, 0) AS billed_annexure_count,
      direct_invoice.direct_invoice_id,
      json_build_object(
        'id', c.id,
        'name', c.name,
        'customer_code', c.customer_code,
        'address', c.address,
        'contact_person', c.contact_person,
        'phone', c.phone
      ) AS customer,
      json_build_object('id', d.id, 'name', d.name, 'driver_code', d.driver_code, 'phone', d.phone) AS driver,
      json_build_object('id', v.id, 'vehicle_number', v.vehicle_number, 'vehicle_type', v.vehicle_type) AS vehicle,
      CASE
        WHEN vc.id IS NULL THEN NULL
        ELSE json_build_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active)
      END AS vehicle_category,
      CASE
        WHEN parent_t.id IS NULL THEN NULL
        ELSE json_build_object('id', parent_t.id, 'trip_number', parent_t.trip_number)
      END AS parent_trip,
      CASE
        WHEN rc.id IS NULL THEN NULL
        ELSE json_build_object('id', rc.id, 'name', rc.name, 'effective_from', rc.effective_from::text, 'effective_to', rc.effective_to::text)
      END AS rate_chart,
      CASE
        WHEN rci.id IS NULL THEN NULL
        ELSE json_build_object('id', rci.id, 'package_code', rci.package_code, 'package_label', rci.package_label, 'duty_type', rci.duty_type)
      END AS rate_chart_item,
      CASE
        WHEN rcfr.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', rcfr.id,
          'from_location', rcfr.from_location,
          'to_location', rcfr.to_location,
          'duty_type', rcfr.duty_type,
          'fixed_amount', rcfr.fixed_amount,
          'description', rcfr.description
        )
      END AS rate_chart_fixed_route
    FROM trips t
    JOIN customers c ON c.id = t.customer_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN trips parent_t ON parent_t.id = t.parent_trip_id
    LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
    LEFT JOIN rate_charts rc ON rc.id = t.rate_chart_id
    LEFT JOIN rate_chart_items rci ON rci.id = t.rate_chart_item_id
    LEFT JOIN rate_chart_fixed_routes rcfr ON rcfr.id = t.rate_chart_fixed_route_id
    LEFT JOIN (
      SELECT trip_id, COALESCE(SUM(amount), 0) AS total_expenses
      FROM trip_expenses
      GROUP BY trip_id
    ) AS expense_summary ON expense_summary.trip_id = t.id
    LEFT JOIN (
      SELECT
        trip_id,
        COUNT(*) AS annexure_count,
        COUNT(*) FILTER (WHERE is_billed = true) AS billed_annexure_count
      FROM annexures
      GROUP BY trip_id
    ) AS annexure_summary ON annexure_summary.trip_id = t.id
    LEFT JOIN (
      SELECT DISTINCT ON (ii.trip_id)
        ii.trip_id,
        ii.invoice_id AS direct_invoice_id
      FROM invoice_items ii
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE ii.trip_id IS NOT NULL AND ii.annexure_id IS NULL AND inv.invoice_status = 'active'
      ORDER BY ii.trip_id, ii.created_at ASC, ii.invoice_id ASC
    ) AS direct_invoice ON direct_invoice.trip_id = t.id
  `;
}

async function getTripById(db: Queryable, tripId: string): Promise<TripDetailResponse | null> {
  const tripResult = await db.query<TripDetailRow>(`${getTripDetailSelect()} WHERE t.id = $1 LIMIT 1`, [tripId]);
  const trip = tripResult.rows[0] ?? null;

  if (!trip) {
    return null;
  }

  const [metricResult, expenseResult] = await Promise.all([
    db.query<TripTravelMetricRecord>(
      `
        SELECT *
        FROM trip_travel_metrics
        WHERE trip_id = $1
        ORDER BY seq ASC, created_at ASC
      `,
      [tripId]
    ),
    db.query<TripExpenseRow>(
      `
        SELECT *
        FROM trip_expenses
        WHERE trip_id = $1
        ORDER BY created_at DESC
      `,
      [tripId]
    ),
  ]);

  const metricAggregation = aggregateTripTravelMetrics(metricResult.rows);

  return {
    ...trip,
    metrics: metricAggregation.metrics,
    expenses: expenseResult.rows,
  };
}

async function ensureTripExists(db: Queryable, tripId: string): Promise<boolean> {
  const result = await db.query<{ id: string }>('SELECT id FROM trips WHERE id = $1 LIMIT 1', [tripId]);
  return Boolean(result.rows[0]);
}

async function syncTripMetricSnapshot(
  db: Queryable,
  tripId: string
): Promise<ReturnType<typeof aggregateTripTravelMetrics>> {
  const metricResult = await db.query<TripTravelMetricRecord>(
    `
      SELECT *
      FROM trip_travel_metrics
      WHERE trip_id = $1
      ORDER BY seq ASC, created_at ASC
    `,
    [tripId]
  );

  const aggregation = aggregateTripTravelMetrics(metricResult.rows);
  const hasMetrics = aggregation.metrics.length > 0;

  await db.query(
    `
      UPDATE trips
      SET
        start_time = $1,
        end_time = $2,
        start_km = $3,
        end_km = $4,
        actual_km = $5,
        total_hours = $6,
        updated_at = now()
      WHERE id = $7
    `,
    [
      aggregation.start_time,
      aggregation.end_time,
      aggregation.start_km,
      aggregation.end_km,
      hasMetrics ? aggregation.total_km : null,
      hasMetrics ? aggregation.total_hours : null,
      tripId,
    ]
  );

  return aggregation;
}

async function getTripSettings(db: Queryable = { query }): Promise<Record<string, string>> {
  const result = await db.query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key = ANY($1)
    `,
    [getTripSettingsKeys()]
  );

  return Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string>;
}

function getStoredBreakdownLineItems(trip: TripDetailResponse): Array<{ label: string; amount: number }> {
  const rows = [
    { label: 'Base Charge', amount: Number(trip.base_charge || 0) },
    { label: 'Extra KM Charge', amount: Number(trip.extra_km_charge || 0) },
    { label: 'Extra Hour Charge', amount: Number(trip.extra_hr_charge || 0) },
    { label: 'Fuel Charge', amount: Number(trip.fuel_charge || 0) },
    { label: 'Night Halt Charge', amount: Number(trip.night_halt_charge || 0) },
    { label: 'Fixed Route Charge', amount: Number(trip.fixed_route_charge || 0) },
    { label: 'OT Charge', amount: Number(trip.ot_charge || 0) },
  ];

  return rows.filter((row) => row.amount > 0);
}

function normalizeTripPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, tripFields);

  if (Object.prototype.hasOwnProperty.call(payload, 'trip_number')) {
    payload.trip_number = normalizeRequiredText(payload.trip_number);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'from_location')) {
    payload.from_location = normalizeRequiredText(payload.from_location);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'to_location')) {
    payload.to_location = normalizeRequiredText(payload.to_location);
  }

  for (const field of ['booked_by', 'report_to', 'purpose', 'remarks', 'annexure_number'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeOptionalText(payload[field]) ?? null;
    }
  }

  for (const field of ['route_id', 'vehicle_category_id', 'rate_chart_id', 'rate_chart_item_id', 'rate_chart_fixed_route_id', 'parent_trip_id'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeNullableValue(payload[field]);
    }
  }

  for (const field of ['start_time', 'end_time', 'start_km', 'end_km', 'actual_km', 'total_hours', 'night_halts', 'duty_type'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeNullableValue(payload[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status') && typeof payload.status === 'string') {
    payload.status = payload.status.trim();
  }

  return payload;
}

function validateTripPayload(payload: Record<string, unknown>, requireAllFields: boolean, tripId?: string): string | null {
  if (requireAllFields) {
    const requiredFields = ['customer_id', 'vehicle_id', 'driver_id', 'trip_date', 'from_location', 'to_location'];
    if (requiredFields.some((field) => payload[field] === undefined || payload[field] === '')) {
      return 'Missing required trip fields.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'duty_type') && payload.duty_type !== null && !isDutyType(payload.duty_type)) {
    return 'Invalid duty type.';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'from_location') && (!payload.from_location || typeof payload.from_location !== 'string')) {
    return 'From location cannot be empty.';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'to_location') && (!payload.to_location || typeof payload.to_location !== 'string')) {
    return 'To location cannot be empty.';
  }

  for (const field of nonNegativeTripFields) {
    const value = payload[field];
    if (value !== undefined && value !== null && value !== '' && Number(value) < 0) {
      return `${field.replace(/_/g, ' ')} cannot be negative.`;
    }
  }

  if (payload.night_halts !== undefined && payload.night_halts !== null && payload.night_halts !== '' && !Number.isInteger(Number(payload.night_halts))) {
    return 'Night halts must be a whole number.';
  }
  if (payload.passengers !== undefined && payload.passengers !== null && payload.passengers !== '' && !Number.isInteger(Number(payload.passengers))) {
    return 'Passengers must be a whole number.';
  }
  if (tripId && payload.parent_trip_id === tripId) {
    return 'Parent trip cannot reference the same trip.';
  }

  return null;
}

function normalizeExpensePayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, expenseFields);

  if (Object.prototype.hasOwnProperty.call(payload, 'expense_type')) {
    payload.expense_type = normalizeRequiredText(payload.expense_type);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) {
    payload.amount = toNumber(payload.amount);
  }
  for (const field of ['description', 'receipt_number'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeOptionalText(payload[field]) ?? null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_billable_to_hirer')) {
    payload.is_billable_to_hirer = payload.is_billable_to_hirer === true;
  }

  return payload;
}

function validateExpensePayload(payload: Record<string, unknown>, requireAllFields: boolean): string | null {
  if (requireAllFields) {
    if (typeof payload.expense_type !== 'string' || payload.expense_type.trim().length === 0 || typeof payload.amount !== 'number') {
      return 'Expense type and amount are required.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'expense_type') && (typeof payload.expense_type !== 'string' || payload.expense_type.trim().length === 0)) {
    return 'Expense type is required.';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) {
    if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount)) {
      return 'Expense amount must be a valid number.';
    }
    if (payload.amount < 0) {
      return 'Expense amount cannot be negative.';
    }
  }

  return null;
}

function normalizeMetricPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, metricFields);

  for (const field of ['start_date', 'start_time'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeRequiredText(payload[field]);
    }
  }
  for (const field of ['end_date', 'end_time'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = normalizeOptionalText(payload[field]) ?? null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'end_km')) {
    payload.end_km = normalizeNullableValue(payload.end_km);
  }

  return payload;
}
function validateMetricPayload(payload: Record<string, unknown>, requireAllFields: boolean): string | null {
  if (requireAllFields) {
    const requiredFields = ['seq', 'start_date', 'start_time', 'start_km'];
    if (requiredFields.some((field) => payload[field] === undefined || payload[field] === '')) {
      return 'Travel metric sequence, start date, start time, and start KM are required.';
    }
  }

  if (payload.seq !== undefined && (!Number.isInteger(Number(payload.seq)) || Number(payload.seq) <= 0)) {
    return 'Sequence must be a positive whole number.';
  }
  if (payload.start_km !== undefined && (Number.isNaN(Number(payload.start_km)) || Number(payload.start_km) < 0)) {
    return 'Start KM must be zero or greater.';
  }

  const hasAnyEndField = payload.end_date !== undefined || payload.end_time !== undefined || payload.end_km !== undefined;
  const hasEndDate = payload.end_date !== undefined && payload.end_date !== null && payload.end_date !== '';
  const hasEndTime = payload.end_time !== undefined && payload.end_time !== null && payload.end_time !== '';
  const hasEndKm = payload.end_km !== undefined && payload.end_km !== null && payload.end_km !== '';

  if (hasAnyEndField && !(hasEndDate && hasEndTime && hasEndKm) && (hasEndDate || hasEndTime || hasEndKm)) {
    return 'End date, end time, and end KM must be supplied together.';
  }
  if (hasEndKm && Number(payload.end_km) < 0) {
    return 'End KM must be zero or greater.';
  }

  try {
    aggregateTripTravelMetrics([{ id: 'validation', trip_id: 'validation', seq: Number(payload.seq ?? 1), start_date: String(payload.start_date ?? '2000-01-01'), start_time: String(payload.start_time ?? '00:00'), start_km: Number(payload.start_km ?? 0), end_date: hasEndDate ? String(payload.end_date) : null, end_time: hasEndTime ? String(payload.end_time) : null, end_km: hasEndKm ? Number(payload.end_km) : null }]);
  } catch (error) {
    if (error instanceof TripMetricValidationError) {
      return error.message;
    }
    throw error;
  }

  return null;
}

function getTripSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505' && pgError.constraint === 'trips_trip_number_key') {
    return 'Trip number already exists.';
  }
  if (pgError?.code === '23503') {
    if (pgError.constraint?.includes('customer')) return 'Selected customer was not found.';
    if (pgError.constraint?.includes('vehicle')) return 'Selected vehicle was not found.';
    if (pgError.constraint?.includes('driver')) return 'Selected driver was not found.';
    if (pgError.constraint?.includes('route')) return 'Selected route was not found.';
    if (pgError.constraint?.includes('vehicle_category')) return 'Selected GT vehicle category was not found.';
    if (pgError.constraint?.includes('rate_chart_fixed_route')) return 'Selected fixed route source was not found.';
    if (pgError.constraint?.includes('rate_chart_item')) return 'Selected package source was not found.';
    if (pgError.constraint?.includes('rate_chart')) return 'Selected rate chart was not found.';
    if (pgError.constraint?.includes('parent_trip')) return 'Selected parent trip was not found.';
  }

  return 'Unable to save trip.';
}

function getTripMetricSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505' && pgError.constraint === 'idx_trip_travel_metrics_trip_seq') {
    return 'Sequence already exists for this trip.';
  }
  if (pgError?.code === '23503' && pgError.constraint?.includes('trip_id')) {
    return 'Trip was not found.';
  }

  return 'Unable to save travel metric.';
}

function getRateEngineStatus(error: RateEngineError): number {
  switch (error.code) {
    case 'RATE_CHART_NOT_FOUND':
    case 'RATE_ITEM_NOT_FOUND':
      return 404;
    case 'RATE_CHART_CONFLICT':
    case 'INVALID_RATE_SETUP':
      return 409;
    case 'PACKAGE_SELECTION_REQUIRED':
      return 400;
    default:
      return 400;
  }
}

async function generateInvoiceForCompletedTrip(client: PoolClient, tripId: string, userId: string | null): Promise<void> {
  const existingItem = await client.query<{ id: string }>(
    `SELECT ii.id FROM invoice_items ii JOIN invoices inv ON inv.id = ii.invoice_id WHERE ii.trip_id = $1 AND inv.invoice_status = 'active' LIMIT 1`,
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
        c.credit_days AS customer_credit_days,
        t.parent_trip_id,
        t.duty_type,
        t.vehicle_category_id,
        t.rate_chart_id,
        COALESCE((SELECT COUNT(*)::text FROM annexures a WHERE a.trip_id = t.id), '0') AS annexure_count
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
  if (
    trip.parent_trip_id ||
    Number(trip.annexure_count || 0) > 0 ||
    trip.duty_type ||
    trip.vehicle_category_id ||
    trip.rate_chart_id
  ) {
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
  const settings = Object.fromEntries(settingRows.rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string>;
  const invoicePrefix = settings.invoice_prefix || 'INV';

  const gstRow = await client.query<{ hsn_code: string; cgst_rate: string; sgst_rate: string; igst_rate: string }>(
    `
      SELECT hsn_code, cgst_rate::text, sgst_rate::text, igst_rate::text
      FROM gst_rates
      WHERE hsn_code = '9964' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `
  );

  const gst = gstRow.rows[0] ?? { hsn_code: '9964', cgst_rate: '2.5', sgst_rate: '2.5', igst_rate: '5' };
  const invoiceCount = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1', [`${invoicePrefix}-%`]);
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



  await writeLedgerEntry(client, {
    event_type: 'invoice_issued',
    customer_id: trip.customer_id,
    invoice_id: invoiceResult.rows[0].id,
    invoice_number: invoiceNumber,
    amount: gstAmounts.total_amount,
    direction: 'AR_INCREASE',
    description: `Invoice ${invoiceNumber} issued for Rs.${formatLedgerAmount(gstAmounts.total_amount)}.`,
    performed_by: userId,
  });
}

router.get('/', authRequired, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  try {
    const values: unknown[] = [];
    const filters = ['t.parent_trip_id IS NULL'];
    if (status) {
      values.push(status);
      filters.push(`t.status = $${values.length}`);
    }
    const whereClause = `WHERE ${filters.join(' AND ')}`;
    const result = await query<TripDetailRow>(`
      ${getTripDetailSelect()}
      ${whereClause}
      ORDER BY t.trip_date DESC, t.created_at DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching trips failed:', error);
    res.status(500).json({ message: 'Unable to fetch trips.' });
  }
});

router.get('/:id/travel-metrics', authRequired, async (req, res) => {
  try {
    const tripExists = await ensureTripExists({ query }, String(req.params.id));
    if (!tripExists) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    const result = await query<TripTravelMetricRecord>(
      `
        SELECT *
        FROM trip_travel_metrics
        WHERE trip_id = $1
        ORDER BY seq ASC, created_at ASC
      `,
      [req.params.id]
    );

    const aggregation = aggregateTripTravelMetrics(result.rows);
    res.json(aggregation.metrics);
  } catch (error) {
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Fetching trip travel metrics failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip travel metrics.' });
  }
});

router.post('/:id/travel-metrics', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const payload = normalizeMetricPayload(req.body as Record<string, unknown>);
  const validationError = validateMetricPayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tripExists = await ensureTripExists(client as unknown as Queryable, tripId);
    if (!tripExists) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    await client.query(
      `
        INSERT INTO trip_travel_metrics (
          trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `,
      [tripId, Number(payload.seq), payload.start_date, payload.start_time, payload.start_km, payload.end_date ?? null, payload.end_time ?? null, payload.end_km ?? null]
    );

    const aggregation = await syncTripMetricSnapshot(client as unknown as Queryable, tripId);
    await client.query('COMMIT');
    res.status(201).json(aggregation.metrics);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Creating trip travel metric failed:', error);
    res.status(500).json({ message: getTripMetricSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.put('/:id/travel-metrics/:metricId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const metricId = String(req.params.metricId);
  const payload = normalizeMetricPayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No travel metric fields supplied for update.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<TripTravelMetricRecord>('SELECT * FROM trip_travel_metrics WHERE id = $1 AND trip_id = $2 LIMIT 1', [metricId, tripId]);
    const existingMetric = existingResult.rows[0];
    if (!existingMetric) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Travel metric not found.' });
      return;
    }

    const mergedMetric = { ...existingMetric, ...payload };
    const mergedValidationError = validateMetricPayload(mergedMetric, true);
    if (mergedValidationError) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: mergedValidationError });
      return;
    }

    const update = buildUpdateClause(payload);
    await client.query(`UPDATE trip_travel_metrics SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} AND trip_id = $${update.values.length + 2}`, [...update.values, metricId, tripId]);

    const aggregation = await syncTripMetricSnapshot(client as unknown as Queryable, tripId);
    await client.query('COMMIT');
    res.json(aggregation.metrics);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Updating trip travel metric failed:', error);
    res.status(500).json({ message: getTripMetricSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/:id/travel-metrics/:metricId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const metricId = String(req.params.metricId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<{ id: string }>('DELETE FROM trip_travel_metrics WHERE id = $1 AND trip_id = $2 RETURNING id', [metricId, tripId]);
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Travel metric not found.' });
      return;
    }

    const aggregation = await syncTripMetricSnapshot(client as unknown as Queryable, tripId);
    await client.query('COMMIT');
    res.json(aggregation.metrics);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Deleting trip travel metric failed:', error);
    res.status(500).json({ message: 'Unable to delete trip travel metric.' });
  } finally {
    client.release();
  }
});

router.get('/:id/expenses', authRequired, async (req, res) => {
  try {
    const result = await query<TripExpenseRow>(`SELECT * FROM trip_expenses WHERE trip_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching trip expenses failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip expenses.' });
  }
});

router.post('/:id/expenses', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = normalizeExpensePayload(req.body as Record<string, unknown>);
  const validationError = validateExpensePayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  try {
    const result = await query<TripExpenseRow>(
      `
        INSERT INTO trip_expenses (trip_id, expense_type, amount, description, receipt_number, is_billable_to_hirer)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        req.params.id,
        payload.expense_type,
        payload.amount,
        payload.description ?? null,
        payload.receipt_number ?? null,
        payload.is_billable_to_hirer ?? false,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating trip expense failed:', error);
    res.status(500).json({ message: 'Unable to create trip expense.' });
  }
});
router.put('/:id/expenses/:expenseId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = normalizeExpensePayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No expense fields supplied for update.' });
    return;
  }

  const validationError = validateExpensePayload(payload, false);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query<TripExpenseRow>(
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
    const result = await query<{ id: string }>('DELETE FROM trip_expenses WHERE id = $1 AND trip_id = $2 RETURNING id', [req.params.expenseId, req.params.id]);
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
  const payload = normalizeTripPayload(req.body as Record<string, unknown>);
  const validationError = validateTripPayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tripNumber = await generateNextTripNumber(client);

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO trips (
          trip_number, customer_id, route_id, vehicle_id, driver_id, trip_date, duty_type, booked_by,
          report_to, vehicle_category_id, rate_chart_id, rate_chart_item_id, rate_chart_fixed_route_id,
          start_time, end_time, start_km, end_km, actual_km, total_hours, night_halts,
          from_location, to_location, purpose, passengers, status, trip_amount,
          advance_hirer, advance_travels, fuel_advance, cash_advance,
          base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge,
          fixed_route_charge, ot_charge, calculated_amount, is_long_trip, parent_trip_id,
          annexure_number, driver_allowance, toll_charges, parking_charges, other_charges,
          remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30,
          $31, $32, $33, $34, $35,
          $36, $37, $38, $39, $40,
          $41, $42, $43, $44, $45,
          $46, $47
        )
        RETURNING id
      `,
      [
        tripNumber, payload.customer_id, payload.route_id ?? null, payload.vehicle_id, payload.driver_id,
        payload.trip_date, payload.duty_type ?? null, payload.booked_by ?? null, payload.report_to ?? null,
        payload.vehicle_category_id ?? null, payload.rate_chart_id ?? null, payload.rate_chart_item_id ?? null,
        payload.rate_chart_fixed_route_id ?? null, payload.start_time ?? null, payload.end_time ?? null,
        payload.start_km ?? null, payload.end_km ?? null, payload.actual_km ?? null, payload.total_hours ?? null,
        payload.night_halts ?? null, payload.from_location, payload.to_location, payload.purpose ?? null,
        payload.passengers ?? null, payload.status ?? 'scheduled', payload.trip_amount ?? 0,
        payload.advance_hirer ?? 0, payload.advance_travels ?? 0, payload.fuel_advance ?? 0, payload.cash_advance ?? 0,
        payload.base_charge ?? 0, payload.extra_km_charge ?? 0, payload.extra_hr_charge ?? 0,
        payload.night_halt_charge ?? 0, payload.fuel_charge ?? 0, payload.fixed_route_charge ?? 0,
        payload.ot_charge ?? 0, payload.calculated_amount ?? null, payload.is_long_trip ?? false,
        payload.parent_trip_id ?? null, payload.annexure_number ?? null, payload.driver_allowance ?? 0,
        payload.toll_charges ?? 0, payload.parking_charges ?? 0, payload.other_charges ?? 0,
        payload.remarks ?? null, req.user?.id ?? null,
      ]
    );

    const trip = await getTripById(client as unknown as Queryable, result.rows[0].id);
    await client.query('COMMIT');
    res.status(201).json(trip);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating trip failed:', error);
    res.status(500).json({ message: getTripSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.post('/:id/calculate', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const packageCode = normalizePackageCode((req.body as Record<string, unknown>).package_code);
  const forceSyncTripAmount = (req.body as Record<string, unknown>).force_sync_trip_amount === true;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tripResult = await client.query<TripCalculationLockRow>(
      `
        SELECT
          t.id,
          t.customer_id,
          t.trip_date::text,
          t.duty_type,
          t.vehicle_category_id,
          t.from_location,
          t.to_location,
          t.night_halts,
          t.trip_amount::text,
          t.calculated_amount::text,
          rci.package_code AS current_package_code
        FROM trips t
        LEFT JOIN rate_chart_items rci ON rci.id = t.rate_chart_item_id
        WHERE t.id = $1
        FOR UPDATE OF t
      `,
      [tripId]
    );
    const trip = tripResult.rows[0];

    if (!trip) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }
    if (!trip.duty_type || !trip.vehicle_category_id) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Duty type and GT vehicle category are required before calculation.' });
      return;
    }

    const metricResult = await client.query<TripTravelMetricRecord>(`SELECT * FROM trip_travel_metrics WHERE trip_id = $1 ORDER BY seq ASC, created_at ASC`, [tripId]);
    const aggregation = aggregateTripTravelMetrics(metricResult.rows);

    if (aggregation.metrics.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'At least one completed travel metric row is required before calculation.' });
      return;
    }
    if (aggregation.has_incomplete_rows) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'All travel metric rows must be completed before calculation.' });
      return;
    }

    const rateChart = await loadActiveRateChartDetail(trip.customer_id, trip.trip_date, client as unknown as Queryable);
    if (!rateChart) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'No active rate chart was found for the selected customer and date.' });
      return;
    }

    const calculation = calculateRateFromChart(rateChart, {
      customer_id: trip.customer_id,
      trip_date: trip.trip_date,
      duty_type: trip.duty_type,
      vehicle_category_id: trip.vehicle_category_id,
      package_code: packageCode ?? trip.current_package_code,
      from_location: trip.from_location,
      to_location: trip.to_location,
      total_km: aggregation.total_km,
      total_hours: aggregation.total_hours,
      night_halts: Number(trip.night_halts ?? 0),
    });

    const previousTripAmount = Number(trip.trip_amount || 0);
    const previousCalculatedAmount = toNumber(trip.calculated_amount);
    const shouldSyncTripAmount = forceSyncTripAmount || (previousCalculatedAmount === null ? previousTripAmount === 0 : previousTripAmount === previousCalculatedAmount);
    const nextTripAmount = shouldSyncTripAmount ? calculation.totals.final_amount : previousTripAmount;

    await client.query(
      `
        UPDATE trips
        SET
          rate_chart_id = $1,
          rate_chart_item_id = $2,
          rate_chart_fixed_route_id = $3,
          start_time = $4,
          end_time = $5,
          start_km = $6,
          end_km = $7,
          actual_km = $8,
          total_hours = $9,
          base_charge = $10,
          extra_km_charge = $11,
          extra_hr_charge = $12,
          fuel_charge = $13,
          night_halt_charge = $14,
          fixed_route_charge = $15,
          ot_charge = $16,
          calculated_amount = $17,
          is_long_trip = $18,
          trip_amount = $19,
          updated_at = now()
        WHERE id = $20
      `,
      [
        calculation.rate_chart_id, calculation.rate_chart_item_id, calculation.applied_fixed_route_id,
        aggregation.start_time, aggregation.end_time, aggregation.start_km, aggregation.end_km,
        aggregation.total_km, aggregation.total_hours, calculation.totals.base_charge,
        calculation.totals.extra_km_charge, calculation.totals.extra_hr_charge, calculation.totals.fuel_charge,
        calculation.totals.night_halt_charge, calculation.applied_fixed_route_id ? calculation.totals.fixed_amount : 0,
        calculation.totals.ot_charge, calculation.totals.final_amount, calculation.applied_duty_type === 'long',
        nextTripAmount, tripId,
      ]
    );

    const tripDetail = await getTripById(client as unknown as Queryable, tripId);
    await client.query('COMMIT');
    res.json({ trip: tripDetail, calculation });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof RateEngineError) {
      res.status(getRateEngineStatus(error)).json({ message: error.message });
      return;
    }

    console.error('Calculating trip failed:', error);
    res.status(500).json({ message: 'Unable to calculate trip.' });
  } finally {
    client.release();
  }
});

router.post('/:id/bill', authRequired, roleCheck(['admin', 'manager', 'accountant', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const invoiceDate = typeof req.body.invoice_date === 'string' && req.body.invoice_date.trim().length > 0
    ? req.body.invoice_date.trim()
    : formatDateOnly(new Date());
  const remarks = typeof req.body.remarks === 'string' && req.body.remarks.trim().length > 0
    ? req.body.remarks.trim()
    : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tripResult = await client.query<TripDirectBillingRow>(
      `
        SELECT
          t.id,
          t.trip_number,
          t.parent_trip_id,
          t.trip_date::text,
          t.duty_type,
          t.from_location,
          t.to_location,
          t.trip_amount::text,
          t.actual_km::text,
          t.total_hours::text,
          c.id AS customer_id,
          c.name AS customer_name,
          c.address AS customer_address,
          c.gstin AS customer_gstin,
          c.credit_days AS customer_credit_days,
          v.vehicle_number,
          COALESCE(vc.name, v.vehicle_type) AS vehicle_type_label,
          EXISTS(SELECT 1 FROM annexures a WHERE a.trip_id = t.id) AS has_annexures,
          (
            SELECT ii.invoice_id
            FROM invoice_items ii
            JOIN invoices inv ON inv.id = ii.invoice_id
            WHERE ii.trip_id = t.id AND ii.annexure_id IS NULL AND inv.invoice_status = 'active'
            ORDER BY ii.created_at ASC, ii.invoice_id ASC
            LIMIT 1
          ) AS direct_invoice_id
        FROM trips t
        JOIN customers c ON c.id = t.customer_id
        JOIN vehicles v ON v.id = t.vehicle_id
        LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
        WHERE t.id = $1
        LIMIT 1
      `,
      [tripId]
    );
    const trip = tripResult.rows[0];

    if (!trip) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }
    if (trip.parent_trip_id) {
      throw new Error('Annexure child trips cannot be billed directly.');
    }
    if (trip.has_annexures) {
      throw new Error('This trip already has annexures. Use annexure billing instead of direct trip billing.');
    }
    if (trip.direct_invoice_id) {
      throw new Error('This trip is already billed.');
    }

    const billedAmount = Number(trip.trip_amount || 0);
    if (!(billedAmount > 0)) {
      throw new Error('Trip amount must be greater than zero before billing.');
    }

    const invoice = await createGtInvoice(
      client,
      {
        customer_id: trip.customer_id,
        billing_address: trip.customer_address,
        customer_gstin: trip.customer_gstin,
        invoice_date: invoiceDate,
        booking_date: trip.trip_date,
        duty_type_label: formatDutyTypeLabel(trip.duty_type),
        nature_of_journey: formatDutyTypeLabel(trip.duty_type),
        vehicle_number: trip.vehicle_number,
        vehicle_type_label: trip.vehicle_type_label,
        duty_slip_number: trip.trip_number,
        total_km: toNumber(trip.actual_km),
        total_hours: toNumber(trip.total_hours),
        payment_terms_days: trip.customer_credit_days,
        interest_note: null,
        remarks: remarks ?? `Direct billing for trip ${trip.trip_number}`,
        created_by: req.user?.id ?? null,
      },
      [{
        trip_id: trip.id,
        description: `Duty slip ${trip.trip_number}: ${trip.from_location} to ${trip.to_location}`,
        amount: billedAmount,
      }]
    );

    await client.query('COMMIT');
    res.status(201).json(invoice);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Direct trip billing failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to bill trip.' });
  } finally {
    client.release();
  }
});

router.get('/:id/duty-slip-pdf', authRequired, async (req, res) => {
  try {
    const rawVariant = req.query['variant'];
    if (rawVariant !== undefined && !isDutySlipVariant(rawVariant)) {
      res.status(400).json({ message: 'Invalid duty slip PDF variant.' });
      return;
    }

    const [trip, settings] = await Promise.all([getTripById({ query }, String(req.params.id)), getTripSettings()]);

    if (!trip) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    const variant: DutySlipVariant = rawVariant
      ?? (trip.status === 'completed' ? 'closed_external' : 'open_external');

    if (variant === 'closed_external' && trip.status !== 'completed') {
      res.status(400).json({ message: 'Closed external duty slip is only available for completed trips.' });
      return;
    }

    const pdf = await buildDutySlipPdf({
      trip_number: trip.trip_number,
      trip_date: trip.trip_date,
      status: trip.status,
      duty_type: trip.duty_type,
      from_location: trip.from_location,
      to_location: trip.to_location,
      purpose: trip.purpose,
      customer_name: trip.customer.name,
      customer_code: trip.customer.customer_code,
      customer_address: trip.customer.address ?? null,
      customer_contact_person: trip.customer.contact_person ?? null,
      customer_phone: trip.customer.phone ?? null,
      booked_by: trip.booked_by,
      report_to: trip.report_to,
      driver_name: trip.driver.name,
      driver_code: trip.driver.driver_code,
      driver_phone: trip.driver.phone,
      vehicle_number: trip.vehicle.vehicle_number,
      vehicle_type: trip.vehicle.vehicle_type,
      vehicle_category_name: trip.vehicle_category?.name ?? null,
      rate_chart_name: trip.rate_chart?.name ?? null,
      package_label: trip.rate_chart_item?.package_label ?? null,
      fixed_route_label: trip.rate_chart_fixed_route ? `${trip.rate_chart_fixed_route.from_location} -> ${trip.rate_chart_fixed_route.to_location}` : null,
      total_km: toNumber(trip.actual_km),
      total_hours: toNumber(trip.total_hours),
      night_halts: toNumber(trip.night_halts),
      advance_hirer: Number(trip.advance_hirer || 0),
      advance_travels: Number(trip.advance_travels || 0),
      fuel_advance: Number(trip.fuel_advance || 0),
      cash_advance: Number(trip.cash_advance || 0),
      calculated_amount: toNumber(trip.calculated_amount),
      trip_amount: Number(trip.trip_amount || 0),
      remarks: trip.remarks,
      metrics: trip.metrics.map((metric) => ({
        seq: metric.seq,
        start_date: metric.start_date,
        start_time: metric.start_time,
        start_km: metric.start_km,
        end_date: metric.end_date,
        end_time: metric.end_time,
        end_km: metric.end_km,
        segment_km: metric.segment_km,
        segment_hours: metric.segment_hours,
      })),
      expenses: trip.expenses.map((expense) => ({
        expense_type: expense.expense_type,
        amount: Number(expense.amount || 0),
        description: expense.description,
      })),
      line_items: getStoredBreakdownLineItems(trip),
    }, settings, variant);

    const safeTripNumber = trip.trip_number.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = variant === 'internal'
      ? `${safeTripNumber}-duty-slip-internal.pdf`
      : variant === 'closed_external'
        ? `${safeTripNumber}-duty-slip-external-closed.pdf`
        : `${safeTripNumber}-duty-slip-external-open.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Generating duty slip PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate duty slip PDF.' });
  }
});
router.get('/:id', authRequired, async (req, res) => {
  try {
    const trip = await getTripById({ query }, String(req.params.id));
    if (!trip) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    res.json(trip);
  } catch (error) {
    if (error instanceof TripMetricValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error('Fetching trip detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch trip detail.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const tripId = String(req.params.id);
  const payload = normalizeTripPayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No trip fields supplied for update.' });
    return;
  }

  const validationError = validateTripPayload(payload, false, tripId);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{ status: string }>('SELECT status FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    const update = buildUpdateClause(payload);
    await client.query(`UPDATE trips SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1}`, [...update.values, tripId]);

    if (existing.rows[0].status !== 'completed' && payload.status === 'completed') {
      await generateInvoiceForCompletedTrip(client, tripId, req.user?.id ?? null);
    }

    const trip = await getTripById(client as unknown as Queryable, tripId);
    await client.query('COMMIT');
    res.json(trip);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating trip failed:', error);
    res.status(500).json({ message: getTripSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query<{ id: string }>('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);
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


