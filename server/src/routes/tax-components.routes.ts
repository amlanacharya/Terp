import { Router } from 'express';
import { query } from '../config/db';
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
    const result = await query<{ gstin: string | null }>('SELECT gstin FROM customers WHERE id = $1 LIMIT 1', [body.customer_id.trim()]);
    return result.rows[0]?.gstin ?? null;
  }

  return null;
}

router.get('/', authRequired, async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const values: unknown[] = [];
    let whereClause = '';

    if (!includeInactive) {
      values.push(true);
      whereClause = `WHERE is_active = $${values.length}`;
    }

    const result = await query(
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
          updated_at
        FROM tax_components
        ${whereClause}
        ORDER BY sort_order ASC, component_code ASC
      `,
      values
    );

    res.json(
      result.rows.map((row) => ({
        ...row,
        rate: row.rate == null ? null : Number(row.rate),
        flat_amount: row.flat_amount == null ? null : Number(row.flat_amount),
      }))
    );
  } catch (error) {
    console.error('Fetching tax components failed:', error);
    res.status(500).json({ message: 'Unable to fetch tax components.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const result = await query(
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
          updated_at
        FROM tax_components
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ message: 'Tax component not found.' });
      return;
    }

    res.json({
      ...row,
      rate: row.rate == null ? null : Number(row.rate),
      flat_amount: row.flat_amount == null ? null : Number(row.flat_amount),
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

router.post('/', authRequired, roleCheck(['admin', 'accountant']), async (req, res) => {
  const payload = normalizeTaxComponentPayload(pickDefinedFields(req.body as Record<string, unknown>, taxComponentFields));
  if (!payload.component_code || !payload.name || payload.is_percentage === undefined || !payload.applies_to) {
    res.status(400).json({ message: 'Missing required tax component fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO tax_components (
          component_code, name, rate, is_percentage, flat_amount, applies_to, hsn_code, is_active, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
      `,
      [
        payload.component_code,
        payload.name,
        payload.rate ?? null,
        payload.is_percentage,
        payload.flat_amount ?? null,
        payload.applies_to,
        payload.hsn_code ?? null,
        payload.is_active ?? true,
        payload.sort_order ?? 0,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      rate: result.rows[0].rate == null ? null : Number(result.rows[0].rate),
      flat_amount: result.rows[0].flat_amount == null ? null : Number(result.rows[0].flat_amount),
    });
  } catch (error) {
    console.error('Creating tax component failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('tax component', error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'accountant']), async (req, res) => {
  const payload = normalizeTaxComponentPayload(pickDefinedFields(req.body as Record<string, unknown>, taxComponentFields));
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No tax component fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `
        UPDATE tax_components
        SET ${update.clause}, updated_at = now()
        WHERE id = $${update.values.length + 1}
        RETURNING *
      `,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Tax component not found.' });
      return;
    }

    res.json({
      ...result.rows[0],
      rate: result.rows[0].rate == null ? null : Number(result.rows[0].rate),
      flat_amount: result.rows[0].flat_amount == null ? null : Number(result.rows[0].flat_amount),
    });
  } catch (error) {
    console.error('Updating tax component failed:', error);
    res.status(500).json({ message: 'Unable to update tax component.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'accountant']), async (req, res) => {
  try {
    const result = await query('DELETE FROM tax_components WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
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


