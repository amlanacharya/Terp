import { Queryable, RateEngineError, calculateRateFromChart, loadActiveRateChartDetail } from './rate-engine';
import { TripMetricValidationError, TripTravelMetricRecord, aggregateTripTravelMetrics } from './trip-metrics';

interface ParentTripRow {
  id: string;
  trip_number: string;
  customer_id: string;
  route_id: string | null;
  vehicle_id: string;
  driver_id: string;
  trip_date: string;
  parent_trip_id: string | null;
  duty_type: 'local' | 'outstation' | 'drop_pickup' | 'station_drop' | 'long' | null;
  booked_by: string | null;
  report_to: string | null;
  vehicle_category_id: string | null;
  rate_chart_id: string | null;
  rate_chart_item_id: string | null;
  rate_chart_fixed_route_id: string | null;
  from_location: string;
  to_location: string;
  purpose: string | null;
  passengers: number | null;
  status: string;
  driver_allowance: number | string;
  toll_charges: number | string;
  parking_charges: number | string;
  other_charges: number | string;
  remarks: string | null;
  current_package_code: string | null;
}

export interface CreateAnnexureInput {
  parent_trip_id: string;
  annexure_number?: string | null;
  selection_mode: 'metric_rows' | 'date_range';
  metric_ids?: string[];
  start_date?: string;
  end_date?: string;
  force_sync_trip_amount?: boolean;
  created_by: string | null;
}

export interface CreatedAnnexureResult {
  annexure_id: string;
  child_trip_id: string;
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

async function loadParentTrip(db: Queryable, parentTripId: string): Promise<ParentTripRow | null> {
  const result = await db.query<ParentTripRow>(
    `
      SELECT
        t.id,
        t.trip_number,
        t.customer_id,
        t.route_id,
        t.vehicle_id,
        t.driver_id,
        t.trip_date::text,
        t.parent_trip_id,
        t.duty_type,
        t.booked_by,
        t.report_to,
        t.vehicle_category_id,
        t.rate_chart_id,
        t.rate_chart_item_id,
        t.rate_chart_fixed_route_id,
        t.from_location,
        t.to_location,
        t.purpose,
        t.passengers,
        t.status,
        t.driver_allowance::text,
        t.toll_charges::text,
        t.parking_charges::text,
        t.other_charges::text,
        t.remarks,
        rci.package_code AS current_package_code
      FROM trips t
      LEFT JOIN rate_chart_items rci ON rci.id = t.rate_chart_item_id
      WHERE t.id = $1
      LIMIT 1
    `,
    [parentTripId]
  );

  return result.rows[0] ?? null;
}

async function getDefaultAnnexureNumber(db: Queryable, parentTrip: ParentTripRow): Promise<string> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM annexures WHERE parent_trip_id = $1',
    [parentTrip.id]
  );

  const nextIndex = Number(result.rows[0]?.count || 0) + 1;
  return `${parentTrip.trip_number}/ANX-${String(nextIndex).padStart(2, '0')}`;
}

async function loadSelectedMetrics(
  db: Queryable,
  input: CreateAnnexureInput
): Promise<TripTravelMetricRecord[]> {
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
      [input.parent_trip_id, input.metric_ids]
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
    [input.parent_trip_id, input.start_date, input.end_date]
  );

  return result.rows;
}

async function ensureMetricsUnallocated(db: Queryable, metricIds: string[]): Promise<void> {
  const result = await db.query<{ source_metric_id: string }>(
    `
      SELECT source_metric_id
      FROM trip_travel_metrics
      WHERE source_metric_id = ANY($1::uuid[])
      LIMIT 1
    `,
    [metricIds]
  );

  if (result.rows[0]) {
    throw new TripMetricValidationError('ANNEXURE_METRIC_ALREADY_ALLOCATED', 'One or more selected travel metric rows already belong to another annexure.');
  }
}

