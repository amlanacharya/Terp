import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

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

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          v.*,
          CASE
            WHEN o.id IS NULL THEN NULL
            ELSE json_build_object('id', o.id, 'name', o.name, 'code', o.code, 'phone', o.phone)
          END AS owner
        FROM vehicles v
        LEFT JOIN owners_vendors o ON o.id = v.owner_id
        ORDER BY v.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching vehicles failed:', error);
    res.status(500).json({ message: 'Unable to fetch vehicles.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, vehicleFields);
  if (!payload.vehicle_number || !payload.vehicle_type) {
    res.status(400).json({ message: 'Vehicle number and type are required.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO vehicles (
          vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, registration_date,
          insurance_expiry, permit_expiry, fitness_expiry, pollution_expiry, is_owned, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `,
      [
        payload.vehicle_number,
        payload.vehicle_type,
        payload.make ?? null,
        payload.model ?? null,
        payload.year ?? null,
        payload.seating_capacity ?? null,
        payload.owner_id ?? null,
        payload.registration_date ?? null,
        payload.insurance_expiry ?? null,
        payload.permit_expiry ?? null,
        payload.fitness_expiry ?? null,
        payload.pollution_expiry ?? null,
        payload.is_owned ?? false,
        payload.is_active ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating vehicle failed:', error);
    res.status(500).json({ message: 'Unable to create vehicle.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, vehicleFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No vehicle fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE vehicles SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Vehicle not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating vehicle failed:', error);
    res.status(500).json({ message: 'Unable to update vehicle.' });
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
    res.status(500).json({ message: 'Unable to delete vehicle.' });
  }
});

export default router;
