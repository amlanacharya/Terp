"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoUpdaterManager = void 0;
const electron_updater_1 = require("electron-updater");
class AutoUpdaterManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.configure();
        this.setupEventHandlers();
    }
    configure() {
        electron_updater_1.autoUpdater.setFeedURL({
            provider: 'generic',
            url: 'https://updates.travelerp.com/releases'
        });
        electron_updater_1.autoUpdater.autoDownload = true;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
    }
    setupEventHandlers() {
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            console.log('Update available:', info);
            this.mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes
            });
        });
        electron_updater_1.autoUpdater.on('update-not-available', (info) => {
            console.log('Update not available:', info);
            this.mainWindow.webContents.send('update-not-available', {
                version: info.version
            });
        });
        electron_updater_1.autoUpdater.on('download-progress', (progress) => {
            console.log('Download progress:', progress.percent);
            this.mainWindow.webContents.send('update-download-progress', {
                percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                transferred: progress.transferred,
                total: progress.total
            });
        });
        electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
            console.log('Update downloaded:', info);
            this.mainWindow.webContents.send('update-downloaded', {
                version: info.version
            });
        });
        electron_updater_1.autoUpdater.on('error', (error) => {
            console.error('Update error:', error);
            this.mainWindow.webContents.send('update-error', {
                message: error.message
            });
        });
    }
    async checkForUpdates() {
        try {
            await electron_updater_1.autoUpdater.checkForUpdates();
        }
        catch (error) {
            console.error('Update check failed:', error);
            throw error;
        }
    }
    async downloadUpdate() {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
        }
        catch (error) {
            console.error('Update download failed:', error);
            throw error;
        }
    }
    async installAndRestart() {
        try {
            electron_updater_1.autoUpdater.quitAndInstall();
        }
        catch (error) {
            console.error('Install and restart failed:', error);
            throw error;
        }
    }
    getCurrentVersion() {
        return electron_updater_1.autoUpdater.currentVersion.version;
    }
}
exports.AutoUpdaterManager = AutoUpdaterManager;
