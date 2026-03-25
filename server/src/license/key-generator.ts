import crypto from 'crypto';

/**
 * Product Key Format: GT01-TTXX-YYYY-ZZZZ-CCCC
 *
 * Format breakdown:
 * - GT01: Version/Publisher identifier (Intelligrip)
 * - TT: Subscription type (10=Monthly, 20=Quarterly, 30=Annual)
 * - XX: Random 2 digits for uniqueness
 * - YYYY: Random 4 digits
 * - ZZZZ: Random 4 digits
 * - CCCC: Checksum (4 digits, Luhn-algorithm style using HMAC-SHA256)
 */

const SECRET_KEY = 'INTELLIGRIP-TRAVELERP-LITE-SECRET-2026';
const VERSION_PREFIX = 'GT01';

export type SubscriptionType = 'monthly' | 'quarterly' | 'annual';

export interface GeneratedKey {
  productKey: string;
  subscriptionType: SubscriptionType;
  generatedAt: Date;
}

export interface KeyPool {
  monthly: string[];
  quarterly: string[];
  annual: string[];
  generatedAt: Date;
  total: number;
}

/**
 * Generate a single product key
 */
export function generateProductKey(type: SubscriptionType): string {
  const typeCode = type === 'monthly' ? '10' : type === 'quarterly' ? '20' : '30';

  // Generate random components
  const random1 = generateRandomDigits(2);
  const random2 = generateRandomDigits(4);
  const random3 = generateRandomDigits(4);

  // Build key without checksum
  const baseKey = `${VERSION_PREFIX}${typeCode}${random1}-${random2}-${random3}-`;

  // Calculate checksum using HMAC-SHA256
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(baseKey.replace(/-/g, ''));
  const hash = hmac.digest('hex');

  // Take first 4 characters of hash, convert to 4-digit number
  const checksum = parseInt(hash.substring(0, 4), 16)
    .toString()
    .padStart(4, '0')
    .slice(0, 4);

  return `${VERSION_PREFIX}-${typeCode}${random1}-${random2}-${random3}-${checksum}`;
}

/**
 * Generate a pool of keys
 */
export function generateKeyPool(
  monthly: number,
  quarterly: number,
  annual: number
): KeyPool {
  const pool: KeyPool = {
    monthly: [],
    quarterly: [],
    annual: [],
    generatedAt: new Date(),
    total: monthly + quarterly + annual,
  };

  // Generate monthly keys
  for (let i = 0; i < monthly; i++) {
    pool.monthly.push(generateProductKey('monthly'));
  }

  // Generate quarterly keys
  for (let i = 0; i < quarterly; i++) {
    pool.quarterly.push(generateProductKey('quarterly'));
  }

  // Generate annual keys
  for (let i = 0; i < annual; i++) {
    pool.annual.push(generateProductKey('annual'));
  }

  return pool;
}

/**
 * Generate random digits
 */
function generateRandomDigits(count: number): string {
  let digits = '';
  for (let i = 0; i < count; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return digits;
}

/**
 * Validate product key format
 */
export function validateProductKeyFormat(productKey: string): {
  valid: boolean;
  error?: string;
} {
  // Format: GT01-TTXX-YYYY-ZZZZ-CCCC
  const formatRegex = /^GT01-(10|20|30)\d{2}-\d{4}-\d{4}-\d{4}$/;

  if (!productKey) {
    return { valid: false, error: 'Product key is required' };
  }

  if (typeof productKey !== 'string') {
    return { valid: false, error: 'Product key must be a string' };
  }

  if (!formatRegex.test(productKey)) {
    return {
      valid: false,
      error: 'Invalid key format. Expected format: GT01-XXYY-ZZZZ-AAAA-BBBB',
    };
  }

  return { valid: true };
}

/**
 * Verify product key checksum
 */
export function verifyChecksum(productKey: string): boolean {
  const formatValid = validateProductKeyFormat(productKey);
  if (!formatValid.valid) {
    return false;
  }

  // Extract provided checksum (5th segment, index 4)
  const parts = productKey.split('-');
  const providedChecksum = parts[4];

  // Recalculate checksum
  // Format: GT01-TTXX-YYYY-ZZZZ-CCCC
  // Base for checksum: GT01TTXXYYYYZZZZ
  const baseKey = `${parts[0]}${parts[1]}${parts[2]}${parts[3]}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(baseKey);
  const hash = hmac.digest('hex');
  const calculatedChecksum = parseInt(hash.substring(0, 4), 16)
    .toString()
    .padStart(4, '0')
    .slice(0, 4);

  return providedChecksum === calculatedChecksum;
}

/**
 * Extract subscription type from product key
 */
export function extractSubscriptionType(productKey: string): {
  type: SubscriptionType;
  valid: boolean;
} {
  const formatValid = validateProductKeyFormat(productKey);
  if (!formatValid.valid) {
    return { type: 'monthly', valid: false };
  }

  const typeCode = productKey.substring(5, 7);
  const type = typeCode === '10' ? 'monthly' : typeCode === '20' ? 'quarterly' : 'annual';

  return { type, valid: true };
}

/**
 * Validate product key (format + checksum)
 */
export function validateProductKey(productKey: string): {
  valid: boolean;
  type?: SubscriptionType;
  error?: string;
} {
  // Check format
  const formatValid = validateProductKeyFormat(productKey);
  if (!formatValid.valid) {
    return formatValid;
  }

  // Verify checksum
  if (!verifyChecksum(productKey)) {
    return { valid: false, error: 'Invalid product key' };
  }

  // Extract type
  const { type } = extractSubscriptionType(productKey);

  return { valid: true, type };
}
