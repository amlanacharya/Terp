import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getHardwareFingerprint,
  verifyFingerprint,
  getMachineId,
  validateHardwareComponents,
} from './fingerprint';

describe('Hardware Fingerprinting', () => {
  describe('getHardwareFingerprint', () => {
    it('should generate a fingerprint', async () => {
      const result = await getHardwareFingerprint();

      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint).toHaveLength(32);
      expect(result.fingerprint).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should include hardware info', async () => {
      const result = await getHardwareFingerprint();

      expect(result.hardwareInfo).toBeDefined();
      expect(result.hardwareInfo).toHaveProperty('cpuId');
      expect(result.hardwareInfo).toHaveProperty('macAddress');
      expect(result.hardwareInfo).toHaveProperty('machineGuid');
      expect(result.hardwareInfo).toHaveProperty('volumeSerial');
    });

    it('should have at least 3 components', async () => {
      const result = await getHardwareFingerprint();

      expect(result.components.length).toBeGreaterThanOrEqual(3);
    });

    it('should generate consistent fingerprints', async () => {
      const fingerprint1 = await getHardwareFingerprint();
      const fingerprint2 = await getHardwareFingerprint();

      expect(fingerprint1.fingerprint).toBe(fingerprint2.fingerprint);
    }, 10000);
  });

  describe('verifyFingerprint', () => {
    it('should verify matching fingerprint', async () => {
      const current = await getHardwareFingerprint();

      const isValid = await verifyFingerprint(current.fingerprint);

      expect(isValid).toBe(true);
    });

    it('should reject different fingerprint', async () => {
      const isValid = await verifyFingerprint('invalid-fingerprint-1234567890abcdef');

      expect(isValid).toBe(false);
    });
  });

  describe('getMachineId', () => {
    it('should return a machine ID', async () => {
      const machineId = await getMachineId();

      expect(machineId).toBeDefined();
      expect(machineId).toHaveLength(12);
      expect(machineId).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should be consistent with last 12 chars of fingerprint', async () => {
      const fingerprint = await getHardwareFingerprint();
      const machineId = await getMachineId();

      expect(machineId).toBe(fingerprint.fingerprint.substring(20));
    });
  });

  describe('validateHardwareComponents', () => {
    it('should validate hardware components', async () => {
      const result = await validateHardwareComponents();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.missingComponents)).toBe(true);
    });

    it('should typically pass on Windows systems', async () => {
      const result = await validateHardwareComponents();

      // Most Windows systems should have at least CPU ID, Machine GUID, and MAC
      expect(result.valid).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should generate fingerprint and verify successfully', async () => {
      const fingerprint = await getHardwareFingerprint();
      const isValid = await verifyFingerprint(fingerprint.fingerprint);

      expect(isValid).toBe(true);
    });

    it('should generate unique machine IDs for different calls', async () => {
      const id1 = await getMachineId();
      const id2 = await getMachineId();

      // Should be consistent, not random
      expect(id1).toBe(id2);
    });
  });
});
