import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const execAsync = promisify(exec);

export class PostgresService {
  private pgPath: string;
  private dataPath: string;
  private sqlPath: string;

  constructor() {
    if (process.env.PG_PATH) {
      this.pgPath = process.env.PG_PATH;
    } else if (app.isPackaged) {
      this.pgPath = path.join(process.resourcesPath, 'postgres');
    } else {
      this.pgPath = path.join(__dirname, '../build/postgres');
    }

    this.dataPath = path.join(app.getPath('userData'), 'postgres-data');

    // SQL files: bundled as extraResources in production, or from server/db in dev
    if (app.isPackaged) {
      this.sqlPath = path.join(process.resourcesPath, 'db');
    } else {
      this.sqlPath = path.join(__dirname, '../server/db');
    }

    console.log(`[PostgresService] PostgreSQL path: ${this.pgPath}`);
    console.log(`[PostgresService] Data directory: ${this.dataPath}`);
  }

  async start(): Promise<void> {
    const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
    const logFile = path.join(this.dataPath, 'postgres.log');

    // Validate binary exists
    if (!fs.existsSync(pgCtlPath)) {
      throw new Error(
        `PostgreSQL not found at: ${this.pgPath}\n` +
        `Expected pg_ctl.exe at: ${pgCtlPath}`
      );
    }

    // Handle stale PID file: if pid file exists but postgres isn't responding, remove it
    const pidFile = path.join(this.dataPath, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      const pgIsReadyPath = path.join(this.pgPath, 'bin', 'pg_isready.exe');
      try {
        await execAsync(`"${pgIsReadyPath}"`, { timeout: 3000 });
        console.log('[PostgresService] PostgreSQL already running');
        return;
      } catch {
        console.log('[PostgresService] Removing stale PID file...');
        try { fs.unlinkSync(pidFile); } catch {}
      }
    }

    console.log('[PostgresService] Starting PostgreSQL...');
    try {
      // Start without -w; waitForReady() handles polling
      const { stdout, stderr } = await execAsync(
        `"${pgCtlPath}" start -D "${this.dataPath}" -l "${logFile}" -o "-p 5432"`,
        { timeout: 15000 }
      );
      console.log('[PostgresService] pg_ctl start output:', stdout || stderr);
    } catch (error: any) {
      if (!error.message.includes('server is already running') &&
          !error.message.includes('another server might be running')) {
        // Append last 10 lines of postgres log to error for diagnosis
        let logTail = '';
        try {
          if (fs.existsSync(logFile)) {
            const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
            logTail = '\n\nLog tail:\n' + lines.slice(-10).join('\n');
          }
        } catch {}
        throw new Error(`Failed to start PostgreSQL: ${error.message}${logTail}`);
      }
      console.log('[PostgresService] PostgreSQL already running');
    }

    await this.waitForReady();
    console.log('[PostgresService] PostgreSQL is ready');
  }

  async stop(): Promise<void> {
    try {
      console.log('[PostgresService] Stopping PostgreSQL...');
      const pgCtlPath = path.join(this.pgPath, 'bin', 'pg_ctl.exe');
      const { stdout, stderr } = await execAsync(
        `"${pgCtlPath}" stop -D "${this.dataPath}" -m fast`,
        { timeout: 15000 }
      );
      console.log('[PostgresService] pg_ctl stop output:', stdout || stderr);
    } catch (error) {
      console.error('[PostgresService] Failed to stop PostgreSQL:', error);
    }
  }

