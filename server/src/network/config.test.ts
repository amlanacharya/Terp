import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkConfigService } from './config';

describe('NetworkConfigService', () => {
  let service: NetworkConfigService;
  const testDir = './test-network-config';

  beforeEach(() => {
    service = new NetworkConfigService(testDir);
  });

  afterEach(() => {
    // Cleanup test files
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(testDir, 'network-config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  it('should have default standalone configuration', () => {
    const config = service.getConfig();

    expect(config.mode).toBe('standalone');
    expect(config.serverAddress).toBe('localhost');
    expect(config.serverPort).toBe(5433);
    expect(config.allowRemoteConnections).toBe(false);
    expect(config.maxConnections).toBe(10);
  });

  it('should set mode to server', () => {
    const config = service.setMode('server');

    expect(config.mode).toBe('server');
  });

  it('should set mode to client', () => {
    const config = service.setMode('client');

    expect(config.mode).toBe('client');
  });

  it('should configure server with options', () => {
    const config = service.configureServer({
      allowRemoteConnections: true,
      maxConnections: 20,
    });

    expect(config.mode).toBe('server');
    expect(config.allowRemoteConnections).toBe(true);
    expect(config.maxConnections).toBe(20);
  });

  it('should configure client with server address', () => {
    const config = service.configureClient({
      serverAddress: '192.168.1.100',
      serverPort: 5433,
    });

    expect(config.mode).toBe('client');
    expect(config.serverAddress).toBe('192.168.1.100');
    expect(config.serverPort).toBe(5433);
  });

  it('should validate IP address', () => {
    expect(service.validateServerAddress('192.168.1.1')).toBe(true);
    expect(service.validateServerAddress('localhost')).toBe(true);
    expect(service.validateServerAddress('invalid')).toBe(false);
  });

  it('should validate port number', () => {
    expect(service.validatePort(5433)).toBe(true);
    expect(service.validatePort(8080)).toBe(true);
    expect(service.validatePort(0)).toBe(false);
    expect(service.validatePort(65536)).toBe(false);
    expect(service.validatePort(3001)).toBe(false); // API port
  });

  it('should get local IPs', () => {
    const ips = service.getLocalIPs();

    expect(Array.isArray(ips)).toBe(true);
    // In test environment, might return empty array
    expect(ips.length).toBeGreaterThanOrEqual(0);
  });

  it('should get hostname', () => {
    const hostname = service.getHostname();

    expect(typeof hostname).toBe('string');
    expect(hostname.length).toBeGreaterThan(0);
  });

  it('should save and load configuration', () => {
    service.setMode('server');

    // Create new service instance
    const service2 = new NetworkConfigService(testDir);
    const config = service2.getConfig();

    expect(config.mode).toBe('server');
  });

  it('should reset to standalone mode', () => {
    service.setMode('server');
    const config = service.resetToStandalone();

    expect(config.mode).toBe('standalone');
  });

  it('should check if network is required', () => {
    service.setMode('standalone');
    expect(service.requiresNetwork()).toBe(false);

    service.setMode('server');
    expect(service.requiresNetwork()).toBe(true);

    service.setMode('client');
    expect(service.requiresNetwork()).toBe(true);
  });

  it('should throw error for invalid mode', () => {
    expect(() => {
      service.setMode('invalid' as any);
    }).toThrow();
  });

  it('should get client connection string in client mode', () => {
    service.configureClient({
      serverAddress: '192.168.1.100',
      serverPort: 5432,
    });

    const connString = service.getClientConnectionString();

    expect(connString).toContain('192.168.1.100');
    expect(connString).toContain('5432');
  });

  it('should throw error when getting connection string not in client mode', () => {
    service.setMode('standalone');

    expect(() => {
      service.getClientConnectionString();
    }).toThrow();
  });

  it('should get server binding address in server mode', () => {
    service.configureServer({
      allowRemoteConnections: false,
    });

    const bindingAddress = service.getServerBindingAddress();

    expect(bindingAddress).toBe('localhost');
  });

  it('should return 0.0.0.0 when remote connections allowed', () => {
    service.configureServer({
      allowRemoteConnections: true,
    });

    const bindingAddress = service.getServerBindingAddress();

    expect(bindingAddress).toBe('0.0.0.0');
  });

  it('should throw error when getting binding address not in server mode', () => {
    service.setMode('client');

    expect(() => {
      service.getServerBindingAddress();
    }).toThrow();
  });
});
