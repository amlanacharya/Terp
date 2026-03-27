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
exports.ScheduledBackupService = void 0;
const cron = __importStar(require("node-cron"));
const backup_manager_1 = require("./backup-manager");
/**
 * ScheduledBackupService
 *
 * Manages automated daily backup scheduling for TravelERP Lite.
 * Runs backup at 2:00 AM daily and retains the 7 most recent backups.
 */
class ScheduledBackupService {
    constructor() {
        this.backupTask = null;
        this.backupManager = new backup_manager_1.BackupManager();
    }
    /**
     * Start the scheduled backup service
     * Runs daily at 2:00 AM
     */
    start() {
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
            }
            catch (error) {
                console.error('[ScheduledBackup] Scheduled backup failed:', error);
            }
        });
        console.log('[ScheduledBackup] Service started successfully');
    }
    /**
     * Stop the scheduled backup service
     */
    stop() {
        if (this.backupTask) {
            console.log('[ScheduledBackup] Stopping scheduled backup service');
            this.backupTask.stop();
            this.backupTask = null;
            console.log('[ScheduledBackup] Service stopped');
        }
        else {
            console.log('[ScheduledBackup] Service not running');
        }
    }
    /**
     * Check if the service is currently running
     */
    isRunning() {
        return this.backupTask !== null;
    }
}
exports.ScheduledBackupService = ScheduledBackupService;
