import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import * as buildInfo from '../package.json';

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5170');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, '../server/dist/index.js');
  const serverDir = path.join(__dirname, '../server');

  serverProcess = spawn('node', [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
    },
    stdio: 'inherit',
  });
}

app.whenReady().then(() => {
  createWindow();
  startServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

ipcMain.handle('get-app-version', () => {
  return buildInfo.version || '1.0.0';
});
