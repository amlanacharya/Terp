/**
 * Fixture data for rate engine unit tests.
 * Each fixture models a real GT customer pattern with known inputs and expected outputs.
 * All IDs are deterministic fake UUIDs for test isolation (no DB required).
 */

import type { RateChartDetail } from './rate-engine';

// ---------------------------------------------------------------------------
// Shared category IDs
// ---------------------------------------------------------------------------
export const CAT_CRYSTA = '00000000-0000-0000-0000-000000000001';
export const CAT_DEZIRE = '00000000-0000-0000-0000-000000000002';
export const CAT_4AIRBAG = '00000000-0000-0000-0000-000000000003';
export const CAT_6AIRBAG = '00000000-0000-0000-0000-000000000004';

function makeCategory(id: string, name: string) {
  return { id, name, description: null, is_active: true };
}

function makeBaseItem(overrides: Partial<ReturnType<typeof makeEmptyItem>>): ReturnType<typeof makeEmptyItem> {
  return { ...makeEmptyItem(), ...overrides };
}

function makeEmptyItem() {
  return {
    id: '',
    rate_chart_id: '',
    vehicle_category_id: '',
    duty_type: 'local' as const,
    package_code: '',
    package_label: '',
    sort_order: 0,
    is_default: true,
    base_hours: null,
    base_km: null,
    base_amount: null,
    extra_km_rate: null,
    extra_hr_rate: null,
    fuel_divisor: null,
    fuel_price_per_unit: null,
    night_halt_rate: null,
    fixed_amount: null,
    use_higher_of_km_hr: false,
    per_km_rate: null,
    ot_rate: null,
    long_km_threshold: null,
    no_km_limit_cap_km: null,
    long_day_hours: null,
    long_night_halt_hours: null,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    vehicle_category: makeCategory('', ''),
  };
}

