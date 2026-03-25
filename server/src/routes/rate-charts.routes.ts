
import { randomUUID } from 'crypto';
import { Router } from 'express';
import pool from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import {
  DutyType,
  Queryable,
  RateEngineError,
  loadActiveRateChartDetail,
  loadRateChartDetail,
  normalizeLocationKey,
} from '../utils/rate-engine';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  constraint?: string;
  message?: string;
}

interface RateChartRow {
  id: string;
  customer_id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
}

interface RateChartItemRow {
  id: string;
  rate_chart_id: string;
  vehicle_category_id: string;
  duty_type: DutyType;
  package_code: string;
  package_label: string;
  sort_order: number;
  is_default: boolean;
  base_hours: number | string | null;
  base_km: number | string | null;
  base_amount: number | string | null;
  extra_km_rate: number | string | null;
  extra_hr_rate: number | string | null;
  fuel_divisor: number | string | null;
  fuel_price_per_unit: number | string | null;
  night_halt_rate: number | string | null;
  fixed_amount: number | string | null;
  use_higher_of_km_hr: boolean;
  per_km_rate: number | string | null;
  ot_rate: number | string | null;
  long_km_threshold: number | string | null;
  no_km_limit_cap_km: number | string | null;
  long_day_hours: number | string | null;
  long_night_halt_hours: number | string | null;
  notes: string | null;
}

interface RateChartFixedRouteRow {
  id: string;
  rate_chart_id: string;
  vehicle_category_id: string;
  duty_type: DutyType;
  from_location: string;
  to_location: string;
  from_location_key: string;
  to_location_key: string;
  fixed_amount: number | string;
  description: string | null;
}

const router = Router();
const chartFields = [
  'customer_id',
  'name',
  'effective_from',
  'effective_to',
  'is_active',
  'notes',
] as const;
const itemFields = [
  'vehicle_category_id',
  'duty_type',
  'package_code',
  'package_label',
  'sort_order',
  'is_default',
  'base_hours',
  'base_km',
  'base_amount',
  'extra_km_rate',
  'extra_hr_rate',
  'fuel_divisor',
  'fuel_price_per_unit',
  'night_halt_rate',
  'fixed_amount',
  'use_higher_of_km_hr',
  'per_km_rate',
  'ot_rate',
  'long_km_threshold',
  'no_km_limit_cap_km',
  'long_day_hours',
  'long_night_halt_hours',
  'notes',
] as const;
const fixedRouteFields = [
  'vehicle_category_id',
  'duty_type',
  'from_location',
  'to_location',
  'fixed_amount',
  'description',
] as const;
const allowedDutyTypes: DutyType[] = [
  'local',
  'outstation',
  'drop_pickup',
  'station_drop',
  'long',
];
const nonNegativeItemFields = [
  'sort_order',
  'base_hours',
  'base_km',
  'base_amount',
  'extra_km_rate',
  'extra_hr_rate',
  'fuel_price_per_unit',
  'night_halt_rate',
  'fixed_amount',
  'per_km_rate',
  'ot_rate',
  'long_km_threshold',
  'no_km_limit_cap_km',
  'long_day_hours',
  'long_night_halt_hours',
] as const;

function isDutyType(value: unknown): value is DutyType {
  return typeof value === 'string' && allowedDutyTypes.includes(value as DutyType);
}

function isNegativeNumber(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && Number(value) < 0;
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeRequiredText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

function normalizePackageCode(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim().toUpperCase();
}

function getQueryString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseBooleanQuery(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function getRateChartSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23503' && pgError.constraint?.includes('customer')) {
    return 'Selected customer was not found.';
  }

  return 'Unable to save rate chart.';
}

function getRateChartItemSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505' && pgError.constraint === 'idx_rate_chart_items_unique_package') {
    return 'Package code already exists for this chart, vehicle category, and duty type.';
  }

  if (pgError?.code === '23505' && pgError.constraint === 'idx_rate_chart_items_default_per_group') {
    return 'Only one default package is allowed for the same chart, vehicle category, and duty type.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('vehicle_category')) {
    return 'Selected vehicle category was not found.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('rate_chart_id')) {
    return 'Selected rate chart was not found.';
  }

  if (pgError?.message?.includes('idx_rate_chart_items_unique_package')) {
    return 'Package code already exists for this chart, vehicle category, and duty type.';
  }

  if (pgError?.message?.includes('idx_rate_chart_items_default_per_group')) {
    return 'Only one default package is allowed for the same chart, vehicle category, and duty type.';
  }

  return 'Unable to save rate chart item.';
}

function getRateChartFixedRouteSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505' && pgError.constraint === 'idx_rate_chart_fixed_routes_unique') {
    return 'A fixed route for the same chart, vehicle category, duty type, and route already exists.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('vehicle_category')) {
    return 'Selected vehicle category was not found.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('rate_chart_id')) {
    return 'Selected rate chart was not found.';
  }

  if (pgError?.message?.includes('idx_rate_chart_fixed_routes_unique')) {
    return 'A fixed route for the same chart, vehicle category, duty type, and route already exists.';
  }

  return 'Unable to save fixed route.';
}

function normalizeChartPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, chartFields);

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    payload.name = normalizeRequiredText(payload.name);
  }

  if (payload.effective_to === '') {
    payload.effective_to = null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    payload.notes = normalizeOptionalText(payload.notes) ?? null;
  }

  return payload;
}

function validateChartPayload(payload: Record<string, unknown>, requireAllFields: boolean): string | null {
  if (requireAllFields) {
    if (!payload.customer_id || typeof payload.customer_id !== 'string') {
      return 'Customer is required.';
    }

    if (!payload.name || typeof payload.name !== 'string') {
      return 'Chart name is required.';
    }

    if (!payload.effective_from || typeof payload.effective_from !== 'string') {
      return 'Effective from date is required.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name') && (!payload.name || typeof payload.name !== 'string')) {
    return 'Chart name cannot be empty.';
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'effective_to') &&
    payload.effective_to !== null &&
    typeof payload.effective_to !== 'string'
  ) {
    return 'Effective to date must be empty or a valid date string.';
  }

  return null;
}

function normalizeItemPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, itemFields);

  if (Object.prototype.hasOwnProperty.call(payload, 'package_code')) {
    payload.package_code = normalizePackageCode(payload.package_code);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'package_label')) {
    payload.package_label = normalizeRequiredText(payload.package_label);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    payload.notes = normalizeOptionalText(payload.notes) ?? null;
  }

  return payload;
}

function validateItemPayload(payload: Record<string, unknown>, requireAllFields: boolean): string | null {
  if (requireAllFields) {
    if (!payload.vehicle_category_id || typeof payload.vehicle_category_id !== 'string') {
      return 'Vehicle category is required.';
    }

    if (!isDutyType(payload.duty_type)) {
      return 'Duty type is required.';
    }

    if (!payload.package_code || typeof payload.package_code !== 'string') {
      return 'Package code is required.';
    }

    if (!payload.package_label || typeof payload.package_label !== 'string') {
      return 'Package label is required.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'duty_type') && !isDutyType(payload.duty_type)) {
    return 'Invalid duty type.';
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'package_code') &&
    (!payload.package_code || typeof payload.package_code !== 'string')
  ) {
    return 'Package code cannot be empty.';
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'package_label') &&
    (!payload.package_label || typeof payload.package_label !== 'string')
  ) {
    return 'Package label cannot be empty.';
  }

  for (const field of nonNegativeItemFields) {
    if (isNegativeNumber(payload[field])) {
      return `${field.replace(/_/g, ' ')} cannot be negative.`;
    }
  }

  if (payload.fuel_divisor !== undefined && payload.fuel_divisor !== null && payload.fuel_divisor !== '' && Number(payload.fuel_divisor) <= 0) {
    return 'Fuel divisor must be greater than zero.';
  }

  const hasFuelDivisor = payload.fuel_divisor !== undefined && payload.fuel_divisor !== null && payload.fuel_divisor !== '';
  const hasFuelPrice = payload.fuel_price_per_unit !== undefined && payload.fuel_price_per_unit !== null && payload.fuel_price_per_unit !== '';
  if (hasFuelDivisor !== hasFuelPrice) {
    return 'Fuel divisor and fuel price per unit must be configured together.';
  }

  if (
    payload.use_higher_of_km_hr === true &&
    !payload.extra_km_rate &&
    !payload.extra_hr_rate
  ) {
    return 'Higher-of KM/HR requires at least one extra rate.';
  }

  return null;
}

function normalizeFixedRoutePayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, fixedRouteFields);

  if (Object.prototype.hasOwnProperty.call(payload, 'from_location')) {
    payload.from_location = normalizeRequiredText(payload.from_location);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'to_location')) {
    payload.to_location = normalizeRequiredText(payload.to_location);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    payload.description = normalizeOptionalText(payload.description) ?? null;
  }

  return payload;
}

function validateFixedRoutePayload(payload: Record<string, unknown>, requireAllFields: boolean): string | null {
  if (requireAllFields) {
    if (!payload.vehicle_category_id || typeof payload.vehicle_category_id !== 'string') {
      return 'Vehicle category is required.';
    }

    if (!isDutyType(payload.duty_type)) {
      return 'Duty type is required.';
    }

    if (!payload.from_location || typeof payload.from_location !== 'string') {
      return 'From location is required.';
    }

    if (!payload.to_location || typeof payload.to_location !== 'string') {
      return 'To location is required.';
    }

    if (payload.fixed_amount === undefined || payload.fixed_amount === null || payload.fixed_amount === '') {
      return 'Fixed amount is required.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'duty_type') && !isDutyType(payload.duty_type)) {
    return 'Invalid duty type.';
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'from_location') &&
    (!payload.from_location || typeof payload.from_location !== 'string')
  ) {
    return 'From location cannot be empty.';
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'to_location') &&
    (!payload.to_location || typeof payload.to_location !== 'string')
  ) {
    return 'To location cannot be empty.';
  }

  if (
    payload.fixed_amount !== undefined &&
    payload.fixed_amount !== null &&
    payload.fixed_amount !== '' &&
    Number(payload.fixed_amount) <= 0
  ) {
    return 'Fixed amount must be greater than zero.';
  }

  return null;
}

function buildFixedRoutePersistencePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nextPayload = { ...payload };

  if (typeof nextPayload.from_location === 'string') {
    nextPayload.from_location_key = normalizeLocationKey(nextPayload.from_location);
  }

  if (typeof nextPayload.to_location === 'string') {
    nextPayload.to_location_key = normalizeLocationKey(nextPayload.to_location);
  }

  return nextPayload;
}

