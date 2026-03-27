import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Hardware Fingerprinting for License Binding
 *
 * Generates a unique fingerprint based on hardware characteristics
 * to bind licenses to specific machines and prevent key sharing.
 */

export interface HardwareInfo {
  cpuId: string;
  macAddress: string;
  machineGuid: string;
  volumeSerial: string;
}

export interface FingerprintResult {
  fingerprint: string;
  hardwareInfo: HardwareInfo;
  components: string[];
}

/**
 * Generate hardware fingerprint for license binding
 */
export async function getHardwareFingerprint(): Promise<FingerprintResult> {
  const hardwareInfo: HardwareInfo = {
    cpuId: await getCpuId(),
    macAddress: await getMacAddress(),
    machineGuid: await getMachineGuid(),
    volumeSerial: await getVolumeSerial(),
  };

  // Combine all components
  const components = [
    hardwareInfo.cpuId,
    hardwareInfo.macAddress,
    hardwareInfo.machineGuid,
    hardwareInfo.volumeSerial,
  ].filter(Boolean); // Remove any undefined/empty values

  // Create fingerprint using SHA-256 hash
  const combined = components.join('|');
  const fingerprint = crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 32); // Use first 32 chars

  return {
    fingerprint,
    hardwareInfo,
    components,
  };
}

/**
 * Get CPU ID (Windows-specific)
 */
async function getCpuId(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'wmic cpu get ProcessorId /value'
    );
    const match = stdout.match(/ProcessorId=(.+)/);
    return match ? match[1].trim() : '';
  } catch (error) {
    console.error('Failed to get CPU ID:', error);
    return '';
  }
}

/**
 * Get MAC address of first network adapter
 */
async function getMacAddress(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'getmac /fo csv /nh'
    );
    const match = stdout.match(/"([0-9A-F-]{17})"/);
    return match ? match[1] : '';
  } catch (error) {
    console.error('Failed to get MAC address:', error);
    return '';
  }
}

/**
 * Get Machine GUID (Windows-specific)
 */
async function getMachineGuid(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
    );
    const match = stdout.match(/MachineGuid\s+REG_SZ\s+(.+)/);
    return match ? match[1].trim() : '';
  } catch (error) {
    console.error('Failed to get Machine GUID:', error);
    return '';
  }
}

/**
 * Get Volume Serial Number (C: drive)
 */
async function getVolumeSerial(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'vol c:'
    );
    const match = stdout.match(/Volume Serial Number is (.+)/);
    return match ? match[1].trim() : '';
  } catch (error) {
    console.error('Failed to get Volume Serial:', error);
    return '';
  }
}

/**
 * Verify if current machine matches the fingerprint
 */
export async function verifyFingerprint(expectedFingerprint: string): Promise<boolean> {
  try {
    const current = await getHardwareFingerprint();
    return current.fingerprint === expectedFingerprint;
  } catch (error) {
    console.error('Failed to verify fingerprint:', error);
    return false;
  }
}

/**
 * Get a simplified machine ID for logging (not for licensing)
 */
export async function getMachineId(): Promise<string> {
  const fingerprint = await getHardwareFingerprint();
  // Return last 12 characters for display purposes
  return fingerprint.fingerprint.substring(20);
}

/**
 * Validate that required hardware components are available
 */
export async function validateHardwareComponents(): Promise<{
  valid: boolean;
  missingComponents: string[];
}> {
  const hardwareInfo = await getHardwareFingerprint();
  const missingComponents: string[] = [];

  if (!hardwareInfo.hardwareInfo.cpuId) {
    missingComponents.push('CPU ID');
  }

  if (!hardwareInfo.hardwareInfo.macAddress) {
    missingComponents.push('MAC Address');
  }

  if (!hardwareInfo.hardwareInfo.machineGuid) {
    missingComponents.push('Machine GUID');
  }

  // At least 3 components are required
  const valid = missingComponents.length < 2;

  return {
    valid,
    missingComponents,
  };
}
