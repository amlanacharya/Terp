"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_1 = require("electron");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * BackupManager
 *
 * Manages database backup and restore operations for TravelERP Lite.
 * Uses pg_dump and psql utilities for creating and restoring SQL dumps.
 */
class BackupManager {
    constructor() {
        // Path to PostgreSQL installation - will be bundled with desktop app
        this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
        this.backupDir = path.join(electron_1.app.getPath('userData'), 'backups');
        this.ensureBackupDir();
    }
    /**
     * Ensure backup directory exists
     */
    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }
    /**
     * Create a database backup
     * @param customPath Optional custom path for backup file
     * @returns Path to created backup file
     */
    async createBackup(customPath) {
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
        }
        catch (error) {
            console.error('[BackupManager] Backup failed:', error);
            throw new Error(`Backup failed: ${error.message}`);
        }
    }
    /**
     * Restore database from backup
     * @param backupPath Path to backup file
     */
    async restoreBackup(backupPath) {
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
        }
        catch (error) {
            console.error('[BackupManager] Restore failed:', error);
            throw new Error(`Restore failed: ${error.message}`);
        }
    }
    /**
     * List all available backup files
     * @returns Array of backup filenames sorted by date (newest first)
     */
    async listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            return files
                .filter(f => f.startsWith('travelerp_backup_') && f.endsWith('.sql'))
                .sort()
                .reverse();
        }
        catch (error) {
            console.error('[BackupManager] Failed to list backups:', error);
            throw new Error(`Failed to list backups: ${error.message}`);
        }
    }
    /**
     * Delete old backups, keeping only the most recent ones
     * @param keepCount Number of backups to keep (default: 7)
     */
    async deleteOldBackups(keepCount = 7) {
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
        }
        catch (error) {
            console.error('[BackupManager] Failed to delete old backups:', error);
            throw new Error(`Failed to delete old backups: ${error.message}`);
        }
    }
    /**
     * Get backup directory path
     */
    getBackupDirectory() {
        return this.backupDir;
    }
}
exports.BackupManager = BackupManager;
