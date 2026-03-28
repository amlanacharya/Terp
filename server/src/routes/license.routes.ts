import { Router } from 'express';
import {
  handleActivation,
  handleVerifyLicense,
  handleGetCompanySettings,
  getLicenseStatusWithEnforcement,
} from '../license/service.js';
import { saveCompanySettings } from '../license/db.js';

const router = Router();

/**
 * POST /api/license/activate
 * Activate a product key
 */
router.post('/activate', async (req, res) => {
  try {
    const { productKey } = req.body;

    if (!productKey) {
      return res.status(400).json({ error: 'Product key is required' });
    }

    const result = await handleActivation(productKey);

    if (result.success) {
      return res.json({
        success: true,
        license: result.license,
        message: result.message,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('License activation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/license/status
 * Get current license status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getLicenseStatusWithEnforcement();
    res.json(status);
  } catch (error: any) {
    console.error('License status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/license/verify
 * Verify license validity
 */
router.post('/verify', async (req, res) => {
  try {
    const result = await handleVerifyLicense();
    res.json(result);
  } catch (error: any) {
    console.error('License verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/license/company
 * Get company settings
 */
router.get('/company', async (req, res) => {
  try {
    const settings = await handleGetCompanySettings();

    if (!settings) {
      return res.status(404).json({ error: 'Company settings not found' });
    }

    res.json(settings);
  } catch (error: any) {
    console.error('Get company settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/license/company
 * Save company settings
 */
router.post('/company', async (req, res) => {
  try {
    const settings = req.body;

    // Validate required fields
    const required = [
      'company_name',
      'business_address',
      'city',
      'state',
      'pin_code',
      'phone',
      'email',
    ];

    for (const field of required) {
      if (!settings[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    const saved = await saveCompanySettings({
      ...settings,
      sac_code: settings.sac_code || '998511',
      default_duty_start_time: settings.default_duty_start_time || '09:00',
      default_duty_hours: settings.default_duty_hours || 8,
      invoice_pdf_mode: settings.invoice_pdf_mode || 'invoice_only',
      tax_config: settings.tax_config || {
        intra_state: { cgst_rate: 2.5, sgst_rate: 2.5 },
        inter_state: { igst_rate: 5.0 },
      },
    });

    res.json(saved);
  } catch (error: any) {
    console.error('Save company settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/license/reset
 * Deactivate all licenses (admin use — allows re-activation with a new key)
 */
router.post('/reset', async (req, res) => {
  try {
    const pool = (await import('../config/db.js')).getPool();
    await pool.query('UPDATE licenses SET is_active = false WHERE is_active = true');
    res.json({ success: true, message: 'License reset. You can now activate a new key.' });
  } catch (error: any) {
    console.error('License reset error:', error);
    res.status(500).json({ error: 'Failed to reset license' });
  }
});

export default router;
