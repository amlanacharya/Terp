import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const tripFields = [
  'trip_number',
  'customer_id',
  'route_id',
  'vehicle_id',
  'driver_id',
  'trip_date',
  'start_time',
  'end_time',
  'start_km',
  'end_km',
  'actual_km',
  'from_location',
  'to_location',
  'purpose',
  'passengers',
  'status',
  'trip_amount',
  'driver_allowance',
  'toll_charges',
  'parking_charges',
  'other_charges',
  'remarks',
] as const;

router.get('/', authRequired, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  try {
    const values: unknown[] = [];
    const whereClause = status ? 'WHERE t.status = $1' : '';
    if (status) {
      values.push(status);
    }

    const result = await query(
      `
        SELECT
          t.*,
          json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
          json_build_object('id', d.id, 'name', d.name, 'driver_code', d.driver_code, 'phone', d.phone) AS driver,
          json_build_object('id', v.id, 'vehicle_number', v.vehicle_number, 'vehicle_type', v.vehicle_type) AS vehicle
        FROM trips t
        JOIN customers c ON c.id = t.customer_id
        JOIN drivers d ON d.id = t.driver_id
        JOIN vehicles v ON v.id = t.vehicle_id
        ${whereClause}
        ORDER BY t.trip_date DESC, t.created_at DESC
      `,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching trips failed:', error);
    res.status(500).json({ message: 'Unable to fetch trips.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, tripFields);
  const requiredFields = ['trip_number', 'customer_id', 'vehicle_id', 'driver_id', 'trip_date', 'from_location', 'to_location', 'trip_amount'];

  if (requiredFields.some((field) => payload[field] === undefined || payload[field] === '')) {
    res.status(400).json({ message: 'Missing required trip fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO trips (
          trip_number, customer_id, route_id, vehicle_id, driver_id, trip_date, start_time, end_time, start_km,
          end_km, actual_km, from_location, to_location, purpose, passengers, status, trip_amount, driver_allowance,
          toll_charges, parking_charges, other_charges, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23
        )
        RETURNING *
      `,
      [
        payload.trip_number,
        payload.customer_id,
        payload.route_id ?? null,
        payload.vehicle_id,
        payload.driver_id,
        payload.trip_date,
        payload.start_time ?? null,
        payload.end_time ?? null,
        payload.start_km ?? null,
        payload.end_km ?? null,
        payload.actual_km ?? null,
        payload.from_location,
        payload.to_location,
        payload.purpose ?? null,
        payload.passengers ?? null,
        payload.status ?? 'scheduled',
        payload.trip_amount,
        payload.driver_allowance ?? 0,
        payload.toll_charges ?? 0,
        payload.parking_charges ?? 0,
        payload.other_charges ?? 0,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating trip failed:', error);
    res.status(500).json({ message: 'Unable to create trip.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, tripFields);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No trip fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE trips SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating trip failed:', error);
    res.status(500).json({ message: 'Unable to update trip.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Trip not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting trip failed:', error);
    res.status(500).json({ message: 'Unable to delete trip.' });
  }
});

export default router;
