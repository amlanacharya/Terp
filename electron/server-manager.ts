import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  private serverPort: number = 3001;
  private isProduction: boolean;
  private lastError: string = '';

  constructor(isProduction: boolean = false) {
    this.isProduction = isProduction;
  }

  async start(): Promise<boolean> {
    try {
      if (this.serverProcess) {
        console.log('Server already running');
        return true;
      }

      // In development, assume backend is already running
      if (!this.isProduction) {
        console.log('Development mode: Assuming backend is already running on port 3001');
        await this.delay(1000);
        return true;
      }

      console.log('Starting Express server...');

      // In production, server is in extraResources → resources/server/
      const serverDir = process.resourcesPath
        ? path.join(process.resourcesPath, 'server')
        : path.join(process.cwd(), 'server');
      const entryPoint = path.join(serverDir, 'dist', 'index.js');

      // Validate server entry point exists
      if (!fs.existsSync(entryPoint)) {
        this.lastError = `Server entry point not found: ${entryPoint}`;
        console.error(this.lastError);
        return false;
      }

      const command = 'node';
      const args = [entryPoint];
      this.lastError = '';

      this.serverProcess = spawn(command, args, {
        cwd: serverDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: this.serverPort.toString(),
        },
      });

      // Collect stderr for diagnostics
      let stderrOutput = '';

      this.serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server] ${data}`);
      });

      this.serverProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        stderrOutput += msg;
        console.error(`[Server Error] ${msg}`);
      });

      this.serverProcess.on('error', (error) => {
        this.lastError = `Failed to spawn server: ${error.message}`;
        console.error(this.lastError);
      });

      this.serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
          this.lastError = stderrOutput || `Server exited with code ${code}`;
        }
        this.serverProcess = null;
      });

      // Wait for server to start (up to 5 seconds)
      for (let i = 0; i < 10; i++) {
        await this.delay(500);
        if (!this.serverProcess || this.serverProcess.killed) {
          // Process already died
          return false;
        }
        // Try to connect to the server
        if (i >= 3) {
          try {
            const http = await import('http');
            const ok = await new Promise<boolean>((resolve) => {
              const req = http.default.get(`http://localhost:${this.serverPort}/api/health`, (res) => {
                resolve(res.statusCode === 200);
              });
              req.on('error', () => resolve(false));
              req.setTimeout(1000, () => { req.destroy(); resolve(false); });
            });
            if (ok) {
              console.log(`Express server started on port ${this.serverPort}`);
              return true;
            }
          } catch {
            // Continue waiting
          }
        }
      }

      // Final check
      if (this.serverProcess && !this.serverProcess.killed) {
        console.log(`Express server started on port ${this.serverPort}`);
        return true;
      }

      return false;
    } catch (error) {
      this.lastError = `Error starting server: ${(error as Error).message}`;
      console.error(this.lastError);
      return false;
    }
  }

  getLastError(): string {
    return this.lastError;
  }

  async stop(): Promise<boolean> {
    try {
      if (!this.serverProcess) {
        console.log('Server not running');
        return true;
      }

      console.log('Stopping Express server...');

      // Try graceful shutdown first
      if (this.serverProcess.pid) {
        process.kill(this.serverProcess.pid, 'SIGTERM');
      }

      // Wait for graceful shutdown
      await this.delay(2000);

      // Force kill if still running
      if (this.serverProcess && !this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }

      this.serverProcess = null;
      console.log('Express server stopped');
      return true;
    } catch (error) {
      console.error('Error stopping server:', error);
      return false;
    }
  }

  async restart(): Promise<boolean> {
    await this.stop();
    await this.delay(1000);
    return this.start();
  }

  isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  getPort(): number {
    return this.serverPort;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
