import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPath: (name: string) => ipcRenderer.invoke('get-path', name),

  // License API (will be implemented in Phase 2)
  license: {
    validate: (productKey: string) => ipcRenderer.invoke('license:validate', productKey),
    activate: (productKey: string) => ipcRenderer.invoke('license:activate', productKey),
    getStatus: () => ipcRenderer.invoke('license:get-status'),
  },

  // Database API (will be implemented in Phase 1)
  database: {
    start: () => ipcRenderer.invoke('database:start'),
    stop: () => ipcRenderer.invoke('database:stop'),
    getStatus: () => ipcRenderer.invoke('database:get-status'),
  },

  // Update API (will be implemented in Phase 4)
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
  },

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Events
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;

  license: {
    validate: (productKey: string) => Promise<{ valid: boolean; type?: string; error?: string }>;
    activate: (productKey: string) => Promise<{ success: boolean; expiryDate?: string; error?: string }>;
    getStatus: () => Promise<{
      status: 'active' | 'grace' | 'readonly' | 'expired';
      expiryDate: string;
      daysRemaining: number;
    }>;
  };

  database: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    getStatus: () => Promise<{ running: boolean; port: number }>;
  };

  update: {
    check: () => Promise<{ available: boolean; version?: string }>;
    download: () => Promise<void>;
    install: () => Promise<void>;
  };

  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
  }>;

  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
