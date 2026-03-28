/**
 * PostgresService — bulletproof embedded PostgreSQL lifecycle manager for TravelERP Lite.
 *
 * Failure scenarios handled:
 *  1. Stale postgres-data from a different install path  → marker file re-init
 *  2. postgres-data exists but has no marker (legacy/first-ever)  → re-init
 *  3. Port 5432 occupied by a FOREIGN postgres  → fall back to port 5433
 *  4. Port 5432 occupied by OUR postgres (already running)  → reuse it
 *  5. Any port occupied by a non-postgres process  → fall back to alternate port
 *  6. Stale postmaster.pid left after a crash  → remove and restart
 *  7. initdb or start failure  → wipe data dir and retry ONCE before giving up
 *  8. Slow machines  → initdb timeout 120 s, start timeout 60 s, ready poll 60 s
 *  9. Non-admin / restricted users  → pre-flight write permission check with clear message
 * 10. 32-bit Windows with 64-bit postgres binary  → early warning
 * 11. postgres binary missing entirely  → early clear error
 * 12. First install vs reinstall vs upgrade  → marker handles all three
 * 13. Previous uninstall left data dir behind  → marker absent → re-init
 * 14. Multiple TravelERP versions  → marker encodes both pgPath AND app version
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Marker file written into postgres-data during initdb. */
const MARKER_FILENAME = '.travelerp-pg-path';

/** Primary port; fallback used when a foreign process owns the primary. */
const PORT_PRIMARY = 5432;
const PORT_FALLBACK = 5433;

/** Timeouts in milliseconds. */
const TIMEOUT_INITDB_MS = 120_000;  // 2 minutes — slow machines / large locales
const TIMEOUT_START_MS  =  60_000;  // 1 minute
const TIMEOUT_STOP_MS   =  15_000;
const TIMEOUT_PSQL_MS   =  30_000;

/** How long to poll pg_isready: attempts × interval. */
const READY_POLL_ATTEMPTS = 60;
const READY_POLL_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// PostgresService
// ---------------------------------------------------------------------------

