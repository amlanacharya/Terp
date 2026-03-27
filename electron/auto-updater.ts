import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.configure();
    this.setupEventHandlers();
  }

  private configure() {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://updates.travelerp.com/releases'
    });

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  private setupEventHandlers() {
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      this.mainWindow.webContents.send('update-not-available', {
        version: info.version
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log('Download progress:', progress.percent);
      this.mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('Update error:', error);
      this.mainWindow.webContents.send('update-error', {
        message: error.message
      });
    });
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Update check failed:', error);
      throw error;
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Update download failed:', error);
      throw error;
    }
  }

  async installAndRestart(): Promise<void> {
    try {
      autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('Install and restart failed:', error);
      throw error;
    }
  }

  getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
  }
}
