import { Request, Response } from 'express';
import { Pool } from 'pg';
import {
  validateProductKey,
  extractSubscriptionType,
  type SubscriptionType,
} from './key-generator.js';
import { getHardwareFingerprint } from './fingerprint.js';
import {
  activateLicense,
  getCurrentLicense,
  getLicenseStatus,
  getCompanySettings,
  type License,
} from './db.js';

/**
 * License Service
 *
 * Handles license activation, validation, and enforcement
 */

export interface ActivationResult {
  success: boolean;
  license?: License;
  error?: string;
  message?: string;
}

export interface LicenseStatusResult {
  status: 'active' | 'grace' | 'readonly' | 'expired';
  expiryDate: string;
  daysRemaining: number;
  subscriptionType: string;
  canUse: boolean;
  warningMessage?: string;
}

/**
 * Activate a product key
 */
export async function handleActivation(productKey: string): Promise<ActivationResult> {
  try {
    // Validate product key format and checksum
    const keyValidation = validateProductKey(productKey);
    if (!keyValidation.valid) {
      return {
        success: false,
        error: keyValidation.error || 'Invalid product key',
      };
    }

    // Get hardware fingerprint
    const { fingerprint } = await getHardwareFingerprint();
    if (!fingerprint) {
      return {
        success: false,
        error: 'Failed to generate hardware fingerprint',
      };
    }

    // Extract subscription type
    const { type } = extractSubscriptionType(productKey);

    // Activate the license
    const license = await activateLicense(productKey, fingerprint, type);

    return {
      success: true,
      license,
      message: `License activated successfully. Expires on ${new Date(license.expiry_date).toLocaleDateString()}`,
    };
  } catch (error: any) {
    console.error('Activation error:', error);

    if (error.message?.includes('already activated')) {
      return {
        success: false,
        error: 'This license is already activated on a different machine',
      };
    }

    return {
      success: false,
      error: error.message || 'Activation failed',
    };
  }
}

/**
 * Get current license status with enforcement
 */
export async function getLicenseStatusWithEnforcement(): Promise<LicenseStatusResult> {
  try {
    const license = await getCurrentLicense();

    if (!license) {
      return {
        status: 'expired',
        expiryDate: new Date().toISOString(),
        daysRemaining: 0,
        subscriptionType: 'none',
        canUse: false,
        warningMessage: 'No license found. Please activate your product.',
      };
    }

    // Verify hardware fingerprint matches
    const { fingerprint: currentFingerprint } = await getHardwareFingerprint();
    if (currentFingerprint !== license.hardware_fingerprint) {
      return {
        status: 'expired',
        expiryDate: license.expiry_date.toISOString(),
        daysRemaining: 0,
        subscriptionType: license.subscription_type,
        canUse: false,
        warningMessage: 'License hardware mismatch. Please contact support.',
      };
    }

    // Get license status
    const { status, daysRemaining } = getLicenseStatus(license);

    const warningMessages = {
      active: '',
      grace: 'Subscription expiring soon. Please renew to continue service.',
      readonly: 'Subscription expired. View-only mode enabled. Renew to restore full access.',
      expired: 'Subscription expired. Please renew to continue.',
    };

    return {
      status,
      expiryDate: license.expiry_date.toISOString(),
      daysRemaining,
      subscriptionType: license.subscription_type,
      canUse: status === 'active' || status === 'grace',
      warningMessage: warningMessages[status],
    };
  } catch (error) {
    console.error('License status error:', error);
    throw error;
  }
}

/**
 * Middleware to check license status on each request
 */
export async function checkLicenseMiddleware(
  req: Request,
  res: Response,
  next: Function
): Promise<void> {
  try {
    // Allow license verification endpoint
    if (req.path === '/api/license/verify' || req.path === '/api/license/status') {
      return next();
    }

    // Get license status
    const licenseStatus = await getLicenseStatusWithEnforcement();

    // Add license info to request for later use
    (req as any).licenseStatus = licenseStatus;

    // Allow GET requests in readonly mode
    const isGetRequest = req.method === 'GET';
    const isPdfRequest = req.path.includes('/pdf');

    // Determine access based on status
    switch (licenseStatus.status) {
      case 'active':
      case 'grace':
        // Full access
        return next();

      case 'readonly':
        // Allow GET requests (browsing data), block PDF generation and edits
        if (!isGetRequest || isPdfRequest) {
          res.status(403).json({
            error: licenseStatus.warningMessage || 'Subscription expired',
            status: licenseStatus.status,
            expiryDate: licenseStatus.expiryDate,
          });
          return;
        }
        return next();

      case 'expired':
        // Complete lockdown
        res.status(403).json({
          error: licenseStatus.warningMessage || 'Subscription expired',
          status: licenseStatus.status,
          expiryDate: licenseStatus.expiryDate,
        });
        return;

      default:
        return next();
    }
  } catch (error) {
    console.error('License middleware error:', error);
    // Fail open - allow request if license check fails
    return next();
  }
}

/**
 * Verify license endpoint
 */
export async function handleVerifyLicense(): Promise<{
  valid: boolean;
  status?: LicenseStatusResult;
}> {
  try {
    const status = await getLicenseStatusWithEnforcement();
    return {
      valid: status.status !== 'expired',
      status,
    };
  } catch (error) {
    console.error('License verify error:', error);
    return { valid: false };
  }
}

/**
 * Get company settings
 */
export async function handleGetCompanySettings() {
  try {
    const settings = await getCompanySettings();

    if (!settings) {
      return null;
    }

    return settings;
  } catch (error) {
    console.error('Get company settings error:', error);
    throw error;
  }
}

/**
 * Calculate expiry date based on subscription type
 */
export function calculateExpiryDate(
  subscriptionType: SubscriptionType,
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
