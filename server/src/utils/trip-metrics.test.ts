import { describe, it, expect } from 'vitest';
import { aggregateTripTravelMetrics, TripMetricValidationError } from './trip-metrics';
import {
  METRICS_LOCAL_SINGLE,
  METRICS_OUTSTATION_2DAY,
  METRICS_INPROGRESS,
  METRICS_UNORDERED,
  TRIP_A,
} from './trip-metrics.fixtures';

// ---------------------------------------------------------------------------
// Fixture 1: Single complete row — local duty (8Hr/75KM)
// ---------------------------------------------------------------------------
describe('Single complete row — local duty', () => {
  it('returns correct segment_km and segment_hours', () => {
    const result = aggregateTripTravelMetrics(METRICS_LOCAL_SINGLE);

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].segment_km).toBe(75);    // 175 - 100
    expect(result.metrics[0].segment_hours).toBe(8);  // 16:00 - 08:00
    expect(result.metrics[0].is_complete).toBe(true);
  });

  it('sums to total_km and total_hours from the single segment', () => {
    const result = aggregateTripTravelMetrics(METRICS_LOCAL_SINGLE);

    expect(result.total_km).toBe(75);
    expect(result.total_hours).toBe(8);
  });

  it('populates compatibility snapshot fields', () => {
    const result = aggregateTripTravelMetrics(METRICS_LOCAL_SINGLE);

    expect(result.start_km).toBe(100);
    expect(result.end_km).toBe(175);
    expect(result.start_time).toBe('2025-06-01T08:00:00');
    expect(result.end_time).toBe('2025-06-01T16:00:00');
  });

  it('reports no incomplete rows', () => {
    const result = aggregateTripTravelMetrics(METRICS_LOCAL_SINGLE);

    expect(result.has_incomplete_rows).toBe(false);
  });

  it('normalizes HH:MM times to HH:MM:SS in the returned metric', () => {
    const result = aggregateTripTravelMetrics(METRICS_LOCAL_SINGLE);

    expect(result.metrics[0].start_time).toBe('08:00:00');
    expect(result.metrics[0].end_time).toBe('16:00:00');
  });
});

