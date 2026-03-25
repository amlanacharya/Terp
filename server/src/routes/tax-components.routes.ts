import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb, query } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';
import { calculateInvoiceTaxes } from '../utils/tax-engine';

const router = Router();
const taxComponentFields = [
  'component_code',
  'name',
  'rate',
  'is_percentage',
  'flat_amount',
  'applies_to',
  'hsn_code',
  'is_active',
  'sort_order',
] as const;

function normalizeTaxComponentPayload(payload: Record<string, unknown>) {
  const normalized = { ...payload } as Record<string, unknown>;

  if ('component_code' in normalized && typeof normalized.component_code === 'string') {
    normalized.component_code = normalized.component_code.trim().toUpperCase();
  }
  if ('name' in normalized && typeof normalized.name === 'string') {
    normalized.name = normalized.name.trim();
  }
  if ('hsn_code' in normalized) {
    normalized.hsn_code = typeof normalized.hsn_code === 'string' && normalized.hsn_code.trim().length > 0
      ? normalized.hsn_code.trim()
      : null;
  }
  if ('rate' in normalized) {
    normalized.rate = normalized.rate === null || normalized.rate === '' ? null : Number(normalized.rate);
  }
  if ('flat_amount' in normalized) {
    normalized.flat_amount = normalized.flat_amount === null || normalized.flat_amount === '' ? null : Number(normalized.flat_amount);
  }
  if ('sort_order' in normalized) {
    normalized.sort_order = Number(normalized.sort_order ?? 0);
  }

  return normalized;
}

function getTaxComponentById(id: string) {
  return getDb()
    .prepare(
      `
        SELECT
          id,
          component_code,
          name,
          rate,
          is_percentage,
          flat_amount,
          applies_to,
          hsn_code,
          is_active,
          sort_order,
          created_at,
          updated_at,
          version
        FROM tax_components
        WHERE id = $id
        LIMIT 1
      `
    )
    .get({ id }) as Record<string, unknown> | undefined;
}

async function loadCompanyGstin(): Promise<string | null> {
  const result = await query<{ setting_value: string }>(
    `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'company_gstin'
      LIMIT 1
    `
  );

  return result.rows[0]?.setting_value ?? null;
}

async function resolveCustomerGstin(body: Record<string, unknown>): Promise<string | null> {
  if (typeof body.customer_gstin === 'string' && body.customer_gstin.trim().length > 0) {
    return body.customer_gstin.trim();
  }

  if (typeof body.customer_id === 'string' && body.customer_id.trim().length > 0) {
    const result = await query<{ gstin: string | null }>('SELECT gstin FROM customers WHERE id = $1 LIMIT 1', [
      body.customer_id.trim(),
    ]);
    return result.rows[0]?.gstin ?? null;
  }

  return null;
}

router.get('/', authRequired, (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive ?? '') === 'true';
    const rows = getDb()
      .prepare(
        `
          SELECT
            id,
            component_code,
            name,
            rate,
            is_percentage,
            flat_amount,
            applies_to,
            hsn_code,
            is_active,
            sort_order,
            created_at,
            updated_at,
            version
          FROM tax_components
          ${includeInactive ? '' : 'WHERE is_active = 1'}
          ORDER BY sort_order ASC, component_code ASC
        `
      )
      .all() as Array<Record<string, unknown>>;

    res.json(
      rows.map((row) => ({
        ...row,
        rate: row.rate == null ? null : Number(row.rate),
        flat_amount: row.flat_amount == null ? null : Number(row.flat_amount),
        is_active: Boolean(row.is_active),
      }))
    );
  } catch (error) {
    console.error('Fetching tax components failed:', error);
    res.status(500).json({ message: 'Unable to fetch tax components.' });
  }
});

router.get('/:id', authRequired, (req, res) => {
  try {
    const row = getTaxComponentById(String(req.params.id));
    if (!row) {
      res.status(404).json({ message: 'Tax component not found.' });
      return;
    }

    res.json({
      ...row,
      rate: row.rate == null ? null : Number(row.rate),
      flat_amount: row.flat_amount == null ? null : Number(row.flat_amount),
      is_active: Boolean(row.is_active),
    });
  } catch (error) {
    console.error('Fetching tax component failed:', error);
    res.status(500).json({ message: 'Unable to fetch tax component.' });
  }
});

