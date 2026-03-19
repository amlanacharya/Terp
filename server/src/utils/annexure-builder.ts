import { Queryable, RateEngineError, calculateRateFromChart, loadActiveRateChartDetail } from './rate-engine';
import { TripMetricValidationError, TripTravelMetricRecord, aggregateTripTravelMetrics } from './trip-metrics';

interface ParentTripRow {
  id: string;
  trip_number: string;
  customer_id: string;
  trip_date: string;
  parent_trip_id: string | null;
  duty_type: 'local' | 'outstation' | 'drop_pickup' | 'station_drop' | 'long' | null;
  vehicle_category_id: string | null;
  vehicle_id: string;
  from_location: string;
  to_location: string;
  current_package_code: string | null;
}

export interface CreateAnnexureInput {
  trip_id: string;
  annexure_number?: string | null;
  selection_mode: 'metric_rows' | 'date_range';
  metric_ids?: string[];
  start_date?: string;
  end_date?: string;
}

export interface CreatedAnnexureResult {
  annexure_id: string;
}

function toNumber(value: number | string | null | undefined): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundValue(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function getDateDiffInDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

export function deriveNightHalts(metrics: TripTravelMetricRecord[]): number {
  if (metrics.length === 0) {
    return 0;
  }

  const firstDate = metrics[0].start_date;
  const lastDate = metrics[metrics.length - 1].end_date ?? metrics[metrics.length - 1].start_date;
  return Math.max(0, getDateDiffInDays(firstDate, lastDate));
}

async function loadParentTrip(db: Queryable, tripId: string): Promise<ParentTripRow | null> {
  const result = await db.query<ParentTripRow>(
    `
      SELECT
        t.id,
        t.trip_number,
        t.customer_id,
        t.trip_date::text,
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
    [tripId]
  );

  return result.rows[0] ?? null;
}

async function getDefaultAnnexureNumber(db: Queryable, parentTrip: ParentTripRow): Promise<string> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM annexures WHERE trip_id = $1',
    [parentTrip.id]
  );

  const nextIndex = Number(result.rows[0]?.count || 0) + 1;
  return `${parentTrip.trip_number}/ANX-${String(nextIndex).padStart(2, '0')}`;
}

async function loadSelectedMetrics(db: Queryable, input: CreateAnnexureInput): Promise<TripTravelMetricRecord[]> {
  if (input.selection_mode === 'metric_rows') {
    if (!input.metric_ids?.length) {
      throw new TripMetricValidationError('ANNEXURE_METRICS_REQUIRED', 'Select at least one travel metric row.');
    }

    const result = await db.query<TripTravelMetricRecord>(
      `
        SELECT id, trip_id, seq, start_date::text, start_time::text, start_km, end_date::text, end_time::text, end_km
        FROM trip_travel_metrics
        WHERE trip_id = $1 AND id = ANY($2::uuid[])
        ORDER BY seq ASC, created_at ASC
      `,
      [input.trip_id, input.metric_ids]
    );

    return result.rows;
  }

  if (!input.start_date || !input.end_date) {
    throw new TripMetricValidationError('ANNEXURE_DATE_RANGE_REQUIRED', 'Start date and end date are required for date-range annexures.');
  }

  const result = await db.query<TripTravelMetricRecord>(
    `
      SELECT id, trip_id, seq, start_date::text, start_time::text, start_km, end_date::text, end_time::text, end_km
      FROM trip_travel_metrics
      WHERE trip_id = $1
        AND start_date >= $2
        AND COALESCE(end_date, start_date) <= $3
      ORDER BY seq ASC, created_at ASC
    `,
    [input.trip_id, input.start_date, input.end_date]
  );

  return result.rows;
}

async function ensureMetricsUnallocated(db: Queryable, metricIds: string[]): Promise<void> {
  const result = await db.query<{ metric_id: string }>(
    `
      SELECT metric_id
      FROM annexure_metrics
      WHERE metric_id = ANY($1::uuid[])
      LIMIT 1
    `,
    [metricIds]
  );

  if (result.rows[0]) {
    throw new TripMetricValidationError('ANNEXURE_METRIC_ALREADY_ALLOCATED', 'One or more selected travel metric rows already belong to another annexure.');
  }
}

export async function createAnnexureFromParent(db: Queryable, input: CreateAnnexureInput): Promise<CreatedAnnexureResult> {
  const parentTrip = await loadParentTrip(db, input.trip_id);
  if (!parentTrip) {
    throw new Error('Parent trip not found.');
  }
  if (parentTrip.parent_trip_id) {
    throw new Error('Annexures can only be created from parent trips.');
  }
  if (parentTrip.duty_type === null || !parentTrip.vehicle_category_id) {
    throw new Error('Parent trip requires duty type and GT vehicle category before annexure creation.');
  }

  const selectedMetrics = await loadSelectedMetrics(db, input);
  if (selectedMetrics.length === 0) {
    throw new TripMetricValidationError('ANNEXURE_METRICS_REQUIRED', 'Select at least one travel metric row.');
  }

  await ensureMetricsUnallocated(db, selectedMetrics.map((metric) => metric.id));

  const aggregation = aggregateTripTravelMetrics(selectedMetrics);
  if (aggregation.has_incomplete_rows) {
    throw new TripMetricValidationError('ANNEXURE_INCOMPLETE_METRICS', 'All selected travel metric rows must be completed before annexure creation.');
  }

  const rateChart = await loadActiveRateChartDetail(parentTrip.customer_id, selectedMetrics[0].start_date, db);
  if (!rateChart) {
    throw new RateEngineError('RATE_CHART_NOT_FOUND', 'No active rate chart was found for the annexure date.');
  }

  const nightHalts = deriveNightHalts(selectedMetrics);
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

  const annexureNumber = normalizeOptionalText(input.annexure_number) ?? await getDefaultAnnexureNumber(db, parentTrip);
  const finalAmount = roundValue(calculation.totals.final_amount);
  const annexureInsert = await db.query<{ id: string }>(
    `
      INSERT INTO annexures (
        annexure_number, trip_id, start_date, end_date, start_km, end_km,
        total_km, total_hours, night_halts, calculated_amount
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      RETURNING id
    `,
    [
      annexureNumber,
      parentTrip.id,
      selectedMetrics[0].start_date,
      selectedMetrics[selectedMetrics.length - 1].end_date ?? selectedMetrics[selectedMetrics.length - 1].start_date,
      toNumber(selectedMetrics[0].start_km),
      toNumber(selectedMetrics[selectedMetrics.length - 1].end_km ?? selectedMetrics[selectedMetrics.length - 1].start_km),
      aggregation.total_km,
      aggregation.total_hours,
      nightHalts,
      finalAmount,
    ]
  );

  const annexureId = annexureInsert.rows[0].id;
  for (const metric of selectedMetrics) {
    await db.query(
      `
        INSERT INTO annexure_metrics (annexure_id, metric_id, seq)
        VALUES ($1, $2, $3)
      `,
      [annexureId, metric.id, metric.seq]
    );
  }

  return { annexure_id: annexureId };
}
