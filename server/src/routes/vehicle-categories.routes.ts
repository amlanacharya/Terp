import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
}

const router = Router();
const vehicleCategoryFields = ['name', 'description', 'is_active'] as const;

function normalizeVehicleCategoryPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = pickDefinedFields(source, vehicleCategoryFields);

  if (typeof payload.name === 'string') {
    payload.name = payload.name.trim();
  }

  if (payload.description === '') {
    payload.description = null;
  }

  return payload;
}

function getVehicleCategorySaveErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23505') {
    return 'Vehicle category name already exists.';
  }

  return 'Unable to save vehicle category.';
}

async function getVehicleCategoryById(id: string) {
  const result = await query(
    `
      SELECT
        vc.*,
        COUNT(vcm.id)::int AS vehicle_count
      FROM vehicle_categories vc
      LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_category_id = vc.id
      WHERE vc.id = $1
      GROUP BY vc.id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          vc.*,
          COUNT(vcm.id)::int AS vehicle_count
        FROM vehicle_categories vc
        LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_category_id = vc.id
        GROUP BY vc.id
        ORDER BY vc.is_active DESC, LOWER(vc.name) ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching vehicle categories failed:', error);
    res.status(500).json({ message: 'Unable to fetch vehicle categories.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = normalizeVehicleCategoryPayload(req.body as Record<string, unknown>);

  if (!payload.name || typeof payload.name !== 'string') {
    res.status(400).json({ message: 'Vehicle category name is required.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO vehicle_categories (name, description, is_active)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [payload.name, payload.description ?? null, payload.is_active ?? true]
    );

    const category = await getVehicleCategoryById(result.rows[0].id as string);
    res.status(201).json(category);
  } catch (error) {
    console.error('Creating vehicle category failed:', error);
    res.status(500).json({ message: getVehicleCategorySaveErrorMessage(error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const categoryId = String(req.params.id);
  const payload = normalizeVehicleCategoryPayload(req.body as Record<string, unknown>);

  if (typeof payload.name === 'string' && payload.name.length === 0) {
    res.status(400).json({ message: 'Vehicle category name cannot be empty.' });
    return;
  }

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No vehicle category fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE vehicle_categories SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING id`,
      [...update.values, categoryId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Vehicle category not found.' });
      return;
    }

    const category = await getVehicleCategoryById(categoryId);
    res.json(category);
  } catch (error) {
    console.error('Updating vehicle category failed:', error);
    res.status(500).json({ message: getVehicleCategorySaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const categoryId = String(req.params.id);

  try {
    const usage = await query(
      'SELECT COUNT(*)::int AS vehicle_count FROM vehicle_category_mappings WHERE vehicle_category_id = $1',
      [categoryId]
    );

    if (Number(usage.rows[0]?.vehicle_count ?? 0) > 0) {
      res.status(409).json({ message: 'Cannot delete vehicle category - linked vehicles exist.' });
      return;
    }

    const result = await query('DELETE FROM vehicle_categories WHERE id = $1 RETURNING id', [categoryId]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Vehicle category not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting vehicle category failed:', error);
    res.status(500).json({ message: 'Unable to delete vehicle category.' });
  }
});

export default router;
