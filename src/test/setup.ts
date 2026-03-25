import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

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

// Mock fetch
const originalFetch = global.fetch;

beforeEach(() => {
  // Reset fetch before each test
  global.fetch = originalFetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

export function createMockFetch(data: any, status = 200) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
    } as Response)
  ) as any;
}

export function createMockFetchError(message: string, status = 500) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error: message }),
      text: () => Promise.resolve(message),
    } as Response)
  ) as any;
}

export const mockApiResponses = {
  licenseStatus: {
    status: 'active',
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 30,
    subscriptionType: 'monthly',
    canUse: true,
  },

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