async function ensureNoOverlappingActiveChart(
  db: Queryable,
  params: {
    customer_id: string;
    effective_from: string;
    effective_to: string | null;
    is_active: boolean;
    exclude_id?: string;
  }
) {
  if (!params.is_active) {
    return;
  }

  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM rate_charts
      WHERE customer_id = $1
        AND is_active = 1
        AND ($2 IS NULL OR id <> $2)
        AND effective_from <= COALESCE($4, '9999-12-31')
        AND COALESCE(effective_to, '9999-12-31') >= $3
      LIMIT 1
    `,
    [
      params.customer_id,
      params.exclude_id ?? null,
      params.effective_from,
      params.effective_to,
    ]
  );

  if (result.rows[0]) {
    throw new Error('ACTIVE_CHART_OVERLAP');
  }
}

async function clearDefaultItem(
  db: Queryable,
  rateChartId: string,
  vehicleCategoryId: string,
  dutyType: DutyType,
  excludeItemId?: string
) {
  await db.query(
    `
      UPDATE rate_chart_items
      SET is_default = false, updated_at = now()
      WHERE rate_chart_id = $1
        AND vehicle_category_id = $2
        AND duty_type = $3
        AND ($4 IS NULL OR id <> $4)
    `,
    [rateChartId, vehicleCategoryId, dutyType, excludeItemId ?? null]
  );
}

router.get('/customers/:customerId/rate-chart', authRequired, async (req, res) => {
  const customerId = String(req.params.customerId);
  const date = getQueryString(req.query.date) ?? new Date().toISOString().slice(0, 10);

  try {
    const rateChart = await loadActiveRateChartDetail(customerId, date);

    if (!rateChart) {
      res.status(404).json({ message: 'No active rate chart found for this customer and date.' });
      return;
    }

    res.json(rateChart);
  } catch (error) {
    if (error instanceof RateEngineError && error.code === 'RATE_CHART_CONFLICT') {
      res.status(409).json({ message: error.message });
      return;
    }

    console.error('Fetching customer rate chart failed:', error);
    res.status(500).json({ message: 'Unable to fetch rate chart.' });
  }
});

router.get('/rate-charts', authRequired, async (req, res) => {
  const customerId = getQueryString(req.query.customer_id);
  const activeFilterRaw = getQueryString(req.query.active);
  const dateFilter = getQueryString(req.query.date);
  const activeFilter = parseBooleanQuery(activeFilterRaw);

  if (activeFilterRaw !== null && activeFilter === null) {
    res.status(400).json({ message: 'Active filter must be true or false.' });
    return;
  }

  try {
    const whereClauses: string[] = [];
    const values: unknown[] = [];

    if (customerId) {
      values.push(customerId);
      whereClauses.push(`rc.customer_id = $${values.length}`);
    }

    if (activeFilter !== null) {
      values.push(activeFilter);
      whereClauses.push(`rc.is_active = $${values.length}`);
    }

    if (dateFilter) {
      values.push(dateFilter);
      whereClauses.push(`rc.effective_from <= $${values.length}`);
      whereClauses.push(`(rc.effective_to IS NULL OR rc.effective_to >= $${values.length})`);
    }

    const result = await pool.query(
      `
        SELECT
          rc.*,
          json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
          COALESCE(item_counts.item_count, 0) AS item_count,
          COALESCE(route_counts.fixed_route_count, 0) AS fixed_route_count
        FROM rate_charts rc
        INNER JOIN customers c ON c.id = rc.customer_id
        LEFT JOIN (
          SELECT rate_chart_id, COUNT(*) AS item_count
          FROM rate_chart_items
          GROUP BY rate_chart_id
        ) item_counts ON item_counts.rate_chart_id = rc.id
        LEFT JOIN (
          SELECT rate_chart_id, COUNT(*) AS fixed_route_count
          FROM rate_chart_fixed_routes
          GROUP BY rate_chart_id
        ) route_counts ON route_counts.rate_chart_id = rc.id
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY LOWER(c.name), rc.effective_from DESC, LOWER(rc.name)
      `,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching rate charts failed:', error);
    res.status(500).json({ message: 'Unable to fetch rate charts.' });
  }
});

router.get('/rate-charts/:id', authRequired, async (req, res) => {
  try {
    const rateChart = await loadRateChartDetail(String(req.params.id));

    if (!rateChart) {
      res.status(404).json({ message: 'Rate chart not found.' });
      return;
    }

    res.json(rateChart);
  } catch (error) {
    console.error('Fetching rate chart failed:', error);
    res.status(500).json({ message: 'Unable to fetch rate chart.' });
  }
});
router.post('/rate-charts', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = normalizeChartPayload(req.body as Record<string, unknown>);
  const validationError = validateChartPayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  if (
    payload.effective_to !== null &&
    typeof payload.effective_from === 'string' &&
    typeof payload.effective_to === 'string' &&
    payload.effective_to < payload.effective_from
  ) {
    res.status(400).json({ message: 'Effective to date cannot be earlier than effective from date.' });
    return;
  }

  try {
    const rateChartId = randomUUID();

    await ensureNoOverlappingActiveChart(pool, {
      customer_id: String(payload.customer_id),
      effective_from: String(payload.effective_from),
      effective_to: (payload.effective_to as string | null | undefined) ?? null,
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
    });

    await pool.query(
      `
        INSERT INTO rate_charts (
          id, customer_id, name, effective_from, effective_to, is_active, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        rateChartId,
        payload.customer_id,
        payload.name,
        payload.effective_from,
        payload.effective_to ?? null,
        payload.is_active ?? true,
        payload.notes ?? null,
        req.user?.id ?? null,
      ]
    );

    const rateChart = await loadRateChartDetail(rateChartId);
    res.status(201).json(rateChart);
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_CHART_OVERLAP') {
      res.status(409).json({ message: 'An overlapping active rate chart already exists for this customer.' });
      return;
    }

    console.error('Creating rate chart failed:', error);
    res.status(500).json({ message: getRateChartSaveErrorMessage(error) });
  }
});