router.post('/preview', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items)
      ? req.body.items
          .map((item: unknown) => ({
            taxable_base: Number((item as Record<string, unknown>).taxable_base ?? (item as Record<string, unknown>).amount ?? 0),
            hsn_code: typeof (item as Record<string, unknown>).hsn_code === 'string' ? ((item as Record<string, unknown>).hsn_code as string).trim() || null : null,
          }))
          .filter((item: { taxable_base: number; hsn_code: string | null }) => Number.isFinite(item.taxable_base) && item.taxable_base >= 0)
      : [];

    if (items.length === 0) {
      res.status(400).json({ message: 'At least one taxable item is required for preview.' });
      return;
    }

    const [companyGstin, customerGstin] = await Promise.all([loadCompanyGstin(), resolveCustomerGstin(req.body as Record<string, unknown>)]);
    const preview = await calculateInvoiceTaxes({ query }, {
      items,
      companyGstin,
      customerGstin,
    });

    res.json(preview);
  } catch (error) {
    console.error('Previewing tax components failed:', error);
    res.status(500).json({ message: 'Unable to preview tax components.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'accountant']), (req, res) => {
  const payload = normalizeTaxComponentPayload(pickDefinedFields(req.body as Record<string, unknown>, taxComponentFields));
  if (!payload.component_code || !payload.name || payload.is_percentage === undefined || !payload.applies_to) {
    res.status(400).json({ message: 'Missing required tax component fields.' });
    return;
  }

  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb().prepare(
      `
        INSERT INTO tax_components (
          id, component_code, name, rate, is_percentage, flat_amount, applies_to, hsn_code, is_active, sort_order, created_at, updated_at, version
        ) VALUES (
          $id, $component_code, $name, $rate, $is_percentage, $flat_amount, $applies_to, $hsn_code, $is_active, $sort_order, $created_at, $updated_at, 1
        )
      `
    ).run({
      id,
      component_code: payload.component_code,
      name: payload.name,
      rate: payload.rate ?? null,
      is_percentage: payload.is_percentage,
      flat_amount: payload.flat_amount ?? null,
      applies_to: payload.applies_to,
      hsn_code: payload.hsn_code ?? null,
      is_active: payload.is_active ?? true,
      sort_order: payload.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    });

    const result = getTaxComponentById(id);
    res.status(201).json({
      ...result,
      rate: result?.rate == null ? null : Number(result.rate),
      flat_amount: result?.flat_amount == null ? null : Number(result.flat_amount),
      is_active: Boolean(result?.is_active),
    });
  } catch (error) {
    console.error('Creating tax component failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('tax component', error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'accountant']), (req, res) => {
  const payload = normalizeTaxComponentPayload(pickDefinedFields(req.body as Record<string, unknown>, taxComponentFields));
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No tax component fields supplied for update.' });
    return;
  }

  const clientVersion = Number((req.body as { version?: unknown }).version);
  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const existing = db
      .prepare('SELECT id, version FROM tax_components WHERE id = $id LIMIT 1')
      .get({ id: String(req.params.id) }) as { id: string; version: number } | undefined;

    if (!existing) {
      res.status(404).json({ message: 'Tax component not found.' });
      return;
    }

    if (existing.version !== clientVersion) {
      res.status(409).json({ message: 'Tax component was updated by another user.' });
      return;
    }

    const update = buildUpdateClause(payload);
    const result = db.prepare(
      `
        UPDATE tax_components
        SET ${update.clause}, updated_at = datetime('now'), version = version + 1
        WHERE id = $id AND version = $version
      `
    ).run({
      ...update.params,
      id: String(req.params.id),
      version: clientVersion,
    });

    if (result.changes === 0) {
      res.status(409).json({ message: 'Tax component was updated by another user.' });
      return;
    }

    const updated = getTaxComponentById(String(req.params.id));
    res.json({
      ...updated,
      rate: updated?.rate == null ? null : Number(updated.rate),
      flat_amount: updated?.flat_amount == null ? null : Number(updated.flat_amount),
      is_active: Boolean(updated?.is_active),
    });
  } catch (error) {
    console.error('Updating tax component failed:', error);
    res.status(500).json({ message: 'Unable to update tax component.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'accountant']), (req, res) => {
  try {
    const result = getDb().prepare('DELETE FROM tax_components WHERE id = $id').run({ id: String(req.params.id) });
    if (result.changes === 0) {
      res.status(404).json({ message: 'Tax component not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting tax component failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('tax component', error) });
  }
});

export default router;