// ---------------------------------------------------------------------------
// Fixture 2: Two complete rows — outstation 2-day duty slip
// ---------------------------------------------------------------------------
describe('Two complete rows — outstation 2-day duty', () => {
  it('sums segment_km across both rows, not last_end_km minus first_start_km', () => {
    // Both produce the same total here (coincidental for this fixture) but
    // the spec requires per-row summation.
    const result = aggregateTripTravelMetrics(METRICS_OUTSTATION_2DAY);

    expect(result.metrics[0].segment_km).toBe(180);  // 12180 - 12000
    expect(result.metrics[1].segment_km).toBe(200);  // 12380 - 12180
    expect(result.total_km).toBe(380);               // 180 + 200
  });

  it('sums segment_hours across both rows', () => {
    const result = aggregateTripTravelMetrics(METRICS_OUTSTATION_2DAY);

    expect(result.metrics[0].segment_hours).toBe(12);   // 20:00 - 08:00
    expect(result.metrics[1].segment_hours).toBe(8.5);  // 17:30 - 09:00
    expect(result.total_hours).toBe(20.5);              // 12 + 8.5
  });

  it('start_km and start_time come from seq=1 row (first after sort)', () => {
    const result = aggregateTripTravelMetrics(METRICS_OUTSTATION_2DAY);

    expect(result.start_time).toBe('2025-06-01T08:00:00');
  });

  it('end_km and end_time come from last completed segment row', () => {
    const result = aggregateTripTravelMetrics(METRICS_OUTSTATION_2DAY);

    expect(result.end_km).toBe(12380);
    expect(result.end_time).toBe('2025-06-02T17:30:00');
  });

  it('reports no incomplete rows', () => {
    const result = aggregateTripTravelMetrics(METRICS_OUTSTATION_2DAY);

    expect(result.has_incomplete_rows).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture 3: Second row still open (in-progress duty slip)
// ---------------------------------------------------------------------------
describe('In-progress duty slip with one open row', () => {
  it('reports has_incomplete_rows when any row lacks end fields', () => {
    const result = aggregateTripTravelMetrics(METRICS_INPROGRESS);

    expect(result.has_incomplete_rows).toBe(true);
  });

  it('open row has null segment_km and segment_hours', () => {
    const result = aggregateTripTravelMetrics(METRICS_INPROGRESS);
    const openRow = result.metrics.find((m) => !m.is_complete);

    expect(openRow).toBeDefined();
    expect(openRow!.segment_km).toBeNull();
    expect(openRow!.segment_hours).toBeNull();
  });

  it('total_km and total_hours count only completed rows', () => {
    const result = aggregateTripTravelMetrics(METRICS_INPROGRESS);

    expect(result.total_km).toBe(60);   // only seq=1: 260-200
    expect(result.total_hours).toBe(4); // only seq=1: 12:00-08:00
  });

  it('end_km and end_time reflect the last completed row, not the open row', () => {
    const result = aggregateTripTravelMetrics(METRICS_INPROGRESS);

    expect(result.end_km).toBe(260);
    expect(result.end_time).toBe('2025-06-01T12:00:00');
  });

  it('start fields still come from the first row (open rows can be first)', () => {
    const result = aggregateTripTravelMetrics(METRICS_INPROGRESS);

    expect(result.start_km).toBe(200);
    expect(result.start_time).toBe('2025-06-01T08:00:00');
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: Records supplied out of seq order
// ---------------------------------------------------------------------------
describe('Seq ordering — records supplied out of order', () => {
  it('processes rows in seq order regardless of array position', () => {
    const result = aggregateTripTravelMetrics(METRICS_UNORDERED);

    expect(result.metrics[0].seq).toBe(1);
    expect(result.metrics[1].seq).toBe(2);
  });

  it('start_km and start_time come from seq=1 even when it was second in array', () => {
    const result = aggregateTripTravelMetrics(METRICS_UNORDERED);

    expect(result.start_km).toBe(50);
    expect(result.start_time).toBe('2025-06-01T06:00:00');
  });

  it('totals are correct after ordering', () => {
    const result = aggregateTripTravelMetrics(METRICS_UNORDERED);

    expect(result.total_km).toBe(110);  // 60 + 50
    expect(result.total_hours).toBe(3.5); // 2 + 1.5
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------
describe('Empty metrics array', () => {
  it('returns zero totals and null compatibility fields', () => {
    const result = aggregateTripTravelMetrics([]);

    expect(result.total_km).toBe(0);
    expect(result.total_hours).toBe(0);
    expect(result.has_incomplete_rows).toBe(false);
    expect(result.start_km).toBeNull();
    expect(result.end_km).toBeNull();
    expect(result.start_time).toBeNull();
    expect(result.end_time).toBeNull();
    expect(result.metrics).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------
describe('Validation errors', () => {
  it('throws INVALID_START_KM when start_km is negative', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v1',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: -1,
          end_date: null,
          end_time: null,
          end_km: null,
        },
      ])
    ).toThrow(TripMetricValidationError);

    try {
      aggregateTripTravelMetrics([
        {
          id: 'v1',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: -1,
          end_date: null,
          end_time: null,
          end_km: null,
        },
      ]);
    } catch (err) {
      expect((err as TripMetricValidationError).code).toBe('INVALID_START_KM');
    }
  });

  it('throws INVALID_END_KM when end_km is less than start_km', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v2',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 200,
          end_date: '2025-06-01',
          end_time: '16:00',
          end_km: 150, // less than start
        },
      ])
    ).toThrow(TripMetricValidationError);

    try {
      aggregateTripTravelMetrics([
        {
          id: 'v2',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 200,
          end_date: '2025-06-01',
          end_time: '16:00',
          end_km: 150,
        },
      ]);
    } catch (err) {
      expect((err as TripMetricValidationError).code).toBe('INVALID_END_KM');
    }
  });

  it('throws INVALID_METRIC_RANGE when end timestamp is before start timestamp', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v3',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '16:00',
          start_km: 100,
          end_date: '2025-06-01',
          end_time: '08:00', // earlier than start
          end_km: 180,
        },
      ])
    ).toThrow(TripMetricValidationError);

    try {
      aggregateTripTravelMetrics([
        {
          id: 'v3',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '16:00',
          start_km: 100,
          end_date: '2025-06-01',
          end_time: '08:00',
          end_km: 180,
        },
      ]);
    } catch (err) {
      expect((err as TripMetricValidationError).code).toBe('INVALID_METRIC_RANGE');
    }
  });

  it('throws INCOMPLETE_METRIC when only some end fields are present', () => {
    // end_date present but end_time and end_km absent
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v4',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 100,
          end_date: '2025-06-01',
          end_time: null,
          end_km: null,
        },
      ])
    ).toThrow(TripMetricValidationError);

    try {
      aggregateTripTravelMetrics([
        {
          id: 'v4',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 100,
          end_date: '2025-06-01',
          end_time: null,
          end_km: null,
        },
      ]);
    } catch (err) {
      expect((err as TripMetricValidationError).code).toBe('INCOMPLETE_METRIC');
    }
  });

  it('throws INCOMPLETE_METRIC when only end_km is present', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v5',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 100,
          end_date: null,
          end_time: null,
          end_km: 180,
        },
      ])
    ).toThrow(TripMetricValidationError);
  });

  it('throws INVALID_METRIC_TIMESTAMP when start_date is malformed', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'v6',
          trip_id: TRIP_A,
          seq: 1,
          start_date: 'not-a-date',
          start_time: '08:00',
          start_km: 100,
          end_date: null,
          end_time: null,
          end_km: null,
        },
      ])
    ).toThrow(TripMetricValidationError);
  });
});

