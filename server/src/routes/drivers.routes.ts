import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

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
  'bank_name',
  'bank_account',
  'ifsc_code',
  'is_active',
] as const;

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching drivers failed:', error);
    res.status(500).json({ message: 'Unable to fetch drivers.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverFields);

  if (!payload.driver_code || !payload.name || !payload.phone || !payload.license_number || !payload.license_expiry) {
    res.status(400).json({ message: 'Missing required driver fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO drivers (
          driver_code, name, phone, email, address, city, state, license_number, license_expiry,
          date_of_birth, blood_group, emergency_contact, emergency_phone, pan, bank_name,
          bank_account, ifsc_code, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18
        )
        RETURNING *
      `,
      [
        payload.driver_code,
        payload.name,
        payload.phone,
        payload.email ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.license_number,
        payload.license_expiry,
        payload.date_of_birth ?? null,
        payload.blood_group ?? null,
        payload.emergency_contact ?? null,
        payload.emergency_phone ?? null,
        payload.pan ?? null,
        payload.bank_name ?? null,
        payload.bank_account ?? null,
        payload.ifsc_code ?? null,
        payload.is_active ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating driver failed:', error);
    res.status(500).json({ message: 'Unable to create driver.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No driver fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE drivers SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Driver not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating driver failed:', error);
    res.status(500).json({ message: 'Unable to update driver.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM drivers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
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
