import * as cron from 'node-cron';
import { BackupManager } from './backup-manager';

/**
 * ScheduledBackupService
 *
 * Manages automated daily backup scheduling for TravelERP Lite.
 * Runs backup at 2:00 AM daily and retains the 7 most recent backups.
 */
export class ScheduledBackupService {
  private backupTask: cron.ScheduledTask | null = null;
  private backupManager: BackupManager;

  constructor() {
    this.backupManager = new BackupManager();
  }

  /**
   * Start the scheduled backup service
   * Runs daily at 2:00 AM
   */
  start(): void {
    if (this.backupTask) {
      console.log('[ScheduledBackup] Service already running');
      return;
    }

    console.log('[ScheduledBackup] Starting daily backup service (2:00 AM)');

    // Schedule daily backup at 2:00 AM
    this.backupTask = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('[ScheduledBackup] Running scheduled backup...');
        const backupPath = await this.backupManager.createBackup();
        console.log(`[ScheduledBackup] Backup created: ${backupPath}`);

        // Delete old backups (keep 7 most recent)
        await this.backupManager.deleteOldBackups(7);
        console.log('[ScheduledBackup] Old backups cleaned up (keeping 7)');

      } catch (error) {
        console.error('[ScheduledBackup] Scheduled backup failed:', error);
      }
    });

    console.log('[ScheduledBackup] Service started successfully');
  }

  /**
   * Stop the scheduled backup service
   */
  stop(): void {
    if (this.backupTask) {
      console.log('[ScheduledBackup] Stopping scheduled backup service');
      this.backupTask.stop();
      this.backupTask = null;
      console.log('[ScheduledBackup] Service stopped');
    } else {
      console.log('[ScheduledBackup] Service not running');
    }
  }

  /**
   * Check if the service is currently running
   */
  isRunning(): boolean {
    return this.backupTask !== null;
  }
}
