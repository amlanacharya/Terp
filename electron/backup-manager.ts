import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const execAsync = promisify(exec);

/**
 * BackupManager
 *
 * Manages database backup and restore operations for TravelERP Lite.
 * Uses pg_dump and psql utilities for creating and restoring SQL dumps.
 */
export class BackupManager {
  private pgPath: string;
  private backupDir: string;

  constructor() {
    // Path to PostgreSQL installation - will be bundled with desktop app
    this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a database backup
   * @param customPath Optional custom path for backup file
   * @returns Path to created backup file
   */
  async createBackup(customPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `travelerp_backup_${timestamp}_${time}.sql`;
    const backupPath = customPath || path.join(this.backupDir, filename);

    const pgDumpPath = path.join(this.pgPath, 'bin', 'pg_dump.exe');

    // Build pg_dump command with environment variable for password
    const command = `"${pgDumpPath}" -U travelerp -d travelerp_lite -f "${backupPath}"`;

    try {
      // Set PGPASSWORD environment variable to avoid password prompt
      const env = {
        ...process.env,
        PGPASSWORD: process.env.DB_PASSWORD || 'travelerp123'
      };

      await execAsync(command, { env });
      console.log(`[BackupManager] Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[BackupManager] Backup failed:', error);
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restore database from backup
   * @param backupPath Path to backup file
   */
  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    const psqlPath = path.join(this.pgPath, 'bin', 'psql.exe');

    // Build psql command with environment variable for password
    const command = `"${psqlPath}" -U travelerp -d travelerp_lite -f "${backupPath}"`;

    try {
      // Set PGPASSWORD environment variable to avoid password prompt
      const env = {
        ...process.env,
        PGPASSWORD: process.env.DB_PASSWORD || 'travelerp123'
      };

      await execAsync(command, { env });
      console.log(`[BackupManager] Database restored from: ${backupPath}`);
    } catch (error) {
      console.error('[BackupManager] Restore failed:', error);
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * List all available backup files
   * @returns Array of backup filenames sorted by date (newest first)
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.backupDir);
      return files
        .filter(f => f.startsWith('travelerp_backup_') && f.endsWith('.sql'))
        .sort()
        .reverse();
    } catch (error) {
      console.error('[BackupManager] Failed to list backups:', error);
      throw new Error(`Failed to list backups: ${(error as Error).message}`);
    }
  }

  /**
   * Delete old backups, keeping only the most recent ones
   * @param keepCount Number of backups to keep (default: 7)
   */
  async deleteOldBackups(keepCount: number = 7): Promise<void> {
    try {
      const backups = await this.listBackups();
      const toDelete = backups.slice(keepCount);

      for (const backup of toDelete) {
        const backupPath = path.join(this.backupDir, backup);
        fs.unlinkSync(backupPath);
        console.log(`[BackupManager] Deleted old backup: ${backup}`);
      }

      if (toDelete.length > 0) {
        console.log(`[BackupManager] Deleted ${toDelete.length} old backup(s)`);
      }
    } catch (error) {
      console.error('[BackupManager] Failed to delete old backups:', error);
      throw new Error(`Failed to delete old backups: ${(error as Error).message}`);
    }
  }

  /**
   * Get backup directory path
   */
  getBackupDirectory(): string {
    return this.backupDir;
  }
}
