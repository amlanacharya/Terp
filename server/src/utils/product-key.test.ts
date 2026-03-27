import { generateProductKey, validateProductKey, decodeProductKey } from './product-key';

describe('Product Key Utility', () => {
  describe('generateProductKey', () => {
    it('should generate a valid key for monthly subscription', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate a valid key for quarterly subscription', () => {
      const key = generateProductKey('quarterly', '2026-03-27');
      expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate a valid key for annual subscription', () => {
      const key = generateProductKey('annual', '2026-03-27');
      expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateProductKey('annual', '2026-03-27');
      const key2 = generateProductKey('annual', '2026-03-27');
      expect(key1).not.toBe(key2);
    });

    it('should start with T3RP prefix', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      expect(key).toMatch(/^T3RP-/);
    });
  });

  describe('validateProductKey', () => {
    it('should validate a correct key', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      expect(validateProductKey(key)).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(validateProductKey('INVALID')).toBe(false);
    });

    it('should reject malformed format', () => {
      expect(validateProductKey('XXXX-XXXX-XXXX')).toBe(false);
    });

    it('should reject tampered checksum', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      const tamperedKey = key.replace(/.$/, 'X');
      expect(validateProductKey(tamperedKey)).toBe(false);
    });

    it('should reject key with invalid characters', () => {
      expect(validateProductKey('T3RP-01AB-2601-XXXX')).toBe(false);
    });
  });

  describe('decodeProductKey', () => {
    it('should decode monthly subscription type', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      const decoded = decodeProductKey(key);
      expect(decoded.subscriptionType).toBe('monthly');
    });

    it('should decode quarterly subscription type', () => {
      const key = generateProductKey('quarterly', '2026-03-27');
      const decoded = decodeProductKey(key);
      expect(decoded.subscriptionType).toBe('quarterly');
    });

    it('should decode annual subscription type', () => {
      const key = generateProductKey('annual', '2026-03-27');
      const decoded = decodeProductKey(key);
      expect(decoded.subscriptionType).toBe('annual');
    });

    it('should decode issue date', () => {
      const key = generateProductKey('monthly', '2026-03-01');
      const decoded = decodeProductKey(key);
      // Note: Date encoding stores YYMM (year-month), day defaults to 01
      expect(decoded.issueDate).toBe('2026-03-01');
    });

    it('should decode issue date with different month', () => {
      const key = generateProductKey('annual', '2025-12-15');
      const decoded = decodeProductKey(key);
      expect(decoded.issueDate).toBe('2025-12-01');
    });

    it('should throw error for invalid key', () => {
      expect(() => decodeProductKey('INVALID')).toThrow('Invalid product key');
    });

    it('should throw error for key with bad checksum', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      const tamperedKey = key.replace(/.$/, 'X');
      expect(() => decodeProductKey(tamperedKey)).toThrow('Invalid product key');
    });
  });
});
