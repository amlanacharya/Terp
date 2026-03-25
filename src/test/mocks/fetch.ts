/**
 * Mock fetch API for testing
 */

import { vi } from 'vitest';

export const mockFetch = {
  response: (data: any, status = 200) => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
        blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
      } as Response)
    ) as any;
  },

  error: (message: string, status = 500) => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status,
        json: () => Promise.resolve({ error: message }),
        text: () => Promise.resolve(message),
      } as Response)
    ) as any;
  },

  reset: () => {
    global.fetch = fetch as any;
  },
};

/**
 * Mock API responses for common endpoints
 */
export const mockApiResponses = {
  // License endpoints
  licenseStatus: {
    status: 'active',
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 30,
    subscriptionType: 'monthly',
    canUse: true,
  },

  // Network endpoints
  networkStatus: {
    mode: 'standalone',
    isRunning: true,
  },

  networkConfig: {
    mode: 'standalone',
    serverAddress: 'localhost',
    serverPort: 5433,
    allowRemoteConnections: false,
    maxConnections: 10,
  },

  localIPs: {
    hostname: 'test-pc',
    ips: ['192.168.1.100', '10.0.0.5'],
  },

  // Backup endpoints
  backupList: {
    success: true,
    backups: [
      {
        id: '1',
        filename: 'travelerp-backup-2026-03-25.sql.gz',
        size: 1024000,
        created_at: new Date().toISOString(),
        type: 'manual',
        compressed: true,
      },
    ],
  },

  backupStatistics: {
    success: true,
    statistics: {
      totalCount: 5,
      totalSize: 5120000,
      automaticCount: 3,
      manualCount: 2,
    },
  },

  // Import endpoints
  importTemplates: {
    success: true,
    templates: [
      {
        id: 'customers',
        name: 'Customers',
        description: 'Import customer master data',
        fields: ['customer_code', 'name', 'phone', 'email'],
      },
    ],
  },
};

/**
 * Setup all common mocks
 */
export function setupCommonMocks() {
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      hostname: 'localhost',
      port: '3000',
      origin: 'http://localhost:3000',
    },
    writable: true,
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
}

/**
 * Create a test component wrapper
 */
export function createTestWrapper(props: any = {}) {
  return {
    props,
  };
}
