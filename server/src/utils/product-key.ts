import { createHash, randomBytes } from 'crypto';

export interface ProductKeyInfo {
  subscriptionType: 'monthly' | 'quarterly' | 'annual';
  issueDate: string;
}

export function generateProductKey(
  subscriptionType: 'monthly' | 'quarterly' | 'annual',
  issueDate: string
): string {
  const typeCode: Record<string, string> = {
    monthly: '01',
    quarterly: '02',
    annual: '03'
  };

  // Encode date (simple encoding: YYMM)
  const date = new Date(issueDate);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const dateCode = year + month;

  // Generate random segment (only 2 chars now to make room for date)
  const random = randomBytes(1).toString('hex').toUpperCase().slice(0, 2);

  // Create key segments (must be 4 chars each for XXXX-XXXX-XXXX-XXXX format)
  // Structure: T3RP-TTYY-MMRR-CCCC
  // Where: TT=type, YY=year, MM=month, RR=random, CCCC=checksum
  const prefix = 'T3RP';  // Version/Publisher (4 chars)
  const segment1 = typeCode[subscriptionType] + dateCode.substring(0, 2);  // type + year
  const segment2 = dateCode.substring(2, 4) + random;  // month + random

  // Calculate checksum from first 12 chars
  const withoutChecksum = prefix + segment1 + segment2;
  const checksum = calculateChecksum(withoutChecksum);

  return `${prefix}-${segment1}-${segment2}-${checksum}`;
}

export function validateProductKey(key: string): boolean {
  // Check format
  const format = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!format.test(key)) return false;

  // Verify checksum
  const parts = key.split('-');
  const providedChecksum = parts[3];
  const withoutChecksum = parts.slice(0, 3).join('');
  const calculatedChecksum = calculateChecksum(withoutChecksum);

  return providedChecksum === calculatedChecksum;
}

export function decodeProductKey(key: string): ProductKeyInfo {
  if (!validateProductKey(key)) {
    throw new Error('Invalid product key');
  }

  const parts = key.split('-');
  // Format: T3RP-TTYY-MMRR-CCCC
  // Where: TT=type, YY=year, MM=month, RR=random, CCCC=checksum
  const typeCode = parts[1].substring(0, 2);
  const yearCode = parts[1].substring(2, 4);
  const monthCode = parts[2].substring(0, 2);

  const subscriptionTypes: Record<string, 'monthly' | 'quarterly' | 'annual'> = {
    '01': 'monthly',
    '02': 'quarterly',
    '03': 'annual'
  };

  // Decode date
  const year = '20' + yearCode;
  const month = monthCode;
  const issueDate = `${year}-${month}-01`;

  return {
    subscriptionType: subscriptionTypes[typeCode] || 'annual',
    issueDate
  };
}

function calculateChecksum(data: string): string {
  const hash = createHash('sha256').update(data).digest('hex');
  return hash.substring(0, 4).toUpperCase();
}

export function hashProductKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
