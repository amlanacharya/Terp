import { randomUUID } from 'crypto';
import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';
import { generateNextCode } from '../utils/auto-code';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

interface SqliteErrorLike {
  code?: string;
  message?: string;
}

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

function getOwnerById(id: string) {
  return getDb()
    .prepare('SELECT * FROM owners_vendors WHERE id = $id LIMIT 1')
    .get({ id }) as Record<string, unknown> | undefined;
}

function getOwnerSaveErrorMessage(error: unknown): string {
  const sqliteError = error as SqliteErrorLike | undefined;
  const message = sqliteError?.message ?? '';

  if (sqliteError?.code === 'SQLITE_CONSTRAINT_UNIQUE' || message.includes('UNIQUE constraint failed')) {
    return 'Owner already exists.';
  }

  return 'Unable to save owner.';
}

router.get('/', authRequired, (_req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM owners_vendors ORDER BY created_at DESC').all();
    res.json(rows);
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

  if (
    payload.aadhar_number !== undefined &&
    payload.aadhar_number !== null &&
    payload.aadhar_number !== '' &&
    !isAadhaarValid(payload.aadhar_number)
  ) {
    res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits.' });
    return;
  }

  try {
    const db = getDb();
    const ownerCode = await generateNextCode(db, {
      table: 'owners_vendors',
      column: 'code',
      prefix: 'GT-OWN',
      padLength: 4,
    });
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO owners_vendors (
          id, code, name, contact_person, phone, email, address, city, state,
          pincode, gstin, pan, aadhar_number, bank_name, bank_account, ifsc_code,
          is_active, created_at, updated_at, version
        ) VALUES (
          $id, $code, $name, $contact_person, $phone, $email, $address, $city, $state,
          $pincode, $gstin, $pan, $aadhar_number, $bank_name, $bank_account, $ifsc_code,
          $is_active, $created_at, $updated_at, 1
        )
      `
    ).run({
      id,
      code: ownerCode,
      name: payload.name,
      contact_person: payload.contact_person ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      pincode: payload.pincode ?? null,
      gstin: payload.gstin ?? null,
      pan: payload.pan ?? null,
      aadhar_number: payload.aadhar_number ?? null,
      bank_name: payload.bank_name ?? null,
      bank_account: payload.bank_account ?? null,
      ifsc_code: payload.ifsc_code ?? null,
      is_active: payload.is_active ?? true,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json(getOwnerById(id));
  } catch (error) {
    console.error('Creating owner failed:', error);
    res.status(500).json({ message: getOwnerSaveErrorMessage(error) });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, ownerFields);
  const clientVersion = Number((req.body as { version?: unknown }).version);

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No owner fields supplied for update.' });
    return;
  }

  if (
    payload.aadhar_number !== undefined &&
    payload.aadhar_number !== null &&
    payload.aadhar_number !== '' &&
    !isAadhaarValid(payload.aadhar_number)
  ) {
    res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits.' });
    return;
  }

  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'Owner version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const existing = db
      .prepare('SELECT id, version FROM owners_vendors WHERE id = $id LIMIT 1')
      .get({ id: req.params.id }) as { id: string; version: number } | undefined;

    if (!existing) {
      res.status(404).json({ message: 'Owner not found.' });
      return;
    }

    if (existing.version !== clientVersion) {
      res.status(409).json({ message: 'Owner was modified by another user.' });
      return;
    }

    const now = new Date().toISOString();
    const update = buildUpdateClause({ ...payload, updated_at: now });
    const result = db
      .prepare(
        `
          UPDATE owners_vendors
          SET ${update.clause}, version = version + 1
          WHERE id = $id AND version = $version
        `
      )
      .run({
        ...update.params,
        id: req.params.id,
        version: clientVersion,
      });

    if (result.changes === 0) {
      res.status(409).json({ message: 'Owner was modified by another user.' });
      return;
    }

    res.json(getOwnerById(String(req.params.id)));
  } catch (error) {
    console.error('Updating owner failed:', error);
    res.status(500).json({ message: getOwnerSaveErrorMessage(error) });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), (req, res) => {
  try {
    const result = getDb().prepare('DELETE FROM owners_vendors WHERE id = $id').run({ id: req.params.id });
    if (result.changes === 0) {
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
