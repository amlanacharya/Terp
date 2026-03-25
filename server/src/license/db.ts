import { Pool } from '../config/db.js';

/**
 * License Database Operations
 */

export interface LicensePool {
  id: string;
  product_key: string;
  subscription_type: 'monthly' | 'quarterly' | 'annual';
  date_added: Date;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface License {
  id: string;
  product_key: string;
  subscription_type: 'monthly' | 'quarterly' | 'annual';
  activation_date: Date;
  expiry_date: Date;
  hardware_fingerprint: string;
  last_verified: Date;
  grace_period_used: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  business_address: string;
  city: string;
  state: string;
  pin_code: string;
  gst_number?: string;
  pan_number?: string;
  phone: string;
  email: string;
  sac_code: string;
  default_duty_start_time: string;
  default_duty_hours: number;
  invoice_pdf_mode: string;
  tax_config: {
    intra_state: { cgst_rate: number; sgst_rate: number };
    inter_state: { igst_rate: number };
  };
  created_at: Date;
  updated_at: Date;
}

/**
 * Add keys to license pool
 */
export async function addToLicensePool(
  keys: string[],
  subscriptionType: 'monthly' | 'quarterly' | 'annual'
): Promise<number> {
  const client = await Pool.connect();

  try {
    await client.query('BEGIN');

    let addedCount = 0;

    for (const key of keys) {
      try {
        await client.query(
          `INSERT INTO license_pool (product_key, subscription_type)
           VALUES ($1, $2)
           ON CONFLICT (product_key) DO NOTHING`,
          [key, subscriptionType]
        );
        addedCount++;
      } catch (error) {
        console.error(`Failed to add key ${key}:`, error);
      }
    }

    await client.query('COMMIT');
    return addedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get available key from pool
 */
export async function getAvailableKey(
  subscriptionType: 'monthly' | 'quarterly' | 'annual'
): Promise<string | null> {
  const result = await Pool.query(
    `SELECT product_key
     FROM license_pool
     WHERE subscription_type = $1
       AND is_available = true
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [subscriptionType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const key = result.rows[0].product_key;

  // Mark as unavailable
  await Pool.query(
    `UPDATE license_pool
     SET is_available = false, updated_at = now()
     WHERE product_key = $1`,
    [key]
  );

  return key;
}

/**
 * Activate license
 */
export async function activateLicense(
  productKey: string,
  hardwareFingerprint: string,
  subscriptionType: 'monthly' | 'quarterly' | 'annual'
): Promise<License> {
  const client = await Pool.connect();

  try {
    await client.query('BEGIN');

    // Calculate expiry date
    const activationDate = new Date();
    const expiryDate = calculateExpiryDate(subscriptionType, activationDate);

    // Check if key is already activated
    const existingResult = await client.query(
      'SELECT * FROM licenses WHERE product_key = $1',
      [productKey]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.hardware_fingerprint === hardwareFingerprint) {
        // Same hardware, return existing license
        await client.query('ROLLBACK');
        return existing;
      } else {
        throw new Error('License already activated on different machine');
      }
    }

    // Create new license
    const result = await client.query(
      `INSERT INTO licenses (
        product_key, subscription_type, activation_date, expiry_date,
        hardware_fingerprint, last_verified
      ) VALUES ($1, $2, $3, $4, $5, now())
      RETURNING *`,
      [productKey, subscriptionType, activationDate, expiryDate, hardwareFingerprint]
    );

    await client.query('COMMIT');

    // Log activation
    await logLicenseEvent(result.rows[0].id, 'activation', hardwareFingerprint, null, {
      product_key: productKey,
      subscription_type: subscriptionType,
    });

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get current license
 */
export async function getCurrentLicense(): Promise<License | null> {
  const result = await Pool.query(
    `SELECT * FROM licenses
     WHERE is_active = true
     ORDER BY activation_date DESC
     LIMIT 1`
  );

  return result.rows[0] || null;
}

/**
 * Update license last verified timestamp
 */
export async function updateLicenseLastVerified(licenseId: string): Promise<void> {
  await Pool.query(
    `UPDATE licenses
     SET last_verified = now(), updated_at = now()
     WHERE id = $1`,
    [licenseId]
  );
}

/**
 * Get company settings
 */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const result = await Pool.query('SELECT * FROM company_settings LIMIT 1');

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Save company settings
 */
export async function saveCompanySettings(
  settings: Omit<CompanySettings, 'id' | 'created_at' | 'updated_at'>
): Promise<CompanySettings> {
  const client = await Pool.connect();

  try {
    await client.query('BEGIN');

    // Check if settings exist
    const existingResult = await client.query('SELECT id FROM company_settings LIMIT 1');

    if (existingResult.rows.length > 0) {
      // Update existing
      const result = await client.query(
        `UPDATE company_settings
         SET company_name = $1,
             business_address = $2,
             city = $3,
             state = $4,
             pin_code = $5,
             gst_number = $6,
             pan_number = $7,
             phone = $8,
             email = $9,
             sac_code = $10,
             default_duty_start_time = $11,
             default_duty_hours = $12,
             invoice_pdf_mode = $13,
             tax_config = $14,
             updated_at = now()
         RETURNING *`,
        [
          settings.company_name,
          settings.business_address,
          settings.city,
          settings.state,
          settings.pin_code,
          settings.gst_number || null,
          settings.pan_number || null,
          settings.phone,
          settings.email,
          settings.sac_code,
          settings.default_duty_start_time,
          settings.default_duty_hours,
          settings.invoice_pdf_mode,
          JSON.stringify(settings.tax_config),
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } else {
      // Insert new
      const result = await client.query(
        `INSERT INTO company_settings (
          company_name, business_address, city, state, pin_code,
          gst_number, pan_number, phone, email, sac_code,
          default_duty_start_time, default_duty_hours, invoice_pdf_mode, tax_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          settings.company_name,
          settings.business_address,
          settings.city,
          settings.state,
          settings.pin_code,
          settings.gst_number || null,
          settings.pan_number || null,
          settings.phone,
          settings.email,
          settings.sac_code,
          settings.default_duty_start_time,
          settings.default_duty_hours,
          settings.invoice_pdf_mode,
          JSON.stringify(settings.tax_config),
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate expiry date based on subscription type
 */
function calculateExpiryDate(
  subscriptionType: 'monthly' | 'quarterly' | 'annual',
  activationDate: Date
): Date {
  const expiry = new Date(activationDate);

  switch (subscriptionType) {
    case 'monthly':
      expiry.setMonth(expiry.getMonth() + 1);
      break;
    case 'quarterly':
      expiry.setMonth(expiry.getMonth() + 3);
      break;
    case 'annual':
      expiry.setFullYear(expiry.getFullYear() + 1);
      break;
  }

  return expiry;
}

/**
 * Get license status (active, grace, readonly, expired)
 */
export function getLicenseStatus(license: License): {
  status: 'active' | 'grace' | 'readonly' | 'expired';
  daysRemaining: number;
} {
  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor(
    (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastExpiry <= 0) {
    return { status: 'active', daysRemaining: Math.abs(daysPastExpiry) };
  }

  if (daysPastExpiry <= 7) {
    return { status: 'grace', daysRemaining: -daysPastExpiry };
  }

  if (daysPastExpiry <= 27) {
    return { status: 'readonly', daysRemaining: -daysPastExpiry };
  }

  return { status: 'expired', daysRemaining: -daysPastExpiry };
}

/**
 * Log license event
 */
async function logLicenseEvent(
  licenseId: string,
  action: string,
  hardwareFingerprint: string | null,
  metadata: Record<string, any> | null,
  message?: string
): Promise<void> {
  await Pool.query(
    `INSERT INTO license_activation_logs (
      license_id, action, hardware_fingerprint, metadata, message
    ) VALUES ($1, $2, $3, $4, $5)`,
    [licenseId, action, hardwareFingerprint, metadata ? JSON.stringify(metadata) : null, message || null]
  );
}
