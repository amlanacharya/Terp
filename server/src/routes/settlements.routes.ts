import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const driverSettlementFields = [
  'settlement_number',
  'driver_id',
  'period_from',
  'period_to',
  'total_trips',
  'total_km',
  'total_allowance',
  'advances',
  'deductions',
  'net_amount',
  'payment_mode',
  'payment_date',
  'reference_number',
  'status',
  'remarks',
] as const;

const ownerSettlementFields = [
  'settlement_number',
  'owner_id',
  'vehicle_id',
  'period_from',
  'period_to',
  'total_trips',
  'total_km',
  'total_amount',
  'tds_amount',
  'other_deductions',
  'net_amount',
  'payment_mode',
  'payment_date',
  'reference_number',
  'status',
  'remarks',
] as const;

router.get('/drivers', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          ds.*,
          json_build_object('id', d.id, 'name', d.name, 'driver_code', d.driver_code, 'phone', d.phone) AS driver
        FROM driver_settlements ds
        JOIN drivers d ON d.id = ds.driver_id
        ORDER BY ds.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching driver settlements failed:', error);
    res.status(500).json({ message: 'Unable to fetch driver settlements.' });
  }
});

router.post('/drivers', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverSettlementFields);
  if (!payload.settlement_number || !payload.driver_id || !payload.period_from || !payload.period_to || payload.net_amount === undefined) {
    res.status(400).json({ message: 'Missing required driver settlement fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO driver_settlements (
          settlement_number, driver_id, period_from, period_to, total_trips, total_km, total_allowance,
          advances, deductions, net_amount, payment_mode, payment_date, reference_number, status, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING *
      `,
      [
        payload.settlement_number,
        payload.driver_id,
        payload.period_from,
        payload.period_to,
        payload.total_trips ?? 0,
        payload.total_km ?? 0,
        payload.total_allowance ?? 0,
        payload.advances ?? 0,
        payload.deductions ?? 0,
        payload.net_amount,
        payload.payment_mode ?? null,
        payload.payment_date ?? null,
        payload.reference_number ?? null,
        payload.status ?? 'pending',
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating driver settlement failed:', error);
    res.status(500).json({ message: 'Unable to create driver settlement.' });
  }
});

router.put('/drivers/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, driverSettlementFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No driver settlement fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE driver_settlements SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Driver settlement not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating driver settlement failed:', error);
    res.status(500).json({ message: 'Unable to update driver settlement.' });
  }
});

router.get('/owners', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          os.*,
          json_build_object('id', o.id, 'name', o.name, 'code', o.code, 'phone', o.phone) AS owner,
          CASE
            WHEN v.id IS NULL THEN NULL
            ELSE json_build_object('id', v.id, 'vehicle_number', v.vehicle_number, 'vehicle_type', v.vehicle_type)
          END AS vehicle
        FROM owner_settlements os
        JOIN owners_vendors o ON o.id = os.owner_id
        LEFT JOIN vehicles v ON v.id = os.vehicle_id
        ORDER BY os.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching owner settlements failed:', error);
    res.status(500).json({ message: 'Unable to fetch owner settlements.' });
  }
});

router.post('/owners', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerSettlementFields);
  if (!payload.settlement_number || !payload.owner_id || !payload.period_from || !payload.period_to || payload.net_amount === undefined) {
    res.status(400).json({ message: 'Missing required owner settlement fields.' });
    return;
  }

  try {
    const result = await query(
      `
        INSERT INTO owner_settlements (
          settlement_number, owner_id, vehicle_id, period_from, period_to, total_trips, total_km, total_amount,
          tds_amount, other_deductions, net_amount, payment_mode, payment_date, reference_number, status, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        RETURNING *
      `,
      [
        payload.settlement_number,
        payload.owner_id,
        payload.vehicle_id ?? null,
        payload.period_from,
        payload.period_to,
        payload.total_trips ?? 0,
        payload.total_km ?? 0,
        payload.total_amount ?? 0,
        payload.tds_amount ?? 0,
        payload.other_deductions ?? 0,
        payload.net_amount,
        payload.payment_mode ?? null,
        payload.payment_date ?? null,
        payload.reference_number ?? null,
        payload.status ?? 'pending',
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating owner settlement failed:', error);
    res.status(500).json({ message: 'Unable to create owner settlement.' });
  }
});

router.put('/owners/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerSettlementFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No owner settlement fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE owner_settlements SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Owner settlement not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating owner settlement failed:', error);
    res.status(500).json({ message: 'Unable to update owner settlement.' });
  }
});

export default router;
