import { randomUUID } from 'crypto';
import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
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
const followUpFields = ['follow_up_date', 'next_follow_up', 'contact_mode', 'summary', 'quoted_amount'] as const;

type JsonObject = Record<string, unknown> | null;

function parseJsonObject(value: unknown): JsonObject {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapLeadRow(row: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    customer: parseJsonObject(row.customer),
    assigned_user: parseJsonObject(row.assigned_user),
    follow_up_count: Number(row.follow_up_count ?? 0),
  };
}

function mapFollowUpRow(row: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    created_by_user: parseJsonObject(row.created_by_user),
  };
}

function isLeadRequiredFieldError(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) =>
    ['source', 'prospect_phone', 'trip_type', 'from_location', 'travel_date', 'pax_count', 'customer_id', 'prospect_name'].includes(key)
  );
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

function getLeadPrefix(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'lead_prefix' LIMIT 1")
    .get() as { setting_value?: string } | undefined;

  return row?.setting_value?.trim() || 'LEAD';
}

function generateLeadNumber(): string {
  const db = getDb();
  const prefix = getLeadPrefix();
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM leads WHERE lead_number LIKE $pattern')
    .get({ pattern: `${prefix}%` }) as { count?: number } | undefined;

  const nextValue = Number(row?.count ?? 0) + 1;
  return `${prefix}${String(nextValue).padStart(4, '0')}`;
}

function getLeadListQuery() {
  return getDb().prepare(`
    SELECT
      l.*,
      CASE
        WHEN c.id IS NULL THEN NULL
        ELSE json_object('id', c.id, 'customer_code', c.customer_code, 'name', c.name)
      END AS customer,
      CASE
        WHEN p.id IS NULL THEN NULL
        ELSE json_object('id', p.id, 'full_name', p.full_name, 'role', p.role)
      END AS assigned_user,
      (
        SELECT f.follow_up_date
        FROM lead_follow_ups f
        WHERE f.lead_id = l.id
        ORDER BY f.follow_up_date DESC, f.created_at DESC
        LIMIT 1
      ) AS last_follow_up_date,
      (
        SELECT f.next_follow_up
        FROM lead_follow_ups f
        WHERE f.lead_id = l.id
        ORDER BY f.follow_up_date DESC, f.created_at DESC
        LIMIT 1
      ) AS next_follow_up,
      (
        SELECT f.summary
        FROM lead_follow_ups f
        WHERE f.lead_id = l.id
        ORDER BY f.follow_up_date DESC, f.created_at DESC
        LIMIT 1
      ) AS last_follow_up_summary,
      (
        SELECT COUNT(*)
        FROM lead_follow_ups f
        WHERE f.lead_id = l.id
      ) AS follow_up_count
    FROM leads l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN profiles p ON p.id = l.assigned_to
    ORDER BY l.lead_date DESC, l.created_at DESC
  `);
}

router.get('/meta', authRequired, (_req, res) => {
  try {
    const db = getDb();
    const customers = db
      .prepare(
        `
          SELECT id, customer_code, name
          FROM customers
          WHERE is_active = 1
          ORDER BY name ASC
        `
      )
      .all();
    const assignees = db
      .prepare(
        `
          SELECT id, full_name, role
          FROM profiles
          WHERE is_active = 1
          ORDER BY full_name ASC
        `
      )
      .all();

    res.json({ customers, assignees });
  } catch (error) {
    console.error('Fetching lead metadata failed:', error);
    res.status(500).json({ message: 'Unable to load lead form options.' });
  }
});

router.get('/', authRequired, (_req, res) => {
  try {
    const leads = (getLeadListQuery().all() as Record<string, unknown>[]).map((row) => mapLeadRow(row));
    res.json(leads);
  } catch (error) {
    console.error('Fetching leads failed:', error);
    res.status(500).json({ message: 'Unable to fetch leads.' });
  }
});

