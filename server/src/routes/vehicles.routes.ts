import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  constraint?: string;
}

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

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
      ELSE json_build_object('id', o.id, 'name', o.name, 'code', o.code, 'phone', o.phone)
    END AS owner,
    CASE
      WHEN vc.id IS NULL THEN NULL
      ELSE json_build_object('id', vc.id, 'name', vc.name, 'description', vc.description, 'is_active', vc.is_active)
    END AS vehicle_category
  FROM vehicles v
  LEFT JOIN owners_vendors o ON o.id = v.owner_id
  LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_id = v.id
  LEFT JOIN vehicle_categories vc ON vc.id = vcm.vehicle_category_id
`;

function getVehicleSaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505' && pgError.constraint === 'vehicles_vehicle_number_key') {
    return 'Vehicle number already exists.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('vehicle_category')) {
    return 'Selected vehicle category was not found.';
  }

  if (pgError?.code === '23503' && pgError.constraint?.includes('owner')) {
    return 'Selected vehicle owner was not found.';
  }

  return 'Unable to save vehicle.';
}

async function getVehicleById(db: Queryable, id: string) {
  const result = await db.query(`${vehicleSelect} WHERE v.id = $1`, [id]);
  return result.rows[0] ?? null;
}

async function syncVehicleCategoryMapping(db: Queryable, vehicleId: string, vehicleCategoryId: unknown) {
  if (vehicleCategoryId === null) {
    await db.query('DELETE FROM vehicle_category_mappings WHERE vehicle_id = $1', [vehicleId]);
    return;
  }

  await db.query(
    `
      INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id)
      VALUES ($1, $2)
      ON CONFLICT (vehicle_id)
      DO UPDATE SET vehicle_category_id = EXCLUDED.vehicle_category_id, updated_at = now()
    `,
    [vehicleId, vehicleCategoryId]
  );
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(`${vehicleSelect} ORDER BY v.created_at DESC`);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching vehicles failed:', error);
    res.status(500).json({ message: 'Unable to fetch vehicles.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, [...vehicleFields, vehicleCategoryField]);
  const vehiclePayload = pickDefinedFields(payload, vehicleFields);
  const hasVehicleCategoryPayload = Object.prototype.hasOwnProperty.call(payload, vehicleCategoryField);
  const vehicleCategoryId = payload[vehicleCategoryField] ?? null;

  if (!vehiclePayload.vehicle_number || !vehiclePayload.vehicle_type) {
    res.status(400).json({ message: 'Vehicle number and type are required.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO vehicles (
          vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, registration_date,
          insurance_expiry, permit_expiry, fitness_expiry, pollution_expiry, is_owned, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14
        )
        RETURNING id
      `,
      [
        vehiclePayload.vehicle_number,
        vehiclePayload.vehicle_type,
        vehiclePayload.make ?? null,
        vehiclePayload.model ?? null,
        vehiclePayload.year ?? null,
        vehiclePayload.seating_capacity ?? null,
        vehiclePayload.owner_id ?? null,
        vehiclePayload.registration_date ?? null,
        vehiclePayload.insurance_expiry ?? null,
        vehiclePayload.permit_expiry ?? null,
        vehiclePayload.fitness_expiry ?? null,
        vehiclePayload.pollution_expiry ?? null,
        vehiclePayload.is_owned ?? false,
        vehiclePayload.is_active ?? true,
      ]
    );

    const createdVehicleId = result.rows[0].id as string;

    if (hasVehicleCategoryPayload) {
      await syncVehicleCategoryMapping(client as unknown as Queryable, createdVehicleId, vehicleCategoryId);
    }

    const vehicle = await getVehicleById(client as unknown as Queryable, createdVehicleId);
    await client.query('COMMIT');

    res.status(201).json(vehicle);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating vehicle failed:', error);
    res.status(500).json({ message: getVehicleSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const vehicleId = String(req.params.id);
  const payload = pickDefinedFields(req.body as Record<string, unknown>, [...vehicleFields, vehicleCategoryField]);
  const vehiclePayload = pickDefinedFields(payload, vehicleFields);
  const hasVehicleCategoryPayload = Object.prototype.hasOwnProperty.call(payload, vehicleCategoryField);
  const vehicleCategoryId = payload[vehicleCategoryField] ?? null;

  if (Object.keys(vehiclePayload).length === 0 && !hasVehicleCategoryPayload) {
    res.status(400).json({ message: 'No vehicle fields supplied for update.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (Object.keys(vehiclePayload).length > 0) {
      const update = buildUpdateClause(vehiclePayload);
      const result = await client.query(
        `UPDATE vehicles SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING id`,
        [...update.values, vehicleId]
      );

      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Vehicle not found.' });
        return;
      }
    } else {
      const existing = await client.query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);

      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Vehicle not found.' });
        return;
      }
    }

    if (hasVehicleCategoryPayload) {
      await syncVehicleCategoryMapping(client as unknown as Queryable, vehicleId, vehicleCategoryId);
    }

    const vehicle = await getVehicleById(client as unknown as Queryable, vehicleId);
    await client.query('COMMIT');

    res.json(vehicle);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating vehicle failed:', error);
    res.status(500).json({ message: getVehicleSaveErrorMessage(error) });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Vehicle not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting vehicle failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('vehicle', error) });
  }
});

export default router;
