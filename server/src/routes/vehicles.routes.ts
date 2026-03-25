import { randomUUID } from 'crypto';
import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  constraint?: string;
  message?: string;
}

type VehicleRow = Record<string, unknown> & {
  owner: string | null;
  vehicle_category: string | null;
};

const router = Router();
const vehicleFields = [
  'vehicle_number',
  'vehicle_type',
  'make',
  'model',
  'year',
  'seating_capacity',
  'owner_id',
  'registration_date',
  'insurance_expiry',
  'permit_expiry',
  'fitness_expiry',
  'pollution_expiry',
  'is_owned',
  'is_active',
] as const;
const vehicleCategoryField = 'vehicle_category_id';
const vehicleSelect = `
  SELECT
    v.*,
    CASE
      WHEN o.id IS NULL THEN NULL
      ELSE json_object('id', o.id, 'name', o.name, 'code', o.code, 'phone', o.phone)
    END AS owner,
    CASE
      WHEN vc.id IS NULL THEN NULL
      ELSE json_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active)
    END AS vehicle_category
  FROM vehicles v
  LEFT JOIN owners_vendors o ON o.id = v.owner_id
  LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_id = v.id
  LEFT JOIN vehicle_categories vc ON vc.id = vcm.vehicle_category_id
`;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function toJsonObject(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) {
    return value ?? null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function mapVehicleRow(row: Record<string, unknown> | undefined): VehicleRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    owner: toJsonObject(row.owner) as string | null,
    vehicle_category: toJsonObject(row.vehicle_category) as string | null,
  };
}

function getVehicleSaveErrorMessage(error: unknown): string {
  const sqliteError = error as PgLikeError | undefined;
  const message = sqliteError?.message ?? '';

  if (message === 'Selected vehicle owner was not found.' || message === 'Selected vehicle category was not found.') {
    return message;
  }

  if (
    sqliteError?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    message.includes('UNIQUE constraint failed: vehicles.vehicle_number')
  ) {
    return 'Vehicle number already exists.';
  }

  if (
    sqliteError?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    message.includes('FOREIGN KEY constraint failed')
  ) {
    if (message.includes('vehicle_category_mappings')) {
      return 'Selected vehicle category was not found.';
    }

    if (message.includes('vehicles.owner_id') || message.includes('owners_vendors')) {
      return 'Selected vehicle owner was not found.';
    }
  }

  return 'Unable to save vehicle.';
}

function getVehicleDeleteErrorMessage(error: unknown): string {
  const sqliteError = error as PgLikeError | undefined;
  const message = sqliteError?.message ?? '';

  if (sqliteError?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || message.includes('FOREIGN KEY constraint failed')) {
    return 'Cannot delete vehicle - linked records exist.';
  }

  return 'Unable to delete vehicle.';
}

function prepareVehicleSelect(db: ReturnType<typeof getDb>, id: string): VehicleRow | null {
  const row = db.prepare(`${vehicleSelect} WHERE v.id = $id`).get({ id }) as Record<string, unknown> | undefined;
  return mapVehicleRow(row);
}

function ensureOwnerExists(db: ReturnType<typeof getDb>, ownerId: unknown): boolean {
  if (isEmpty(ownerId)) {
    return true;
  }

  const row = db.prepare('SELECT id FROM owners_vendors WHERE id = $id LIMIT 1').get({ id: ownerId });
  return Boolean(row);
}

function ensureVehicleCategoryExists(db: ReturnType<typeof getDb>, vehicleCategoryId: unknown): boolean {
  if (isEmpty(vehicleCategoryId)) {
    return true;
  }

  const row = db.prepare('SELECT id FROM vehicle_categories WHERE id = $id LIMIT 1').get({ id: vehicleCategoryId });
  return Boolean(row);
}

