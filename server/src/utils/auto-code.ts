import type Database from 'better-sqlite3';

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

type PgLikeQueryable = {
  query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

type Queryable = Database.Database | PgLikeQueryable;

function isSqliteDb(db: Queryable): db is Database.Database {
  return 'prepare' in db;
}

function getNextCodeFromRows(
  values: Array<string | number | null | undefined>,
  prefix: string,
  separator: string,
  padLength: number
): string {
  const prefixWithSeparator = `${prefix}${separator}`;
  let maxValue = 0;

  for (const value of values) {
    if (typeof value !== 'string' || !value.startsWith(prefixWithSeparator)) {
      continue;
    }

    const segment = value.slice(prefixWithSeparator.length);
    const numericValue = Number(segment);
    if (Number.isInteger(numericValue) && numericValue > maxValue) {
      maxValue = numericValue;
    }
  }

  return `${prefixWithSeparator}${String(maxValue + 1).padStart(padLength, '0')}`;
}

export async function generateNextCode(db: Queryable, config: AutoCodeConfig): Promise<string> {
  const separator = config.separator ?? '-';

  if (isSqliteDb(db)) {
    const rows = db
      .prepare(`SELECT ${config.column} AS value FROM ${config.table} WHERE ${config.column} LIKE $pattern`)
      .all({ pattern: `${config.prefix}${separator}%` }) as Array<{ value: string | null }>;
    return getNextCodeFromRows(rows.map((row) => row.value), config.prefix, separator, config.padLength);
  }

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

  if (isSqliteDb(db)) {
    const prefix = String(
      (
        db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'trip_prefix' LIMIT 1").get() as
          | { setting_value?: string }
          | undefined
      )?.setting_value ?? ''
    );
    const tripRows = db.prepare('SELECT trip_number FROM trips').all() as Array<{ trip_number: string }>;
    const separator = '-';
    const usedTripNumbers = new Set<number>();
    let maxValue = 0;

    for (const row of tripRows) {
      const tripNumber = row.trip_number;
      let numericPart: string | null = null;

      if (!prefix) {
        if (/^[0-9]+$/.test(tripNumber)) {
          numericPart = tripNumber;
        }
      } else {
        const expectedPrefix = `${prefix}${separator}`;
        if (tripNumber.startsWith(expectedPrefix)) {
          numericPart = tripNumber.slice(expectedPrefix.length);
        }
      }

      if (!numericPart || !/^[0-9]{1,5}$/.test(numericPart)) {
        continue;
      }

      const numericValue = Number(numericPart);
      usedTripNumbers.add(numericValue);
      if (numericValue > maxValue) {
        maxValue = numericValue;
      }
    }

    const nextValue = maxValue + 1;
    if (nextValue <= maxTripNumber) {
      const paddedNumber = String(nextValue).padStart(5, '0');
      return {
        trip_number: prefix ? `${prefix}-${paddedNumber}` : paddedNumber,
        wrapped: false,
      };
    }

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

  const prefixResult = await db.query<{ setting_value: string }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'trip_prefix' LIMIT 1`
  );
  const prefix = prefixResult.rows[0]?.setting_value ?? '';
  await db.query('LOCK TABLE trips IN EXCLUSIVE MODE');

  const maxResult = !prefix
    ? await db.query<{ next_value: number | string }>(
        `
          SELECT COALESCE(MAX(CAST(trip_number AS INTEGER)), 0) + 1 AS next_value
          FROM trips
          WHERE trip_number ~ '^[0-9]+$'
        `
      )
    : await db.query<{ next_value: number | string }>(
        `
          SELECT COALESCE(MAX(CAST(SPLIT_PART(trip_number, $1, 2) AS INTEGER)), 0) + 1 AS next_value
          FROM trips
          WHERE trip_number LIKE $2
        `,
        ['-', `${prefix}-%`]
      );

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
