/**
 * Electron API type definitions for renderer process
 *
 * This file provides TypeScript type definitions for the Electron APIs
 * exposed via contextBridge in the preload script.
 */

export interface ElectronAPI {
  /**
   * Get the application version
   * @returns Promise resolving to version string
   */
  getAppVersion: () => Promise<string>;

  /**
   * Create a backup of the database
   * @returns Promise resolving to backup file path
   */
  backupDatabase?: () => Promise<string>;

  /**
   * Restore database from backup file
   * @param filePath Path to backup file
   */
  restoreDatabase?: (filePath: string) => Promise<void>;

  /**
   * List available database backups
   * @returns Promise resolving to array of backup filenames
   */
  listBackups?: () => Promise<string[]>;

  /**
   * Get PostgreSQL service status
   * @returns Promise resolving to 'running' | 'stopped' | 'unknown'
   */
  postgresStatus?: () => Promise<string>;

  /**
   * Validate current license
   * @returns Promise resolving to license status
   */
  licenseValidate?: () => Promise<string>;

  /**
   * Activate a product key
   * @param productKey 16-digit product key (XXXX-XXXX-XXXX-XXXX)
   * @returns Promise resolving to activation result
   */
  licenseActivate?: (productKey: string) => Promise<boolean>;

  /**
   * Get current license information
   * @returns Promise resolving to license details
   */
  licenseInfo?: () => Promise<any>;

  /**
   * Check for application updates
   */
  checkForUpdates?: () => Promise<void>;

  /**
   * Install downloaded update and restart
   */
  installUpdate?: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// This export is required to make this a module
export {};
