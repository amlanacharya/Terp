/**
 * Fixture data for invoice-gt and annexure-builder unit tests.
 * All values are real GT billing scenarios with known expected outputs.
 * No DB required — pure function inputs only.
 */

import type { TripTravelMetricRecord } from './trip-metrics';

// ---------------------------------------------------------------------------
// GSTIN samples (Indian state codes: Odisha=21, Maharashtra=27, Delhi=07,
//                Karnataka=29, West Bengal=19)
// ---------------------------------------------------------------------------
export const GSTIN_ODISHA_COMPANY   = '21AABCT1332L1ZN'; // GT company — Odisha
export const GSTIN_ODISHA_CUSTOMER  = '21AABCU9603R1ZP'; // RBI Odisha branch — intra-state
export const GSTIN_MAHARASHTRA_CUST = '27AADCS0472N1ZO'; // Customer in Maharashtra — inter-state
export const GSTIN_DELHI_CUST       = '07AAACP0165G1ZV'; // Customer in Delhi — inter-state
export const GSTIN_KARNATAKA_CUST   = '29AABCV8342P1ZE'; // Customer in Karnataka — inter-state

// ---------------------------------------------------------------------------
// Metric fixtures for deriveNightHalts tests
// ---------------------------------------------------------------------------
const TRIP_P = '00000000-0000-0000-0000-trip0000pha4';

function makeMetric(
  overrides: Partial<TripTravelMetricRecord> &
    Pick<TripTravelMetricRecord, 'id' | 'seq' | 'start_date' | 'start_time' | 'start_km'>
): TripTravelMetricRecord {
  return {
    trip_id: TRIP_P,
    end_date: null,
    end_time: null,
    end_km: null,
    ...overrides,
  };
}

// Single-day local trip — 2025-06-01 only (0 nights)
export const METRICS_SINGLE_DAY: TripTravelMetricRecord[] = [
  makeMetric({
    id: 'metric-p4-single',
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 100,
    end_date: '2025-06-01',
    end_time: '18:00',
    end_km: 240,
  }),
];

// 2-day outstation — 2025-06-01 to 2025-06-03 (2 nights)
export const METRICS_TWO_NIGHT: TripTravelMetricRecord[] = [
  makeMetric({
    id: 'metric-p4-2n-seq1',
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 5000,
    end_date: '2025-06-01',
    end_time: '20:00',
    end_km: 5180,
  }),
  makeMetric({
    id: 'metric-p4-2n-seq2',
    seq: 2,
    start_date: '2025-06-02',
    start_time: '09:00',
    start_km: 5180,
    end_date: '2025-06-03',
    end_time: '17:00',
    end_km: 5380,
  }),
];

// Last row open (no end_date) — should fall back to last start_date for night-halt calc
export const METRICS_LAST_OPEN: TripTravelMetricRecord[] = [
  makeMetric({
    id: 'metric-p4-open-seq1',
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 200,
    end_date: '2025-06-01',
    end_time: '14:00',
    end_km: 280,
  }),
  makeMetric({
    id: 'metric-p4-open-seq2',
    seq: 2,
    start_date: '2025-06-01',
    start_time: '14:30',
    start_km: 280,
    // no end fields — trip still in progress
  }),
];
