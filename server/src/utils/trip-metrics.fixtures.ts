/**
 * Fixture data for trip-metrics unit tests.
 * Each fixture models a real GT duty-slip scenario with known inputs and expected outputs.
 * All IDs are deterministic fake UUIDs for test isolation (no DB required).
 */

import type { TripTravelMetricRecord } from './trip-metrics';

// ---------------------------------------------------------------------------
// Shared trip / vehicle IDs
// ---------------------------------------------------------------------------
export const TRIP_A = '00000000-0000-0000-0000-trip00000001';
export const TRIP_B = '00000000-0000-0000-0000-trip00000002';
export const TRIP_C = '00000000-0000-0000-0000-trip00000003';
export const TRIP_D = '00000000-0000-0000-0000-trip00000004';

function makeRecord(overrides: Partial<TripTravelMetricRecord> & Pick<TripTravelMetricRecord, 'id' | 'trip_id' | 'seq' | 'start_date' | 'start_time' | 'start_km'>): TripTravelMetricRecord {
  return {
    end_date: null,
    end_time: null,
    end_km: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture 1: Single complete row — GT local duty (8Hr)
// Pattern: one row, 08:00→16:00, odometer 100→175 (75 km, 8 hr)
// ---------------------------------------------------------------------------
export const METRICS_LOCAL_SINGLE: TripTravelMetricRecord[] = [
  makeRecord({
    id: 'metric-a-seq1',
    trip_id: TRIP_A,
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 100,
    end_date: '2025-06-01',
    end_time: '16:00',
    end_km: 175,
  }),
];

// Expected aggregation for METRICS_LOCAL_SINGLE:
//   total_km   = 75   (175 - 100)
//   total_hours = 8   (16:00 - 08:00)
//   start_time  = '2025-06-01T08:00:00'
//   end_time    = '2025-06-01T16:00:00'
//   start_km    = 100
//   end_km      = 175

// ---------------------------------------------------------------------------
// Fixture 2: Two complete rows — outstation duty spread across 2 days
// Pattern: Day-1 + Day-2 segments; total must be SUM, not last_end - first_start
//
//   seq=1: 2025-06-01 08:00 @12000 → 2025-06-01 20:00 @12180  (180 km, 12 hr)
//   seq=2: 2025-06-02 09:00 @12180 → 2025-06-02 17:30 @12380  (200 km,  8.5 hr)
//
//   total_km    = 380   (180 + 200)  NOT (12380 - 12000 = 380, coincidental here)
//   total_hours = 20.5  (12 + 8.5)
// ---------------------------------------------------------------------------
export const METRICS_OUTSTATION_2DAY: TripTravelMetricRecord[] = [
  makeRecord({
    id: 'metric-b-seq1',
    trip_id: TRIP_B,
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 12000,
    end_date: '2025-06-01',
    end_time: '20:00',
    end_km: 12180,
  }),
  makeRecord({
    id: 'metric-b-seq2',
    trip_id: TRIP_B,
    seq: 2,
    start_date: '2025-06-02',
    start_time: '09:00',
    start_km: 12180,
    end_date: '2025-06-02',
    end_time: '17:30',
    end_km: 12380,
  }),
];

// ---------------------------------------------------------------------------
// Fixture 3: Two rows, second row is still open (in-progress duty slip)
// Pattern: seq=1 complete, seq=2 started but not finished
//
//   seq=1: 2025-06-01 08:00 @200 → 2025-06-01 12:00 @260  (60 km, 4 hr)
//   seq=2: 2025-06-01 12:30 @260 → (open)
//
//   has_incomplete_rows = true
//   total_km    = 60  (only seq=1 contributes)
//   total_hours = 4   (only seq=1 contributes)
//   end_km      = 260 (last completed row)
// ---------------------------------------------------------------------------
export const METRICS_INPROGRESS: TripTravelMetricRecord[] = [
  makeRecord({
    id: 'metric-c-seq1',
    trip_id: TRIP_C,
    seq: 1,
    start_date: '2025-06-01',
    start_time: '08:00',
    start_km: 200,
    end_date: '2025-06-01',
    end_time: '12:00',
    end_km: 260,
  }),
  makeRecord({
    id: 'metric-c-seq2',
    trip_id: TRIP_C,
    seq: 2,
    start_date: '2025-06-01',
    start_time: '12:30',
    start_km: 260,
    // end fields intentionally absent
  }),
];

// ---------------------------------------------------------------------------
// Fixture 4: Records supplied out of seq order
// Pattern: array has seq=2 first, seq=1 second — ordering must be by seq
//
//   seq=1: 2025-06-01 06:00 @50  → 2025-06-01 08:00 @110  (60 km, 2 hr)
//   seq=2: 2025-06-01 08:30 @110 → 2025-06-01 10:00 @160  (50 km, 1.5 hr)
//
//   total_km    = 110
//   total_hours = 3.5
// ---------------------------------------------------------------------------
export const METRICS_UNORDERED: TripTravelMetricRecord[] = [
  makeRecord({
    id: 'metric-d-seq2',
    trip_id: TRIP_D,
    seq: 2,
    start_date: '2025-06-01',
    start_time: '08:30',
    start_km: 110,
    end_date: '2025-06-01',
    end_time: '10:00',
    end_km: 160,
  }),
  makeRecord({
    id: 'metric-d-seq1',
    trip_id: TRIP_D,
    seq: 1,
    start_date: '2025-06-01',
    start_time: '06:00',
    start_km: 50,
    end_date: '2025-06-01',
    end_time: '08:00',
    end_km: 110,
  }),
];
