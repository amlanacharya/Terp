import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { generateNextCode } from '../utils/auto-code';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  constraint?: string;
}

const router = Router();
const driverFields = [
  'driver_code',
  'name',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'license_number',
  'license_expiry',
  'date_of_birth',
  'blood_group',
  'emergency_contact',
  'emergency_phone',
  'pan',
  'aadhar_number',
  'bank_name',
  'bank_account',
  'ifsc_code',
  'default_vehicle_id',
  'night_halt_rate',
  'ot_per_hour',
  'is_active',
] as const;

function isNegativeNumber(value: unknown): boolean {
  return value !== null && value !== undefined && Number(value) < 0;
}

function validateDriverPayload(payload: Record<string, unknown>): string | null {
  if (isNegativeNumber(payload.night_halt_rate)) {
    return 'Night halt rate cannot be negative.';
  }

  if (isNegativeNumber(payload.ot_per_hour)) {
    return 'OT per hour cannot be negative.';
  }

  if (payload.aadhar_number !== undefined && payload.aadhar_number !== null && payload.aadhar_number !== '' && !/^[0-9]{12}$/.test(String(payload.aadhar_number))) {
    return 'Aadhaar number must be exactly 12 digits.';
  }

  return null;
}

function getDriverSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23503' && pgError.constraint?.includes('default_vehicle_id')) {
    return 'Selected default vehicle was not found.';
  }

  return 'Unable to save driver.';
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching drivers failed:', error);
    res.status(500).json({ message: 'Unable to fetch drivers.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverFields);

  if (!payload.name || !payload.phone || !payload.license_number || !payload.license_expiry) {
    res.status(400).json({ message: 'Missing required driver fields.' });
    return;
  }

  const validationError = validateDriverPayload(payload);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const driverCode = await generateNextCode(client, {
      table: 'drivers',
      column: 'driver_code',
      prefix: 'GT-DRV',
      padLength: 4,
    });

    const result = await client.query(
      `
        INSERT INTO drivers (
          driver_code, name, phone, email, address, city, state, license_number, license_expiry,
          date_of_birth, blood_group, emergency_contact, emergency_phone, pan, aadhar_number,
          bank_name, bank_account, ifsc_code, default_vehicle_id, night_halt_rate, ot_per_hour, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22
        )
        RETURNING *
      `,
      [
        driverCode,
        payload.name,
        payload.phone,
        payload.email ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.license_number,
        payload.license_expiry,
        payload.date_of_birth ?? null,
        payload.blood_group ?? null,
        payload.emergency_contact ?? null,
        payload.emergency_phone ?? null,
        payload.pan ?? null,
        payload.aadhar_number ?? null,
        payload.bank_name ?? null,
        payload.bank_account ?? null,
        payload.ifsc_code ?? null,
        payload.default_vehicle_id ?? null,
        payload.night_halt_rate ?? null,
        payload.ot_per_hour ?? null,
        payload.is_active ?? true,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating driver failed:', error);
    res.status(500).json({ message: getDriverSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No driver fields supplied for update.' });
    return;
  }

  const validationError = validateDriverPayload(payload);
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE drivers SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Driver not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating driver failed:', error);
    res.status(500).json({ message: getDriverSaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM drivers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Driver not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting driver failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('driver', error) });
  }
});

export default router;
