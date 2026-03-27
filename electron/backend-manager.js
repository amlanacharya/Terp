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
exports.BackendManager = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
/**
 * BackendManager
 *
 * Manages the Express backend server lifecycle for the Electron app.
 * Spawns a Node.js process running the compiled backend server.
 */
class BackendManager {
    constructor() {
        this.backendProcess = null;
    }
    /**
     * Start the Express backend server
     * @returns Promise that resolves when backend is ready
     */
    start() {
        return new Promise((resolve, reject) => {
            // Path to compiled backend server
            const serverPath = path.join(__dirname, '../server/dist/index.js');
            console.log('[BackendManager] Starting backend server from:', serverPath);
            // Spawn Node.js process for backend
            this.backendProcess = (0, child_process_1.spawn)('node', [serverPath], {
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    PORT: '3001',
                    DB_HOST: process.env.DB_HOST || 'localhost',
                    DB_PORT: process.env.DB_PORT || '5432',
                    DB_NAME: process.env.DB_NAME || 'travelerp_lite',
                    DB_USER: process.env.DB_USER || 'travelerp',
                    DB_PASSWORD: process.env.DB_PASSWORD || 'travelerp123'
                },
                stdio: 'pipe'
            });
            // Log backend stdout
            this.backendProcess.stdout?.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`[Backend] ${message}`);
                // Detect when server is ready
                if (message.includes('listening on http://localhost') ||
                    message.includes('Server running on') ||
                    message.includes('ready')) {
                    console.log('[BackendManager] Backend is ready');
                    resolve();
                }
            });
            // Log backend stderr
            this.backendProcess.stderr?.on('data', (data) => {
                console.error(`[Backend Error] ${data.toString().trim()}`);
            });
            // Handle process spawn errors
            this.backendProcess.on('error', (error) => {
                console.error('[BackendManager] Failed to start backend process:', error);
                reject(new Error(`Failed to start backend: ${error.message}`));
            });
            // Handle unexpected process exit
            this.backendProcess.on('exit', (code, signal) => {
                if (code !== 0 && code !== null) {
                    console.error(`[BackendManager] Backend exited with code ${code}`);
                }
                if (signal) {
                    console.error(`[BackendManager] Backend killed with signal ${signal}`);
                }
            });
            // Timeout after 15 seconds (assume started if no explicit error)
            setTimeout(() => {
                if (this.backendProcess && !this.backendProcess.killed) {
                    console.log('[BackendManager] Backend startup timeout - assuming ready');
                    resolve();
                }
            }, 15000);
        });
    }
    /**
     * Stop the Express backend server
     */
    stop() {
        if (this.backendProcess) {
            console.log('[BackendManager] Stopping backend server...');
            this.backendProcess.kill('SIGTERM');
            this.backendProcess = null;
            console.log('[BackendManager] Backend stopped');
        }
    }
    /**
     * Check if backend is currently running
     */
    isRunning() {
        return this.backendProcess !== null && !this.backendProcess.killed;
    }
}
exports.BackendManager = BackendManager;
