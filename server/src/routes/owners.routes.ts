import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { generateNextCode } from '../utils/auto-code';
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
  'aadhar_number',
  'bank_name',
  'bank_account',
  'ifsc_code',
  'is_active',
] as const;

function isAadhaarValid(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9]{12}$/.test(value);
}

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
  if (!payload.name) {
    res.status(400).json({ message: 'Owner name is required.' });
    return;
  }

  if (payload.aadhar_number !== undefined && payload.aadhar_number !== null && payload.aadhar_number !== '' && !isAadhaarValid(payload.aadhar_number)) {
    res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerCode = await generateNextCode(client, {
      table: 'owners_vendors',
      column: 'code',
      prefix: 'GT-OWN',
      padLength: 4,
    });

    const result = await client.query(
      `
        INSERT INTO owners_vendors (
          code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, pan, aadhar_number, bank_name, bank_account, ifsc_code, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING *
      `,
      [
        ownerCode,
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
        payload.aadhar_number ?? null,
        payload.bank_name ?? null,
        payload.bank_account ?? null,
        payload.ifsc_code ?? null,
        payload.is_active ?? true,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating owner failed:', error);
    res.status(500).json({ message: 'Unable to create owner.' });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No owner fields supplied for update.' });
    return;
  }

  if (payload.aadhar_number !== undefined && payload.aadhar_number !== null && payload.aadhar_number !== '' && !isAadhaarValid(payload.aadhar_number)) {
    res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits.' });
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
