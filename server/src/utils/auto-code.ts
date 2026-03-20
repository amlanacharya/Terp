import { Queryable } from './rate-engine';

interface AutoCodeConfig {
  table: string;
  column: string;
  prefix: string;
  padLength: number;
  separator?: string;
}

export interface TripNumberGenerationResult {
  trip_number: string;
  wrapped: boolean;
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export async function generateNextCode(db: Queryable, config: AutoCodeConfig): Promise<string> {
  const separator = config.separator ?? '-';
  const segmentIndex = config.prefix.split(separator).length + 1;

  await db.query(`LOCK TABLE ${config.table} IN EXCLUSIVE MODE`);

  const result = await db.query<{ next_value: number | string }>(
    `
      SELECT COALESCE(MAX(CAST(SPLIT_PART(${config.column}, '${escapeLiteral(separator)}', ${segmentIndex}) AS INTEGER)), 0) + 1 AS next_value
      FROM ${config.table}
      WHERE ${config.column} LIKE $1
    `,
    [`${config.prefix}${separator}%`]
  );

  const nextValue = Number(result.rows[0]?.next_value ?? 1);
  return `${config.prefix}${separator}${String(nextValue).padStart(config.padLength, '0')}`;
}

export async function generateNextTripNumber(db: Queryable): Promise<TripNumberGenerationResult> {
  const maxTripNumber = 99999;

  // Read trip_prefix from system_settings
  const prefixResult = await db.query<{ setting_value: string }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'trip_prefix' LIMIT 1`
  );
  const prefix = prefixResult.rows[0]?.setting_value ?? '';

  await db.query('LOCK TABLE trips IN EXCLUSIVE MODE');

  let maxResult;

  if (!prefix) {
    // No prefix: find max numeric trip number
    maxResult = await db.query<{ next_value: number | string }>(
      `
        SELECT COALESCE(MAX(CAST(trip_number AS INTEGER)), 0) + 1 AS next_value
        FROM trips
        WHERE trip_number ~ '^[0-9]+$'
      `
    );
  } else {
    // With prefix: find max numeric part after prefix
    const separator = '-';
    maxResult = await db.query<{ next_value: number | string }>(
      `
        SELECT COALESCE(MAX(CAST(SPLIT_PART(trip_number, $1, 2) AS INTEGER)), 0) + 1 AS next_value
        FROM trips
        WHERE trip_number LIKE $2
      `,
      [separator, `${prefix}${separator}%`]
    );
  }

  const nextValue = Number(maxResult.rows[0]?.next_value ?? 1);
  if (nextValue <= maxTripNumber) {
    const paddedNumber = String(nextValue).padStart(5, '0');
    return {
      trip_number: prefix ? `${prefix}-${paddedNumber}` : paddedNumber,
      wrapped: false,
    };
  }

  // When number range exhausted, find unused number
  let usedResult;
  if (!prefix) {
    usedResult = await db.query<{ trip_number: number | string }>(
      `
        SELECT CAST(trip_number AS INTEGER) AS trip_number
        FROM trips
        WHERE trip_number ~ '^[0-9]{1,5}$'
      `
    );
  } else {
    usedResult = await db.query<{ trip_number: number | string }>(
      `
        SELECT CAST(SPLIT_PART(trip_number, $1, 2) AS INTEGER) AS trip_number
        FROM trips
        WHERE trip_number LIKE $2
      `,
      ['-', `${prefix}-%`]
    );
  }

  const usedTripNumbers = new Set(usedResult.rows.map((row) => Number(row.trip_number)));

  for (let candidate = 1; candidate <= maxTripNumber; candidate += 1) {
    if (!usedTripNumbers.has(candidate)) {
      const paddedNumber = String(candidate).padStart(5, '0');
      return {
        trip_number: prefix ? `${prefix}-${paddedNumber}` : paddedNumber,
        wrapped: true,
      };
    }
  }

  throw new Error('Duty slip number range 00001-99999 is exhausted. Contact the IT team before creating more trips.');
}
