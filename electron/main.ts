import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { BackendManager } from './backend-manager';
import { PostgresService } from './postgres-service';
import { ScheduledBackupService } from './scheduled-backup';
import { AutoUpdaterManager } from './auto-updater';
import { registerIPCHandlers } from './ipc-handlers';

/**
 * TravelERP Lite - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It creates the main window and manages the application lifecycle.
 */

let mainWindow: BrowserWindow;
let backendManager: BackendManager;
let postgresService: PostgresService;
let scheduledBackupService: ScheduledBackupService;
let autoUpdaterManager: AutoUpdaterManager;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('ready', async () => {
  // Register IPC handlers for main-renderer communication
  registerIPCHandlers();

  postgresService = new PostgresService();
  backendManager = new BackendManager();
  scheduledBackupService = new ScheduledBackupService();

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
    autoUpdaterManager = new AutoUpdaterManager(mainWindow);

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
  } catch (error) {
    console.error('[Main] Failed to start app:', error);
    app.quit();
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    // Note: This path will be updated in Task 1.2 when electron-builder is configured
    // The packaged app will use a different path structure
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window closed errors
  mainWindow.on('unresponsive', () => {
    console.error('Main window became unresponsive');
  });
}

app.on('window-all-closed', () => {
  // On Windows/Linux, quit when all windows closed
  // On macOS, keep app running (standard macOS behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle macOS dock click (recreate window if all windows closed)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      createMainWindow();
    } catch (error) {
      console.error('Failed to recreate window on activate:', error);
    }
  }
});

// Clean up backend, PostgreSQL, and scheduled backups before app quits
app.on('before-quit', async () => {
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
