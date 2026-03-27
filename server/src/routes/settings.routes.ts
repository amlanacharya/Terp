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

// Check if this is first run
router.get('/first-run', async (_req, res) => {
  try {
    // Check if any users exist
    const result = await query('SELECT COUNT(*) as count FROM profiles', []);

    const firstRun = parseInt(result.rows[0].count) === 0;
    res.json({ firstRun });
  } catch (error) {
    console.error('Error checking first run status:', error);
    res.status(500).json({ error: 'Failed to check first run status' });
  }
});

// Complete first-run setup
router.post('/setup', async (req, res) => {
  const { companyInfo, licenseKey, adminUser } = req.body;

  try {
    // Start a transaction
    await query('BEGIN', []);

    try {
      // Insert company settings
      await query(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES ('company_name', $1, 'Company name'),
                ('company_address', $2, 'Company address'),
                ('company_city', $3, 'Company city'),
                ('company_state', $4, 'Company state'),
                ('company_pincode', $5, 'Company PIN code'),
                ('company_phone', $6, 'Company phone'),
                ('company_email', $7, 'Company email'),
                ('company_gstin', $8, 'Company GSTIN')
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [
          companyInfo.name,
          companyInfo.address,
          companyInfo.city,
          companyInfo.state,
          companyInfo.pincode,
          companyInfo.phone,
          companyInfo.email,
          companyInfo.gstin || null
        ]
      );

      // Insert admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);

      const userResult = await query(
        `INSERT INTO users (email, password_hash, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [adminUser.email, hashedPassword]
      );

      const userId = userResult.rows[0].id;

      await query(
        `INSERT INTO profiles (user_id, full_name, email, role, phone, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', $4, true, NOW(), NOW())`,
        [userId, adminUser.name, adminUser.email, adminUser.phone]
      );

      // Activate license if provided
      if (licenseKey) {
        // This would typically call the license manager
        // For now, we'll store it in settings
        await query(
          `INSERT INTO system_settings (setting_key, setting_value, description)
           VALUES ('license_key', $1, 'Product key')
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
          [licenseKey]
        );
      }

      // Commit the transaction
      await query('COMMIT', []);

      res.json({
        success: true,
        message: 'Setup completed successfully',
        userId
      });

    } catch (innerError) {
      // Rollback on error
      await query('ROLLBACK', []);
      throw innerError;
    }

  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
