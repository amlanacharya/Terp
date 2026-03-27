import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to renderer process
 *
 * This API provides secure communication between the renderer process
 * and the main process for backup, restore, and system operations.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // App Information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),

  // Backup Operations
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: (filePath: string) => ipcRenderer.invoke('restore-database', filePath),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  deleteOldBackups: (keepCount?: number) => ipcRenderer.invoke('delete-old-backups', keepCount),
  getBackupDirectory: () => ipcRenderer.invoke('get-backup-directory'),

  // PostgreSQL Service Operations
  postgresStatus: () => ipcRenderer.invoke('postgres-status'),
  postgresStart: () => ipcRenderer.invoke('postgres-start'),
  postgresStop: () => ipcRenderer.invoke('postgres-stop'),
  postgresRestart: () => ipcRenderer.invoke('postgres-restart'),

  // License Management
  licenseValidate: () => ipcRenderer.invoke('license-validate'),
  licenseActivate: (productKey: string) => ipcRenderer.invoke('license-activate', productKey),
  licenseInfo: () => ipcRenderer.invoke('license-info'),

  // Auto-Updater Operations
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),

  // Update Event Listeners
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback: (error: any) => void) => {
    const handler = (_event: any, error: any) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  }
});
