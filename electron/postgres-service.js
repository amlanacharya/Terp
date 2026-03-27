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
exports.PostgresService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * PostgresService
 *
 * Manages PostgreSQL service operations for the embedded database.
 * Provides status checking and service control capabilities.
 */
class PostgresService {
    constructor() {
        // Path to PostgreSQL installation
        this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
    }
    /**
     * Get PostgreSQL service status
     * @returns Service status information
     */
    async getStatus() {
        const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
        try {
            // Check if PostgreSQL service is running
            const statusCommand = `"${pgCtlPath}" status -D "${path.join(this.pgPath, 'data')}"`;
            const env = {
                ...process.env,
                PGDATA: path.join(this.pgPath, 'data')
            };
            try {
                const { stdout } = await execAsync(statusCommand, { env, timeout: 5000 });
                // Parse output to check if server is running
                const isRunning = stdout.includes('server is running') || stdout.includes('pid');
                // Get version
                let version;
                try {
                    const psqlPath = path.join(this.pgPath, 'bin', 'psql.exe');
                    const { stdout: versionOutput } = await execAsync(`"${psqlPath}" --version`, { timeout: 5000 });
                    version = versionOutput.trim();
                }
                catch {
                    version = undefined;
                }
                return {
                    running: isRunning,
                    version
                };
            }
            catch (statusError) {
                // pg_ctl status returns error if server is not running
                const error = statusError;
                if (error.stderr?.includes('not running') || error.stderr?.includes('no server running')) {
                    return {
                        running: false,
                        error: 'PostgreSQL service is not running'
                    };
                }
                throw statusError;
            }
        }
        catch (error) {
            console.error('[PostgresService] Failed to get status:', error);
            return {
                running: false,
                error: `Failed to check PostgreSQL status: ${error.message}`
            };
        }
    }
    /**
     * Start PostgreSQL service
     */
    async start() {
        const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
        const dataDir = path.join(this.pgPath, 'data');
        try {
            const command = `"${pgCtlPath}" start -D "${dataDir}"`;
            const env = {
                ...process.env,
                PGDATA: dataDir
            };
            await execAsync(command, { env, timeout: 15000 });
            console.log('[PostgresService] PostgreSQL service started');
            return { success: true };
        }
        catch (error) {
            console.error('[PostgresService] Failed to start service:', error);
            return {
                success: false,
                error: `Failed to start PostgreSQL: ${error.message}`
            };
        }
    }
    /**
     * Stop PostgreSQL service
     */
    async stop() {
        const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
        const dataDir = path.join(this.pgPath, 'data');
        try {
            const command = `"${pgCtlPath}" stop -D "${dataDir}"`;
            const env = {
                ...process.env,
                PGDATA: dataDir
            };
            await execAsync(command, { env, timeout: 15000 });
            console.log('[PostgresService] PostgreSQL service stopped');
            return { success: true };
        }
        catch (error) {
            console.error('[PostgresService] Failed to stop service:', error);
            return {
                success: false,
                error: `Failed to stop PostgreSQL: ${error.message}`
            };
        }
    }
    /**
     * Restart PostgreSQL service
     */
    async restart() {
        const stopResult = await this.stop();
        if (!stopResult.success) {
            return stopResult;
        }
        // Wait a moment for stop to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.start();
    }
}
exports.PostgresService = PostgresService;