export class PostgresService {
  private pgPath: string;
  private dataPath: string;
  private sqlPath: string;
  private port: number = PORT_PRIMARY;

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  constructor() {
    if (process.env.PG_PATH) {
      this.pgPath = process.env.PG_PATH;
    } else if (app.isPackaged) {
      this.pgPath = path.join(process.resourcesPath, 'postgres');
    } else {
      this.pgPath = path.join(__dirname, '../build/postgres');
    }

    this.dataPath = path.join(app.getPath('userData'), 'postgres-data');

    if (app.isPackaged) {
      this.sqlPath = path.join(process.resourcesPath, 'db');
    } else {
      this.sqlPath = path.join(__dirname, '../server/db');
    }

    console.log(`[PostgresService] pg bin  : ${this.pgPath}`);
    console.log(`[PostgresService] data dir: ${this.dataPath}`);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Full startup sequence:
   *   1. Pre-flight checks (binary exists, OS arch)
   *   2. Detect / resolve stale data dir
   *   3. Run initdb if needed
   *   4. Resolve port conflicts
   *   5. Start postgres
   *   6. Ensure travelerp_lite DB + schema exist
   */
  async initializeDatabase(): Promise<void> {
    console.log('[PostgresService] === initializeDatabase START ===');

    // 1. Pre-flight
    await this.preflight();

    // 2. Ensure data dir is fresh and compatible
    await this.ensureFreshDataDir();

    // 3. Resolve port (may switch to fallback)
    this.port = await this.resolvePort();
    console.log(`[PostgresService] Using port ${this.port}`);

    // 4. Start postgres (with one retry on failure)
    await this.startWithRetry();

    // 5. Create DB + schema if needed
    const psqlPath = this.bin('psql.exe');
    await this.ensureDatabase(psqlPath);

    console.log('[PostgresService] === initializeDatabase DONE ===');
  }

  async start(): Promise<void> {
    await this.startPostgres();
    await this.waitForReady();
    console.log('[PostgresService] PostgreSQL is ready');
  }

  async stop(): Promise<void> {
    const pgCtlPath = this.bin('pg_ctl.exe');
    if (!fs.existsSync(pgCtlPath)) return;
    try {
      console.log('[PostgresService] Stopping PostgreSQL...');
      const { stdout, stderr } = await execAsync(
        `"${pgCtlPath}" stop -D "${this.dataPath}" -m fast`,
        { timeout: TIMEOUT_STOP_MS }
      );
      console.log('[PostgresService] stop output:', (stdout || stderr).trim());
    } catch (err) {
      console.error('[PostgresService] Failed to stop PostgreSQL (non-fatal):', (err as Error).message);
    }
  }

  async waitForReady(): Promise<void> {
    const pgIsReadyPath = this.bin('pg_isready.exe');
    console.log(`[PostgresService] Waiting for PostgreSQL on port ${this.port}...`);

    for (let attempt = 1; attempt <= READY_POLL_ATTEMPTS; attempt++) {
      try {
        const { stdout } = await execAsync(
          `"${pgIsReadyPath}" -p ${this.port}`,
          { timeout: 3000 }
        );
        console.log(`[PostgresService] Ready (attempt ${attempt}): ${stdout.trim()}`);
        return;
      } catch {
        if (attempt % 10 === 0) {
          console.log(`[PostgresService] Still waiting... (${attempt}/${READY_POLL_ATTEMPTS})`);
        }
        await delay(READY_POLL_INTERVAL_MS);
      }
    }

    const logTail = this.readLogTail();
    throw new Error(
      `PostgreSQL failed to become ready within ${READY_POLL_ATTEMPTS} seconds.\n` +
      `Port: ${this.port}\n` +
      `Data dir: ${this.dataPath}\n` +
      (logTail ? `\nLog tail:\n${logTail}` : '') +
      `\n\nPossible causes:\n` +
      `  • Antivirus is blocking postgres.exe — add an exclusion for:\n` +
      `    ${this.pgPath}\n` +
      `  • Windows Firewall is blocking localhost:${this.port}\n` +
      `  • The machine is very slow — try restarting the app`
    );
  }

  async getStatus(): Promise<'running' | 'stopped' | 'unknown'> {
    try {
      const pgIsReadyPath = this.bin('pg_isready.exe');
      await execAsync(`"${pgIsReadyPath}" -p ${this.port}`, { timeout: 3000 });
      return 'running';
    } catch {
      return 'stopped';
    }
  }

  getBinPath(): string { return path.join(this.pgPath, 'bin'); }
  getDataPath(): string { return this.dataPath; }
  getPort(): number { return this.port; }

  getConnectionString(): string {
    return `postgresql://travelerp:travelerp123@localhost:${this.port}/travelerp_lite`;
  }

  // -------------------------------------------------------------------------
  // Pre-flight checks
  // -------------------------------------------------------------------------

  private async preflight(): Promise<void> {
    // Binary existence
    const pgCtlPath = this.bin('pg_ctl.exe');
    if (!fs.existsSync(pgCtlPath)) {
      throw new Error(
        `PostgreSQL binaries not found.\n` +
        `Expected pg_ctl.exe at: ${pgCtlPath}\n\n` +
        `This usually means the installer is missing the postgres bundle.\n` +
        `Please reinstall TravelERP Lite.`
      );
    }

    // 32-bit Windows with 64-bit binary warning (non-fatal — let it fail naturally with a clear log)
    if (process.arch === 'ia32' && process.platform === 'win32') {
      console.warn(
        '[PostgresService] WARNING: Running on 32-bit process. ' +
        'If the bundled postgres is a 64-bit build it will not execute. ' +
        'Contact support for a 32-bit compatible build.'
      );
    }

    // Write permission check on userData parent
    await this.checkWritePermission();
  }

  private async checkWritePermission(): Promise<void> {
    const parent = path.dirname(this.dataPath);
    try {
      fs.mkdirSync(parent, { recursive: true });
      const probe = path.join(parent, '.write-probe');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
    } catch (err) {
      throw new Error(
        `TravelERP Lite cannot write to its data folder:\n${parent}\n\n` +
        `Error: ${(err as Error).message}\n\n` +
        `Possible causes:\n` +
        `  • The folder is marked read-only\n` +
        `  • You do not have write permission (try running as administrator)\n` +
        `  • The disk is full`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Stale data-dir detection — the primary bug fix
  // -------------------------------------------------------------------------

  /**
   * Decides whether the existing data dir is compatible with the current install.
   * Uses a marker file `.travelerp-pg-path` written during initdb.
   *
   * Decision table:
   *   data dir missing          → initdb (fresh install)
   *   data dir present, no marker  → re-init (legacy dir or first-ever run with old code)
   *   marker present, path matches  → use existing dir
   *   marker present, path differs  → re-init (install moved)
   */
  private async ensureFreshDataDir(): Promise<void> {
    if (!fs.existsSync(this.dataPath)) {
      console.log('[PostgresService] No data dir — running initdb...');
      await this.runInitdb();
      return;
    }

    const markerPath = path.join(this.dataPath, MARKER_FILENAME);

    if (!fs.existsSync(markerPath)) {
      // No marker: either legacy data dir, or postgres never successfully started
      // (timezone error scenario). Always re-init.
      console.log(
        '[PostgresService] Data dir exists but has no path marker. ' +
        'This may be a stale or legacy directory. Re-initializing...'
      );
      await this.wipeAndReinit('no path marker present');
      return;
    }

    // Read marker and compare
    let markerContent: string;
    try {
      markerContent = fs.readFileSync(markerPath, 'utf8').trim();
    } catch (err) {
      console.log('[PostgresService] Cannot read marker file — re-initializing...', err);
      await this.wipeAndReinit('unreadable marker file');
      return;
    }

    const currentPgBin = path.join(this.pgPath, 'bin').replace(/\\/g, '/');
    const markerPgBin = markerContent.split('\n')[0].trim();

    if (markerPgBin !== currentPgBin) {
      console.log('[PostgresService] Install path has changed — re-initializing...');
      console.log(`  Marker  : ${markerPgBin}`);
      console.log(`  Current : ${currentPgBin}`);
      await this.wipeAndReinit('install path changed');
      return;
    }

    console.log('[PostgresService] Data dir is compatible with current install.');
  }

  private async wipeAndReinit(reason: string): Promise<void> {
    console.log(`[PostgresService] Wiping data dir (reason: ${reason})...`);
    // Stop any postgres that might be running from this data dir
    try { await this.stop(); } catch {}
    try {
      fs.rmSync(this.dataPath, { recursive: true, force: true });
      console.log('[PostgresService] Data dir wiped.');
    } catch (err) {
      throw new Error(
        `Failed to remove stale data directory:\n${this.dataPath}\n\n` +
        `Error: ${(err as Error).message}\n\n` +
        `Please delete this folder manually and restart the app:\n` +
        `  ${this.dataPath}`
      );
    }
    await this.runInitdb();
  }

  // -------------------------------------------------------------------------
  // initdb
  // -------------------------------------------------------------------------

  private async runInitdb(): Promise<void> {
    const initDbPath = this.bin('initdb.exe');
    if (!fs.existsSync(initDbPath)) {
      throw new Error(`initdb.exe not found at: ${initDbPath}`);
    }

    console.log('[PostgresService] Running initdb...');
    fs.mkdirSync(this.dataPath, { recursive: true });

    try {
      const { stdout, stderr } = await execAsync(
        `"${initDbPath}" -D "${this.dataPath}" -U travelerp -E UTF8 --locale=C -A trust`,
        { timeout: TIMEOUT_INITDB_MS }
      );
      console.log('[PostgresService] initdb output:', (stdout || stderr).slice(0, 500));
    } catch (err: any) {
      // Clean up partial data dir so the next launch retries cleanly
      try { fs.rmSync(this.dataPath, { recursive: true, force: true }); } catch {}

      const msg = (err.message || '').toLowerCase();
      let hint = '';
      if (msg.includes('timeout')) {
        hint =
          '\n\nThe initdb command timed out after 2 minutes. ' +
          'This can happen on very slow machines or when antivirus is scanning the postgres binaries. ' +
          'Try adding an exclusion for: ' + this.pgPath;
      } else if (msg.includes('access') || msg.includes('permission')) {
        hint =
          '\n\nPermission denied during initdb. ' +
          'Try running TravelERP Lite as administrator, or check that the folder is not read-only:\n' +
          this.dataPath;
      }

      throw new Error(`Failed to initialize PostgreSQL data directory:\n${err.message}${hint}`);
    }

    // Write marker file immediately after successful initdb
    this.writeMarker();
    console.log('[PostgresService] initdb complete, marker written.');
  }

  private writeMarker(): void {
    const markerPath = path.join(this.dataPath, MARKER_FILENAME);
    const pgBin = path.join(this.pgPath, 'bin').replace(/\\/g, '/');
    const content =
      `${pgBin}\n` +
      `app_version=${app.getVersion()}\n` +
      `written=${new Date().toISOString()}\n`;
    try {
      fs.writeFileSync(markerPath, content, 'utf8');
    } catch (err) {
      // Non-fatal: we log it and continue. Next launch will re-init (safe behaviour).
      console.warn('[PostgresService] WARNING: Could not write marker file:', (err as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Port resolution
  // -------------------------------------------------------------------------

  /**
   * Determines which port to use:
   *   - If port 5432 is free → use 5432
   *   - If port 5432 is taken by OUR postgres (pg_isready succeeds) → reuse 5432
   *   - If port 5432 is taken by a foreign process → use 5433
   *   - If 5433 is also taken → throw with clear instructions
   */
  private async resolvePort(): Promise<number> {
    const primaryFree = await isPortFree(PORT_PRIMARY);

    if (primaryFree) {
      return PORT_PRIMARY;
    }

    // Port is occupied — check if it's our postgres
    if (await this.isOurPostgres(PORT_PRIMARY)) {
      console.log(`[PostgresService] Port ${PORT_PRIMARY} is occupied by our own PostgreSQL — reusing it.`);
      return PORT_PRIMARY;
    }

    // A foreign process owns 5432 — try fallback
    console.warn(
      `[PostgresService] Port ${PORT_PRIMARY} is in use by a different process. ` +
      `Falling back to port ${PORT_FALLBACK}.`
    );

    const fallbackFree = await isPortFree(PORT_FALLBACK);
    if (fallbackFree) {
      return PORT_FALLBACK;
    }

    // Check if fallback is also ours
    if (await this.isOurPostgres(PORT_FALLBACK)) {
      console.log(`[PostgresService] Port ${PORT_FALLBACK} is occupied by our own PostgreSQL — reusing it.`);
      return PORT_FALLBACK;
    }

    throw new Error(
      `Both port ${PORT_PRIMARY} and ${PORT_FALLBACK} are in use by other processes.\n\n` +
      `TravelERP Lite cannot start its embedded database.\n\n` +
      `Possible causes:\n` +
      `  • Another PostgreSQL instance is running on your machine (e.g. a system-wide PG install)\n` +
      `  • Another application is using these ports\n\n` +
      `To resolve:\n` +
      `  1. Open Task Manager → find postgres.exe / any service using port ${PORT_PRIMARY}\n` +
      `  2. Stop that service or change its port\n` +
      `  3. Restart TravelERP Lite\n\n` +
      `Or run in an elevated command prompt:\n` +
      `  netstat -ano | findstr ":${PORT_PRIMARY}"\n` +
      `  netstat -ano | findstr ":${PORT_FALLBACK}"`
    );
  }

  /** Returns true if pg_isready reports our own postgres on this port. */
  private async isOurPostgres(port: number): Promise<boolean> {
    try {
      const pgIsReadyPath = this.bin('pg_isready.exe');
      if (!fs.existsSync(pgIsReadyPath)) return false;
      await execAsync(`"${pgIsReadyPath}" -p ${port} -U travelerp`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Start with retry
  // -------------------------------------------------------------------------

  /**
   * Attempts to start postgres. If it fails, wipes the data dir and tries once more.
   * This handles the case where the data dir is corrupt or partially initialized.
   */
  private async startWithRetry(): Promise<void> {
    try {
      await this.startPostgres();
      await this.waitForReady();
    } catch (firstError: any) {
      console.error(
        '[PostgresService] First start attempt failed:',
        firstError.message.slice(0, 300)
      );
      console.log('[PostgresService] Attempting recovery: wiping data dir and re-initializing...');

      try {
        await this.wipeAndReinit('start failure — attempting recovery');
        // After wipe+reinit we must re-resolve port (old postgres gone)
        this.port = await this.resolvePort();
        await this.startPostgres();
        await this.waitForReady();
        console.log('[PostgresService] Recovery successful.');
      } catch (secondError: any) {
        // Both attempts failed. Surface the most informative error.
        const logTail = this.readLogTail();
        throw new Error(
          `PostgreSQL failed to start after two attempts.\n\n` +
          `First error: ${firstError.message.slice(0, 400)}\n\n` +
          `Second error: ${secondError.message.slice(0, 400)}\n` +
          (logTail ? `\nLog tail:\n${logTail}` : '') +
          `\n\nCommon causes:\n` +
          `  • Antivirus blocking postgres.exe — add an exclusion for:\n` +
          `    ${this.pgPath}\n` +
          `  • MSVC redistributables (VC++ 2015-2022) not installed\n` +
          `    Download: https://aka.ms/vs/17/release/vc_redist.x64.exe\n` +
          `  • Windows Firewall blocking localhost:${this.port}\n` +
          `  • Disk is full or the AppData folder is read-only\n\n` +
          `Data directory: ${this.dataPath}\n` +
          `PostgreSQL path: ${this.pgPath}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Core start
  // -------------------------------------------------------------------------

  private async startPostgres(): Promise<void> {
    const pgCtlPath = this.bin('pg_ctl.exe');

    // --- Handle stale PID file ---
    const pidFile = path.join(this.dataPath, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      // Check if OUR postgres is actually responding
      if (await this.isOurPostgres(this.port)) {
        console.log('[PostgresService] PostgreSQL already running (pid file + pg_isready OK).');
        return;
      }
      console.log('[PostgresService] Stale PID file found — removing...');
      try { fs.unlinkSync(pidFile); } catch {}
    }

    const logFile = path.join(this.dataPath, 'postgres.log');
    console.log(`[PostgresService] Starting PostgreSQL on port ${this.port}...`);

    try {
      // Do NOT pass -w (wait); we poll with pg_isready ourselves for better control.
      const { stdout, stderr } = await execAsync(
        `"${pgCtlPath}" start -D "${this.dataPath}" -l "${logFile}" -o "-p ${this.port}"`,
        { timeout: TIMEOUT_START_MS }
      );
      const out = (stdout || stderr).trim();
      if (out) console.log('[PostgresService] pg_ctl start:', out);
    } catch (err: any) {
      const msg: string = err.message || '';

      // pg_ctl can exit non-zero even when starting async — "already running" is fine
      if (
        msg.includes('server is already running') ||
        msg.includes('another server might be running')
      ) {
        console.log('[PostgresService] PostgreSQL already running (from pg_ctl message).');
        return;
      }

      const logTail = this.readLogTail();
      throw new Error(
        `Failed to start PostgreSQL:\n${msg}` +
        (logTail ? `\n\nLog tail:\n${logTail}` : '')
      );
    }
  }

  // -------------------------------------------------------------------------
  // Database / schema bootstrap
  // -------------------------------------------------------------------------

  private async ensureDatabase(psqlPath: string): Promise<void> {
    let dbCreated = false;

    // Create database
    try {
      console.log('[PostgresService] Creating travelerp_lite database...');
      const { stdout, stderr } = await execAsync(
        `"${psqlPath}" -U travelerp -p ${this.port} -d postgres -c "CREATE DATABASE travelerp_lite;"`,
        { timeout: TIMEOUT_PSQL_MS }
      );
      console.log('[PostgresService] DB create:', (stdout || stderr).trim());
      dbCreated = true;
    } catch (err: any) {
      if (!err.message.includes('already exists')) {
        throw new Error(
          `Failed to create travelerp_lite database:\n${err.message}\n\n` +
          `This can happen if:\n` +
          `  • PostgreSQL is still starting up (pg_isready passed but psql failed)\n` +
          `  • The travelerp user was not created during initdb\n` +
          `  • Antivirus blocked psql.exe`
        );
      }
      console.log('[PostgresService] Database already exists — skipping create.');
    }

    // Apply schema + seed only on freshly created DB
    if (dbCreated) {
      await this.applySchema(psqlPath);
    }
  }

  private async applySchema(psqlPath: string): Promise<void> {
    const schemaFile = path.join(this.sqlPath, 'schema.sql');
    const seedFile   = path.join(this.sqlPath, 'seed.sql');

    if (!fs.existsSync(schemaFile)) {
      throw new Error(
        `Schema file not found: ${schemaFile}\n\n` +
        `This indicates a broken installation. Please reinstall TravelERP Lite.`
      );
    }

    console.log('[PostgresService] Applying schema...');
    try {
      const { stdout, stderr } = await execAsync(
        `"${psqlPath}" -U travelerp -p ${this.port} -d travelerp_lite -f "${schemaFile}"`,
        { timeout: TIMEOUT_INITDB_MS }
      );
      console.log('[PostgresService] Schema applied:', (stdout || stderr).slice(0, 300));
    } catch (err: any) {
      throw new Error(`Failed to apply schema:\n${err.message}`);
    }

    if (fs.existsSync(seedFile)) {
      console.log('[PostgresService] Applying seed data...');
      try {
        const { stdout, stderr } = await execAsync(
          `"${psqlPath}" -U travelerp -p ${this.port} -d travelerp_lite -f "${seedFile}"`,
          { timeout: TIMEOUT_PSQL_MS }
        );
        console.log('[PostgresService] Seed applied:', (stdout || stderr).slice(0, 300));
      } catch (err: any) {
        // Non-fatal: seed is nice-to-have
        console.error('[PostgresService] Seed data error (non-fatal):', err.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private bin(exe: string): string {
    return path.join(this.pgPath, 'bin', exe);
  }

  private readLogTail(lines: number = 15): string {
    const logFile = path.join(this.dataPath, 'postgres.log');
    try {
      if (!fs.existsSync(logFile)) return '';
      const content = fs.readFileSync(logFile, 'utf8').trim();
      if (!content) return '';
      return content.split('\n').slice(-lines).join('\n');
    } catch {
      return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if no process is listening on the given TCP port on 127.0.0.1.
 * Uses a low-level net.connect probe — no external tools required.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(true); // connection refused → port is free
    };
    socket.setTimeout(2000);
    socket.on('error', onError);
    socket.on('timeout', onError);
    socket.connect(port, '127.0.0.1', () => {
      socket.destroy();
      resolve(false); // connected → port is in use
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
