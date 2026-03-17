import { QueryResultRow } from 'pg';
import { query } from '../config/db';

export type DutyType = 'local' | 'outstation' | 'drop_pickup' | 'station_drop' | 'long';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

export interface RateChartCustomerSummary {
  id: string;
  name: string;
  customer_code: string;
}

export interface RateChartVehicleCategorySummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface RateChartItemRecord {
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
  created_at: string;
  updated_at: string;
  vehicle_category: RateChartVehicleCategorySummary;
}

export interface RateChartFixedRouteRecord {
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
  created_at: string;
  updated_at: string;
  vehicle_category: RateChartVehicleCategorySummary;
}

export interface RateChartDetail {
  id: string;
  customer_id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer: RateChartCustomerSummary;
  items: RateChartItemRecord[];
  fixed_routes: RateChartFixedRouteRecord[];
}

export interface RateCalculationInput {
  customer_id: string;
  trip_date: string;
  duty_type: DutyType;
  vehicle_category_id: string;
  package_code?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  total_km: number;
  total_hours: number;
  night_halts?: number;
}

export interface RateCalculationLineItem {
  code: string;
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface RateCalculationResult {
  rate_chart_id: string;
  rate_chart_item_id: string | null;
  package_code: string | null;
  package_label: string | null;
  requested_duty_type: DutyType;
  applied_duty_type: DutyType;
  applied_fixed_route_id: string | null;
  is_long_trip: boolean;
  line_items: RateCalculationLineItem[];
  totals: {
    base_charge: number;
    extra_km_charge: number;
    extra_hr_charge: number;
    fuel_charge: number;
    night_halt_charge: number;
    ot_charge: number;
    fixed_amount: number;
    final_amount: number;
  };
  warnings: string[];
}

const defaultDb: Queryable = { query };

export class RateEngineError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RateEngineError';
  }
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function pushLineItem(
  lineItems: RateCalculationLineItem[],
  code: string,
  label: string,
  amount: number,
  meta?: Record<string, unknown>
) {
  const roundedAmount = roundMoney(amount);
  if (roundedAmount === 0) {
    return;
  }

  lineItems.push({ code, label, amount: roundedAmount, meta });
}

function selectRateChartItem(
  items: RateChartItemRecord[],
  packageCode?: string | null
): RateChartItemRecord {
  const trimmedPackageCode = packageCode?.trim();

  if (trimmedPackageCode) {
    const matchedItem = items.find((item) => item.package_code === trimmedPackageCode);
    if (!matchedItem) {
      throw new RateEngineError('RATE_ITEM_NOT_FOUND', `Package ${trimmedPackageCode} was not found.`);
    }

    return matchedItem;
  }

  if (items.length === 1) {
    return items[0];
  }

  throw new RateEngineError(
    'PACKAGE_SELECTION_REQUIRED',
    'Multiple packages exist for this duty type. Package selection is required.'
  );
}

function resolveLongFallbackItem(
  items: RateChartItemRecord[],
  vehicleCategoryId: string
): RateChartItemRecord | null {
  const longItems = items.filter(
    (item) => item.vehicle_category_id === vehicleCategoryId && item.duty_type === 'long'
  );

  if (longItems.length === 0) {
    return null;
  }

  const defaultItem = longItems.find((item) => item.is_default);
  if (defaultItem) {
    return defaultItem;
  }

  return longItems.length === 1 ? longItems[0] : null;
}

