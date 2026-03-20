import { Router } from 'express';
import { query } from '../config/db';
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

async function ensureDefaultSettings(): Promise<void> {
  for (const setting of defaultSettings) {
    await query(
      `
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO NOTHING
      `,
      [setting.key, setting.value, setting.description]
    );
  }
}

router.get('/', authRequired, async (_req, res) => {
  try {
    await ensureDefaultSettings();
    const result = await query('SELECT * FROM system_settings ORDER BY setting_key ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching settings failed:', error);
    res.status(500).json({ message: 'Unable to fetch settings.' });
  }
});

router.put('/:key', authRequired, roleCheck(['admin']), async (req, res) => {
  const { setting_value, description } = req.body as { setting_value?: string; description?: string };

  if (setting_value === undefined) {
    res.status(400).json({ message: 'setting_value is required.' });
    return;
  }

  try {
    const result = await query(
      `
        UPDATE system_settings
        SET setting_value = $1, description = COALESCE($2, description), updated_by = $3, updated_at = now()
        WHERE setting_key = $4
        RETURNING *
      `,
      [setting_value, description ?? null, req.user?.id ?? null, req.params.key]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Setting not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating setting failed:', error);
    res.status(500).json({ message: 'Unable to update setting.' });
  }
});

export default router;