// ---------------------------------------------------------------------------
// Fixture 1: RBI — CRYSTA 8Hr/80KM base package with extra KM/HR rates
// Pattern: base package (8Hr/80KM = Rs.3000), extra KM = Rs.18/km, extra HR = Rs.180/hr
// Use-higher-of-km-hr is enabled.
// ---------------------------------------------------------------------------
export const CHART_RBI: RateChartDetail = {
  id: 'chart-rbi-0000-0000-0000-000000000001',
  customer_id: 'cust-rbi-00000-0000-0000-000000000001',
  name: 'RBI Rate Chart 2025',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: { id: 'cust-rbi-00000-0000-0000-000000000001', name: 'RBI', customer_code: 'RBI' },
  items: [
    makeBaseItem({
      id: 'item-rbi-crysta-local-8hr',
      rate_chart_id: 'chart-rbi-0000-0000-0000-000000000001',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'local',
      package_code: '8HR80KM',
      package_label: '8Hr/80KM',
      base_hours: 8,
      base_km: 80,
      base_amount: 3000,
      extra_km_rate: 18,
      extra_hr_rate: 180,
      use_higher_of_km_hr: true,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
    makeBaseItem({
      id: 'item-rbi-crysta-local-4hr',
      rate_chart_id: 'chart-rbi-0000-0000-0000-000000000001',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'local',
      package_code: '4HR40KM',
      package_label: '4Hr/40KM',
      is_default: false,
      base_hours: 4,
      base_km: 40,
      base_amount: 2000,
      extra_km_rate: 18,
      extra_hr_rate: 180,
      use_higher_of_km_hr: true,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
  ],
  fixed_routes: [],
};

// ---------------------------------------------------------------------------
// Fixture 2: TSM — fuel formula (KM/10 × 102.15) + fixed drop routes
// Pattern: base=0 (fuel formula only for local), fixed routes override entirely
// ---------------------------------------------------------------------------
export const CHART_TSM: RateChartDetail = {
  id: 'chart-tsm-0000-0000-0000-000000000002',
  customer_id: 'cust-tsm-00000-0000-0000-000000000002',
  name: 'TSM Rate Chart 2025',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: { id: 'cust-tsm-00000-0000-0000-000000000002', name: 'TSM', customer_code: 'TSM' },
  items: [
    makeBaseItem({
      id: 'item-tsm-crysta-local',
      rate_chart_id: 'chart-tsm-0000-0000-0000-000000000002',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'local',
      package_code: 'LOCAL',
      package_label: 'Local',
      base_amount: 0,
      fuel_divisor: 10,
      fuel_price_per_unit: 102.15,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
  ],
  fixed_routes: [
    {
      id: 'route-tsm-bbsr',
      rate_chart_id: 'chart-tsm-0000-0000-0000-000000000002',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'drop_pickup',
      from_location: 'TSM',
      to_location: 'BBSR',
      from_location_key: 'TSM',
      to_location_key: 'BBSR',
      fixed_amount: 4000,
      description: 'TSM to BBSR drop',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixture 3: UNIT-4 — fuel formula with 4AIR BAG and 6AIR BAG vehicles
// Pattern: base_amount=0, fuel only (no extras), two vehicle categories
// ---------------------------------------------------------------------------
export const CHART_UNIT4: RateChartDetail = {
  id: 'chart-unit4-000-0000-0000-000000000003',
  customer_id: 'cust-unit4-0000-0000-0000-000000000003',
  name: 'UNIT-4 Rate Chart 2025',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: { id: 'cust-unit4-0000-0000-0000-000000000003', name: 'UNIT-4', customer_code: 'UNIT4' },
  items: [
    makeBaseItem({
      id: 'item-unit4-4airbag-local',
      rate_chart_id: 'chart-unit4-000-0000-0000-000000000003',
      vehicle_category_id: CAT_4AIRBAG,
      duty_type: 'local',
      package_code: 'LOCAL4',
      package_label: 'Local 4AIR BAG',
      base_amount: 0,
      fuel_divisor: 12,
      fuel_price_per_unit: 102.15,
      vehicle_category: makeCategory(CAT_4AIRBAG, '4AIR BAG'),
    }),
    makeBaseItem({
      id: 'item-unit4-6airbag-local',
      rate_chart_id: 'chart-unit4-000-0000-0000-000000000003',
      vehicle_category_id: CAT_6AIRBAG,
      duty_type: 'local',
      package_code: 'LOCAL6',
      package_label: 'Local 6AIR BAG',
      base_amount: 0,
      fuel_divisor: 10,
      fuel_price_per_unit: 102.15,
      vehicle_category: makeCategory(CAT_6AIRBAG, '6AIR BAG'),
    }),
  ],
  fixed_routes: [],
};

// ---------------------------------------------------------------------------
// Fixture 4: NTPC — local vs long threshold at 250 KM
// Pattern: local 8Hr/80KM, but above 250 KM upgrades to long per-km rate
// Uses long_km_threshold on the local item to auto-switch, with per_km_rate inline
// ---------------------------------------------------------------------------
export const CHART_NTPC: RateChartDetail = {
  id: 'chart-ntpc-0000-0000-0000-000000000004',
  customer_id: 'cust-ntpc-00000-0000-0000-000000000004',
  name: 'NTPC Rate Chart 2025',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: { id: 'cust-ntpc-00000-0000-0000-000000000004', name: 'NTPC', customer_code: 'NTPC' },
  items: [
    makeBaseItem({
      id: 'item-ntpc-crysta-local',
      rate_chart_id: 'chart-ntpc-0000-0000-0000-000000000004',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'local',
      package_code: '8HR80KM',
      package_label: '8Hr/80KM',
      base_hours: 8,
      base_km: 80,
      base_amount: 2800,
      extra_km_rate: 16,
      extra_hr_rate: 160,
      // Above 250 KM falls back to the 'long' item below (no per_km_rate here)
      long_km_threshold: 250,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
    makeBaseItem({
      id: 'item-ntpc-crysta-long',
      rate_chart_id: 'chart-ntpc-0000-0000-0000-000000000004',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'long',
      package_code: 'LONG',
      package_label: 'Long',
      per_km_rate: 22,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
  ],
  fixed_routes: [],
};

// ---------------------------------------------------------------------------
// Fixture 5: IFFCO — 10Hr/80KM with no_km_limit_cap_km = 450
// Pattern: long outstation per-km with a cap field configured
// ---------------------------------------------------------------------------
export const CHART_IFFCO: RateChartDetail = {
  id: 'chart-iffco-000-0000-0000-000000000005',
  customer_id: 'cust-iffco-0000-0000-0000-000000000005',
  name: 'IFFCO Rate Chart 2025',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: { id: 'cust-iffco-0000-0000-0000-000000000005', name: 'IFFCO', customer_code: 'IFFCO' },
  items: [
    makeBaseItem({
      id: 'item-iffco-crysta-local',
      rate_chart_id: 'chart-iffco-000-0000-0000-000000000005',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'local',
      package_code: '10HR80KM',
      package_label: '10Hr/80KM',
      base_hours: 10,
      base_km: 80,
      base_amount: 3200,
      extra_km_rate: 20,
      extra_hr_rate: 200,
      no_km_limit_cap_km: 450,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
    makeBaseItem({
      id: 'item-iffco-crysta-outstation',
      rate_chart_id: 'chart-iffco-000-0000-0000-000000000005',
      vehicle_category_id: CAT_CRYSTA,
      duty_type: 'outstation',
      package_code: 'OUTSTATION',
      package_label: 'Outstation',
      per_km_rate: 25,
      night_halt_rate: 500,
      long_day_hours: 10,
      ot_rate: 200,
      no_km_limit_cap_km: 450,
      vehicle_category: makeCategory(CAT_CRYSTA, 'CRYSTA'),
    }),
  ],
  fixed_routes: [],
};
