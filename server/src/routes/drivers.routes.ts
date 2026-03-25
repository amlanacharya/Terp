import { randomUUID } from 'crypto';
import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { generateNextCode } from '../utils/auto-code';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  constraint?: string;
  message?: string;
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
  const message = pgError?.message ?? '';

  if (pgError?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || message.includes('FOREIGN KEY constraint failed')) {
    if (message.includes('default_vehicle_id') || message.includes('vehicles')) {
      return 'Selected default vehicle was not found.';
    }
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('default_vehicle_id')) {
    return 'Selected default vehicle was not found.';
  }

  return 'Unable to save driver.';
}

function getDriverById(id: string) {
  return getDb()
    .prepare('SELECT * FROM drivers WHERE id = $id LIMIT 1')
    .get({ id }) as Record<string, unknown> | undefined;
}

router.get('/', authRequired, (_req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM drivers ORDER BY created_at DESC').all();
    res.json(rows);
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

  try {
    const db = getDb();
    const driverCode = await generateNextCode(db, {
      table: 'drivers',
      column: 'driver_code',
      prefix: 'GT-DRV',
      padLength: 4,
    });
    const driverId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO drivers (
          id, driver_code, name, phone, email, address, city, state, license_number, license_expiry,
          date_of_birth, blood_group, emergency_contact, emergency_phone, pan, aadhar_number,
          bank_name, bank_account, ifsc_code, default_vehicle_id, night_halt_rate, ot_per_hour, is_active,
          created_at, updated_at, version
        ) VALUES (
          $id, $driver_code, $name, $phone, $email, $address, $city, $state, $license_number, $license_expiry,
          $date_of_birth, $blood_group, $emergency_contact, $emergency_phone, $pan, $aadhar_number,
          $bank_name, $bank_account, $ifsc_code, $default_vehicle_id, $night_halt_rate, $ot_per_hour, $is_active,
          $created_at, $updated_at, 1
        )
      `,
    ).run({
      id: driverId,
      driver_code: driverCode,
      name: payload.name,
      phone: payload.phone,
      email: payload.email ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      license_number: payload.license_number,
      license_expiry: payload.license_expiry,
      date_of_birth: payload.date_of_birth ?? null,
      blood_group: payload.blood_group ?? null,
      emergency_contact: payload.emergency_contact ?? null,
      emergency_phone: payload.emergency_phone ?? null,
      pan: payload.pan ?? null,
      aadhar_number: payload.aadhar_number ?? null,
      bank_name: payload.bank_name ?? null,
      bank_account: payload.bank_account ?? null,
      ifsc_code: payload.ifsc_code ?? null,
      default_vehicle_id: payload.default_vehicle_id ?? null,
      night_halt_rate: payload.night_halt_rate ?? null,
      ot_per_hour: payload.ot_per_hour ?? null,
      is_active: payload.is_active ?? true,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json(getDriverById(driverId));
  } catch (error) {
    console.error('Creating driver failed:', error);
    res.status(500).json({ message: getDriverSaveErrorMessage(error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
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

  const clientVersion = Number((req.body as { version?: unknown }).version);
  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'Driver version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const current = db.prepare('SELECT id, version FROM drivers WHERE id = $id LIMIT 1').get({ id: req.params.id }) as
      | { id: string; version: number }
      | undefined;

    if (!current) {
      res.status(404).json({ message: 'Driver not found.' });
      return;
    }

    if (current.version !== clientVersion) {
      res.status(409).json({ message: 'Driver was updated by another user.' });
      return;
    }

    const update = buildUpdateClause(payload);
    const result = db.prepare(
      `UPDATE drivers SET ${update.clause}, updated_at = datetime('now'), version = version + 1 WHERE id = $id AND version = $version`
    ).run({
      ...update.params,
      id: req.params.id,
      version: clientVersion,
    });

    if (result.changes === 0) {
      res.status(409).json({ message: 'Driver was updated by another user.' });
      return;
    }

    res.json(getDriverById(String(req.params.id)));
  } catch (error) {
    console.error('Updating driver failed:', error);
    res.status(500).json({ message: getDriverSaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), (req, res) => {
  try {
    const result = getDb().prepare('DELETE FROM drivers WHERE id = $id').run({ id: req.params.id });
    if (result.changes === 0) {
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
