import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ServerManager } from './server-manager.js';
import { WindowManager } from './window-manager.js';
import { getAutoUpdaterService } from './auto-updater.js';
import { PostgresService } from './postgres-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = app.isPackaged;
const postgresService = new PostgresService();
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
    console.log('Starting TravelERP Lite...');

    // Start PostgreSQL first (only in production)
    if (isProduction) {
      try {
        await postgresService.initializeDatabase();
        // Propagate the resolved port to the server manager so Express connects
        // to the correct port even when 5432 was taken and we fell back to 5433.
        process.env.PG_PORT = String(postgresService.getPort());
      } catch (pgError) {
        await dialog.showErrorBox(
          'Database Error',
          `Failed to start PostgreSQL:\n${(pgError as Error).message}\n\nPlease contact support.`
        );
        app.quit();
        return;
      }
    }

    // Start Express server
    const serverStarted = await serverManager.start();

    if (!serverStarted) {
      const details = serverManager.getLastError();
      await dialog.showErrorBox(
        'Server Error',
        `Failed to start the application server.\n\n${details ? 'Details:\n' + details + '\n\n' : ''}Please try restarting the application or contact support.`
      );
      app.quit();
      return;
    }

    // Create main window after server is ready
    const mainWindow = windowManager.createMainWindow();

    // Initialize auto-updater
    const autoUpdaterService = getAutoUpdaterService();
    autoUpdaterService.setMainWindow(mainWindow);

    // Setup IPC handlers
    setupIpcHandlers();

    // Check for updates on startup (only in production)
    if (isProduction) {
      // Delay check to avoid slowing down app startup
      setTimeout(() => {
        autoUpdaterService.checkForUpdates().catch(console.error);
      }, 30000); // Check after 30 seconds
    }

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
      }
    });
  } catch (error) {
    console.error('Error during app startup:', error);
    try {
      await dialog.showErrorBox(
        'Startup Error',
        `TravelERP Lite failed to start:\n${(error as Error).message}\n\nPlease contact support.`
      );
    } catch {}
    app.quit();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await serverManager.stop();
  if (isProduction) {
    await postgresService.stop();
  }
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

  // Database control
  ipcMain.handle('database:start', async () => {
    if (isProduction) {
      await postgresService.start();
    }
    return true;
  });

  ipcMain.handle('database:stop', async () => {
    if (isProduction) {
      await postgresService.stop();
    }
    return true;
  });

  ipcMain.handle('database:get-status', async () => {
    const status = isProduction ? await postgresService.getStatus() : 'running';
    return { running: status === 'running', port: postgresService.getPort() };
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

  // Update control
  ipcMain.handle('update:check', async () => {
    const autoUpdaterService = getAutoUpdaterService();
    return autoUpdaterService.checkForUpdates();
  });

  ipcMain.handle('update:download', async () => {
    const autoUpdaterService = getAutoUpdaterService();
    return autoUpdaterService.downloadUpdate();
  });

  ipcMain.handle('update:install', async () => {
    const autoUpdaterService = getAutoUpdaterService();
    autoUpdaterService.installAndRestart();
  });

  ipcMain.handle('update:get-current-version', async () => {
    const autoUpdaterService = getAutoUpdaterService();
    return autoUpdaterService.getCurrentVersion();
  });

  ipcMain.handle('update:is-available', async () => {
    const autoUpdaterService = getAutoUpdaterService();
    return autoUpdaterService.isUpdateAvailable();
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
