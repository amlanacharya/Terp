"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseManager = void 0;
const hardware_fingerprint_1 = require("./hardware-fingerprint");
// @ts-ignore - Compiled server modules
const db_js_1 = require("../server/dist/config/db.js");
// @ts-ignore - Compiled server modules
const product_key_js_1 = require("../server/dist/utils/product-key.js");
const crypto_1 = require("crypto");
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
class LicenseManager {
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
    async validateLicense() {
        try {
            const license = await this.getCurrentLicense();
            if (!license) {
                return 'expired';
            }
            // Verify hardware fingerprint
            const currentFingerprint = await (0, hardware_fingerprint_1.getHardwareFingerprint)();
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
        }
        catch (error) {
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
    async activateProductKey(productKey) {
        // Validate product key format
        if (!(0, product_key_js_1.validateProductKey)(productKey)) {
            throw new Error('Invalid product key format');
        }
        // Decode subscription info
        const subscriptionInfo = (0, product_key_js_1.decodeProductKey)(productKey);
        // Check if key already used
        const keyHash = (0, product_key_js_1.hashProductKey)(productKey);
        const existing = await (0, db_js_1.query)('SELECT * FROM licenses WHERE product_key_hash = $1', [keyHash]);
        if (existing.rows.length > 0) {
            throw new Error('Product key already activated');
        }
        // Get hardware fingerprint
        const hardwareFingerprint = await (0, hardware_fingerprint_1.getHardwareFingerprint)();
        // Calculate dates
        const activationDate = new Date();
        const expiryDate = this.calculateExpiryDate(activationDate, subscriptionInfo.subscriptionType);
        // Generate signature
        const signature = this.generateSignature(productKey, hardwareFingerprint);
        // Create license
        await (0, db_js_1.query)(`INSERT INTO licenses
       (product_key_hash, subscription_type, activation_date, expiry_date,
        hardware_fingerprint, activation_signature)
       VALUES ($1, $2, $3, $4, $5, $6)`, [keyHash, subscriptionInfo.subscriptionType, activationDate, expiryDate,
            hardwareFingerprint, signature]);
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
    async getLicenseInfo() {
        return this.getCurrentLicense();
    }
    /**
     * Get the most recent active license.
     *
     * @private
     */
    async getCurrentLicense() {
        const result = await (0, db_js_1.query)('SELECT * FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1');
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
    getLicenseStatus(license) {
        const now = new Date();
        const expiryDate = new Date(license.expiry_date);
        const daysPastExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPastExpiry <= 0)
            return 'active';
        if (daysPastExpiry <= 7)
            return 'grace';
        if (daysPastExpiry <= 27)
            return 'readonly';
        return 'expired';
    }
    /**
     * Calculate expiry date based on subscription type.
     *
     * @private
     */
    calculateExpiryDate(activationDate, subscriptionType) {
        const days = {
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
    generateSignature(productKey, fingerprint) {
        const data = productKey + fingerprint + Date.now();
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    /**
     * Log a tamper detection event.
     *
     * @private
     */
    async logTamper(licenseId, eventType) {
        await this.logLicenseEvent(licenseId, 'tamper_detected', { eventType });
    }
    /**
     * Log a license event for audit purposes.
     *
     * @private
     */
    async logLicenseEvent(licenseId, eventType, details) {
        await (0, db_js_1.query)(`INSERT INTO license_logs (license_id, event_type, system_time, details)
       VALUES ($1, $2, $3, $4)`, [licenseId, eventType, new Date().toISOString(), JSON.stringify(details || {})]);
    }
    /**
     * Update the last verified timestamp for a license.
     *
     * @private
     */
    async updateLastVerified(licenseId) {
        await (0, db_js_1.query)('UPDATE licenses SET last_verified = now() WHERE id = $1', [licenseId]);
    }
}
exports.LicenseManager = LicenseManager;
