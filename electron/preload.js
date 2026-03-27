"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Electron API exposed to renderer process
 *
 * This API provides secure communication between the renderer process
 * and the main process for backup, restore, and system operations.
 */
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // App Information
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getAppPaths: () => electron_1.ipcRenderer.invoke('get-app-paths'),
    // Backup Operations
    backupDatabase: () => electron_1.ipcRenderer.invoke('backup-database'),
    restoreDatabase: (filePath) => electron_1.ipcRenderer.invoke('restore-database', filePath),
    listBackups: () => electron_1.ipcRenderer.invoke('list-backups'),
    deleteOldBackups: (keepCount) => electron_1.ipcRenderer.invoke('delete-old-backups', keepCount),
    getBackupDirectory: () => electron_1.ipcRenderer.invoke('get-backup-directory'),
    // PostgreSQL Service Operations
    postgresStatus: () => electron_1.ipcRenderer.invoke('postgres-status'),
    postgresStart: () => electron_1.ipcRenderer.invoke('postgres-start'),
    postgresStop: () => electron_1.ipcRenderer.invoke('postgres-stop'),
    postgresRestart: () => electron_1.ipcRenderer.invoke('postgres-restart'),
    // License Management
    licenseValidate: () => electron_1.ipcRenderer.invoke('license-validate'),
    licenseActivate: (productKey) => electron_1.ipcRenderer.invoke('license-activate', productKey),
    licenseInfo: () => electron_1.ipcRenderer.invoke('license-info')
});
