import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db';

type LicenseStatus = 'active' | 'grace' | 'readonly' | 'expired';

interface License {
  id: string;
  expiry_date: Date;
}

export async function licenseCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow license verification endpoint
  if (req.path === '/api/license/validate' || req.path === '/api/license/info') {
    return next();
  }

  try {
    const license = await getCurrentLicense();
    const status = getLicenseStatus(license);

    // Read-only requests work in readonly mode
    const isReadOnlyRequest = req.method === 'GET' && !req.path.includes('/pdf');

    if (status === 'active' || status === 'grace') {
      return next();
    }

    if (status === 'readonly' && isReadOnlyRequest) {
      return next();
    }

    if (status === 'readonly' && req.path.includes('/pdf')) {
      res.status(403).json({
        error: 'PDF generation disabled. Please renew subscription.',
        status: 'readonly'
      });
      return;
    }

    // Expired or invalid request
    res.status(403).json({
      error: 'Subscription expired. Please contact administrator to renew.',
      status
    });

  } catch (error) {
    console.error('License check failed:', error);
    res.status(500).json({ error: 'License check failed' });
  }
}

async function getCurrentLicense(): Promise<License | null> {
  const result = await query<License>(
    'SELECT id, expiry_date FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
  );

  return result.rows[0] || null;
}

function getLicenseStatus(license: License | null): LicenseStatus {
  if (!license) return 'expired';

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
