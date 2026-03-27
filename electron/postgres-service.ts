import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * PostgresService
 *
 * Manages PostgreSQL service operations for the embedded database.
 * Provides status checking and service control capabilities.
 */
export class PostgresService {
  private pgPath: string;

  constructor() {
    // Path to PostgreSQL installation
    this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
  }

  /**
   * Get PostgreSQL service status
   * @returns Service status information
   */
  async getStatus(): Promise<{
    running: boolean;
    version?: string;
    error?: string;
  }> {
    const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');

    try {
      // Check if PostgreSQL service is running
      const statusCommand = `"${pgCtlPath}" status -D "${path.join(this.pgPath, 'data')}"`;

      const env = {
        ...process.env,
        PGDATA: path.join(this.pgPath, 'data')
      };

      try {
        const { stdout } = await execAsync(statusCommand, { env, timeout: 5000 });

        // Parse output to check if server is running
        const isRunning = stdout.includes('server is running') || stdout.includes('pid');

        // Get version
        let version: string | undefined;
        try {
          const psqlPath = path.join(this.pgPath, 'bin', 'psql.exe');
          const { stdout: versionOutput } = await execAsync(`"${psqlPath}" --version`, { timeout: 5000 });
          version = versionOutput.trim();
        } catch {
          version = undefined;
        }

        return {
          running: isRunning,
          version
        };
      } catch (statusError) {
        // pg_ctl status returns error if server is not running
        const error = statusError as { stderr?: string };
        if (error.stderr?.includes('not running') || error.stderr?.includes('no server running')) {
          return {
            running: false,
            error: 'PostgreSQL service is not running'
          };
        }
        throw statusError;
      }
    } catch (error) {
      console.error('[PostgresService] Failed to get status:', error);
      return {
        running: false,
        error: `Failed to check PostgreSQL status: ${(error as Error).message}`
      };
    }
  }

  /**
   * Start PostgreSQL service
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
    const dataDir = path.join(this.pgPath, 'data');

    try {
      const command = `"${pgCtlPath}" start -D "${dataDir}"`;

      const env = {
        ...process.env,
        PGDATA: dataDir
      };

      await execAsync(command, { env, timeout: 15000 });
      console.log('[PostgresService] PostgreSQL service started');

      return { success: true };
    } catch (error) {
      console.error('[PostgresService] Failed to start service:', error);
      return {
        success: false,
        error: `Failed to start PostgreSQL: ${(error as Error).message}`
      };
    }
  }

  /**
   * Stop PostgreSQL service
   */
  async stop(): Promise<{ success: boolean; error?: string }> {
    const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
    const dataDir = path.join(this.pgPath, 'data');

    try {
      const command = `"${pgCtlPath}" stop -D "${dataDir}"`;

      const env = {
        ...process.env,
        PGDATA: dataDir
      };

      await execAsync(command, { env, timeout: 15000 });
      console.log('[PostgresService] PostgreSQL service stopped');

      return { success: true };
    } catch (error) {
      console.error('[PostgresService] Failed to stop service:', error);
      return {
        success: false,
        error: `Failed to stop PostgreSQL: ${(error as Error).message}`
      };
    }
  }

  /**
   * Restart PostgreSQL service
   */
  async restart(): Promise<{ success: boolean; error?: string }> {
    const stopResult = await this.stop();
    if (!stopResult.success) {
      return stopResult;
    }

    // Wait a moment for stop to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    return await this.start();
  }
}
