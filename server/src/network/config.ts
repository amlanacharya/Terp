import fs from 'fs';
import path from 'path';
import os from 'os';

export interface NetworkConfig {
  mode: 'standalone' | 'server' | 'client';
  serverAddress?: string;
  serverPort?: number;
  allowRemoteConnections?: boolean;
  maxConnections?: number;
  databasePath?: string;
  apiPort?: number;
}

export interface ServerStatus {
  mode: 'standalone' | 'server' | 'client';
  isRunning: boolean;
  connectedClients?: number;
  serverAddress?: string;
  uptime?: number;
}

const CONFIG_FILE = 'network-config.json';
const DEFAULT_CONFIG: NetworkConfig = {
  mode: 'standalone',
  serverAddress: 'localhost',
  serverPort: 5433,
  allowRemoteConnections: false,
  maxConnections: 10,
  databasePath: './data/travelerp',
  apiPort: 3001,
};

export class NetworkConfigService {
  private configPath: string;
  private config: NetworkConfig;

  constructor(dataDir: string = './data') {
    this.configPath = path.join(dataDir, CONFIG_FILE);
    this.config = this.loadConfig();
  }

  /**
   * Load network configuration from file
   */
  private loadConfig(): NetworkConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load network config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save network configuration to file
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save network config:', error);
      throw error;
    }
  }

  /**
   * Get current network configuration
   */
  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * Update network configuration
   */
  updateConfig(updates: Partial<NetworkConfig>): NetworkConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    return this.getConfig();
  }

  /**
   * Set network mode
   */
  setMode(mode: 'standalone' | 'server' | 'client'): NetworkConfig {
    return this.updateConfig({ mode });
  }

  /**
   * Configure server mode
   */
  configureServer(options: {
    allowRemoteConnections?: boolean;
    maxConnections?: number;
    apiPort?: number;
  }): NetworkConfig {
    return this.updateConfig({
      mode: 'server',
      ...options,
    });
  }

  /**
   * Configure client mode
   */
  configureClient(options: {
    serverAddress: string;
    serverPort?: number;
  }): NetworkConfig {
    return this.updateConfig({
      mode: 'client',
      serverAddress: options.serverAddress,
      serverPort: options.serverPort || 5433,
    });
  }

  /**
   * Get local IP addresses
   */
  getLocalIPs(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          ips.push(iface.address);
        }
      }
    }

    return ips;
  }

  /**
   * Get hostname
   */
  getHostname(): string {
    return os.hostname();
  }

  /**
   * Validate server address
   */
  validateServerAddress(address: string): boolean {
    // Check if it's a valid IP address or hostname
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/;

    return ipRegex.test(address) || hostnameRegex.test(address) || address === 'localhost';
  }

  /**
   * Validate port number
   */
  validatePort(port: number): boolean {
    return port > 0 && port < 65536 && port !== 3001; // 3001 is used by API
  }

  /**
   * Reset to standalone mode
   */
  resetToStandalone(): NetworkConfig {
    return this.setMode('standalone');
  }

  /**
   * Check if current mode requires network
   */
  requiresNetwork(): boolean {
    return this.config.mode !== 'standalone';
  }

  /**
   * Get connection string for client mode
   */
  getClientConnectionString(): string {
    if (this.config.mode !== 'client') {
      throw new Error('Not in client mode');
    }

    const address = this.config.serverAddress || 'localhost';
    const port = this.config.serverPort || 5433;

    return `postgresql://postgres:postgres@${address}:${port}/travelerp`;
  }

  /**
   * Get server binding address
   */
  getServerBindingAddress(): string {
    if (this.config.mode !== 'server') {
      throw new Error('Not in server mode');
    }

    return this.config.allowRemoteConnections ? '0.0.0.0' : 'localhost';
  }
}

// Singleton instance
let networkConfigService: NetworkConfigService | null = null;

export function getNetworkConfigService(dataDir?: string): NetworkConfigService {
  if (!networkConfigService) {
    networkConfigService = new NetworkConfigService(dataDir);
  }
  return networkConfigService;
}
