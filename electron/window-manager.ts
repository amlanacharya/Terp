import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createMainWindow(): BrowserWindow {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
      icon: path.join(__dirname, '../build/icon.ico'),
    });

    this.windows.set('main', mainWindow);

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.on('closed', () => {
      this.windows.delete('main');
    });

    return mainWindow;
  }

  createWizardWindow(wizardType: 'first-run' | 'import' | 'update'): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const wizardWindow = new BrowserWindow({
      width: Math.min(800, width - 100),
      height: Math.min(600, height - 100),
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      modal: true,
      parent: this.getMainWindow() || undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    this.windows.set(wizardType, wizardWindow);

    // Load appropriate wizard
    if (process.env.NODE_ENV === 'development') {
      wizardWindow.loadURL(`http://localhost:5173/wizard/${wizardType}`);
      wizardWindow.webContents.openDevTools();
    } else {
      wizardWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        hash: `/wizard/${wizardType}`,
      });
    }

    wizardWindow.once('ready-to-show', () => {
      wizardWindow.show();
      wizardWindow.center();
    });

    wizardWindow.on('closed', () => {
      this.windows.delete(wizardType);
    });

    return wizardWindow;
  }

  getMainWindow(): BrowserWindow | undefined {
    return this.windows.get('main');
  }

  getWindow(windowId: string): BrowserWindow | undefined {
    return this.windows.get(windowId);
  }

  closeAllWindows(): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }

  closeWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
    this.windows.delete(windowId);
  }
}
