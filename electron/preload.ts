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
  postgresRestart: () => ipcRenderer.invoke('postgres-restart')
});