function syncVehicleCategoryMapping(db: ReturnType<typeof getDb>, vehicleId: string, vehicleCategoryId: unknown): void {
  if (isEmpty(vehicleCategoryId)) {
    db.prepare('DELETE FROM vehicle_category_mappings WHERE vehicle_id = $vehicleId').run({ vehicleId });
    return;
  }

  db.prepare(
    `
      INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id, created_at, updated_at, version)
      VALUES ($vehicleId, $vehicleCategoryId, datetime('now'), datetime('now'), 1)
      ON CONFLICT(vehicle_id)
      DO UPDATE SET
        vehicle_category_id = excluded.vehicle_category_id,
        updated_at = datetime('now'),
        version = vehicle_category_mappings.version + 1
    `
  ).run({ vehicleId, vehicleCategoryId });
}

router.get('/', authRequired, (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`${vehicleSelect} ORDER BY v.created_at DESC`).all() as Array<Record<string, unknown>>;
    res.json(rows.map((row) => mapVehicleRow(row)));
  } catch (error) {
    console.error('Fetching vehicles failed:', error);
    res.status(500).json({ message: 'Unable to fetch vehicles.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, [...vehicleFields, vehicleCategoryField]);
  const vehiclePayload = pickDefinedFields(payload, vehicleFields);
  const hasVehicleCategoryPayload = Object.prototype.hasOwnProperty.call(payload, vehicleCategoryField);
  const vehicleCategoryId = payload[vehicleCategoryField] ?? null;

  if (isEmpty(vehiclePayload.vehicle_number) || isEmpty(vehiclePayload.vehicle_type)) {
    res.status(400).json({ message: 'Vehicle number and type are required.' });
    return;
  }

  const db = getDb();
  const createVehicle = db.transaction(() => {
    if (!ensureOwnerExists(db, vehiclePayload.owner_id)) {
      throw new Error('Selected vehicle owner was not found.');
    }

    if (hasVehicleCategoryPayload && !ensureVehicleCategoryExists(db, vehicleCategoryId)) {
      throw new Error('Selected vehicle category was not found.');
    }

    const vehicleId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO vehicles (
          id, vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, registration_date,
          insurance_expiry, permit_expiry, fitness_expiry, pollution_expiry, is_owned, is_active,
          created_at, updated_at, version
        ) VALUES (
          $id, $vehicle_number, $vehicle_type, $make, $model, $year, $seating_capacity, $owner_id, $registration_date,
          $insurance_expiry, $permit_expiry, $fitness_expiry, $pollution_expiry, $is_owned, $is_active,
          $created_at, $updated_at, 1
        )
      `
    ).run({
      id: vehicleId,
      vehicle_number: vehiclePayload.vehicle_number,
      vehicle_type: vehiclePayload.vehicle_type,
      make: vehiclePayload.make ?? null,
      model: vehiclePayload.model ?? null,
      year: vehiclePayload.year ?? null,
      seating_capacity: vehiclePayload.seating_capacity ?? null,
      owner_id: vehiclePayload.owner_id ?? null,
      registration_date: vehiclePayload.registration_date ?? null,
      insurance_expiry: vehiclePayload.insurance_expiry ?? null,
      permit_expiry: vehiclePayload.permit_expiry ?? null,
      fitness_expiry: vehiclePayload.fitness_expiry ?? null,
      pollution_expiry: vehiclePayload.pollution_expiry ?? null,
      is_owned: vehiclePayload.is_owned ?? false,
      is_active: vehiclePayload.is_active ?? true,
      created_at: now,
      updated_at: now,
    });

    if (hasVehicleCategoryPayload) {
      syncVehicleCategoryMapping(db, vehicleId, vehicleCategoryId);
    }

    return prepareVehicleSelect(db, vehicleId);
  });

  try {
    const vehicle = createVehicle();
    res.status(201).json(vehicle);
  } catch (error) {
    const message = (error as { message?: string }).message;
    if (message === 'Selected vehicle owner was not found.' || message === 'Selected vehicle category was not found.') {
      res.status(400).json({ message });
      return;
    }

    console.error('Creating vehicle failed:', error);
    res.status(500).json({ message: getVehicleSaveErrorMessage(error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
  const vehicleId = String(req.params.id);
  const payload = pickDefinedFields(req.body as Record<string, unknown>, [...vehicleFields, vehicleCategoryField]);
  const vehiclePayload = pickDefinedFields(payload, vehicleFields);
  const hasVehicleCategoryPayload = Object.prototype.hasOwnProperty.call(payload, vehicleCategoryField);
  const vehicleCategoryId = payload[vehicleCategoryField] ?? null;
  const clientVersion = Number((req.body as Record<string, unknown>).version);

  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'Vehicle version is required for updates.' });
    return;
  }

  if (Object.keys(vehiclePayload).length === 0 && !hasVehicleCategoryPayload) {
    res.status(400).json({ message: 'No vehicle fields supplied for update.' });
    return;
  }

  const db = getDb();
  const updateVehicle = db.transaction(() => {
    const currentVehicle = prepareVehicleSelect(db, vehicleId);
    if (!currentVehicle) {
      const error = new Error('Vehicle not found.');
      error.name = 'NotFoundError';
      throw error;
    }

    const currentVersion = Number(currentVehicle.version ?? 0);
    if (currentVersion !== clientVersion) {
      const error = new Error('Vehicle has been modified by another user.');
      error.name = 'ConflictError';
      throw error;
    }

    if (vehiclePayload.owner_id !== undefined && !ensureOwnerExists(db, vehiclePayload.owner_id)) {
      throw new Error('Selected vehicle owner was not found.');
    }

    if (hasVehicleCategoryPayload && !ensureVehicleCategoryExists(db, vehicleCategoryId)) {
      throw new Error('Selected vehicle category was not found.');
    }

    const now = new Date().toISOString();
    const updateFields = {
      ...vehiclePayload,
      updated_at: now,
    } as Record<string, unknown>;
    const update = buildUpdateClause(updateFields);
    const updateSql =
      Object.keys(update.params).length > 0
        ? `UPDATE vehicles SET ${update.clause}, version = version + 1 WHERE id = $id AND version = $version`
        : `UPDATE vehicles SET updated_at = $updated_at, version = version + 1 WHERE id = $id AND version = $version`;
    const updateParams =
      Object.keys(update.params).length > 0
        ? { ...update.params, id: vehicleId, version: clientVersion }
        : { updated_at: now, id: vehicleId, version: clientVersion };

    const result = db.prepare(updateSql).run(updateParams);
    if (result.changes === 0) {
      const error = new Error('Vehicle has been modified by another user.');
      error.name = 'ConflictError';
      throw error;
    }

    if (hasVehicleCategoryPayload) {
      syncVehicleCategoryMapping(db, vehicleId, vehicleCategoryId);
    }

    return prepareVehicleSelect(db, vehicleId);
  });

  try {
    const vehicle = updateVehicle();
    res.json(vehicle);
  } catch (error) {
    const message = (error as { message?: string }).message;
    if (message === 'Selected vehicle owner was not found.' || message === 'Selected vehicle category was not found.') {
      res.status(400).json({ message });
      return;
    }

    if ((error as { name?: string }).name === 'NotFoundError') {
      res.status(404).json({ message: 'Vehicle not found.' });
      return;
    }

    if ((error as { name?: string }).name === 'ConflictError') {
      res.status(409).json({ message: 'Vehicle was updated by another user. Reload and try again.' });
      return;
    }

    console.error('Updating vehicle failed:', error);
    res.status(500).json({ message: getVehicleSaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM vehicles WHERE id = $id').run({ id: req.params.id });

    if (result.changes === 0) {
      res.status(404).json({ message: 'Vehicle not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting vehicle failed:', error);
    res.status(500).json({ message: getVehicleDeleteErrorMessage(error) });
  }
});

export default router;
