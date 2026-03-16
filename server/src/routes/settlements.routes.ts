import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildDriverSettlementPdf, buildOwnerSettlementPdf } from '../utils/pdf-settlement';
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

async function getSettlementSettings(): Promise<Record<string, string>> {
  const result = await query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key = ANY($1)
    `,
    [['company_name', 'company_address']]
  );

  return Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string>;
}

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

router.get('/drivers/:id/pdf', authRequired, async (req, res) => {
  try {
    const [settlementResult, tripResult, settings] = await Promise.all([
      query<{
        settlement_number: string;
        period_from: string;
        period_to: string;
        total_trips: number;
        total_km: string;
        total_allowance: string;
        advances: string;
        deductions: string;
        net_amount: string;
        payment_mode: string | null;
        reference_number: string | null;
        status: string;
        driver_name: string;
        driver_code: string;
        driver_phone: string | null;
        bank_name: string | null;
        bank_account: string | null;
        ifsc_code: string | null;
      }>(
        `
          SELECT
            ds.settlement_number,
            ds.period_from::text,
            ds.period_to::text,
            ds.total_trips,
            ds.total_km::text,
            ds.total_allowance::text,
            ds.advances::text,
            ds.deductions::text,
            ds.net_amount::text,
            ds.payment_mode::text,
            ds.reference_number,
            ds.status::text,
            d.name AS driver_name,
            d.driver_code,
            d.phone AS driver_phone,
            d.bank_name,
            d.bank_account,
            d.ifsc_code
          FROM driver_settlements ds
          JOIN drivers d ON d.id = ds.driver_id
          WHERE ds.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
      query<{
        trip_number: string;
        trip_date: string;
        from_location: string;
        to_location: string;
        trip_amount: string;
      }>(
        `
          SELECT
            t.trip_number,
            t.trip_date::text,
            t.from_location,
            t.to_location,
            t.trip_amount::text
          FROM driver_settlements ds
          JOIN trips t ON t.driver_id = ds.driver_id
          WHERE ds.id = $1
            AND t.trip_date BETWEEN ds.period_from AND ds.period_to
          ORDER BY t.trip_date ASC
        `,
        [req.params.id]
      ),
      getSettlementSettings(),
    ]);

    const settlement = settlementResult.rows[0];
    if (!settlement) {
      res.status(404).json({ message: 'Driver settlement not found.' });
      return;
    }

    const pdf = await buildDriverSettlementPdf(
      {
        ...settlement,
        total_km: Number(settlement.total_km),
        total_allowance: Number(settlement.total_allowance),
        advances: Number(settlement.advances),
        deductions: Number(settlement.deductions),
        net_amount: Number(settlement.net_amount),
        trips: tripResult.rows.map((trip) => ({
          ...trip,
          trip_amount: Number(trip.trip_amount),
        })),
      },
      settings
    );

    const fileName = `${settlement.settlement_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating driver settlement PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate driver settlement PDF.' });
  }
});

router.delete('/drivers/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM driver_settlements WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Driver settlement not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting driver settlement failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('driver settlement', error) });
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

router.get('/owners/:id/pdf', authRequired, async (req, res) => {
  try {
    const [settlementResult, tripResult, settings] = await Promise.all([
      query<{
        settlement_number: string;
        period_from: string;
        period_to: string;
        total_trips: number;
        total_km: string;
        total_amount: string;
        tds_amount: string;
        other_deductions: string;
        net_amount: string;
        payment_mode: string | null;
        reference_number: string | null;
        status: string;
        owner_name: string;
        owner_code: string;
        owner_phone: string | null;
        bank_name: string | null;
        bank_account: string | null;
        ifsc_code: string | null;
        vehicle_number: string | null;
      }>(
        `
          SELECT
            os.settlement_number,
            os.period_from::text,
            os.period_to::text,
            os.total_trips,
            os.total_km::text,
            os.total_amount::text,
            os.tds_amount::text,
            os.other_deductions::text,
            os.net_amount::text,
            os.payment_mode::text,
            os.reference_number,
            os.status::text,
            o.name AS owner_name,
            o.code AS owner_code,
            o.phone AS owner_phone,
            o.bank_name,
            o.bank_account,
            o.ifsc_code,
            v.vehicle_number
          FROM owner_settlements os
          JOIN owners_vendors o ON o.id = os.owner_id
          LEFT JOIN vehicles v ON v.id = os.vehicle_id
          WHERE os.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
      query<{
        trip_number: string;
        trip_date: string;
        from_location: string;
        to_location: string;
        trip_amount: string;
      }>(
        `
          SELECT
            t.trip_number,
            t.trip_date::text,
            t.from_location,
            t.to_location,
            t.trip_amount::text
          FROM owner_settlements os
          JOIN vehicles v ON v.owner_id = os.owner_id
          JOIN trips t ON t.vehicle_id = v.id
          WHERE os.id = $1
            AND t.trip_date BETWEEN os.period_from AND os.period_to
            AND (os.vehicle_id IS NULL OR t.vehicle_id = os.vehicle_id)
          ORDER BY t.trip_date ASC
        `,
        [req.params.id]
      ),
      getSettlementSettings(),
    ]);

    const settlement = settlementResult.rows[0];
    if (!settlement) {
      res.status(404).json({ message: 'Owner settlement not found.' });
      return;
    }

    const pdf = await buildOwnerSettlementPdf(
      {
        ...settlement,
        total_km: Number(settlement.total_km),
        total_amount: Number(settlement.total_amount),
        tds_amount: Number(settlement.tds_amount),
        other_deductions: Number(settlement.other_deductions),
        net_amount: Number(settlement.net_amount),
        trips: tripResult.rows.map((trip) => ({
          ...trip,
          trip_amount: Number(trip.trip_amount),
        })),
      },
      settings
    );

    const fileName = `${settlement.settlement_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating owner settlement PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate owner settlement PDF.' });
  }
});

router.delete('/owners/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM owner_settlements WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Owner settlement not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting owner settlement failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('owner settlement', error) });
  }
});

export default router;
