import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ServerManager } from './server-manager.js';
import { WindowManager } from './window-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const serverManager = new ServerManager(isProduction);
const windowManager = new WindowManager();

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Start Express server first
    console.log('Starting TravelERP Lite...');
    const serverStarted = await serverManager.start();

    if (!serverStarted) {
      console.error('Failed to start Express server');
      // Show error dialog
      app.quit();
      return;
    }

    // Create main window after server is ready
    windowManager.createMainWindow();

    // Setup IPC handlers
    setupIpcHandlers();

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
      }
    });
  } catch (error) {
    console.error('Error during app startup:', error);
    app.quit();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    // Stop server before quitting
    await serverManager.stop();
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Stop server before quitting
  await serverManager.stop();
});

function setupIpcHandlers(): void {
  // Version info
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // Path info
  ipcMain.handle('get-path', async (_event, name: string) => {
    return app.getPath(name as any);
  });

  // Database control (placeholder for Phase 1 Day 3)
  ipcMain.handle('database:start', async () => {
    // TODO: Implement PostgreSQL service management
    return true;
  });

  ipcMain.handle('database:stop', async () => {
    // TODO: Implement PostgreSQL service management
    return true;
  });

  ipcMain.handle('database:get-status', async () => {
    // TODO: Implement PostgreSQL service status check
    return { running: false, port: 5432 };
  });

  // License control (placeholder for Phase 2)
  ipcMain.handle('license:validate', async (_event, productKey: string) => {
    // TODO: Implement license validation
    return { valid: false, error: 'Not implemented yet' };
  });

  ipcMain.handle('license:activate', async (_event, productKey: string) => {
    // TODO: Implement license activation
    return { success: false, error: 'Not implemented yet' };
  });

  ipcMain.handle('license:get-status', async () => {
    // TODO: Implement license status check
    return {
      status: 'active',
      expiryDate: new Date().toISOString(),
      daysRemaining: 30,
    };
  });

  // Update control (placeholder for Phase 4)
  ipcMain.handle('update:check', async () => {
    // TODO: Implement update check
    return { available: false };
  });

  ipcMain.handle('update:download', async () => {
    // TODO: Implement update download
  });

  ipcMain.handle('update:install', async () => {
    // TODO: Implement update install
  });

  // System info
  ipcMain.handle('get-system-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      electronVersion: process.versions.electron,
    };
  });
}
