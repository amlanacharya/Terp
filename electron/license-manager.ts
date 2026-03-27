import { getHardwareFingerprint } from './hardware-fingerprint';
// @ts-ignore - Compiled server modules
import { query } from '../server/dist/config/db.js';
// @ts-ignore - Compiled server modules
import { hashProductKey, validateProductKey, decodeProductKey } from '../server/dist/utils/product-key.js';
import { createHash } from 'crypto';

export type LicenseStatus = 'active' | 'grace' | 'readonly' | 'expired';

export interface License {
  id: string;
  product_key_hash: string;
  subscription_type: string;
  activation_date: Date;
  expiry_date: Date;
  hardware_fingerprint: string;
  last_verified: Date;
  is_active: boolean;
}

/**
 * LicenseManager handles product license activation, validation, and enforcement.
 *
 * Features:
 * - Product key activation with hardware fingerprinting
 * - License validation with tamper detection
 * - Time rollback detection
 * - Grace period management (7 days grace, 20 days readonly)
 * - Comprehensive event logging
 */
export class LicenseManager {
  /**
   * Validate the current license status.
   *
   * Checks:
   * 1. License exists and is active
   * 2. Hardware fingerprint matches
   * 3. System time hasn't been rolled back
   * 4. License expiry status
   *
   * @returns License status: active, grace, readonly, or expired
   */
  async validateLicense(): Promise<LicenseStatus> {
    try {
      const license = await this.getCurrentLicense();

      if (!license) {
        return 'expired';
      }

      // Verify hardware fingerprint
      const currentFingerprint = await getHardwareFingerprint();
      if (currentFingerprint !== license.hardware_fingerprint) {
        await this.logTamper(license.id, 'hardware_mismatch');
        return 'expired';
      }

      // Check for time rollback
      const now = new Date();
      if (now < license.last_verified) {
        await this.logTamper(license.id, 'time_rollback');
        return 'expired';
      }

      // Update last verified time
      await this.updateLastVerified(license.id);

      // Check expiry
      return this.getLicenseStatus(license);

    } catch (error) {
      console.error('License validation failed:', error);
      return 'expired';
    }
  }

  /**
   * Activate a product key.
   *
   * Validates the product key format, checks if it's already been used,
   * and creates a new license bound to the current hardware.
   *
   * @param productKey - The product key to activate (format: XXXX-XXXX-XXXX-XXXX)
   * @returns true if activation successful
   * @throws Error if product key is invalid or already activated
   */
  async activateProductKey(productKey: string): Promise<boolean> {
    // Validate product key format
    if (!validateProductKey(productKey)) {
      throw new Error('Invalid product key format');
    }

    // Decode subscription info
    const subscriptionInfo = decodeProductKey(productKey);

    // Check if key already used
    const keyHash = hashProductKey(productKey);
    const existing = await query(
      'SELECT * FROM licenses WHERE product_key_hash = $1',
      [keyHash]
    );

    if (existing.rows.length > 0) {
      throw new Error('Product key already activated');
    }

    // Get hardware fingerprint
    const hardwareFingerprint = await getHardwareFingerprint();

    // Calculate dates
    const activationDate = new Date();
    const expiryDate = this.calculateExpiryDate(activationDate, subscriptionInfo.subscriptionType);

    // Generate signature
    const signature = this.generateSignature(productKey, hardwareFingerprint);

    // Create license
    await query(
      `INSERT INTO licenses
       (product_key_hash, subscription_type, activation_date, expiry_date,
        hardware_fingerprint, activation_signature)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [keyHash, subscriptionInfo.subscriptionType, activationDate, expiryDate,
       hardwareFingerprint, signature]
    );

    // Log activation
    const license = await this.getCurrentLicense();
    if (license) {
      await this.logLicenseEvent(license.id, 'activation');
    }

    return true;
  }

  /**
   * Get current license information.
   *
   * @returns License object or null if no active license
   */
  async getLicenseInfo(): Promise<License | null> {
    return this.getCurrentLicense();
  }

  /**
   * Get the most recent active license.
   *
   * @private
   */
  private async getCurrentLicense(): Promise<License | null> {
    const result = await query<License>(
      'SELECT * FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
    );

    return result.rows[0] || null;
  }

  /**
   * Determine license status based on expiry date.
   *
   * Status rules:
   * - active: Not expired
   * - grace: 0-7 days past expiry (full functionality)
   * - readonly: 8-27 days past expiry (read-only access)
   * - expired: 28+ days past expiry (no access)
   *
   * @private
   */
  private getLicenseStatus(license: License): LicenseStatus {
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

  /**
   * Calculate expiry date based on subscription type.
   *
   * @private
   */
  private calculateExpiryDate(
    activationDate: Date,
    subscriptionType: string
  ): Date {
    const days: Record<string, number> = {
      monthly: 30,
      quarterly: 90,
      annual: 365
    };

    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days[subscriptionType] || 365);
    return expiry;
  }

  /**
   * Generate activation signature from product key and hardware fingerprint.
   *
   * @private
   */
  private generateSignature(productKey: string, fingerprint: string): string {
    const data = productKey + fingerprint + Date.now();
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Log a tamper detection event.
   *
   * @private
   */
  private async logTamper(licenseId: string, eventType: string): Promise<void> {
    await this.logLicenseEvent(licenseId, 'tamper_detected', { eventType });
  }

  /**
   * Log a license event for audit purposes.
   *
   * @private
   */
  private async logLicenseEvent(
    licenseId: string,
    eventType: string,
    details?: any
  ): Promise<void> {
    await query(
      `INSERT INTO license_logs (license_id, event_type, system_time, details)
       VALUES ($1, $2, $3, $4)`,
      [licenseId, eventType, new Date().toISOString(), JSON.stringify(details || {})]
    );
  }

  /**
   * Update the last verified timestamp for a license.
   *
   * @private
   */
  private async updateLastVerified(licenseId: string): Promise<void> {
    await query(
      'UPDATE licenses SET last_verified = now() WHERE id = $1',
      [licenseId]
    );
  }
}