// ---------------------------------------------------------------------------
// Date and time edge cases
// ---------------------------------------------------------------------------
describe('Date and time edge cases', () => {
  it('calculates hours correctly for overnight trip spanning midnight', () => {
    // 22:00 on day 1 → 06:00 on day 2 = 8 hours
    const result = aggregateTripTravelMetrics([
      {
        id: 'ov1',
        trip_id: TRIP_A,
        seq: 1,
        start_date: '2025-06-01',
        start_time: '22:00',
        start_km: 500,
        end_date: '2025-06-02',
        end_time: '06:00',
        end_km: 620,
      },
    ]);

    expect(result.metrics[0].segment_hours).toBe(8);
    expect(result.metrics[0].segment_km).toBe(120);
  });

  it('handles zero-km zero-hour same-point row', () => {
    // start = end (odometer and time identical — edge case, not an error)
    const result = aggregateTripTravelMetrics([
      {
        id: 'zz1',
        trip_id: TRIP_A,
        seq: 1,
        start_date: '2025-06-01',
        start_time: '10:00',
        start_km: 300,
        end_date: '2025-06-01',
        end_time: '10:00',
        end_km: 300,
      },
    ]);

    expect(result.metrics[0].segment_km).toBe(0);
    expect(result.metrics[0].segment_hours).toBe(0);
    expect(result.total_km).toBe(0);
    expect(result.total_hours).toBe(0);
  });

  it('accepts start_km = 0 (odometer starts from zero)', () => {
    expect(() =>
      aggregateTripTravelMetrics([
        {
          id: 'zk1',
          trip_id: TRIP_A,
          seq: 1,
          start_date: '2025-06-01',
          start_time: '08:00',
          start_km: 0,
          end_date: '2025-06-01',
          end_time: '10:00',
          end_km: 50,
        },
      ])
    ).not.toThrow();

    const result = aggregateTripTravelMetrics([
      {
        id: 'zk1',
        trip_id: TRIP_A,
        seq: 1,
        start_date: '2025-06-01',
        start_time: '08:00',
        start_km: 0,
        end_date: '2025-06-01',
        end_time: '10:00',
        end_km: 50,
      },
    ]);
    expect(result.total_km).toBe(50);
  });

  it('rounds segment_km and segment_hours to 2 decimal places', () => {
    // 1/3 of an hour = 20 minutes = 0.333... hr → rounds to 0.33
    // 10.005 km → rounds to 10.01 (banker's rounding is not used — toFixed)
    const result = aggregateTripTravelMetrics([
      {
        id: 'rnd1',
        trip_id: TRIP_A,
        seq: 1,
        start_date: '2025-06-01',
        start_time: '08:00',
        start_km: 100,
        end_date: '2025-06-01',
        end_time: '08:20',
        end_km: 110,
      },
    ]);

    // 20 min = 0.333... hr → 0.33
    expect(result.metrics[0].segment_hours).toBe(0.33);
    expect(result.metrics[0].segment_km).toBe(10);
  });

  it('accepts numeric strings for start_km and end_km (as returned by pg driver)', () => {
    const result = aggregateTripTravelMetrics([
      {
        id: 'str1',
        trip_id: TRIP_A,
        seq: 1,
        start_date: '2025-06-01',
        start_time: '08:00',
        start_km: '100.50' as unknown as number,
        end_date: '2025-06-01',
        end_time: '12:00',
        end_km: '200.50' as unknown as number,
      },
    ]);

    expect(result.metrics[0].start_km).toBe(100.5);
    expect(result.metrics[0].end_km).toBe(200.5);
    expect(result.total_km).toBe(100);
  });
});
