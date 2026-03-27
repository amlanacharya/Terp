import { ipcMain, app } from 'electron';
import { BackupManager } from './backup-manager';
import { PostgresService } from './postgres-service';

/**
 * Register IPC handlers for main-renderer communication
 *
 * This function sets up all IPC handlers for secure communication
 * between the main process and renderer process.
 */
export function registerIPCHandlers(): void {
  // Create service instances
  const backupManager = new BackupManager();
  const postgresService = new PostgresService();

  // ========================================
  // Backup Handlers
  // ========================================

  /**
   * Create a database backup
   * Returns: Path to the created backup file
   */
  ipcMain.handle('backup-database', async () => {
    try {
      const backupPath = await backupManager.createBackup();
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('[IPC] backup-database failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Restore database from a backup file
   * Parameters: filePath (string) - Path to backup file
   * Returns: Success status
   */
  ipcMain.handle('restore-database', async (_event, filePath: string) => {
    try {
      await backupManager.restoreBackup(filePath);
      return { success: true };
    } catch (error) {
      console.error('[IPC] restore-database failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * List all available backup files
   * Returns: Array of backup filenames
   */
  ipcMain.handle('list-backups', async () => {
    try {
      const backups = await backupManager.listBackups();
      return { success: true, backups };
    } catch (error) {
      console.error('[IPC] list-backups failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Delete old backups
   * Parameters: keepCount (number) - Number of backups to keep (default: 7)
   * Returns: Success status
   */
  ipcMain.handle('delete-old-backups', async (_event, keepCount: number = 7) => {
    try {
      await backupManager.deleteOldBackups(keepCount);
      return { success: true };
    } catch (error) {
      console.error('[IPC] delete-old-backups failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get backup directory path
   * Returns: Path to backup directory
   */
  ipcMain.handle('get-backup-directory', async () => {
    try {
      const backupDir = backupManager.getBackupDirectory();
      return { success: true, path: backupDir };
    } catch (error) {
      console.error('[IPC] get-backup-directory failed:', error);
      return {
        success: false,
        error: (error as Error).message
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
  ipcMain.handle('postgres-status', async () => {
    try {
      const status = await postgresService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      console.error('[IPC] postgres-status failed:', error);
      return {
        success: false,
        running: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Start PostgreSQL service
   * Returns: Success status
   */
  ipcMain.handle('postgres-start', async () => {
    try {
      const result = await postgresService.start();
      return result;
    } catch (error) {
      console.error('[IPC] postgres-start failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Stop PostgreSQL service
   * Returns: Success status
   */
  ipcMain.handle('postgres-stop', async () => {
    try {
      const result = await postgresService.stop();
      return result;
    } catch (error) {
      console.error('[IPC] postgres-stop failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Restart PostgreSQL service
   * Returns: Success status
   */
  ipcMain.handle('postgres-restart', async () => {
    try {
      const result = await postgresService.restart();
      return result;
    } catch (error) {
      console.error('[IPC] postgres-restart failed:', error);
      return {
        success: false,
        error: (error as Error).message
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
  ipcMain.handle('get-app-version', () => {
    try {
      return { success: true, version: app.getVersion() };
    } catch (error) {
      console.error('[IPC] get-app-version failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get application paths
   * Returns: Various application paths
   */
  ipcMain.handle('get-app-paths', () => {
    try {
      return {
        success: true,
        paths: {
          userData: app.getPath('userData'),
          appData: app.getPath('appData'),
          logs: app.getPath('logs'),
          temp: app.getPath('temp')
        }
      };
    } catch (error) {
      console.error('[IPC] get-app-paths failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  console.log('[IPC] All IPC handlers registered successfully');
}
