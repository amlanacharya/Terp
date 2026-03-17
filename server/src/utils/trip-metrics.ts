export interface TripTravelMetricRecord {
  id: string;
  trip_id: string;
  seq: number;
  start_date: string;
  start_time: string;
  start_km: number | string;
  end_date: string | null;
  end_time: string | null;
  end_km: number | string | null;
  source_metric_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizedTripTravelMetric extends Omit<TripTravelMetricRecord, 'start_km' | 'end_km'> {
  start_km: number;
  end_km: number | null;
  segment_km: number | null;
  segment_hours: number | null;
  is_complete: boolean;
}

export interface TripTravelMetricAggregation {
  metrics: NormalizedTripTravelMetric[];
  total_km: number;
  total_hours: number;
  has_incomplete_rows: boolean;
  start_time: string | null;
  end_time: string | null;
  start_km: number | null;
  end_km: number | null;
}

export class TripMetricValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'TripMetricValidationError';
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function roundValue(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeTime(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length === 5 ? `${trimmedValue}:00` : trimmedValue;
}

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return trimmedValue;
  }

  if (trimmedValue.includes('T')) {
    return trimmedValue.slice(0, 10);
  }

  return trimmedValue;
}

function parseMetricTimestamp(date: string | Date, time: string): number {
  const dateParts = normalizeDate(date).split('-').map((part) => Number(part));
  const timeParts = normalizeTime(time).split(':').map((part) => Number(part));

  if (
    dateParts.length !== 3 ||
    timeParts.length !== 3 ||
    [...dateParts, ...timeParts].some((part) => !Number.isFinite(part))
  ) {
    throw new TripMetricValidationError('INVALID_METRIC_TIMESTAMP', 'Travel metric date/time is invalid.');
  }

  const [year, month, day] = dateParts;
  const [hours, minutes, seconds] = timeParts;

  return Date.UTC(year, month - 1, day, hours, minutes, seconds);
}

function combineMetricTimestamp(date: string | Date, time: string): string {
  return `${normalizeDate(date)}T${normalizeTime(time)}`;
}

export function aggregateTripTravelMetrics(
  records: TripTravelMetricRecord[]
): TripTravelMetricAggregation {
  const orderedRecords = [...records].sort((left, right) => left.seq - right.seq);

  const metrics = orderedRecords.map<NormalizedTripTravelMetric>((record) => {
    const startKm = toNumber(record.start_km);
    if (startKm === null || startKm < 0) {
      throw new TripMetricValidationError('INVALID_START_KM', 'Travel metric start KM must be zero or greater.');
    }

    const normalizedStartDate = normalizeDate(record.start_date);
    const endDate = record.end_date;
    const normalizedEndDate = endDate ? normalizeDate(endDate) : null;
    const endTime = record.end_time;
    const endKm = toNumber(record.end_km);
    const hasAnyEndField = endDate !== null || endTime !== null || record.end_km !== null;
    const isComplete = endDate !== null && endTime !== null && endKm !== null;

    if (hasAnyEndField && !isComplete) {
      throw new TripMetricValidationError(
        'INCOMPLETE_METRIC',
        `Travel metric row ${record.seq} must include end date, end time, and end KM together.`
      );
    }

    let segmentKm: number | null = null;
    let segmentHours: number | null = null;

    parseMetricTimestamp(normalizedStartDate, record.start_time);

    if (isComplete) {
      if (endKm < startKm) {
        throw new TripMetricValidationError(
          'INVALID_END_KM',
          `Travel metric row ${record.seq} has end KM earlier than start KM.`
        );
      }

      const startTimestamp = parseMetricTimestamp(normalizedStartDate, record.start_time);
      const endTimestamp = parseMetricTimestamp(normalizedEndDate!, endTime);

      if (endTimestamp < startTimestamp) {
        throw new TripMetricValidationError(
          'INVALID_METRIC_RANGE',
          `Travel metric row ${record.seq} has an end time earlier than the start time.`
        );
      }

      segmentKm = Math.max(0, roundValue(endKm - startKm));
      segmentHours = roundValue((endTimestamp - startTimestamp) / (1000 * 60 * 60));
    }

    return {
      ...record,
      start_time: normalizeTime(record.start_time),
      start_km: startKm,
      end_date: normalizedEndDate,
      end_time: endTime ? normalizeTime(endTime) : null,
      end_km: endKm,
      segment_km: segmentKm,
      segment_hours: segmentHours,
      is_complete: isComplete,
    };
  });

  const totalKm = roundValue(
    metrics.reduce((sum, metric) => sum + (metric.segment_km ?? 0), 0)
  );
  const totalHours = roundValue(
    metrics.reduce((sum, metric) => sum + (metric.segment_hours ?? 0), 0)
  );
  const firstMetric = metrics[0] ?? null;
  const completedMetrics = metrics.filter((metric) => metric.is_complete);
  const lastCompletedMetric = completedMetrics[completedMetrics.length - 1] ?? null;

  return {
    metrics,
    total_km: totalKm,
    total_hours: totalHours,
    has_incomplete_rows: metrics.some((metric) => !metric.is_complete),
    start_time: firstMetric
      ? combineMetricTimestamp(firstMetric.start_date, firstMetric.start_time)
      : null,
    end_time:
      lastCompletedMetric && lastCompletedMetric.end_date && lastCompletedMetric.end_time
        ? combineMetricTimestamp(lastCompletedMetric.end_date, lastCompletedMetric.end_time)
        : null,
    start_km: firstMetric?.start_km ?? null,
    end_km: lastCompletedMetric?.end_km ?? null,
  };
}





