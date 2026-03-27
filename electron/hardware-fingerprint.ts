import * as si from 'systeminformation';
import { createHash } from 'crypto';

/**
 * Generate a hardware fingerprint based on system components.
 * This fingerprint is used to bind licenses to specific machines.
 *
 * @returns Promise<string> - SHA256 hex hash (64 characters)
 */
export async function getHardwareFingerprint(): Promise<string> {
  try {
    const cpu = await si.cpu();
    const osInfo = await si.osInfo();
    const networkInterfaces = await si.networkInterfaces();

    // Find primary network interface (first active one with non-zero MAC)
    const primaryInterface = networkInterfaces.find(iface =>
      iface.operstate === 'up' && iface.mac && iface.mac !== '00:00:00:00:00:00'
    );

    // Combine hardware components into a fingerprint string
    const components = [
      cpu.manufacturer,
      cpu.brand,
      cpu.cores.toString(),
      osInfo.serial || 'unknown',
      primaryInterface?.mac || 'unknown'
    ].join('|');

    // Generate SHA256 hash
    return createHash('sha256').update(components).digest('hex');
  } catch (error) {
    console.error('Failed to generate hardware fingerprint:', error);
    // Fallback to simple hash if systeminformation fails
    // This allows the application to continue even if hardware detection fails
    return createHash('sha256').update(Date.now().toString()).digest('hex');
  }
}
