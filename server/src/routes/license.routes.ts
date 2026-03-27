import { Router } from 'express';
import { query } from '../config/db';

const router = Router();

router.get('/info', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, subscription_type, activation_date, expiry_date
       FROM licenses
       WHERE is_active = true
       ORDER BY activation_date DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ license: null, status: 'expired' });
    }

    const license = result.rows[0];
    const status = getLicenseStatus(license);

    res.json({
      license: {
        subscriptionType: license.subscription_type,
        activationDate: license.activation_date,
        expiryDate: license.expiry_date
      },
      status
    });
  } catch (error) {
    console.error('Failed to get license info:', error);
    res.status(500).json({ error: 'Failed to get license info' });
  }
});

router.get('/validate', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false, status: 'expired' });
    }

    const license = result.rows[0];
    const status = getLicenseStatus(license);
    const valid = ['active', 'grace'].includes(status);

    res.json({ valid, status, expiryDate: license.expiry_date });
  } catch (error) {
    console.error('License validation failed:', error);
    res.status(500).json({ error: 'License validation failed' });
  }
});

function getLicenseStatus(license: any): string {
  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor(
    (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastExpiry <= 0) return 'active';
  if (daysPastExpiry <= 7) return 'grace';
  if (daysPastExpiry <= 27) return 'readonly';
  return 'expired';
}

export default router;
