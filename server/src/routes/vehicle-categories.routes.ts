import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface PgLikeError {
  code?: string;
  message?: string;
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

  if (pgError?.code === 'SQLITE_CONSTRAINT_UNIQUE' || pgError?.message?.includes('UNIQUE constraint failed')) {
    return 'Vehicle category name already exists.';
  }

  return 'Unable to save vehicle category.';
}

function getVehicleCategoryById(id: string) {
  const db = getDb();
  const result = db
    .prepare(
      `
        SELECT
          vc.*,
          CAST(COUNT(vcm.id) AS INTEGER) AS vehicle_count
        FROM vehicle_categories vc
        LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_category_id = vc.id
        WHERE vc.id = $id
        GROUP BY vc.id
      `
    )
    .get({ id });

  return result ?? null;
}

router.get('/', authRequired, (_req, res) => {
  try {
    const result = getDb()
      .prepare(
      `
        SELECT
          vc.*,
          CAST(COUNT(vcm.id) AS INTEGER) AS vehicle_count
        FROM vehicle_categories vc
        LEFT JOIN vehicle_category_mappings vcm ON vcm.vehicle_category_id = vc.id
        GROUP BY vc.id
        ORDER BY vc.is_active DESC, LOWER(vc.name) ASC
      `
      )
      .all();

    res.json(result);
  } catch (error) {
    console.error('Fetching vehicle categories failed:', error);
    res.status(500).json({ message: 'Unable to fetch vehicle categories.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
  const payload = normalizeVehicleCategoryPayload(req.body as Record<string, unknown>);

  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    res.status(400).json({ message: 'Vehicle category name is required.' });
    return;
  }

  try {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      `
        INSERT INTO vehicle_categories (id, name, description, is_active, created_at, updated_at, version)
        VALUES ($id, $name, $description, $is_active, datetime('now'), datetime('now'), 1)
      `,
    ).run({
      id,
      name: payload.name,
      description: payload.description ?? null,
      is_active: payload.is_active ?? true,
    });

    const category = getVehicleCategoryById(id);
    res.status(201).json(category);
  } catch (error) {
    console.error('Creating vehicle category failed:', error);
    res.status(500).json({ message: getVehicleCategorySaveErrorMessage(error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
  const categoryId = String(req.params.id);
  const payload = normalizeVehicleCategoryPayload(req.body as Record<string, unknown>);
  const clientVersion = Number((req.body as Record<string, unknown>).version);

  if (typeof payload.name === 'string' && payload.name.length === 0) {
    res.status(400).json({ message: 'Vehicle category name cannot be empty.' });
    return;
  }

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No vehicle category fields supplied for update.' });
    return;
  }

  if (!Number.isInteger(clientVersion) || clientVersion <= 0) {
    res.status(400).json({ message: 'Vehicle category version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const update = buildUpdateClause(payload);
    const result = db
      .prepare(
        `
          UPDATE vehicle_categories
          SET ${update.clause},
              updated_at = datetime('now'),
              version = version + 1
          WHERE id = $id AND version = $version
        `
      )
      .run({ ...update.params, id: categoryId, version: clientVersion });

    if (result.changes === 0) {
      const existing = db.prepare('SELECT id, version FROM vehicle_categories WHERE id = $id').get({ id: categoryId }) as
        | { id: string; version: number }
        | undefined;

      if (!existing) {
        res.status(404).json({ message: 'Vehicle category not found.' });
        return;
      }

      res.status(409).json({ message: 'Vehicle category was updated by another user.' });
      return;
    }

    const category = getVehicleCategoryById(categoryId);
    res.json(category);
  } catch (error) {
    console.error('Updating vehicle category failed:', error);
    res.status(500).json({ message: getVehicleCategorySaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), (req, res) => {
  const categoryId = String(req.params.id);

  try {
    const db = getDb();
    const usage = db
      .prepare('SELECT CAST(COUNT(*) AS INTEGER) AS vehicle_count FROM vehicle_category_mappings WHERE vehicle_category_id = $id')
      .get({ id: categoryId }) as { vehicle_count: number } | undefined;

    if (Number(usage?.vehicle_count ?? 0) > 0) {
      res.status(409).json({ message: 'Cannot delete vehicle category - linked vehicles exist.' });
      return;
    }

    const result = db.prepare('DELETE FROM vehicle_categories WHERE id = $id').run({ id: categoryId });

    if (result.changes === 0) {
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
