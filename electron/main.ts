import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { BackendManager } from './backend-manager';

/**
 * TravelERP Lite - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It creates the main window and manages the application lifecycle.
 */

let mainWindow: BrowserWindow;
let backendManager: BackendManager;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('ready', async () => {
  backendManager = new BackendManager();

  try {
    // Start backend first, wait for it to be ready
    console.log('[Main] Starting backend server...');
    await backendManager.start();
    console.log('[Main] Backend started successfully');

    // Then create and show the main window
    createMainWindow();
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

// Clean up backend before app quits
app.on('before-quit', () => {
  if (backendManager) {
    console.log('[Main] App quitting - stopping backend...');
    backendManager.stop();
  }
});

// Handle any uncaught exceptions in the main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log but don't crash - let the app try to continue
});
