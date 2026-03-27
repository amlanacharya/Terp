import { describe, it, expect } from 'vitest';
import {
  generateProductKey,
  generateKeyPool,
  validateProductKeyFormat,
  verifyChecksum,
  extractSubscriptionType,
  validateProductKey,
} from './key-generator';

describe('Key Generator', () => {
  describe('generateProductKey', () => {
    it('should generate a valid monthly key', () => {
      const key = generateProductKey('monthly');
      expect(key).toMatch(/^GT01-10\d{2}-\d{4}-\d{4}-\d{4}$/);
    });

    it('should generate a valid quarterly key', () => {
      const key = generateProductKey('quarterly');
      expect(key).toMatch(/^GT01-20\d{2}-\d{4}-\d{4}-\d{4}$/);
    });

    it('should generate a valid annual key', () => {
      const key = generateProductKey('annual');
      expect(key).toMatch(/^GT01-30\d{2}-\d{4}-\d{4}-\d{4}$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set();
      for (let i = 0; i < 1000; i++) {
        keys.add(generateProductKey('monthly'));
      }
      expect(keys.size).toBe(1000);
    });
  });

  describe('generateKeyPool', () => {
    it('should generate correct number of keys', () => {
      const pool = generateKeyPool(10, 5, 2);
      expect(pool.monthly).toHaveLength(10);
      expect(pool.quarterly).toHaveLength(5);
      expect(pool.annual).toHaveLength(2);
      expect(pool.total).toBe(17);
    });

    it('should generate all valid keys', () => {
      const pool = generateKeyPool(10, 10, 10);
      const allKeys = [...pool.monthly, ...pool.quarterly, ...pool.annual];

      allKeys.forEach(key => {
        const validation = validateProductKey(key);
        expect(validation.valid).toBe(true);
      });
    });

    it('should generate unique keys across all types', () => {
      const pool = generateKeyPool(50, 30, 20);
      const allKeys = [...pool.monthly, ...pool.quarterly, ...pool.annual];
      const uniqueKeys = new Set(allKeys);

      expect(uniqueKeys.size).toBe(100);
    });
  });

  describe('validateProductKeyFormat', () => {
    it('should accept valid monthly key format', () => {
      const result = validateProductKeyFormat('GT01-1012-3456-7890-1234');
      expect(result.valid).toBe(true);
    });

    it('should accept valid quarterly key format', () => {
      const result = validateProductKeyFormat('GT01-2012-3456-7890-1234');
      expect(result.valid).toBe(true);
    });

    it('should accept valid annual key format', () => {
      const result = validateProductKeyFormat('GT01-3012-3456-7890-1234');
      expect(result.valid).toBe(true);
    });

    it('should reject wrong prefix', () => {
      const result = validateProductKeyFormat('AB01-1012-3456-7890-1234');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject wrong type code', () => {
      const result = validateProductKeyFormat('GT01-4012-3456-7890-1234');
      expect(result.valid).toBe(false);
    });

    it('should reject missing segments', () => {
      const result = validateProductKeyFormat('GT01-1012-3456-7890');
      expect(result.valid).toBe(false);
    });

    it('should reject empty key', () => {
      const result = validateProductKeyFormat('');
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyChecksum', () => {
    it('should verify valid checksum', () => {
      // Generate a key and verify its checksum
      const key = generateProductKey('monthly');
      expect(verifyChecksum(key)).toBe(true);
    });

    it('should reject invalid checksum', () => {
      // Generate a valid key and corrupt the checksum
      const key = generateProductKey('monthly');
      const parts = key.split('-');
      parts[3] = '0000'; // Corrupt checksum
      const corruptedKey = parts.join('-');

      expect(verifyChecksum(corruptedKey)).toBe(false);
    });

    it('should reject malformed keys', () => {
      expect(verifyChecksum('invalid-key')).toBe(false);
    });
  });

  describe('extractSubscriptionType', () => {
    it('should extract monthly type', () => {
      const { type, valid } = extractSubscriptionType('GT01-1012-3456-7890-1234');
      expect(type).toBe('monthly');
      expect(valid).toBe(true);
    });

    it('should extract quarterly type', () => {
      const { type, valid } = extractSubscriptionType('GT01-2012-3456-7890-1234');
      expect(type).toBe('quarterly');
      expect(valid).toBe(true);
    });

    it('should extract annual type', () => {
      const { type, valid } = extractSubscriptionType('GT01-3012-3456-7890-1234');
      expect(type).toBe('annual');
      expect(valid).toBe(true);
    });

    it('should return invalid for malformed key', () => {
      const { valid } = extractSubscriptionType('invalid-key');
      expect(valid).toBe(false);
    });
  });

  describe('validateProductKey', () => {
    it('should validate generated keys', () => {
      const monthlyKey = generateProductKey('monthly');
      const quarterlyKey = generateProductKey('quarterly');
      const annualKey = generateProductKey('annual');

      expect(validateProductKey(monthlyKey).valid).toBe(true);
      expect(validateProductKey(quarterlyKey).valid).toBe(true);
      expect(validateProductKey(annualKey).valid).toBe(true);
    });

    it('should return correct type for valid keys', () => {
      const monthlyKey = generateProductKey('monthly');
      const result = validateProductKey(monthlyKey);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('monthly');
    });

    it('should reject invalid format', () => {
      const result = validateProductKey('INVALID-KEY-FORMAT');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid checksum', () => {
      // Create a key with valid format but invalid checksum
      const key = 'GT01-1012-3456-7890-0000';
      const result = validateProductKey(key);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should generate and validate 1000 keys successfully', () => {
      const pool = generateKeyPool(600, 300, 100);
      const allKeys = [...pool.monthly, ...pool.quarterly, ...pool.annual];

      let validCount = 0;
      allKeys.forEach(key => {
        const validation = validateProductKey(key);
        if (validation.valid) {
          validCount++;
        }
      });

      expect(validCount).toBe(1000);
    });

    it('should have no duplicates in 1000 generated keys', () => {
      const pool = generateKeyPool(600, 300, 100);
      const allKeys = [...pool.monthly, ...pool.quarterly, ...pool.annual];
      const uniqueKeys = new Set(allKeys);

      expect(uniqueKeys.size).toBe(1000);
    });
  });
});
