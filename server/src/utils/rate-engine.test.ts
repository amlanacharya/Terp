import { describe, it, expect } from 'vitest';
import { calculateRateFromChart, RateEngineError } from './rate-engine';
import {
  CHART_RBI,
  CHART_TSM,
  CHART_UNIT4,
  CHART_NTPC,
  CHART_IFFCO,
  CAT_CRYSTA,
  CAT_4AIRBAG,
  CAT_6AIRBAG,
} from './rate-engine.fixtures';

// ---------------------------------------------------------------------------
// Fixture 1: RBI — 8Hr/80KM base package with extra KM/HR (use-higher-of)
// ---------------------------------------------------------------------------
describe('RBI — 8Hr/80KM base package with use-higher-of KM/HR', () => {
  it('returns base charge when within package limits', () => {
    const result = calculateRateFromChart(CHART_RBI, {
      customer_id: CHART_RBI.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 60,
      total_hours: 6,
    });

    expect(result.totals.base_charge).toBe(3000);
    expect(result.totals.extra_km_charge).toBe(0);
    expect(result.totals.extra_hr_charge).toBe(0);
    expect(result.totals.final_amount).toBe(3000);
    expect(result.package_code).toBe('8HR80KM');
  });

  it('applies extra KM charge when KM exceeds base and KM wins higher-of', () => {
    // 110 km → 30 extra × Rs.18 = Rs.540 (km wins over 2hr × 180 = 360)
    const result = calculateRateFromChart(CHART_RBI, {
      customer_id: CHART_RBI.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 110,
      total_hours: 10,
    });

    expect(result.totals.base_charge).toBe(3000);
    expect(result.totals.extra_km_charge).toBe(540); // 30 * 18
    expect(result.totals.extra_hr_charge).toBe(0);   // zeroed out by higher-of
    expect(result.totals.final_amount).toBe(3540);
  });

  it('applies extra HR charge when HR exceeds base and HR wins higher-of', () => {
    // 82 km → 2 extra × 18 = Rs.36 (km side)
    // 11 hr → 3 extra × 180 = Rs.540 (hr wins)
    const result = calculateRateFromChart(CHART_RBI, {
      customer_id: CHART_RBI.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 82,
      total_hours: 11,
    });

    expect(result.totals.extra_hr_charge).toBe(540); // 3 * 180
    expect(result.totals.extra_km_charge).toBe(0);   // zeroed out by higher-of
    expect(result.totals.final_amount).toBe(3540);
  });

  it('selects 4Hr/40KM package when explicitly requested', () => {
    const result = calculateRateFromChart(CHART_RBI, {
      customer_id: CHART_RBI.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '4HR40KM',
      total_km: 30,
      total_hours: 3,
    });

    expect(result.package_code).toBe('4HR40KM');
    expect(result.totals.base_charge).toBe(2000);
    expect(result.totals.final_amount).toBe(2000);
  });

  it('throws PACKAGE_SELECTION_REQUIRED when no package_code and multiple packages exist', () => {
    expect(() =>
      calculateRateFromChart(CHART_RBI, {
        customer_id: CHART_RBI.customer_id,
        trip_date: '2025-06-01',
        duty_type: 'local',
        vehicle_category_id: CAT_CRYSTA,
        total_km: 60,
        total_hours: 6,
      })
    ).toThrow(RateEngineError);
  });
});

