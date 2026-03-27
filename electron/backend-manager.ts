import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

/**
 * BackendManager
 *
 * Manages the Express backend server lifecycle for the Electron app.
 * Spawns a Node.js process running the compiled backend server.
 */
export class BackendManager {
  private backendProcess: ChildProcess | null = null;

  /**
   * Start the Express backend server
   * @returns Promise that resolves when backend is ready
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Path to compiled backend server
      const serverPath = path.join(__dirname, '../server/dist/index.js');

      console.log('[BackendManager] Starting backend server from:', serverPath);

      // Spawn Node.js process for backend
      this.backendProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '3001',
          DB_HOST: process.env.DB_HOST || 'localhost',
          DB_PORT: process.env.DB_PORT || '5432',
          DB_NAME: process.env.DB_NAME || 'travelerp_lite',
          DB_USER: process.env.DB_USER || 'travelerp',
          DB_PASSWORD: process.env.DB_PASSWORD || 'travelerp123'
        },
        stdio: 'pipe'
      });

      // Log backend stdout
      this.backendProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`[Backend] ${message}`);

        // Detect when server is ready
        if (message.includes('listening on http://localhost') ||
            message.includes('Server running on') ||
            message.includes('ready')) {
          console.log('[BackendManager] Backend is ready');
          resolve();
        }
      });

      // Log backend stderr
      this.backendProcess.stderr?.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString().trim()}`);
      });

      // Handle process spawn errors
      this.backendProcess.on('error', (error) => {
        console.error('[BackendManager] Failed to start backend process:', error);
        reject(new Error(`Failed to start backend: ${error.message}`));
      });

      // Handle unexpected process exit
      this.backendProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          console.error(`[BackendManager] Backend exited with code ${code}`);
        }
        if (signal) {
          console.error(`[BackendManager] Backend killed with signal ${signal}`);
        }
      });

      // Timeout after 15 seconds (assume started if no explicit error)
      setTimeout(() => {
        if (this.backendProcess && !this.backendProcess.killed) {
          console.log('[BackendManager] Backend startup timeout - assuming ready');
          resolve();
        }
      }, 15000);
    });
  }

  /**
   * Stop the Express backend server
   */
  stop(): void {
    if (this.backendProcess) {
      console.log('[BackendManager] Stopping backend server...');
      this.backendProcess.kill('SIGTERM');
      this.backendProcess = null;
      console.log('[BackendManager] Backend stopped');
    }
  }

  /**
   * Check if backend is currently running
   */
  isRunning(): boolean {
    return this.backendProcess !== null && !this.backendProcess.killed;
  }
}