export async function createAnnexureFromParent(
  db: Queryable,
  input: CreateAnnexureInput
): Promise<CreatedAnnexureResult> {
  const parentTrip = await loadParentTrip(db, input.parent_trip_id);
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

  const annexureNumber = normalizeOptionalText(input.annexure_number) ?? await getDefaultAnnexureNumber(db, parentTrip);
  const childTripDate = selectedMetrics[0].start_date;
  const nightHalts = deriveNightHalts(selectedMetrics);

  const childTripInsert = await db.query<{ id: string }>(
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
      annexureNumber,
      parentTrip.customer_id,
      parentTrip.route_id,
      parentTrip.vehicle_id,
      parentTrip.driver_id,
      childTripDate,
      parentTrip.duty_type,
      parentTrip.booked_by,
      parentTrip.report_to,
      parentTrip.vehicle_category_id,
      parentTrip.rate_chart_id,
      parentTrip.rate_chart_item_id,
      parentTrip.rate_chart_fixed_route_id,
      null,
      null,
      null,
      null,
      null,
      null,
      nightHalts,
      parentTrip.from_location,
      parentTrip.to_location,
      parentTrip.purpose,
      parentTrip.passengers,
      parentTrip.status,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      false,
      parentTrip.id,
      annexureNumber,
      toNumber(parentTrip.driver_allowance),
      toNumber(parentTrip.toll_charges),
      toNumber(parentTrip.parking_charges),
      toNumber(parentTrip.other_charges),
      `Annexure child of ${parentTrip.trip_number}`,
      input.created_by,
    ]
  );

  const childTripId = childTripInsert.rows[0].id;

  for (const metric of selectedMetrics) {
    await db.query(
      `
        INSERT INTO trip_travel_metrics (
          trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km, source_metric_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
      `,
      [
        childTripId,
        metric.seq,
        metric.start_date,
        metric.start_time,
        metric.start_km,
        metric.end_date,
        metric.end_time,
        metric.end_km,
        metric.id,
      ]
    );
  }

  const rateChart = await loadActiveRateChartDetail(parentTrip.customer_id, childTripDate, db);
  if (!rateChart) {
    throw new RateEngineError('RATE_CHART_NOT_FOUND', 'No active rate chart was found for the annexure date.');
  }

  const calculation = calculateRateFromChart(rateChart, {
    customer_id: parentTrip.customer_id,
    trip_date: childTripDate,
    duty_type: parentTrip.duty_type,
    vehicle_category_id: parentTrip.vehicle_category_id,
    package_code: parentTrip.current_package_code,
    from_location: parentTrip.from_location,
    to_location: parentTrip.to_location,
    total_km: aggregation.total_km,
    total_hours: aggregation.total_hours,
    night_halts: nightHalts,
  });

  const finalAmount = roundValue(calculation.totals.final_amount);

  await db.query(
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
        night_halts = $10,
        base_charge = $11,
        extra_km_charge = $12,
        extra_hr_charge = $13,
        fuel_charge = $14,
        night_halt_charge = $15,
        fixed_route_charge = $16,
        ot_charge = $17,
        calculated_amount = $18,
        is_long_trip = $19,
        trip_amount = $20,
        updated_at = now()
      WHERE id = $21
    `,
    [
      calculation.rate_chart_id,
      calculation.rate_chart_item_id,
      calculation.applied_fixed_route_id,
      aggregation.start_time,
      aggregation.end_time,
      aggregation.start_km,
      aggregation.end_km,
      aggregation.total_km,
      aggregation.total_hours,
      nightHalts,
      calculation.totals.base_charge,
      calculation.totals.extra_km_charge,
      calculation.totals.extra_hr_charge,
      calculation.totals.fuel_charge,
      calculation.totals.night_halt_charge,
      calculation.applied_fixed_route_id ? calculation.totals.fixed_amount : 0,
      calculation.totals.ot_charge,
      finalAmount,
      calculation.applied_duty_type === 'long',
      finalAmount,
      childTripId,
    ]
  );

  const annexureInsert = await db.query<{ id: string }>(
    `
      INSERT INTO annexures (
        annexure_number, parent_trip_id, trip_id, start_date, end_date, start_km, end_km,
        total_km, total_hours, night_halts, calculated_amount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11
      )
      RETURNING id
    `,
    [
      annexureNumber,
      parentTrip.id,
      childTripId,
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

  return {
    annexure_id: annexureInsert.rows[0].id,
    child_trip_id: childTripId,
  };
}