  async initializeDatabase(): Promise<void> {
    console.log('[PostgresService] Initializing database...');

    const initDbPath = path.join(this.pgPath, 'bin', 'initdb.exe');
    if (!fs.existsSync(initDbPath)) {
      throw new Error(
        `PostgreSQL binaries not found.\n` +
        `Expected initdb.exe at: ${initDbPath}\n` +
        `pgPath: ${this.pgPath}`
      );
    }

    // Detect stale data directory from a different install location
    // PostgreSQL embeds the binary path during initdb; if the app was reinstalled
    // to a different location, the data directory must be re-initialized
    if (fs.existsSync(this.dataPath)) {
      const pgVersionFile = path.join(this.dataPath, 'PG_VERSION');
      const postmasterOpts = path.join(this.dataPath, 'postmaster.opts');
      if (fs.existsSync(postmasterOpts)) {
        try {
          const opts = fs.readFileSync(postmasterOpts, 'utf8');
          // postmaster.opts contains the path used to start postgres last time
          // If current pgPath isn't in there, the data dir is stale
          const currentBinDir = path.join(this.pgPath, 'bin').replace(/\\/g, '/');
          const optsNormalized = opts.replace(/\\/g, '/');
          if (!optsNormalized.includes(currentBinDir)) {
            console.log('[PostgresService] Data directory was created from a different install location. Re-initializing...');
            console.log(`[PostgresService] Current: ${currentBinDir}`);
            console.log(`[PostgresService] postmaster.opts: ${opts.trim()}`);
            // Stop any running postgres first
            try { await this.stop(); } catch {}
            fs.rmSync(this.dataPath, { recursive: true, force: true });
          }
        } catch (e) {
          console.log('[PostgresService] Could not read postmaster.opts, re-initializing...', e);
          try { await this.stop(); } catch {}
          fs.rmSync(this.dataPath, { recursive: true, force: true });
        }
      }
    }

    if (!fs.existsSync(this.dataPath)) {
      console.log('[PostgresService] Running initdb...');
      fs.mkdirSync(this.dataPath, { recursive: true });

      try {
        // -A trust: no password required for local connections
        const { stdout, stderr } = await execAsync(
          `"${initDbPath}" -D "${this.dataPath}" -U travelerp -E UTF8 --locale=C -A trust`,
          { timeout: 60000 }
        );
        console.log('[PostgresService] initdb output:', stdout || stderr);
      } catch (error) {
        // Clean up partial data dir so next launch retries
        try { fs.rmSync(this.dataPath, { recursive: true, force: true }); } catch {}
        throw new Error(`Failed to initialize database: ${(error as Error).message}`);
      }
    } else {
      console.log('[PostgresService] Data directory already exists');
    }

    await this.start();

    const psqlPath = path.join(this.pgPath, 'bin', 'psql.exe');
    let dbCreated = false;
    try {
      console.log('[PostgresService] Creating travelerp_lite database...');
      const { stdout, stderr } = await execAsync(
        `"${psqlPath}" -U travelerp -d postgres -c "CREATE DATABASE travelerp_lite;"`,
        { timeout: 15000 }
      );
      console.log('[PostgresService] Database creation output:', stdout || stderr);
      dbCreated = true;
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('[PostgresService] Database already exists');
    }

    // Apply schema + seed on first run (when database was just created)
    if (dbCreated) {
      await this.applySchema(psqlPath);
    }

    console.log('[PostgresService] Database initialization complete');
  }

  private async applySchema(psqlPath: string): Promise<void> {
    const schemaFile = path.join(this.sqlPath, 'schema.sql');
    const seedFile = path.join(this.sqlPath, 'seed.sql');

    if (!fs.existsSync(schemaFile)) {
      console.error(`[PostgresService] schema.sql not found at: ${schemaFile}`);
      throw new Error(`Schema file not found: ${schemaFile}`);
    }

    console.log('[PostgresService] Applying schema...');
    try {
      const { stdout, stderr } = await execAsync(
        `"${psqlPath}" -U travelerp -d travelerp_lite -f "${schemaFile}"`,
        { timeout: 60000 }
      );
      console.log('[PostgresService] Schema applied:', stdout || stderr);
    } catch (error: any) {
      console.error('[PostgresService] Schema error:', error.message);
      throw new Error(`Failed to apply schema: ${error.message}`);
    }

    if (fs.existsSync(seedFile)) {
      console.log('[PostgresService] Applying seed data...');
      try {
        const { stdout, stderr } = await execAsync(
          `"${psqlPath}" -U travelerp -d travelerp_lite -f "${seedFile}"`,
          { timeout: 60000 }
        );
        console.log('[PostgresService] Seed data applied:', stdout || stderr);
      } catch (error: any) {
        console.error('[PostgresService] Seed error:', error.message);
        // Non-fatal: seed data is nice-to-have
      }
    }
  }

  async waitForReady(): Promise<void> {
    const maxAttempts = 30;
    const pgIsReadyPath = path.join(this.pgPath, 'bin', 'pg_isready.exe');
    console.log('[PostgresService] Waiting for PostgreSQL to be ready...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { stdout } = await execAsync(`"${pgIsReadyPath}"`, { timeout: 3000 });
        console.log(`[PostgresService] PostgreSQL ready (attempt ${attempt}):`, stdout.trim());
        return;
      } catch {
        console.log(`[PostgresService] Waiting... (${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('PostgreSQL failed to start within 30 seconds');
  }

  async getStatus(): Promise<'running' | 'stopped' | 'unknown'> {
    try {
      const pgIsReadyPath = path.join(this.pgPath, 'bin', 'pg_isready.exe');
      await execAsync(`"${pgIsReadyPath}"`, { timeout: 3000 });
      return 'running';
    } catch {
      return 'stopped';
    }
  }

  getBinPath(): string {
    return path.join(this.pgPath, 'bin');
  }

  getDataPath(): string {
    return this.dataPath;
  }

  getConnectionString(): string {
    return `postgresql://travelerp:travelerp123@localhost:5432/travelerp_lite`;
  }
}
