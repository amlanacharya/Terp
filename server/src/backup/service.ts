import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getPool } from '../config/db.js';

export interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  autoBackupEnabled: boolean;
  autoBackupSchedule: string; // cron expression
  autoBackupTime: string; // HH:MM format
  compressionEnabled: boolean;
}

export interface BackupMetadata {
  id: string;
  filename: string;
  size: number;
  created_at: string;
  description?: string;
  type: 'manual' | 'automatic';
  compressed: boolean;
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  filename?: string;
  size?: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class BackupService {
  private config: BackupConfig;

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      backupDir: config?.backupDir || './backups',
      retentionDays: config?.retentionDays || 30,
      autoBackupEnabled: config?.autoBackupEnabled || false,
      autoBackupSchedule: config?.autoBackupSchedule || '0 2 * * *', // 2 AM daily
      autoBackupTime: config?.autoBackupTime || '02:00',
      compressionEnabled: config?.compressionEnabled !== false, // default true
    };

    // Ensure backup directory exists
    this.ensureBackupDir();
  }

  /**
   * Create a database backup
   */
  async createBackup(description?: string): Promise<BackupResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `travelerp-backup-${timestamp}.sql`;
      const backupPath = path.join(this.config.backupDir, filename);

      // Get database connection info
      const pool = getPool();
      const client = await pool.connect();

      let dbHost = 'localhost';
      let dbPort = 5432;
      let dbUser = 'postgres';
      let dbPassword = 'postgres';
      let dbName = 'travelerp';

      try {
        // Try to get connection info from environment or pool
        if (process.env.DB_HOST) dbHost = process.env.DB_HOST;
        if (process.env.DB_PORT) dbPort = parseInt(process.env.DB_PORT);
        if (process.env.DB_USER) dbUser = process.env.DB_USER;
        if (process.env.DB_PASSWORD) dbPassword = process.env.DB_PASSWORD;
        if (process.env.DB_NAME) dbName = process.env.DB_NAME;

        // Set PGPASSWORD for pg_dump
        process.env.PGPASSWORD = dbPassword;

        // Run pg_dump
        await this.runPgDump(dbHost, dbPort, dbUser, dbName, backupPath);

        // Get file size
        const stats = fs.statSync(backupPath);
        const size = stats.size;

        // Create metadata file
        const metadata: BackupMetadata = {
          id: this.generateId(),
          filename,
          size,
          created_at: new Date().toISOString(),
          description,
          type: 'manual',
          compressed: false,
        };

        this.saveMetadata(filename, metadata);

        // Compress if enabled
        if (this.config.compressionEnabled) {
          await this.compressBackup(backupPath);
          const compressedPath = backupPath + '.gz';
          const compressedStats = fs.statSync(compressedPath);
          metadata.compressed = true;
          metadata.size = compressedStats.size;
          metadata.filename = filename + '.gz';
          this.saveMetadata(filename + '.gz', metadata);

          return {
            success: true,
            backupPath: compressedPath,
            filename: filename + '.gz',
            size: compressedStats.size,
          };
        }

        return {
          success: true,
          backupPath,
          filename,
          size,
        };
      } finally {
        client.release();
        delete process.env.PGPASSWORD;
      }
    } catch (error: any) {
      console.error('Backup failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Restore from a backup file
   */
  async restoreBackup(backupFilename: string): Promise<RestoreResult> {
    try {
      const backupPath = path.join(this.config.backupDir, backupFilename);

      // Check if backup exists
      if (!fs.existsSync(backupPath)) {
        // Try with .gz extension
        const gzPath = backupPath + '.gz';
        if (fs.existsSync(gzPath)) {
          return this.restoreCompressedBackup(gzPath);
        }
        return {
          success: false,
          error: 'Backup file not found',
        };
      }

      // Get database connection info
      let dbHost = 'localhost';
      let dbPort = 5432;
      let dbUser = 'postgres';
      let dbPassword = 'postgres';
      let dbName = 'travelerp';

      if (process.env.DB_HOST) dbHost = process.env.DB_HOST;
      if (process.env.DB_PORT) dbPort = parseInt(process.env.DB_PORT);
      if (process.env.DB_USER) dbUser = process.env.DB_USER;
      if (process.env.DB_PASSWORD) dbPassword = process.env.DB_PASSWORD;
      if (process.env.DB_NAME) dbName = process.env.DB_NAME;

      process.env.PGPASSWORD = dbPassword;

      // Decompress if needed
      let sqlFile = backupPath;
      if (backupFilename.endsWith('.gz')) {
        sqlFile = await this.decompressBackup(backupPath);
      }

      // Run psql to restore
      await this.runPsqlRestore(dbHost, dbPort, dbUser, dbName, sqlFile);

      // Clean up temporary decompressed file
      if (backupFilename.endsWith('.gz') && sqlFile !== backupPath) {
        fs.unlinkSync(sqlFile);
      }

      delete process.env.PGPASSWORD;

      return {
        success: true,
        message: 'Database restored successfully',
      };
    } catch (error: any) {
      console.error('Restore failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get list of all backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];

    try {
      const files = fs.readdirSync(this.config.backupDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const metadataPath = path.join(this.config.backupDir, file);
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            backups.push(metadata);
          } catch (error) {
            console.error(`Failed to read metadata for ${file}:`, error);
          }
        }
      }

      // Sort by created_at descending
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupFilename: string): Promise<boolean> {
    try {
      const backupPath = path.join(this.config.backupDir, backupFilename);
      const metadataPath = path.join(this.config.backupDir, `${backupFilename}.json`);

      // Delete backup file
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      // Delete metadata
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const now = new Date();
      let deletedCount = 0;

      for (const backup of backups) {
        const backupDate = new Date(backup.created_at);
        const daysOld = Math.floor((now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld > this.config.retentionDays) {
          const deleted = await this.deleteBackup(backup.filename);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Get backup configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Update backup configuration
   */
  updateConfig(updates: Partial<BackupConfig>): BackupConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    return this.getConfig();
  }

  /**
   * Get backup statistics
   */
  async getStatistics(): Promise<{
    totalCount: number;
    totalSize: number;
    automaticCount: number;
    manualCount: number;
    oldestBackup?: string;
    newestBackup?: string;
  }> {
    const backups = await this.listBackups();

    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const automaticCount = backups.filter(b => b.type === 'automatic').length;
    const manualCount = backups.filter(b => b.type === 'manual').length;

    return {
      totalCount: backups.length,
      totalSize,
      automaticCount,
      manualCount,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created_at : undefined,
      newestBackup: backups.length > 0 ? backups[0].created_at : undefined,
    };
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  /**
   * Run pg_dump command
   */
  private async runPgDump(
    host: string,
    port: number,
    user: string,
    database: string,
    outputPath: string
  ): Promise<void> {
    const pgDumpPath = path.join(process.cwd(), 'build', 'postgres', 'bin', 'pg_dump.exe');

    return new Promise((resolve, reject) => {
      const process = spawn(pgDumpPath, [
        '-h', host,
        '-p', port.toString(),
        '-U', user,
        '-d', database,
        '-F', 'p', // Plain text format
        '-f', outputPath,
        '--no-owner',
        '--no-acl',
      ]);

      let stderr = '';

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed: ${stderr}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Run psql restore command
   */
  private async runPsqlRestore(
    host: string,
    port: number,
    user: string,
    database: string,
    sqlFile: string
  ): Promise<void> {
    const psqlPath = path.join(process.cwd(), 'build', 'postgres', 'bin', 'psql.exe');

    return new Promise((resolve, reject) => {
      const process = spawn(psqlPath, [
        '-h', host,
        '-p', port.toString(),
        '-U', user,
        '-d', database,
        '-f', sqlFile,
      ]);

      let stderr = '';

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`psql restore failed: ${stderr}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Compress backup using gzip
   */
  private async compressBackup(filePath: string): Promise<void> {
    const zlib = await import('zlib');
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(filePath + '.gz');
    const gzip = zlib.createGzip();

    return new Promise((resolve, reject) => {
      input
        .pipe(gzip)
        .pipe(output)
        .on('finish', () => {
          fs.unlinkSync(filePath); // Delete original
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * Decompress backup using gzip
   */
  private async decompressBackup(filePath: string): Promise<string> {
    const zlib = await import('zlib');
    const input = fs.createReadStream(filePath);
    const outputPath = filePath.replace('.gz', '');
    const output = fs.createWriteStream(outputPath);
    const gunzip = zlib.createGunzip();

    return new Promise((resolve, reject) => {
      input
        .pipe(gunzip)
        .pipe(output)
        .on('finish', () => {
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * Restore from compressed backup
   */
  private async restoreCompressedBackup(gzPath: string): Promise<RestoreResult> {
    try {
      const sqlFile = await this.decompressBackup(gzPath);
      const result = await this.restoreCompressedBackup(gzPath);
      fs.unlinkSync(sqlFile); // Clean up
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decompression failed',
      };
    }
  }

  /**
   * Save backup metadata
   */
  private saveMetadata(filename: string, metadata: BackupMetadata): void {
    const metadataPath = path.join(this.config.backupDir, `${filename}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load backup configuration from file
   */
  private loadConfig(): void {
    const configPath = path.join(this.config.backupDir, 'backup-config.json');

    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        this.config = { ...this.config, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load backup config:', error);
    }
  }

  /**
   * Save backup configuration to file
   */
  private saveConfig(): void {
    const configPath = path.join(this.config.backupDir, 'backup-config.json');
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let backupService: BackupService | null = null;

export function getBackupService(config?: Partial<BackupConfig>): BackupService {
  if (!backupService) {
    backupService = new BackupService(config);
  }
  return backupService;
}