// ---------------------------------------------------------------------------
// Fixture 2: TSM — fuel formula + fixed drop routes
// ---------------------------------------------------------------------------
describe('TSM — fuel formula (KM/10 × 102.15) and fixed drop routes', () => {
  it('applies fuel formula for local duty', () => {
    // 100 km → (100/10) × 102.15 = Rs.1021.50
    const result = calculateRateFromChart(CHART_TSM, {
      customer_id: CHART_TSM.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: 'LOCAL',
      total_km: 100,
      total_hours: 4,
    });

    expect(result.totals.fuel_charge).toBeCloseTo(1021.5, 2);
    expect(result.totals.final_amount).toBeCloseTo(1021.5, 2);
  });

  it('returns fixed amount for TSM→BBSR drop_pickup route', () => {
    const result = calculateRateFromChart(CHART_TSM, {
      customer_id: CHART_TSM.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'drop_pickup',
      vehicle_category_id: CAT_CRYSTA,
      from_location: 'TSM',
      to_location: 'BBSR',
      total_km: 350,
      total_hours: 6,
    });

    expect(result.totals.fixed_amount).toBe(4000);
    expect(result.totals.final_amount).toBe(4000);
    expect(result.applied_fixed_route_id).toBeTruthy();
  });

  it('fixed route match is case and whitespace insensitive', () => {
    const result = calculateRateFromChart(CHART_TSM, {
      customer_id: CHART_TSM.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'drop_pickup',
      vehicle_category_id: CAT_CRYSTA,
      from_location: '  tsm  ',
      to_location: ' bbsr ',
      total_km: 350,
      total_hours: 6,
    });

    expect(result.totals.fixed_amount).toBe(4000);
  });

  it('does not match fixed route for wrong duty type', () => {
    // Fixed route is drop_pickup; local should fall through to package pricing
    const result = calculateRateFromChart(CHART_TSM, {
      customer_id: CHART_TSM.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      from_location: 'TSM',
      to_location: 'BBSR',
      package_code: 'LOCAL',
      total_km: 50,
      total_hours: 3,
    });

    expect(result.applied_fixed_route_id).toBeNull();
    expect(result.totals.fuel_charge).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture 3: UNIT-4 — fuel formula with 4AIR BAG and 6AIR BAG
// ---------------------------------------------------------------------------
describe('UNIT-4 — fuel formula per vehicle category', () => {
  it('calculates fuel for 4AIR BAG at divisor 12', () => {
    // 120 km → (120/12) × 102.15 = Rs.1021.50
    const result = calculateRateFromChart(CHART_UNIT4, {
      customer_id: CHART_UNIT4.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_4AIRBAG,
      package_code: 'LOCAL4',
      total_km: 120,
      total_hours: 4,
    });

    expect(result.totals.fuel_charge).toBeCloseTo(1021.5, 2);
    expect(result.totals.final_amount).toBeCloseTo(1021.5, 2);
  });

  it('calculates fuel for 6AIR BAG at divisor 10', () => {
    // 120 km → (120/10) × 102.15 = Rs.1225.80
    const result = calculateRateFromChart(CHART_UNIT4, {
      customer_id: CHART_UNIT4.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_6AIRBAG,
      package_code: 'LOCAL6',
      total_km: 120,
      total_hours: 4,
    });

    expect(result.totals.fuel_charge).toBeCloseTo(1225.8, 2);
    expect(result.totals.final_amount).toBeCloseTo(1225.8, 2);
  });

  it('throws RATE_ITEM_NOT_FOUND when using wrong vehicle category', () => {
    expect(() =>
      calculateRateFromChart(CHART_UNIT4, {
        customer_id: CHART_UNIT4.customer_id,
        trip_date: '2025-06-01',
        duty_type: 'local',
        vehicle_category_id: CAT_CRYSTA, // not configured in UNIT4
        total_km: 100,
        total_hours: 4,
      })
    ).toThrow(RateEngineError);
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: NTPC — local-to-long threshold upgrade at 250 KM
// ---------------------------------------------------------------------------
describe('NTPC — local vs long KM threshold at 250 KM', () => {
  it('uses local package pricing when KM is within threshold', () => {
    // 200 km, 6 hr — stays local: base=2800, extra_km=(200-80)×16=1920, extra_hr=0
    const result = calculateRateFromChart(CHART_NTPC, {
      customer_id: CHART_NTPC.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 200,
      total_hours: 6,
    });

    expect(result.applied_duty_type).toBe('local');
    expect(result.totals.base_charge).toBe(2800);
    expect(result.totals.extra_km_charge).toBe(1920); // (200-80)*16
    expect(result.warnings).toHaveLength(0);
  });

  it('upgrades to long pricing when KM exceeds 250 threshold', () => {
    // 300 km → long pricing: 300 × 22 = Rs.6600
    const result = calculateRateFromChart(CHART_NTPC, {
      customer_id: CHART_NTPC.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 300,
      total_hours: 10,
    });

    expect(result.applied_duty_type).toBe('long');
    expect(result.is_long_trip ?? (result.applied_duty_type === 'long')).toBe(true);
    expect(result.totals.base_charge).toBe(6600); // 300 * 22
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/threshold/i);
  });

  it('threshold is exclusive — exactly 250 KM stays local', () => {
    const result = calculateRateFromChart(CHART_NTPC, {
      customer_id: CHART_NTPC.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 250,
      total_hours: 8,
    });

    expect(result.applied_duty_type).toBe('local');
  });
});

// ---------------------------------------------------------------------------
// Fixture 5: IFFCO — 10Hr/80KM with no_km_limit_cap_km = 450
// ---------------------------------------------------------------------------
describe('IFFCO — 10Hr/80KM local and outstation with no_km_limit_cap field', () => {
  it('calculates local trip within limits', () => {
    // 60 km, 8 hr — within 10Hr/80KM: base=3200, no extras
    const result = calculateRateFromChart(CHART_IFFCO, {
      customer_id: CHART_IFFCO.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '10HR80KM',
      total_km: 60,
      total_hours: 8,
    });

    expect(result.totals.base_charge).toBe(3200);
    expect(result.totals.extra_km_charge).toBe(0);
    expect(result.totals.extra_hr_charge).toBe(0);
    expect(result.totals.final_amount).toBe(3200);
  });

  it('charges extra KM beyond 80 KM base', () => {
    // 130 km → (130-80)×20 = Rs.1000 extra KM
    const result = calculateRateFromChart(CHART_IFFCO, {
      customer_id: CHART_IFFCO.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '10HR80KM',
      total_km: 130,
      total_hours: 8,
    });

    expect(result.totals.extra_km_charge).toBe(1000); // 50 * 20
    expect(result.totals.final_amount).toBe(4200);
  });

  it('issues a warning for no_km_limit_cap_km field', () => {
    const result = calculateRateFromChart(CHART_IFFCO, {
      customer_id: CHART_IFFCO.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '10HR80KM',
      total_km: 400,
      total_hours: 12,
    });

    expect(result.warnings.some((w) => /cap/i.test(w))).toBe(true);
  });

  it('calculates outstation trip with per-km rate and night halts', () => {
    // 400 km × Rs.25 = Rs.10000 + 2 halts × Rs.500 = Rs.1000, hours=8 (below 10h OT threshold)
    const result = calculateRateFromChart(CHART_IFFCO, {
      customer_id: CHART_IFFCO.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'outstation',
      vehicle_category_id: CAT_CRYSTA,
      package_code: 'OUTSTATION',
      total_km: 400,
      total_hours: 8,
      night_halts: 2,
    });

    expect(result.totals.base_charge).toBe(10000); // 400 * 25
    expect(result.totals.night_halt_charge).toBe(1000); // 2 * 500
    expect(result.totals.ot_charge).toBe(0); // 8 hrs < 10 long_day_hours
    expect(result.totals.final_amount).toBe(11000);
  });

  it('adds OT charge when hours exceed long_day_hours on outstation', () => {
    // 12 hr total, long_day_hours=10 → 2 extra × Rs.200 = Rs.400
    const result = calculateRateFromChart(CHART_IFFCO, {
      customer_id: CHART_IFFCO.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'outstation',
      vehicle_category_id: CAT_CRYSTA,
      package_code: 'OUTSTATION',
      total_km: 200,
      total_hours: 12,
      night_halts: 0,
    });

    expect(result.totals.ot_charge).toBe(400); // 2 * 200
    expect(result.totals.final_amount).toBe(5400); // 200*25 + 400
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('returns zero amounts for all-zero trip inputs', () => {
    const result = calculateRateFromChart(CHART_RBI, {
      customer_id: CHART_RBI.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: '8HR80KM',
      total_km: 0,
      total_hours: 0,
    });

    // base charge is still 3000 (flat package)
    expect(result.totals.extra_km_charge).toBe(0);
    expect(result.totals.extra_hr_charge).toBe(0);
    expect(result.totals.final_amount).toBe(3000);
  });

  it('throws RATE_ITEM_NOT_FOUND for unconfigured duty type', () => {
    expect(() =>
      calculateRateFromChart(CHART_RBI, {
        customer_id: CHART_RBI.customer_id,
        trip_date: '2025-06-01',
        duty_type: 'outstation',
        vehicle_category_id: CAT_CRYSTA,
        total_km: 200,
        total_hours: 8,
      })
    ).toThrow(RateEngineError);
  });

  it('fuel charge rounds to 2 decimal places', () => {
    // 1 km → (1/10) × 102.15 = 10.215 → rounds to 10.22
    const result = calculateRateFromChart(CHART_TSM, {
      customer_id: CHART_TSM.customer_id,
      trip_date: '2025-06-01',
      duty_type: 'local',
      vehicle_category_id: CAT_CRYSTA,
      package_code: 'LOCAL',
      total_km: 1,
      total_hours: 1,
    });

    expect(result.totals.fuel_charge).toBe(10.22);
  });
});
