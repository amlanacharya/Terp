import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired, roleCheck } from '../middleware/auth';

const router = Router();
const defaultSettings: Array<{ key: string; value: string; description: string }> = [
  { key: 'company_name', value: 'Travel ERP', description: 'Company Name' },
  { key: 'company_address', value: 'Mumbai, Maharashtra', description: 'Company Address' },
  { key: 'company_gstin', value: '27ABCDE1234F1Z5', description: 'Company GSTIN' },
  { key: 'company_pan', value: 'ABCDE1234F', description: 'Company PAN' },
  { key: 'lead_prefix', value: 'LEAD', description: 'Lead Number Prefix' },
  { key: 'booking_prefix', value: 'BK', description: 'Booking Number Prefix' },
  { key: 'invoice_prefix', value: 'INV', description: 'Invoice Number Prefix' },
  { key: 'trip_prefix', value: 'TRP', description: 'Trip Number Prefix' },
  { key: 'financial_year_start', value: '04', description: 'Financial Year Start Month' },
  { key: 'bank_name', value: '', description: 'Company Bank Name' },
  { key: 'bank_account', value: '', description: 'Company Bank Account' },
  { key: 'bank_ifsc', value: '', description: 'Company Bank IFSC' },
];

function ensureDefaultSettings(): void {
  const db = getDb();
  const insertDefaultSetting = db.prepare(
    `
      INSERT OR IGNORE INTO system_settings (
        id, setting_key, setting_value, description, updated_at, version
      )
      VALUES ($id, $setting_key, $setting_value, $description, datetime('now'), 1)
    `
  );

  for (const setting of defaultSettings) {
    insertDefaultSetting.run({
      id: `setting-${setting.key}`,
      setting_key: setting.key,
      setting_value: setting.value,
      description: setting.description,
    });
  }
}

router.get('/', authRequired, (_req, res) => {
  try {
    ensureDefaultSettings();
    const result = getDb().prepare('SELECT * FROM system_settings ORDER BY setting_key ASC').all();
    res.json(result);
  } catch (error) {
    console.error('Fetching settings failed:', error);
    res.status(500).json({ message: 'Unable to fetch settings.' });
  }
});

router.put('/:key', authRequired, roleCheck(['admin']), (req, res) => {
  const { setting_value, description, version } = req.body as {
    setting_value?: string;
    description?: string;
    version?: unknown;
  };

  if (setting_value === undefined) {
    res.status(400).json({ message: 'setting_value is required.' });
    return;
  }

  const clientVersion = Number(version);
  if (!Number.isInteger(clientVersion) || clientVersion < 1) {
    res.status(400).json({ message: 'version is required for updates.' });
    return;
  }

  try {
    const db = getDb();
    const existing = db
      .prepare('SELECT id, version FROM system_settings WHERE setting_key = $key LIMIT 1')
      .get({ key: req.params.key }) as { id: string; version: number } | undefined;

    if (!existing) {
      res.status(404).json({ message: 'Setting not found.' });
      return;
    }

    if (existing.version !== clientVersion) {
      res.status(409).json({ message: 'Setting was updated by another user.' });
      return;
    }

    const result = db
      .prepare(
        `
          UPDATE system_settings
          SET
            setting_value = $setting_value,
            description = COALESCE($description, description),
            updated_by = $updated_by,
            updated_at = datetime('now'),
            version = version + 1
          WHERE setting_key = $setting_key AND version = $version
        `
      )
      .run({
        setting_value,
        description: description ?? null,
        updated_by: req.user?.id ?? null,
        setting_key: req.params.key,
        version: clientVersion,
      });

    if (result.changes === 0) {
      res.status(409).json({ message: 'Setting was updated by another user.' });
      return;
    }

    const updated = db
      .prepare('SELECT * FROM system_settings WHERE setting_key = $key LIMIT 1')
      .get({ key: req.params.key });

    res.json(updated);
  } catch (error) {
    console.error('Updating setting failed:', error);
    res.status(500).json({ message: 'Unable to update setting.' });
  }
});

export default router;
