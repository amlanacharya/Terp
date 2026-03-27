import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * PostgresService
 *
 * Manages the PostgreSQL database service for the TravelERP Lite desktop application.
 * Handles starting/stopping the PostgreSQL Windows service, initializing the database,
 * and checking service status.
 */
export class PostgresService {
  private pgPath: string;
  private dataPath: string;
  private serviceName = 'TravelERP-PostgreSQL';

  constructor() {
    // Determine PostgreSQL path
    // Priority: 1) Environment variable, 2) Bundled binaries, 3) Default installation
    if (process.env.PG_PATH) {
      this.pgPath = process.env.PG_PATH;
    } else {
      // Check if bundled binaries exist
      const bundledPath = path.join(__dirname, '../build/postgres');
      if (fs.existsSync(bundledPath)) {
        this.pgPath = bundledPath;
      } else {
        // Use default installation path
        this.pgPath = 'C:\\Program Files\\TravelERP\\pgsql';
      }
    }

    // Data directory in user data folder
    this.dataPath = path.join(this.pgPath, 'data');

    console.log(`[PostgresService] PostgreSQL path: ${this.pgPath}`);
    console.log(`[PostgresService] Data directory: ${this.dataPath}`);
  }

  /**
   * Start the PostgreSQL service
   * @throws Error if service fails to start
   */
  async start(): Promise<void> {
    try {
      console.log('[PostgresService] Starting PostgreSQL service...');

      // Try to start the Windows service
      try {
        const { stdout, stderr } = await execAsync(`net start "${this.serviceName}"`);
        console.log('[PostgresService] Service start output:', stdout || stderr);
      } catch (error: any) {
        // If already started, that's okay
        if (!error.message.includes('already been started') &&
            !error.message.includes('service has already been started')) {
          throw error;
        }
        console.log('[PostgresService] Service already running');
      }

      // Wait for PostgreSQL to be ready
      await this.waitForReady();
      console.log('[PostgresService] PostgreSQL is ready');
    } catch (error) {
      throw new Error(`Failed to start PostgreSQL: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the PostgreSQL service
   */
  async stop(): Promise<void> {
    try {
      console.log('[PostgresService] Stopping PostgreSQL service...');
      const { stdout, stderr } = await execAsync(`net stop "${this.serviceName}"`);
      console.log('[PostgresService] Service stop output:', stdout || stderr);
    } catch (error) {
      console.error('[PostgresService] Failed to stop PostgreSQL:', error);
    }
  }

  /**
   * Initialize the database
   * - Runs initdb if data directory doesn't exist
   * - Starts the service
   * - Creates the travelerp_lite database
   * @throws Error if initialization fails
   */
  async initializeDatabase(): Promise<void> {
    console.log('[PostgresService] Initializing database...');

    // Check if data directory exists
    if (!fs.existsSync(this.dataPath)) {
      console.log('[PostgresService] Data directory not found, running initdb...');

      // Create parent directories if needed
      const parentDir = path.dirname(this.dataPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Run initdb
      try {
        const initDbPath = path.join(this.pgPath, 'bin', 'initdb.exe');
        const { stdout, stderr } = await execAsync(
          `"${initDbPath}" -D "${this.dataPath}" -U travelerp -E UTF8 --locale=C`
        );
        console.log('[PostgresService] initdb output:', stdout || stderr);
      } catch (error) {
        throw new Error(`Failed to initialize database: ${(error as Error).message}`);
      }
    } else {
      console.log('[PostgresService] Data directory already exists');
    }

    // Start service
    await this.start();

    // Create database
    try {
      console.log('[PostgresService] Creating travelerp_lite database...');
      const psqlPath = path.join(this.pgPath, 'bin', 'psql.exe');
      const { stdout, stderr } = await execAsync(
        `"${psqlPath}" -U travelerp -c "CREATE DATABASE travelerp_lite;"`
      );
      console.log('[PostgresService] Database creation output:', stdout || stderr);
    } catch (error: any) {
      // If database already exists, that's okay
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('[PostgresService] Database already exists');
    }

    console.log('[PostgresService] Database initialization complete');
  }

  /**
   * Wait for PostgreSQL to accept connections
   * @throws Error if timeout is reached
   */
  async waitForReady(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;
    const pgIsReadyPath = path.join(this.pgPath, 'bin', 'pg_isready.exe');

    console.log('[PostgresService] Waiting for PostgreSQL to be ready...');

    while (attempts < maxAttempts) {
      try {
        const { stdout } = await execAsync(`"${pgIsReadyPath}"`);
        console.log(`[PostgresService] PostgreSQL ready (attempt ${attempts + 1}):`, stdout.trim());
        return;
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[PostgresService] Waiting... (${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw new Error('PostgreSQL failed to start within timeout period');
  }

  /**
   * Get the current status of PostgreSQL
   * @returns 'running' if PostgreSQL is accepting connections, 'stopped' otherwise
   */
  async getStatus(): Promise<'running' | 'stopped' | 'unknown'> {
    try {
      const pgIsReadyPath = path.join(this.pgPath, 'bin', 'pg_isready.exe');
      await execAsync(`"${pgIsReadyPath}"`);
      return 'running';
    } catch (error) {
      return 'stopped';
    }
  }

  /**
   * Get the PostgreSQL bin directory path
   */
  getBinPath(): string {
    return path.join(this.pgPath, 'bin');
  }

  /**
   * Get the PostgreSQL data directory path
   */
  getDataPath(): string {
    return this.dataPath;
  }

  /**
   * Get the connection string for the database
   */
  getConnectionString(): string {
    return `postgresql://travelerp:travelerp123@localhost:5432/travelerp_lite`;
  }
}
