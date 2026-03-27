import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import type { UpdateInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import path from 'path';

export interface UpdateStatus {
  available: boolean;
  version: string;
  releaseDate: string;
  downloaded: boolean;
  error?: string;
}

export class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable = false;

  constructor() {
    this.configureAutoUpdater();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private configureAutoUpdater() {
    // Configure auto updater settings
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://updates.intelligrip.com/travelerp-lite', // Replace with actual update server
    });

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false; // We'll handle install manually

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateAvailable = true;
      this.sendStatus('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateAvailable = false;
      this.sendStatus('update-not-available', {
        version: info.version,
      });
    });

    autoUpdater.on('error', (error: Error) => {
      this.sendStatus('error', {
        error: error.message,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus('download-progress', {
        percent: Math.floor(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendStatus('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });

      // Notify user and prompt for install
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-ready-to-install', {
          version: info.version,
          releaseNotes: info.releaseNotes,
        });
      }
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      const result = await autoUpdater.checkForUpdates();

      if (result === null) {
        return {
          available: false,
          version: app.getVersion(),
          releaseDate: new Date().toISOString(),
          downloaded: false,
        };
      }

      return {
        available: result.downloadPromise !== undefined,
        version: result.updateInfo.version,
        releaseDate: result.updateInfo.releaseDate,
        downloaded: false,
      };
    } catch (error: any) {
      return {
        available: false,
        version: app.getVersion(),
        releaseDate: new Date().toISOString(),
        downloaded: false,
        error: error.message,
      };
    }
  }

  /**
   * Download update
   */
  async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate();
  }

  /**
   * Install update and restart
   */
  installAndRestart(): void {
    setImmediate(() => {
      autoUpdater.quitAndInstall();
    });
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  /**
   * Send status to renderer process
   */
  private sendStatus(event: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('auto-updater-event', {
        event,
        data,
      });
    }
  }

  /**
   * Disable auto-updater (for development)
   */
  disable(): void {
    autoUpdater.autoDownload = false;
  }
}

// Singleton instance
let autoUpdaterService: AutoUpdaterService | null = null;

export function getAutoUpdaterService(): AutoUpdaterService {
  if (!autoUpdaterService) {
    autoUpdaterService = new AutoUpdaterService();
  }
  return autoUpdaterService;
}
