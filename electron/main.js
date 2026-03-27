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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const backend_manager_1 = require("./backend-manager");
const postgres_service_1 = require("./postgres-service");
const scheduled_backup_1 = require("./scheduled-backup");
const auto_updater_1 = require("./auto-updater");
const ipc_handlers_1 = require("./ipc-handlers");
/**
 * TravelERP Lite - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It creates the main window and manages the application lifecycle.
 */
let mainWindow;
let backendManager;
let postgresService;
let scheduledBackupService;
let autoUpdaterManager;
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
electron_1.app.on('ready', async () => {
    // Register IPC handlers for main-renderer communication
    (0, ipc_handlers_1.registerIPCHandlers)();
    postgresService = new postgres_service_1.PostgresService();
    backendManager = new backend_manager_1.BackendManager();
    scheduledBackupService = new scheduled_backup_1.ScheduledBackupService();
    try {
        // Start PostgreSQL first, wait for it to be ready
        console.log('[Main] Starting PostgreSQL service...');
        await postgresService.start();
        console.log('[Main] PostgreSQL started successfully');
        // Start backend, wait for it to be ready
        console.log('[Main] Starting backend server...');
        await backendManager.start();
        console.log('[Main] Backend started successfully');
        // Start scheduled backup service
        console.log('[Main] Starting scheduled backup service...');
        scheduledBackupService.start();
        console.log('[Main] Scheduled backup service started');
        // Then create and show the main window
        createMainWindow();
        // Initialize auto-updater after window is created
        console.log('[Main] Initializing auto-updater...');
        autoUpdaterManager = new auto_updater_1.AutoUpdaterManager(mainWindow);
        // Set the auto-updater manager instance for IPC handlers
        const { setAutoUpdaterManager } = require('./ipc-handlers');
        setAutoUpdaterManager(autoUpdaterManager);
        // Check for updates on startup (after a short delay to not slow down startup)
        setTimeout(() => {
            console.log('[Main] Checking for updates...');
            autoUpdaterManager.checkForUpdates().catch(error => {
                console.error('[Main] Failed to check for updates on startup:', error);
            });
        }, 5000);
    }
    catch (error) {
        console.error('[Main] Failed to start app:', error);
        electron_1.app.quit();
    }
});
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        title: 'TravelERP Lite',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    // Load React app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        // Note: This path will be updated in Task 1.2 when electron-builder is configured
        // The packaged app will use a different path structure
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // Handle window closed errors
    mainWindow.on('unresponsive', () => {
        console.error('Main window became unresponsive');
    });
}
electron_1.app.on('window-all-closed', () => {
    // On Windows/Linux, quit when all windows closed
    // On macOS, keep app running (standard macOS behavior)
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Handle macOS dock click (recreate window if all windows closed)
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        try {
            createMainWindow();
        }
        catch (error) {
            console.error('Failed to recreate window on activate:', error);
        }
    }
});
// Clean up backend, PostgreSQL, and scheduled backups before app quits
electron_1.app.on('before-quit', async () => {
    if (scheduledBackupService) {
        console.log('[Main] App quitting - stopping scheduled backup service...');
        scheduledBackupService.stop();
    }
    if (backendManager) {
        console.log('[Main] App quitting - stopping backend...');
        backendManager.stop();
    }
    if (postgresService) {
        console.log('[Main] App quitting - stopping PostgreSQL...');
        await postgresService.stop();
    }
});
// Handle any uncaught exceptions in the main process
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log but don't crash - let the app try to continue
});
