import { app, BrowserWindow } from 'electron';
import * as path from 'path';

/**
 * TravelERP Lite - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It creates the main window and manages the application lifecycle.
 */

let mainWindow: BrowserWindow;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('ready', () => {
  try {
    createMainWindow();
  } catch (error) {
    console.error('Failed to create main window:', error);
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

// Handle any uncaught exceptions in the main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log but don't crash - let the app try to continue
});