export function normalizeLocationKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export async function findActiveRateChartIds(
  customerId: string,
  date: string = getTodayIsoDate(),
  db: Queryable = defaultDb
): Promise<string[]> {
  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM rate_charts
      WHERE customer_id = $1
        AND is_active = true
        AND effective_from <= $2::date
        AND (effective_to IS NULL OR effective_to >= $2::date)
      ORDER BY effective_from DESC, created_at DESC
    `,
    [customerId, date]
  );

  return result.rows.map((row) => row.id);
}

export async function loadRateChartDetail(
  chartId: string,
  db: Queryable = defaultDb
): Promise<RateChartDetail | null> {
  const chartResult = await db.query<RateChartDetail>(
    `
      SELECT
        rc.*,
        json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer
      FROM rate_charts rc
      INNER JOIN customers c ON c.id = rc.customer_id
      WHERE rc.id = $1
    `,
    [chartId]
  );

  const chart = chartResult.rows[0];
  if (!chart) {
    return null;
  }

  const itemResult = await db.query<RateChartItemRecord>(
    `
      SELECT
        rci.*,
        json_build_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active) AS vehicle_category
      FROM rate_chart_items rci
      INNER JOIN vehicle_categories vc ON vc.id = rci.vehicle_category_id
      WHERE rci.rate_chart_id = $1
      ORDER BY LOWER(vc.name), rci.duty_type, rci.sort_order ASC, LOWER(rci.package_label)
    `,
    [chartId]
  );

  const fixedRouteResult = await db.query<RateChartFixedRouteRecord>(
    `
      SELECT
        rcfr.*,
        json_build_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active) AS vehicle_category
      FROM rate_chart_fixed_routes rcfr
      INNER JOIN vehicle_categories vc ON vc.id = rcfr.vehicle_category_id
      WHERE rcfr.rate_chart_id = $1
      ORDER BY LOWER(vc.name), rcfr.duty_type, LOWER(rcfr.from_location), LOWER(rcfr.to_location)
    `,
    [chartId]
  );

  return {
    ...chart,
    items: itemResult.rows,
    fixed_routes: fixedRouteResult.rows,
  };
}

export async function loadActiveRateChartDetail(
  customerId: string,
  date: string = getTodayIsoDate(),
  db: Queryable = defaultDb
): Promise<RateChartDetail | null> {
  const activeRateChartIds = await findActiveRateChartIds(customerId, date, db);

  if (activeRateChartIds.length === 0) {
    return null;
  }

  if (activeRateChartIds.length > 1) {
    throw new RateEngineError(
      'RATE_CHART_CONFLICT',
      'Multiple active rate charts exist for this customer and date.'
    );
  }

  return loadRateChartDetail(activeRateChartIds[0], db);
}

export function calculateRateFromChart(
  rateChart: RateChartDetail,
  input: RateCalculationInput
): RateCalculationResult {
  const fromLocation = input.from_location ?? null;
  const toLocation = input.to_location ?? null;
  const fixedRoute =
    fromLocation && toLocation
      ? rateChart.fixed_routes.find(
          (route) =>
            route.vehicle_category_id === input.vehicle_category_id &&
            route.duty_type === input.duty_type &&
            route.from_location_key === normalizeLocationKey(fromLocation) &&
            route.to_location_key === normalizeLocationKey(toLocation)
        )
      : null;

  if (fixedRoute) {
    const fixedAmount = roundMoney(toNumber(fixedRoute.fixed_amount) ?? 0);

    return {
      rate_chart_id: rateChart.id,
      rate_chart_item_id: null,
      package_code: null,
      package_label: null,
      requested_duty_type: input.duty_type,
      applied_duty_type: input.duty_type,
      applied_fixed_route_id: fixedRoute.id,
      is_long_trip: false,
      line_items: [
        {
          code: 'FIXED_ROUTE',
          label: `Fixed Route: ${fixedRoute.from_location} -> ${fixedRoute.to_location}`,
          amount: fixedAmount,
        },
      ],
      totals: {
        base_charge: 0,
        extra_km_charge: 0,
        extra_hr_charge: 0,
        fuel_charge: 0,
        night_halt_charge: 0,
        ot_charge: 0,
        fixed_amount: fixedAmount,
        final_amount: fixedAmount,
      },
      warnings: [],
    };
  }

  const dutyTypeItems = rateChart.items.filter(
    (item) =>
      item.vehicle_category_id === input.vehicle_category_id && item.duty_type === input.duty_type
  );

  if (dutyTypeItems.length === 0) {
    throw new RateEngineError(
      'RATE_ITEM_NOT_FOUND',
      'No rate items are configured for the selected vehicle category and duty type.'
    );
  }

  let selectedItem = selectRateChartItem(dutyTypeItems, input.package_code);
  let appliedDutyType: DutyType = input.duty_type;
  const warnings: string[] = [];

  const longKmThreshold = toNumber(selectedItem.long_km_threshold);
  if (
    selectedItem.duty_type === 'local' &&
    longKmThreshold !== null &&
    input.total_km > longKmThreshold
  ) {
    const selectedItemPerKmRate = toNumber(selectedItem.per_km_rate);

    if (selectedItemPerKmRate !== null) {
      appliedDutyType = 'long';
      warnings.push('Local package exceeded the long KM threshold, so long pricing was applied.');
    } else {
      const fallbackLongItem = resolveLongFallbackItem(
        rateChart.items,
        input.vehicle_category_id
      );

      if (!fallbackLongItem) {
        throw new RateEngineError(
          'INVALID_RATE_SETUP',
          'Local package exceeded the long KM threshold, but no long rate fallback is configured.'
        );
      }

      selectedItem = fallbackLongItem;
      appliedDutyType = 'long';
      warnings.push(
        `Local package exceeded the long KM threshold, so long package ${fallbackLongItem.package_label} was applied.`
      );
    }
  }

  if (toNumber(selectedItem.no_km_limit_cap_km) !== null) {
    warnings.push('No-KM-limit cap is configured on this package but not applied in Phase 2 math yet.');
  }

  const lineItems: RateCalculationLineItem[] = [];
  const totalKm = Math.max(0, Number(input.total_km));
  const totalHours = Math.max(0, Number(input.total_hours));
  const nightHalts = Math.max(0, Number(input.night_halts ?? 0));
  const isLongCalculation = appliedDutyType === 'long' || toNumber(selectedItem.per_km_rate) !== null;

  let baseCharge = 0;
  let extraKmCharge = 0;
  let extraHrCharge = 0;
  let fuelCharge = 0;
  let nightHaltCharge = 0;
  let otCharge = 0;
  let fixedAmount = 0;

  if (isLongCalculation) {
    const perKmRate = toNumber(selectedItem.per_km_rate);
    if (perKmRate === null) {
      throw new RateEngineError(
        'INVALID_RATE_SETUP',
        'Long pricing was selected, but per-KM rate is not configured.'
      );
    }

    baseCharge = totalKm * perKmRate;
    pushLineItem(lineItems, 'DISTANCE', 'Distance Charge', baseCharge, {
      total_km: totalKm,
      per_km_rate: perKmRate,
    });

    const longDayHours = toNumber(selectedItem.long_day_hours);
    const otRate = toNumber(selectedItem.ot_rate);
    if (longDayHours !== null && otRate !== null && totalHours > longDayHours) {
      otCharge = (totalHours - longDayHours) * otRate;
      pushLineItem(lineItems, 'OT', 'OT Charge', otCharge, {
        total_hours: totalHours,
        long_day_hours: longDayHours,
        ot_rate: otRate,
      });
    }
  } else {
    baseCharge =
      toNumber(selectedItem.fixed_amount) ??
      toNumber(selectedItem.base_amount) ??
      0;
    pushLineItem(lineItems, 'BASE', selectedItem.package_label, baseCharge, {
      package_code: selectedItem.package_code,
    });

    const baseKm = toNumber(selectedItem.base_km);
    const extraKmRate = toNumber(selectedItem.extra_km_rate);
    if (baseKm !== null && extraKmRate !== null && totalKm > baseKm) {
      extraKmCharge = (totalKm - baseKm) * extraKmRate;
    }

    const baseHours = toNumber(selectedItem.base_hours);
    const extraHrRate = toNumber(selectedItem.extra_hr_rate);
    if (baseHours !== null && extraHrRate !== null && totalHours > baseHours) {
      extraHrCharge = (totalHours - baseHours) * extraHrRate;
    }

    if (selectedItem.use_higher_of_km_hr) {
      if (extraKmCharge >= extraHrCharge) {
        extraHrCharge = 0;
      } else {
        extraKmCharge = 0;
      }
    }

    pushLineItem(lineItems, 'EXTRA_KM', 'Extra KM Charge', extraKmCharge, {
      total_km: totalKm,
      base_km: baseKm,
      extra_km_rate: extraKmRate,
    });
    pushLineItem(lineItems, 'EXTRA_HR', 'Extra Hour Charge', extraHrCharge, {
      total_hours: totalHours,
      base_hours: baseHours,
      extra_hr_rate: extraHrRate,
    });
  }

  const fuelDivisor = toNumber(selectedItem.fuel_divisor);
  const fuelPricePerUnit = toNumber(selectedItem.fuel_price_per_unit);
  if (fuelDivisor !== null && fuelPricePerUnit !== null) {
    fuelCharge = (totalKm / fuelDivisor) * fuelPricePerUnit;
    pushLineItem(lineItems, 'FUEL', 'Fuel Charge', fuelCharge, {
      total_km: totalKm,
      fuel_divisor: fuelDivisor,
      fuel_price_per_unit: fuelPricePerUnit,
    });
  }

  const nightHaltRate = toNumber(selectedItem.night_halt_rate);
  if (nightHaltRate !== null && nightHalts > 0) {
    nightHaltCharge = nightHalts * nightHaltRate;
    pushLineItem(lineItems, 'NIGHT_HALT', 'Night Halt Charge', nightHaltCharge, {
      night_halts: nightHalts,
      night_halt_rate: nightHaltRate,
    });
  }

  if (!isLongCalculation) {
    fixedAmount = toNumber(selectedItem.fixed_amount) ?? 0;
  }

  const finalAmount = roundMoney(
    baseCharge + extraKmCharge + extraHrCharge + fuelCharge + nightHaltCharge + otCharge
  );

  return {
    rate_chart_id: rateChart.id,
    rate_chart_item_id: selectedItem.id,
    package_code: selectedItem.package_code,
    package_label: selectedItem.package_label,
    requested_duty_type: input.duty_type,
    applied_duty_type: appliedDutyType,
    applied_fixed_route_id: null,
    is_long_trip: appliedDutyType === 'long',
    line_items: lineItems,
    totals: {
      base_charge: roundMoney(baseCharge),
      extra_km_charge: roundMoney(extraKmCharge),
      extra_hr_charge: roundMoney(extraHrCharge),
      fuel_charge: roundMoney(fuelCharge),
      night_halt_charge: roundMoney(nightHaltCharge),
      ot_charge: roundMoney(otCharge),
      fixed_amount: roundMoney(fixedAmount),
      final_amount: finalAmount,
    },
    warnings,
  };
}

export async function calculateRateForCustomer(
  input: RateCalculationInput,
  db: Queryable = defaultDb
): Promise<RateCalculationResult> {
  const rateChart = await loadActiveRateChartDetail(input.customer_id, input.trip_date, db);

  if (!rateChart) {
    throw new RateEngineError(
      'RATE_CHART_NOT_FOUND',
      'No active rate chart was found for the selected customer and date.'
    );
  }

  return calculateRateFromChart(rateChart, input);
}



