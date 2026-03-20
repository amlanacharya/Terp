import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

const router = Router();
const leadFields = [
  'lead_date',
  'source',
  'customer_id',
  'prospect_name',
  'prospect_phone',
  'prospect_email',
  'prospect_company',
  'trip_type',
  'from_location',
  'to_location',
  'travel_date',
  'return_date',
  'pax_count',
  'vehicle_preference',
  'num_vehicles',
  'special_requirements',
  'estimated_amount',
  'status',
  'assigned_to',
  'priority',
  'lost_reason',
  'remarks',
] as const;
const followUpFields = [
  'follow_up_date',
  'next_follow_up',
  'contact_mode',
  'summary',
  'quoted_amount',
] as const;

async function generateLeadNumber(): Promise<string> {
  const prefixResult = await query<{ setting_value: string }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'lead_prefix' LIMIT 1`
  );
  const prefix = prefixResult.rows[0]?.setting_value || 'LEAD';
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM leads WHERE lead_number LIKE $1',
    [`${prefix}%`]
  );

  return `${prefix}${String(Number(countResult.rows[0]?.count || 0) + 1).padStart(4, '0')}`;
}

function validateLeadPayload(payload: Record<string, unknown>): string | null {
  if (!payload.source || !payload.prospect_phone || !payload.trip_type || !payload.from_location || !payload.travel_date) {
    return 'Source, phone, trip type, from location, and travel date are required.';
  }

  if (!payload.customer_id && !payload.prospect_name) {
    return 'Prospect name is required when no existing customer is linked.';
  }

  if (payload.pax_count === undefined || payload.pax_count === null || payload.pax_count === '') {
    return 'Passenger count is required.';
  }

  return null;
}

router.get('/meta', authRequired, async (_req, res) => {
  try {
    const [customerResult, assigneeResult] = await Promise.all([
      query(
        `
          SELECT id, customer_code, name
          FROM customers
          WHERE is_active = true
          ORDER BY name ASC
        `
      ),
      query(
        `
          SELECT id, full_name, role
          FROM profiles
          WHERE is_active = true
          ORDER BY full_name ASC
        `
      ),
    ]);

    res.json({
      customers: customerResult.rows,
      assignees: assigneeResult.rows,
    });
  } catch (error) {
    console.error('Fetching lead metadata failed:', error);
    res.status(500).json({ message: 'Unable to load lead form options.' });
  }
});

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          l.*,
          CASE
            WHEN c.id IS NULL THEN NULL
            ELSE json_build_object('id', c.id, 'customer_code', c.customer_code, 'name', c.name)
          END AS customer,
          CASE
            WHEN p.id IS NULL THEN NULL
            ELSE json_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role)
          END AS assigned_user,
          latest_follow_up.follow_up_date AS last_follow_up_date,
          latest_follow_up.next_follow_up,
          latest_follow_up.summary AS last_follow_up_summary,
          COALESCE(follow_up_stats.follow_up_count, 0) AS follow_up_count
        FROM leads l
        LEFT JOIN customers c ON c.id = l.customer_id
        LEFT JOIN profiles p ON p.id = l.assigned_to
        LEFT JOIN LATERAL (
          SELECT f.follow_up_date, f.next_follow_up, f.summary
          FROM lead_follow_ups f
          WHERE f.lead_id = l.id
          ORDER BY f.follow_up_date DESC, f.created_at DESC
          LIMIT 1
        ) AS latest_follow_up ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS follow_up_count
          FROM lead_follow_ups f
          WHERE f.lead_id = l.id
        ) AS follow_up_stats ON true
        ORDER BY l.lead_date DESC, l.created_at DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching leads failed:', error);
    res.status(500).json({ message: 'Unable to fetch leads.' });
  }
});

router.get('/:id/follow-ups', authRequired, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          f.*,
          CASE
            WHEN p.id IS NULL THEN NULL
            ELSE json_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role)
          END AS created_by_user
        FROM lead_follow_ups f
        LEFT JOIN profiles p ON p.id = f.created_by
        WHERE f.lead_id = $1
        ORDER BY f.follow_up_date DESC, f.created_at DESC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching lead follow-ups failed:', error);
    res.status(500).json({ message: 'Unable to fetch lead follow-ups.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, leadFields);
  const validationError = validateLeadPayload(payload);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  try {
    const leadNumber = await generateLeadNumber();
    const result = await query(
      `
        INSERT INTO leads (
          lead_number, lead_date, source, customer_id, prospect_name, prospect_phone, prospect_email,
          prospect_company, trip_type, from_location, to_location, travel_date, return_date, pax_count,
          vehicle_preference, num_vehicles, special_requirements, estimated_amount, status, assigned_to,
          priority, lost_reason, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24
        )
        RETURNING *
      `,
      [
        leadNumber,
        payload.lead_date ?? new Date().toISOString(),
        payload.source,
        payload.customer_id || null,
        payload.prospect_name ?? null,
        payload.prospect_phone,
        payload.prospect_email ?? null,
        payload.prospect_company ?? null,
        payload.trip_type,
        payload.from_location,
        payload.to_location ?? null,
        payload.travel_date,
        payload.return_date ?? null,
        payload.pax_count,
        payload.vehicle_preference ?? null,
        payload.num_vehicles ?? 1,
        payload.special_requirements ?? null,
        payload.estimated_amount ?? null,
        payload.status ?? 'new',
        payload.assigned_to || null,
        payload.priority ?? 'medium',
        payload.lost_reason ?? null,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating lead failed:', error);
    res.status(500).json({ message: 'Unable to create lead.' });
  }
});

router.post('/:id/follow-ups', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, followUpFields);

  if (!payload.follow_up_date || !payload.contact_mode || !payload.summary) {
    res.status(400).json({ message: 'Follow-up date, contact mode, and summary are required.' });
    return;
  }

  try {
    const leadExists = await query<{ id: string }>('SELECT id FROM leads WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!leadExists.rows[0]) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    const result = await query(
      `
        INSERT INTO lead_follow_ups (
          lead_id, follow_up_date, next_follow_up, contact_mode, summary, quoted_amount, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        RETURNING *
      `,
      [
        req.params.id,
        payload.follow_up_date,
        payload.next_follow_up ?? null,
        payload.contact_mode,
        payload.summary,
        payload.quoted_amount ?? null,
        req.user?.id ?? null,
      ]
    );

    await query('UPDATE leads SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating lead follow-up failed:', error);
    res.status(500).json({ message: 'Unable to record follow-up.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'operator']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, leadFields);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No lead fields supplied for update.' });
    return;
  }

  const validationError = validateLeadPayload({
    source: payload.source ?? 'phone',
    prospect_phone: payload.prospect_phone ?? 'placeholder',
    trip_type: payload.trip_type ?? 'placeholder',
    from_location: payload.from_location ?? 'placeholder',
    travel_date: payload.travel_date ?? 'placeholder',
    pax_count: payload.pax_count ?? 1,
    customer_id: payload.customer_id,
    prospect_name: payload.prospect_name,
  });

  if (validationError && Object.keys(payload).some((key) => ['source', 'prospect_phone', 'trip_type', 'from_location', 'travel_date', 'pax_count', 'customer_id', 'prospect_name'].includes(key))) {
    res.status(400).json({ message: validationError });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE leads SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating lead failed:', error);
    res.status(500).json({ message: 'Unable to update lead.' });
  }
});

router.delete('/:id/follow-ups/:followUpId', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM lead_follow_ups WHERE id = $1 AND lead_id = $2 RETURNING id',
      [req.params.followUpId, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Lead follow-up not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting lead follow-up failed:', error);
    res.status(500).json({ message: 'Unable to delete lead follow-up.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting lead failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('lead', error) });
  }
});

export default router;
