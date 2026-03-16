import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const customerFields = [
  'customer_code',
  'name',
  'contact_person',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'gstin',
  'credit_limit',
  'credit_days',
  'is_active',
] as const;

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching customers failed:', error);
    res.status(500).json({ message: 'Unable to fetch customers.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, customerFields);
  if (!payload.customer_code || !payload.name) {
    res.status(400).json({ message: 'Customer code and name are required.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO customers (
          customer_code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, credit_limit, credit_days, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13
        )
        RETURNING *
      `,
      [
        payload.customer_code,
        payload.name,
        payload.contact_person ?? null,
        payload.phone ?? null,
        payload.email ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.pincode ?? null,
        payload.gstin ?? null,
        payload.credit_limit ?? 0,
        payload.credit_days ?? 0,
        payload.is_active ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating customer failed:', error);
    res.status(500).json({ message: 'Unable to create customer.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, customerFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No customer fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE customers SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating customer failed:', error);
    res.status(500).json({ message: 'Unable to update customer.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting customer failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('customer', error) });
  }
});

export default router;