router.get('/:id/follow-ups', authRequired, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT
            f.*,
            CASE
              WHEN p.id IS NULL THEN NULL
              ELSE json_object('id', p.id, 'full_name', p.full_name, 'role', p.role)
            END AS created_by_user
          FROM lead_follow_ups f
          LEFT JOIN profiles p ON p.id = f.created_by
          WHERE f.lead_id = $lead_id
          ORDER BY f.follow_up_date DESC, f.created_at DESC
        `
      )
      .all({ lead_id: req.params.id } as Record<string, unknown>)
      .map((row) => mapFollowUpRow(row as Record<string, unknown>));

    res.json(rows);
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
    const db = getDb();
    const createdLead = db.transaction(() => {
      const leadNumber = generateLeadNumber();
      const id = randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `
          INSERT INTO leads (
            id, lead_number, lead_date, source, customer_id, prospect_name, prospect_phone, prospect_email,
            prospect_company, trip_type, from_location, to_location, travel_date, return_date, pax_count,
            vehicle_preference, num_vehicles, special_requirements, estimated_amount, status, assigned_to,
            priority, lost_reason, remarks, created_by, created_at, updated_at, version
          ) VALUES (
            $id, $lead_number, $lead_date, $source, $customer_id, $prospect_name, $prospect_phone, $prospect_email,
            $prospect_company, $trip_type, $from_location, $to_location, $travel_date, $return_date, $pax_count,
            $vehicle_preference, $num_vehicles, $special_requirements, $estimated_amount, $status, $assigned_to,
            $priority, $lost_reason, $remarks, $created_by, $created_at, $updated_at, 1
          )
        `
      ).run({
        id,
        lead_number: leadNumber,
        lead_date: payload.lead_date ?? now,
        source: payload.source,
        customer_id: payload.customer_id ?? null,
        prospect_name: payload.prospect_name ?? null,
        prospect_phone: payload.prospect_phone,
        prospect_email: payload.prospect_email ?? null,
        prospect_company: payload.prospect_company ?? null,
        trip_type: payload.trip_type,
        from_location: payload.from_location,
        to_location: payload.to_location ?? null,
        travel_date: payload.travel_date,
        return_date: payload.return_date ?? null,
        pax_count: payload.pax_count,
        vehicle_preference: payload.vehicle_preference ?? null,
        num_vehicles: payload.num_vehicles ?? 1,
        special_requirements: payload.special_requirements ?? null,
        estimated_amount: payload.estimated_amount ?? null,
        status: payload.status ?? 'new',
        assigned_to: payload.assigned_to ?? null,
        priority: payload.priority ?? 'medium',
        lost_reason: payload.lost_reason ?? null,
        remarks: payload.remarks ?? null,
        created_by: req.user?.id ?? null,
        created_at: now,
        updated_at: now,
      });

      return db.prepare('SELECT * FROM leads WHERE id = $id').get({ id });
    })();

    res.status(201).json(createdLead);
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
    const db = getDb();
    const createdFollowUp = db.transaction(() => {
      const leadExists = db.prepare('SELECT id FROM leads WHERE id = $id LIMIT 1').get({ id: req.params.id });
      if (!leadExists) {
        return null;
      }

      const id = randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `
          INSERT INTO lead_follow_ups (
            id, lead_id, follow_up_date, next_follow_up, contact_mode, summary, quoted_amount, created_by, created_at, version
          ) VALUES (
            $id, $lead_id, $follow_up_date, $next_follow_up, $contact_mode, $summary, $quoted_amount, $created_by, $created_at, 1
          )
        `
      ).run({
        id,
        lead_id: req.params.id,
        follow_up_date: payload.follow_up_date,
        next_follow_up: payload.next_follow_up ?? null,
        contact_mode: payload.contact_mode,
        summary: payload.summary,
        quoted_amount: payload.quoted_amount ?? null,
        created_by: req.user?.id ?? null,
        created_at: now,
      });

      db.prepare('UPDATE leads SET updated_at = $updated_at WHERE id = $id').run({
        updated_at: now,
        id: req.params.id,
      });

      return db.prepare('SELECT * FROM lead_follow_ups WHERE id = $id').get({ id });
    })();

    if (!createdFollowUp) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    res.status(201).json(createdFollowUp);
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

  if (validationError && isLeadRequiredFieldError(payload)) {
    res.status(400).json({ message: validationError });
    return;
  }

  const clientVersion = Number((req.body as { version?: unknown }).version);
  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'Lead version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const updatedLead = db.transaction(() => {
      const existing = db.prepare('SELECT id, version FROM leads WHERE id = $id LIMIT 1').get({
        id: req.params.id,
      }) as { id: string; version: number } | undefined;

      if (!existing) {
        return { status: 404 as const, lead: null };
      }

      if (Number(existing.version) !== clientVersion) {
        return { status: 409 as const, lead: null };
      }

      const update = buildUpdateClause(payload);
      const result = db
        .prepare(
          `
            UPDATE leads
            SET ${update.clause}, updated_at = datetime('now'), version = version + 1
            WHERE id = $id AND version = $version
          `
        )
        .run({
          ...update.params,
          id: req.params.id,
          version: clientVersion,
        });

      if (result.changes === 0) {
        return { status: 409 as const, lead: null };
      }

      return { status: 200 as const, lead: db.prepare('SELECT * FROM leads WHERE id = $id').get({ id: req.params.id }) };
    })();

    if (updatedLead.status === 404) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    if (updatedLead.status === 409) {
      res.status(409).json({ message: 'Lead was updated by another user. Reload and try again.' });
      return;
    }

    res.json(updatedLead.lead);
  } catch (error) {
    console.error('Updating lead failed:', error);
    res.status(500).json({ message: 'Unable to update lead.' });
  }
});

router.delete('/:id/follow-ups/:followUpId', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const result = getDb()
      .prepare('DELETE FROM lead_follow_ups WHERE id = $followUpId AND lead_id = $leadId')
      .run({ followUpId: req.params.followUpId, leadId: req.params.id });

    if (result.changes === 0) {
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
    const result = getDb().prepare('DELETE FROM leads WHERE id = $id').run({ id: req.params.id });

    if (result.changes === 0) {
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
