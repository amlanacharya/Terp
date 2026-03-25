import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NetworkConfigService, getNetworkConfigService } from './config.js';
import { Pool } from 'pg';

export interface NetworkStatus {
  mode: 'standalone' | 'server' | 'client';
  isRunning: boolean;
  serverAddress?: string;
  connectedClients?: number;
  uptime?: number;
  error?: string;
}

export class NetworkManager {
  private configService: NetworkConfigService;
  private postgresProcess: ChildProcess | null = null;
  private serverStartTime: number | null = null;
  private connectedClients: Set<string> = new Set();
  private pool: Pool | null = null;

  constructor(dataDir: string = './data') {
    this.configService = getNetworkConfigService(dataDir);
  }

  /**
   * Start PostgreSQL in server mode
   */
  async startServer(): Promise<boolean> {
    try {
      const config = this.configService.getConfig();

      if (config.mode !== 'server') {
        throw new Error('Not in server mode');
      }

      // Check if already running
      if (this.postgresProcess && !this.postgresProcess.killed) {
        console.log('PostgreSQL server already running');
        return true;
      }

      // Start PostgreSQL
      const postgresDir = path.join(process.cwd(), 'build', 'postgres', 'bin');
      const dataDir = path.join(process.cwd(), 'data', 'postgres-server');

      // Ensure data directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database if needed
      const initdbExe = path.join(postgresDir, 'initdb.exe');
      if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
        console.log('Initializing PostgreSQL database...');
        await this.runCommand(initdbExe, [`-D`, dataDir, `-U`, postgres, `-W`, `-E`, UTF8]);
      }

      // Configure PostgreSQL for network access
      const pgConfig = path.join(dataDir, 'postgresql.conf');
      this.configurePostgreSQL(pgConfig, config);

      const pgHba = path.join(dataDir, 'pg_hba.conf');
      this.configurePgHBA(pgHba, config);

      // Start PostgreSQL
      const pgCtlExe = path.join(postgresDir, 'pg_ctl.exe');
      const logFile = path.join(dataDir, 'postgres.log');

      this.postgresProcess = spawn(pgCtlExe, [
        'start',
        '-D', dataDir,
        '-l', logFile,
        '-o', `-p ${config.serverPort || 5433}`,
      ]);

      this.serverStartTime = Date.now();

      // Wait for PostgreSQL to be ready
      await this.waitForPostgreSQL(config);

      console.log(`PostgreSQL server started on port ${config.serverPort || 5433}`);
      return true;
    } catch (error: any) {
      console.error('Failed to start PostgreSQL server:', error);
      return false;
    }
  }

  /**
   * Stop PostgreSQL server
   */
  async stopServer(): Promise<boolean> {
    try {
      if (this.postgresProcess && !this.postgresProcess.killed) {
        const postgresDir = path.join(process.cwd(), 'build', 'postgres', 'bin');
        const dataDir = path.join(process.cwd(), 'data', 'postgres-server');
        const pgCtlExe = path.join(postgresDir, 'pg_ctl.exe');

        await this.runCommand(pgCtlExe, ['stop', '-D', dataDir]);
        this.postgresProcess = null;
        this.serverStartTime = null;
        this.connectedClients.clear();

        console.log('PostgreSQL server stopped');
      }
      return true;
    } catch (error: any) {
      console.error('Failed to stop PostgreSQL server:', error);
      return false;
    }
  }

  /**
   * Connect to remote server (client mode)
   */
  async connectToServer(): Promise<boolean> {
    try {
      const config = this.configService.getConfig();

      if (config.mode !== 'client') {
        throw new Error('Not in client mode');
      }

      // Validate server address
      if (!this.configService.validateServerAddress(config.serverAddress || '')) {
        throw new Error(`Invalid server address: ${config.serverAddress}`);
      }

      // Create connection pool
      const connectionString = this.configService.getClientConnectionString();
      this.pool = new Pool({
        connectionString,
        max: 5, // Client uses fewer connections
      });

      // Test connection
      await this.pool.query('SELECT 1');
      console.log(`Connected to server at ${config.serverAddress}:${config.serverPort}`);

      return true;
    } catch (error: any) {
      console.error('Failed to connect to server:', error);
      this.pool = null;
      return false;
    }
  }

  /**
   * Disconnect from server
   */
  async disconnectFromServer(): Promise<boolean> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        console.log('Disconnected from server');
      }
      return true;
    } catch (error: any) {
      console.error('Failed to disconnect from server:', error);
      return false;
    }
  }

  /**
   * Get current network status
   */
  async getStatus(): Promise<NetworkStatus> {
    const config = this.configService.getConfig();
    const status: NetworkStatus = {
      mode: config.mode,
      isRunning: false,
    };

    if (config.mode === 'server') {
      status.isRunning = this.postgresProcess !== null && !this.postgresProcess.killed;
      status.serverAddress = this.getServerAddress();
      status.connectedClients = this.connectedClients.size;
      status.uptime = this.serverStartTime ? Date.now() - this.serverStartTime : 0;
    } else if (config.mode === 'client') {
      status.isRunning = this.pool !== null;
      status.serverAddress = config.serverAddress;
    } else {
      status.isRunning = true; // Standalone is always "running"
    }

    return status;
  }

  /**
   * Get database connection pool
   */
  getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Test network connectivity to server
   */
  async testConnectivity(address: string, port: number): Promise<boolean> {
    try {
      const testPool = new Pool({
        host: address,
        port: port,
        database: 'postgres', // Connect to default database first
        user: 'postgres',
        password: 'postgres',
        max: 1,
        connectionTimeoutMillis: 5000,
      });

      await testPool.query('SELECT 1');
      await testPool.end();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discover servers on local network
   */
  async discoverServers(): Promise<Array<{ address: string; port: number; hostname?: string }>> {
    const servers: Array<{ address: string; port: number; hostname?: string }> = [];
    const localIPs = this.configService.getLocalIPs();
    const commonPorts = [5432, 5433, 5434];

    // Scan common network ports
    for (const ip of localIPs) {
      const subnet = ip.substring(0, ip.lastIndexOf('.'));

      for (let i = 1; i <= 254; i++) {
        const testIP = `${subnet}.${i}`;

        for (const port of commonPorts) {
          const isReachable = await this.testConnectivity(testIP, port);
          if (isReachable) {
            servers.push({ address: testIP, port });
          }
        }
      }
    }

    return servers;
  }

  /**
   * Configure PostgreSQL for network access
   */
  private configurePostgreSQL(configPath: string, networkConfig: any): void {
    let configContent = '';

    if (fs.existsSync(configPath)) {
      configContent = fs.readFileSync(configPath, 'utf-8');
    } else {
      configContent = `
# PostgreSQL configuration file
listen_addresses = '${networkConfig.allowRemoteConnections ? '0.0.0.0' : 'localhost'}'
port = ${networkConfig.serverPort || 5433}
max_connections = ${networkConfig.maxConnections || 10}
shared_buffers = 256MB
effective_cache_size = 1GB
`;
    }

    // Update listen_addresses and port
    configContent = configContent.replace(
      /listen_addresses\s*=\s*\S+/,
      `listen_addresses = '${networkConfig.allowRemoteConnections ? '0.0.0.0' : 'localhost'}'`
    );
    configContent = configContent.replace(
      /port\s*=\s*\d+/,
      `port = ${networkConfig.serverPort || 5433}`
    );

    fs.writeFileSync(configPath, configContent);
  }

  /**
   * Configure pg_hba.conf for client authentication
   */
  private configurePgHBA(pgHbaPath: string, networkConfig: any): void {
    let hbaContent = '';

    if (fs.existsSync(pgHbaPath)) {
      hbaContent = fs.readFileSync(pgHbaPath, 'utf-8');
    }

    // Add host-based authentication rules
    const rules = [
      '# TYPE  DATABASE        USER            ADDRESS                 METHOD',
      '# IPv4 local connections:',
      'host    all             all             127.0.0.1/32            md5',
    ];

    if (networkConfig.allowRemoteConnections) {
      rules.push(
        '# IPv4 remote connections:',
        'host    all             all             0.0.0.0/0               md5'
      );
    }

    hbaContent = rules.join('\n') + '\n' + hbaContent.split('\n').slice(5).join('\n');

    fs.writeFileSync(pgHbaPath, hbaContent);
  }

  /**
   * Wait for PostgreSQL to be ready
   */
  private async waitForPostgreSQL(config: any): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const testPool = new Pool({
          host: 'localhost',
          port: config.serverPort || 5433,
          database: 'postgres',
          user: 'postgres',
          password: 'postgres',
          max: 1,
          connectionTimeoutMillis: 2000,
        });

        await testPool.query('SELECT 1');
        await testPool.end();
        return;
      } catch (error) {
        if (i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error('PostgreSQL failed to start within timeout period');
  }

  /**
   * Run command and wait for completion
   */
  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let output = '';
      let error = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed: ${error || output}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get server address for clients
   */
  private getServerAddress(): string {
    const config = this.configService.getConfig();

    if (config.allowRemoteConnections) {
      const ips = this.configService.getLocalIPs();
      return ips[0] || 'localhost';
    }

    return 'localhost';
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    if (this.postgresProcess) {
      await this.stopServer();
    }
  }
}

// Singleton instance
let networkManager: NetworkManager | null = null;

export function getNetworkManager(dataDir?: string): NetworkManager {
  if (!networkManager) {
    networkManager = new NetworkManager(dataDir);
  }
  return networkManager;
}
