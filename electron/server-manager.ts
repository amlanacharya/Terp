import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  private serverPort: number = 3001;
  private isProduction: boolean;

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

      // In production, run compiled JS
      const serverDir = path.join(process.cwd(), 'server');
      const entryPoint = 'dist/index.js';

      const command = 'node';
      const args = [path.join(serverDir, entryPoint)];

      this.serverProcess = spawn(command, args, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: this.serverPort.toString(),
        },
      });

      this.serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server] ${data}`);
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error(`[Server Error] ${data}`);
      });

      this.serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
      });

      this.serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        this.serverProcess = null;
      });

      // Wait a bit for server to start
      await this.delay(2000);

      // Verify server is running by checking if process exists
      if (this.serverProcess && !this.serverProcess.killed) {
        console.log(`Express server started on port ${this.serverPort}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error starting server:', error);
      return false;
    }
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
