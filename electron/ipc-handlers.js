"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAutoUpdaterManager = setAutoUpdaterManager;
exports.registerIPCHandlers = registerIPCHandlers;
const electron_1 = require("electron");
const backup_manager_1 = require("./backup-manager");
const postgres_service_1 = require("./postgres-service");
const license_manager_1 = require("./license-manager");
// Global reference to auto-updater manager (set by main.ts)
let autoUpdaterManager = null;
/**
 * Set the auto-updater manager instance
 * Called from main.ts after creating the updater
 */
function setAutoUpdaterManager(updater) {
    autoUpdaterManager = updater;
}
/**
 * Register IPC handlers for main-renderer communication
 *
 * This function sets up all IPC handlers for secure communication
 * between the main process and renderer process.
 */
function registerIPCHandlers() {
    // Create service instances
    const backupManager = new backup_manager_1.BackupManager();
    const postgresService = new postgres_service_1.PostgresService();
    const licenseManager = new license_manager_1.LicenseManager();
    // ========================================
    // Backup Handlers
    // ========================================
    /**
     * Create a database backup
     * Returns: Path to the created backup file
     */
    electron_1.ipcMain.handle('backup-database', async () => {
        try {
            const backupPath = await backupManager.createBackup();
            return { success: true, path: backupPath };
        }
        catch (error) {
            console.error('[IPC] backup-database failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Restore database from a backup file
     * Parameters: filePath (string) - Path to backup file
     * Returns: Success status
     */
    electron_1.ipcMain.handle('restore-database', async (_event, filePath) => {
        try {
            await backupManager.restoreBackup(filePath);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] restore-database failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * List all available backup files
     * Returns: Array of backup filenames
     */
    electron_1.ipcMain.handle('list-backups', async () => {
        try {
            const backups = await backupManager.listBackups();
            return { success: true, backups };
        }
        catch (error) {
            console.error('[IPC] list-backups failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Delete old backups
     * Parameters: keepCount (number) - Number of backups to keep (default: 7)
     * Returns: Success status
     */
    electron_1.ipcMain.handle('delete-old-backups', async (_event, keepCount = 7) => {
        try {
            await backupManager.deleteOldBackups(keepCount);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] delete-old-backups failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Get backup directory path
     * Returns: Path to backup directory
     */
    electron_1.ipcMain.handle('get-backup-directory', async () => {
        try {
            const backupDir = backupManager.getBackupDirectory();
            return { success: true, path: backupDir };
        }
        catch (error) {
            console.error('[IPC] get-backup-directory failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    // ========================================
    // PostgreSQL Service Handlers
    // ========================================
    /**
     * Get PostgreSQL service status
     * Returns: Service status information
     */
    electron_1.ipcMain.handle('postgres-status', async () => {
        try {
            const status = await postgresService.getStatus();
            return { success: true, running: status === 'running', status };
        }
        catch (error) {
            console.error('[IPC] postgres-status failed:', error);
            return {
                success: false,
                running: false,
                status: 'unknown',
                error: error.message
            };
        }
    });
    /**
     * Start PostgreSQL service
     * Returns: Success status
     */
    electron_1.ipcMain.handle('postgres-start', async () => {
        try {
            await postgresService.start();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] postgres-start failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Stop PostgreSQL service
     * Returns: Success status
     */
    electron_1.ipcMain.handle('postgres-stop', async () => {
        try {
            await postgresService.stop();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] postgres-stop failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Restart PostgreSQL service
     * Returns: Success status
     */
    electron_1.ipcMain.handle('postgres-restart', async () => {
        try {
            await postgresService.stop();
            // Wait a moment for stop to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            await postgresService.start();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] postgres-restart failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    // ========================================
    // App Information Handlers
    // ========================================
    /**
     * Get application version
     * Returns: Version string from package.json
     */
    electron_1.ipcMain.handle('get-app-version', () => {
        try {
            return { success: true, version: electron_1.app.getVersion() };
        }
        catch (error) {
            console.error('[IPC] get-app-version failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Get application paths
     * Returns: Various application paths
     */
    electron_1.ipcMain.handle('get-app-paths', () => {
        try {
            return {
                success: true,
                paths: {
                    userData: electron_1.app.getPath('userData'),
                    appData: electron_1.app.getPath('appData'),
                    logs: electron_1.app.getPath('logs'),
                    temp: electron_1.app.getPath('temp')
                }
            };
        }
        catch (error) {
            console.error('[IPC] get-app-paths failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    // ========================================
    // License Management Handlers
    // ========================================
    /**
     * Validate current license status
     * Returns: License status (active, grace, readonly, expired)
     */
    electron_1.ipcMain.handle('license-validate', async () => {
        try {
            const status = await licenseManager.validateLicense();
            return { success: true, status };
        }
        catch (error) {
            console.error('[IPC] license-validate failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Activate a product key
     * Parameters: productKey (string) - Product key to activate
     * Returns: Success status
     */
    electron_1.ipcMain.handle('license-activate', async (_event, productKey) => {
        try {
            await licenseManager.activateProductKey(productKey);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] license-activate failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Get current license information
     * Returns: License object or null
     */
    electron_1.ipcMain.handle('license-info', async () => {
        try {
            const license = await licenseManager.getLicenseInfo();
            return { success: true, license };
        }
        catch (error) {
            console.error('[IPC] license-info failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    // ========================================
    // Auto-Updater Handlers
    // ========================================
    /**
     * Check for updates
     * Returns: Success status
     */
    electron_1.ipcMain.handle('check-for-updates', async () => {
        if (!autoUpdaterManager) {
            return {
                success: false,
                error: 'Auto-updater not initialized'
            };
        }
        try {
            await autoUpdaterManager.checkForUpdates();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] check-for-updates failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Download available update
     * Returns: Success status
     */
    electron_1.ipcMain.handle('download-update', async () => {
        if (!autoUpdaterManager) {
            return {
                success: false,
                error: 'Auto-updater not initialized'
            };
        }
        try {
            await autoUpdaterManager.downloadUpdate();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] download-update failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Install update and restart application
     * Returns: Success status (though app will restart immediately)
     */
    electron_1.ipcMain.handle('install-update', async () => {
        if (!autoUpdaterManager) {
            return {
                success: false,
                error: 'Auto-updater not initialized'
            };
        }
        try {
            await autoUpdaterManager.installAndRestart();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] install-update failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Get current application version
     * Returns: Version string
     */
    electron_1.ipcMain.handle('get-current-version', async () => {
        if (!autoUpdaterManager) {
            return {
                success: false,
                error: 'Auto-updater not initialized'
            };
        }
        try {
            const version = autoUpdaterManager.getCurrentVersion();
            return { success: true, version };
        }
        catch (error) {
            console.error('[IPC] get-current-version failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    console.log('[IPC] All IPC handlers registered successfully');
}