router.put('/rate-charts/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const rateChartId = String(req.params.id);
  const payload = normalizeChartPayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No rate chart fields supplied for update.' });
    return;
  }

  const validationError = validateChartPayload(payload, false);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<RateChartRow>(
      'SELECT * FROM rate_charts WHERE id = $1',
      [rateChartId]
    );
    const existingChart = existingResult.rows[0];

    if (!existingChart) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Rate chart not found.' });
      return;
    }

    const mergedChart = {
      ...existingChart,
      ...payload,
      effective_to: Object.prototype.hasOwnProperty.call(payload, 'effective_to')
        ? ((payload.effective_to as string | null | undefined) ?? null)
        : existingChart.effective_to,
    };

    if (
      mergedChart.effective_to !== null &&
      mergedChart.effective_to < mergedChart.effective_from
    ) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Effective to date cannot be earlier than effective from date.' });
      return;
    }

    await ensureNoOverlappingActiveChart(client as unknown as Queryable, {
      customer_id: mergedChart.customer_id,
      effective_from: mergedChart.effective_from,
      effective_to: mergedChart.effective_to,
      is_active: mergedChart.is_active,
      exclude_id: rateChartId,
    });

    const update = buildUpdateClause(payload);
    await client.query(
      `UPDATE rate_charts SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1}`,
      [...update.values, rateChartId]
    );

    const rateChart = await loadRateChartDetail(rateChartId, client as unknown as Queryable);
    await client.query('COMMIT');

    res.json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof Error && error.message === 'ACTIVE_CHART_OVERLAP') {
      res.status(409).json({ message: 'An overlapping active rate chart already exists for this customer.' });
      return;
    }

    console.error('Updating rate chart failed:', error);
    res.status(500).json({ message: getRateChartSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/rate-charts/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM rate_charts WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Rate chart not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting rate chart failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('rate chart', error) });
  }
});

