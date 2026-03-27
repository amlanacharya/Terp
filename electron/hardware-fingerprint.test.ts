import { getHardwareFingerprint } from './hardware-fingerprint';

// Mock systeminformation module
const mockCpu = jest.fn();
const mockOsInfo = jest.fn();
const mockNetworkInterfaces = jest.fn();

jest.mock('systeminformation', () => ({
  cpu: () => mockCpu(),
  osInfo: () => mockOsInfo(),
  networkInterfaces: () => mockNetworkInterfaces()
}));

describe('Hardware Fingerprint', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockCpu.mockResolvedValue({
      manufacturer: 'Intel',
      brand: 'Core i7',
      cores: 8
    });
    mockOsInfo.mockResolvedValue({
      serial: 'test-serial-123'
    });
    mockNetworkInterfaces.mockResolvedValue([
      {
        operstate: 'up',
        mac: '00:1A:2B:3C:4D:5E'
      }
    ]);
  });

  it('should generate a consistent fingerprint', async () => {
    const fp1 = await getHardwareFingerprint();
    const fp2 = await getHardwareFingerprint();
    expect(fp1).toBe(fp2);
  });

  it('should generate a unique hash', async () => {
    const fp = await getHardwareFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
  });

  it('should handle missing network interface gracefully', async () => {
    mockNetworkInterfaces.mockResolvedValue([]);

    const fp = await getHardwareFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should use fallback when systeminformation fails', async () => {
    mockCpu.mockRejectedValue(new Error('System info not available'));

    const fp1 = await getHardwareFingerprint();
    const fp2 = await getHardwareFingerprint();
    // Both should be valid SHA256 hashes
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    expect(fp2).toMatch(/^[a-f0-9]{64}$/);
  });
});
