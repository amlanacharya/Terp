import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const ownerFields = [
  'code',
  'name',
  'contact_person',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'gstin',
  'pan',
  'bank_name',
  'bank_account',
  'ifsc_code',
  'is_active',
] as const;

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM owners_vendors ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching owners failed:', error);
    res.status(500).json({ message: 'Unable to fetch owners.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerFields);
  if (!payload.code || !payload.name) {
    res.status(400).json({ message: 'Owner code and name are required.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO owners_vendors (
          code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, pan, bank_name, bank_account, ifsc_code, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `,
      [
        payload.code,
        payload.name,
        payload.contact_person ?? null,
        payload.phone ?? null,
        payload.email ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.pincode ?? null,
        payload.gstin ?? null,
        payload.pan ?? null,
        payload.bank_name ?? null,
        payload.bank_account ?? null,
        payload.ifsc_code ?? null,
        payload.is_active ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating owner failed:', error);
    res.status(500).json({ message: 'Unable to create owner.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No owner fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE owners_vendors SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Owner not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating owner failed:', error);
    res.status(500).json({ message: 'Unable to update owner.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM owners_vendors WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Owner not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting owner failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('owner', error) });
  }
});

export default router;