router.post('/rate-charts/:id/items', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const rateChartId = String(req.params.id);
  const payload = normalizeItemPayload(req.body as Record<string, unknown>);
  const validationError = validateItemPayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const itemId = randomUUID();

    const chartResult = await client.query<{ id: string }>('SELECT id FROM rate_charts WHERE id = $1', [rateChartId]);
    if (!chartResult.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Rate chart not found.' });
      return;
    }

    if (payload.is_default === true) {
      await clearDefaultItem(
        client as unknown as Queryable,
        rateChartId,
        String(payload.vehicle_category_id),
        payload.duty_type as DutyType
      );
    }

    await client.query(
      `
        INSERT INTO rate_chart_items (
          id, rate_chart_id, vehicle_category_id, duty_type, package_code, package_label,
          sort_order, is_default, base_hours, base_km, base_amount, extra_km_rate,
          extra_hr_rate, fuel_divisor, fuel_price_per_unit, night_halt_rate, fixed_amount,
          use_higher_of_km_hr, per_km_rate, ot_rate, long_km_threshold, no_km_limit_cap_km,
          long_day_hours, long_night_halt_hours, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22,
          $23, $24, $25
        )
      `,
      [
        itemId,
        rateChartId,
        payload.vehicle_category_id,
        payload.duty_type,
        payload.package_code,
        payload.package_label,
        payload.sort_order ?? 0,
        payload.is_default ?? false,
        payload.base_hours ?? null,
        payload.base_km ?? null,
        payload.base_amount ?? null,
        payload.extra_km_rate ?? null,
        payload.extra_hr_rate ?? null,
        payload.fuel_divisor ?? null,
        payload.fuel_price_per_unit ?? null,
        payload.night_halt_rate ?? null,
        payload.fixed_amount ?? null,
        payload.use_higher_of_km_hr ?? false,
        payload.per_km_rate ?? null,
        payload.ot_rate ?? null,
        payload.long_km_threshold ?? null,
        payload.no_km_limit_cap_km ?? null,
        payload.long_day_hours ?? null,
        payload.long_night_halt_hours ?? null,
        payload.notes ?? null,
      ]
    );

    const rateChart = await loadRateChartDetail(rateChartId, client as unknown as Queryable);
    await client.query('COMMIT');

    res.status(201).json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating rate chart item failed:', error);
    res.status(500).json({ message: getRateChartItemSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.put('/rate-chart-items/:itemId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const itemId = String(req.params.itemId);
  const payload = normalizeItemPayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No rate chart item fields supplied for update.' });
    return;
  }

  const validationError = validateItemPayload(payload, false);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<RateChartItemRow>(
      'SELECT * FROM rate_chart_items WHERE id = $1',
      [itemId]
    );
    const existingItem = existingResult.rows[0];

    if (!existingItem) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Rate chart item not found.' });
      return;
    }

    const mergedItem = {
      ...existingItem,
      ...payload,
      notes: Object.prototype.hasOwnProperty.call(payload, 'notes')
        ? ((payload.notes as string | null | undefined) ?? null)
        : existingItem.notes,
    };

    const mergedValidationError = validateItemPayload(mergedItem, true);
    if (mergedValidationError) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: mergedValidationError });
      return;
    }

    if (mergedItem.is_default) {
      await clearDefaultItem(
        client as unknown as Queryable,
        existingItem.rate_chart_id,
        String(mergedItem.vehicle_category_id),
        mergedItem.duty_type,
        itemId
      );
    }

    const update = buildUpdateClause(payload);
    await client.query(
      `UPDATE rate_chart_items SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1}`,
      [...update.values, itemId]
    );

    const rateChart = await loadRateChartDetail(
      existingItem.rate_chart_id,
      client as unknown as Queryable
    );
    await client.query('COMMIT');

    res.json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating rate chart item failed:', error);
    res.status(500).json({ message: getRateChartItemSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/rate-chart-items/:itemId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const itemId = String(req.params.itemId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<{ rate_chart_id: string }>(
      'SELECT rate_chart_id FROM rate_chart_items WHERE id = $1',
      [itemId]
    );
    const existingItem = existingResult.rows[0];

    if (!existingItem) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Rate chart item not found.' });
      return;
    }

    await client.query('DELETE FROM rate_chart_items WHERE id = $1', [itemId]);
    const rateChart = await loadRateChartDetail(
      existingItem.rate_chart_id,
      client as unknown as Queryable
    );
    await client.query('COMMIT');

    res.json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deleting rate chart item failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('rate chart item', error) });
  } finally {
    client.release();
  }
});
router.post('/rate-charts/:id/fixed-routes', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const rateChartId = String(req.params.id);
  const payload = buildFixedRoutePersistencePayload(
    normalizeFixedRoutePayload(req.body as Record<string, unknown>)
  );
  const validationError = validateFixedRoutePayload(payload, true);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const routeId = randomUUID();

    const chartResult = await client.query<{ id: string }>('SELECT id FROM rate_charts WHERE id = $1', [rateChartId]);
    if (!chartResult.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Rate chart not found.' });
      return;
    }

    await client.query(
      `
        INSERT INTO rate_chart_fixed_routes (
          id, rate_chart_id, vehicle_category_id, duty_type, from_location, to_location,
          from_location_key, to_location_key, fixed_amount, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        routeId,
        rateChartId,
        payload.vehicle_category_id,
        payload.duty_type,
        payload.from_location,
        payload.to_location,
        payload.from_location_key,
        payload.to_location_key,
        payload.fixed_amount,
        payload.description ?? null,
      ]
    );

    const rateChart = await loadRateChartDetail(rateChartId, client as unknown as Queryable);
    await client.query('COMMIT');

    res.status(201).json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating fixed route failed:', error);
    res.status(500).json({ message: getRateChartFixedRouteSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.put('/rate-chart-fixed-routes/:routeId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const routeId = String(req.params.routeId);
  const payload = normalizeFixedRoutePayload(req.body as Record<string, unknown>);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No fixed route fields supplied for update.' });
    return;
  }

  const validationError = validateFixedRoutePayload(payload, false);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<RateChartFixedRouteRow>(
      'SELECT * FROM rate_chart_fixed_routes WHERE id = $1',
      [routeId]
    );
    const existingRoute = existingResult.rows[0];

    if (!existingRoute) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Fixed route not found.' });
      return;
    }

    const mergedRoute = buildFixedRoutePersistencePayload({
      ...existingRoute,
      ...payload,
      description: Object.prototype.hasOwnProperty.call(payload, 'description')
        ? ((payload.description as string | null | undefined) ?? null)
        : existingRoute.description,
    });

    const mergedValidationError = validateFixedRoutePayload(mergedRoute, true);
    if (mergedValidationError) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: mergedValidationError });
      return;
    }

    const update = buildUpdateClause({
      ...payload,
      from_location_key: mergedRoute.from_location_key,
      to_location_key: mergedRoute.to_location_key,
    });
    await client.query(
      `UPDATE rate_chart_fixed_routes SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1}`,
      [...update.values, routeId]
    );

    const rateChart = await loadRateChartDetail(
      existingRoute.rate_chart_id,
      client as unknown as Queryable
    );
    await client.query('COMMIT');

    res.json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating fixed route failed:', error);
    res.status(500).json({ message: getRateChartFixedRouteSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/rate-chart-fixed-routes/:routeId', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const routeId = String(req.params.routeId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query<{ rate_chart_id: string }>(
      'SELECT rate_chart_id FROM rate_chart_fixed_routes WHERE id = $1',
      [routeId]
    );
    const existingRoute = existingResult.rows[0];

    if (!existingRoute) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Fixed route not found.' });
      return;
    }

    await client.query('DELETE FROM rate_chart_fixed_routes WHERE id = $1', [routeId]);
    const rateChart = await loadRateChartDetail(
      existingRoute.rate_chart_id,
      client as unknown as Queryable
    );
    await client.query('COMMIT');

    res.json(rateChart);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deleting fixed route failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('fixed route', error) });
  } finally {
    client.release();
  }
});
router.post('/rate-charts/:id/duplicate', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const sourceRateChartId = String(req.params.id);
  const payload = normalizeChartPayload(req.body as Record<string, unknown>);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sourceResult = await client.query<RateChartRow>(
      'SELECT * FROM rate_charts WHERE id = $1',
      [sourceRateChartId]
    );
    const sourceRateChart = sourceResult.rows[0];

    if (!sourceRateChart) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Source rate chart not found.' });
      return;
    }

    const nextRateChart = {
      customer_id: (payload.customer_id as string | undefined) ?? sourceRateChart.customer_id,
      name: (payload.name as string | undefined) ?? `${sourceRateChart.name} Copy`,
      effective_from:
        (payload.effective_from as string | undefined) ?? sourceRateChart.effective_from,
      effective_to: Object.prototype.hasOwnProperty.call(payload, 'effective_to')
        ? ((payload.effective_to as string | null | undefined) ?? null)
        : sourceRateChart.effective_to,
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : false,
      notes: Object.prototype.hasOwnProperty.call(payload, 'notes')
        ? ((payload.notes as string | null | undefined) ?? null)
        : sourceRateChart.notes,
    };

    const validationError = validateChartPayload(nextRateChart, true);
    if (validationError) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: validationError });
      return;
    }

    if (
      nextRateChart.effective_to !== null &&
      nextRateChart.effective_to < nextRateChart.effective_from
    ) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Effective to date cannot be earlier than effective from date.' });
      return;
    }

    await ensureNoOverlappingActiveChart(client as unknown as Queryable, nextRateChart);

    const duplicatedRateChartId = randomUUID();
    await client.query(
      `
        INSERT INTO rate_charts (
          id, customer_id, name, effective_from, effective_to, is_active, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        duplicatedRateChartId,
        nextRateChart.customer_id,
        nextRateChart.name,
        nextRateChart.effective_from,
        nextRateChart.effective_to,
        nextRateChart.is_active,
        nextRateChart.notes,
        req.user?.id ?? null,
      ]
    );

    const sourceItemsResult = await client.query<Omit<RateChartItemRow, 'rate_chart_id'>>(
      `
        SELECT
          vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
          base_hours, base_km, base_amount, extra_km_rate, extra_hr_rate, fuel_divisor,
          fuel_price_per_unit, night_halt_rate, fixed_amount, use_higher_of_km_hr, per_km_rate,
          ot_rate, long_km_threshold, no_km_limit_cap_km, long_day_hours, long_night_halt_hours, notes
        FROM rate_chart_items
        WHERE rate_chart_id = $1
      `,
      [sourceRateChartId]
    );

    for (const item of sourceItemsResult.rows) {
      await client.query(
        `
          INSERT INTO rate_chart_items (
            id, rate_chart_id, vehicle_category_id, duty_type, package_code, package_label,
            sort_order, is_default, base_hours, base_km, base_amount, extra_km_rate,
            extra_hr_rate, fuel_divisor, fuel_price_per_unit, night_halt_rate, fixed_amount,
            use_higher_of_km_hr, per_km_rate, ot_rate, long_km_threshold, no_km_limit_cap_km,
            long_day_hours, long_night_halt_hours, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25
          )
        `,
        [
          randomUUID(),
          duplicatedRateChartId,
          item.vehicle_category_id,
          item.duty_type,
          item.package_code,
          item.package_label,
          item.sort_order,
          item.is_default,
          item.base_hours,
          item.base_km,
          item.base_amount,
          item.extra_km_rate,
          item.extra_hr_rate,
          item.fuel_divisor,
          item.fuel_price_per_unit,
          item.night_halt_rate,
          item.fixed_amount,
          item.use_higher_of_km_hr,
          item.per_km_rate,
          item.ot_rate,
          item.long_km_threshold,
          item.no_km_limit_cap_km,
          item.long_day_hours,
          item.long_night_halt_hours,
          item.notes,
        ]
      );
    }

    const sourceRoutesResult = await client.query<Omit<RateChartFixedRouteRow, 'rate_chart_id'>>(
      `
        SELECT
          vehicle_category_id, duty_type, from_location, to_location, from_location_key,
          to_location_key, fixed_amount, description
        FROM rate_chart_fixed_routes
        WHERE rate_chart_id = $1
      `,
      [sourceRateChartId]
    );

    for (const route of sourceRoutesResult.rows) {
      await client.query(
        `
          INSERT INTO rate_chart_fixed_routes (
            id, rate_chart_id, vehicle_category_id, duty_type, from_location, to_location,
            from_location_key, to_location_key, fixed_amount, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          randomUUID(),
          duplicatedRateChartId,
          route.vehicle_category_id,
          route.duty_type,
          route.from_location,
          route.to_location,
          route.from_location_key,
          route.to_location_key,
          route.fixed_amount,
          route.description,
        ]
      );
    }

    const duplicatedRateChart = await loadRateChartDetail(
      duplicatedRateChartId,
      client as unknown as Queryable
    );
    await client.query('COMMIT');

    res.status(201).json(duplicatedRateChart);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof Error && error.message === 'ACTIVE_CHART_OVERLAP') {
      res.status(409).json({ message: 'An overlapping active rate chart already exists for this customer.' });
      return;
    }

    console.error('Duplicating rate chart failed:', error);
    res.status(500).json({ message: getRateChartSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

export default router;
