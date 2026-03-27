# TravelERP Lite - Project Plan & Task Breakdown

**Project:** TravelERP Lite Desktop Application
**Timeline:** 13 Weeks (13th March 2026 - 12th June 2026)
**Status:** Planning Phase

---

## Overview

This document breaks down the TravelERP Lite development into actionable tasks with dependencies, deliverables, and timelines. Each phase has clear success criteria and checkpoints.

---

## Phase 1: Foundation (Weeks 1-2)
**Duration:** 10 business days
**Start:** Week 1, Day 1
**End:** Week 2, Day 10

### 1.1 Electron Project Setup (3 days)

**Tasks:**

**Day 1:**
- [ ] Create new GitHub repository: `travelerp-lite`
- [ ] Initialize new project with Electron
- [ ] Set up project structure:
  ```
  travelerp-lite/
  ├── electron/
  │   ├── main.ts
  │   ├── preload.ts
  │   └── window-manager.ts
  ├── src/ (React frontend - symlink or copy from travelerp)
  ├── server/ (Express backend - symlink or copy from travelerp)
  ├── build/
  │   ├── icon.ico
  │   └── installer-script.nsi
  ├── package.json
  ├── electron-builder.yml
  └── tsconfig.json
  ```
- [ ] Configure Electron Builder
- [ ] Set up development hot-reload (electron-reload)
- [ ] Test basic Electron window launches

**Day 2:**
- [ ] Copy existing React frontend to `src/`
- [ ] Copy existing Express backend to `server/`
- [ ] Update import paths for Electron structure
- [ ] Configure Vite to build for Electron renderer
- [ ] Test React app loads in Electron window

**Day 3:**
- [ ] Copy Express backend to `server/`
- [ ] Configure Express to run as child process
- [ ] Test Express server starts from Electron main process
- [ ] Verify React app can call Express APIs
- [ ] Test full stack: Electron → React → Express → Postgres

**Deliverables:**
- ✅ GitHub repository created
- ✅ Electron app launches successfully
- ✅ React frontend loads in Electron window
- ✅ Express backend runs as child process
- ✅ Frontend can call backend APIs

**Dependencies:** None

**Estimated Effort:** 24 hours

---

### 1.2 PostgreSQL Bundling (4 days)

**Tasks:**

**Day 4:**
- [ ] Download PostgreSQL 14/15 portable for Windows x64
- [ ] Extract and organize files:
  ```
  build/postgres/
  ├── bin/
  │   ├── initdb.exe
  │   ├── pg_ctl.exe
  │   ├── postgres.exe
  │   ├── createdb.exe
  │   └── psql.exe
  ├── lib/
  ├── share/
  └── data/ (empty, will be created at runtime)
  ```
- [ ] Test PostgreSQL binaries work standalone
- [ ] Test `initdb` creates data directory

**Day 5:**
- [ ] Create database initialization script:
  ```typescript
  // server/src/db/init.ts
  export async function initializeDatabase(): Promise<void> {
    // 1. Check if data directory exists
    // 2. Run initdb if needed
    // 3. Start postgres service
    // 4. Create travelerp_lite database
    // 5. Run schema.sql
    // 6. Run seed data
  }
  ```
- [ ] Test database creation on clean machine
- [ ] Verify connection with `pg` driver
- [ ] Test basic CRUD operations

**Day 6:**
- [ ] Create PostgreSQL service manager:
  ```typescript
  // electron/postgres-service.ts
  export async function startPostgresService(): Promise<boolean>
  export async function stopPostgresService(): Promise<boolean>
  export async function restartPostgresService(): Promise<boolean>
  export async function isPostgresRunning(): Promise<boolean>
  ```
- [ ] Test service start/stop/restart
- [ ] Test service auto-starts on app launch
- [ ] Test service stops gracefully on app exit

**Day 7:**
- [ ] Optimize postgresql.conf for desktop use:
  - Set shared_buffers = 128MB
  - Set max_connections = 10
  - Configure logging to AppData
  - Enable SSL off (local only)
- [ ] Test with 1000 records
- [ ] Test with 10,000 records
- [ ] Verify memory usage < 200MB

**Deliverables:**
- ✅ PostgreSQL binaries bundled
- ✅ Database initializes automatically
- ✅ Service manager working
- ✅ Connection pool configured
- ✅ Performance tested (10K records)

**Dependencies:**
- Requires: Electron Project Setup (1.1)
- Blocks: Licensing System (2.2)

**Estimated Effort:** 32 hours

---

### 1.3 Windows Installer (3 days)

**Tasks:**

**Day 8:**
- [ ] Create NSIS installer script:
  ```nsis
  ; build/installer.nsi
  ; - Extract PostgreSQL to Program Files
  ; - Initialize database
  ; - Install application files
  ; - Create shortcuts
  ; - Start service
  ```
- [ ] Configure electron-builder.yml:
  ```yaml
  win:
    target: nsis
    icon: build/icon.ico

  nsis:
    oneClick: false
    allowToChangeInstallationDirectory: true
    createDesktopShortcut: always
    createStartMenuShortcut: true
    installerIcon: build/icon.ico
    uninstallerIcon: build/icon.ico
  ```
- [ ] Create app icon (icon.ico) from logo

**Day 9:**
- [ ] Configure build scripts:
  ```json
  {
    "scripts": {
      "build": "npm run build:frontend && npm run build:backend",
      "build:frontend": "cd src && vite build",
      "build:backend": "cd server && tsc",
      "build:electron": "electron-builder"
    }
  }
  ```
- [ ] Test build process
- [ ] Verify all files included in installer

**Day 10:**
- [ ] Test installer on clean Windows 10 machine
- [ ] Test installer on clean Windows 11 machine (if available)
- [ ] Verify uninstall removes all files
- [ ] Test upgrade from previous version (if exists)
- [ ] Document system requirements

**Deliverables:**
- ✅ NSIS installer script created
- ✅ Build process working
- ✅ Installer tested on clean machines
- ✅ Uninstall tested
- ✅ System requirements documented

**Dependencies:**
- Requires: Electron Project Setup (1.1), PostgreSQL Bundling (1.2)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 24 hours

---

## Phase 2: Licensing System (Weeks 3-4)
**Duration:** 10 business days
**Start:** Week 3, Day 11
**End:** Week 4, Day 20

### 2.1 Key Generation Algorithm (2 days)

**Tasks:**

**Day 11:**
- [ ] Design product key format:
  - Finalize: GT01-TTXX-YYYY-ZZZZ-CCCC
  - Document: TT = type, XX/YY/ZZ = random, CCCC = checksum
- [ ] Implement HMAC-SHA256 key generator:
  ```typescript
  // server/src/license/key-generator.ts
  export function generateProductKey(
    type: 'monthly' | 'quarterly' | 'annual'
  ): string
  export function generateKeyPool(
    monthly: number,
    quarterly: number,
    annual: number
  ): KeyPool
  ```
- [ ] Create CLI tool for key generation:
  ```bash
  npm run generate:keys -- --monthly 100 --quarterly 50 --annual 20
  ```

**Day 12:**
- [ ] Implement key validation:
  ```typescript
  export function validateProductKeyFormat(
    key: string
  ): ValidationResult
  export function verifyChecksum(
    key: string,
    secret: string
  ): boolean
  export function extractKeyType(
    key: string
  ): 'monthly' | 'quarterly' | 'annual'
  ```
- [ ] Write unit tests for key generation
- [ ] Write unit tests for key validation
- [ ] Test with 1000 random keys
- [ ] Verify no duplicate keys

**Deliverables:**
- ✅ Key generator implemented
- ✅ Key validation implemented
- ✅ CLI tool created
- ✅ Unit tests passing
- ✅ Key format documented

**Dependencies:**
- Requires: Foundation (Phase 1)
- Blocks: License Validation (2.2)

**Estimated Effort:** 16 hours

---

### 2.2 License Validation System (3 days)

**Tasks:**

**Day 13:**
- [ ] Create database schema:
  ```sql
  CREATE TABLE license_pool (...);
  CREATE TABLE licenses (...);
  CREATE TABLE license_logs (...);
  ```
- [ ] Implement database operations:
  ```typescript
  // server/src/license/db.ts
  export async function addToLicensePool(key: string, type: string)
  export async function activateLicense(
    key: string,
    hardwareFingerprint: string
  )
  export async function getCurrentLicense()
  export async function updateLicenseLastVerified(id: string)
  ```
- [ ] Create migrations for license tables

**Day 14:**
- [ ] Implement hardware fingerprinting:
  ```typescript
  // server/src/license/fingerprint.ts
  export async function getHardwareFingerprint(): Promise<string>
  // Uses: CPU ID, MAC address, Machine GUID, Volume serial
  ```
- [ ] Implement license activation flow:
  ```typescript
  export async function activateLicense(
    productKey: string
  ): Promise<ActivationResult>
  ```
- [ ] Implement subscription expiry calculation:
  ```typescript
  export function calculateExpiryDate(
    type: string,
    activationDate: Date
  ): Date
  export function getLicenseStatus(
    license: License
  ): 'active' | 'grace' | 'readonly' | 'expired'
  ```

**Day 15:**
- [ ] Create Express middleware:
  ```typescript
  // server/src/middleware/license-check.ts
  export async function licenseCheck(
    req: Request,
    res: Response,
    next: NextFunction
  )
  ```
- [ ] Implement tamper detection:
  - Detect system time rollback
  - Validate hardware fingerprint on startup
  - Checksum validation of license records
- [ ] Add license check to all API routes
- [ ] Test all license states (active, grace, readonly, expired)

**Deliverables:**
- ✅ Database schema created
- ✅ License activation working
- ✅ Hardware fingerprinting implemented
- ✅ Middleware enforcing license states
- ✅ Tamper detection implemented

**Dependencies:**
- Requires: Key Generation (2.1), PostgreSQL Bundling (1.2)
- Blocks: First-Run Wizard (2.3)

**Estimated Effort:** 24 hours

---

### 2.3 First-Run Wizard (3 days)

**Tasks:**

**Day 16:**
- [ ] Design wizard UI components:
  ```tsx
  // src/components/Wizard/
  ├── FirstRunWizard.tsx
  ├── WelcomeStep.tsx
  ├── CompanyInfoStep.tsx
  ├── LicenseActivationStep.tsx
  └── DataImportChoiceStep.tsx
  ```
- [ ] Create wizard navigation logic
- [ ] Implement form validation for each step

**Day 17:**
- [ ] Implement company info form:
  ```tsx
  interface CompanySettings {
    company_name: string;
    business_address: string;
    city: string;
    state: string;
    pin_code: string;
    gst_number?: string;
    phone: string;
    email: string;
  }
  ```
- [ ] Save company settings to database
- [ ] Test company info step

**Day 18:**
- [ ] Implement license activation step:
  ```tsx
  interface LicenseActivationProps {
    onActivated: (license: License) => void;
  }
  ```
- [ ] Add product key input with auto-formatting
  - Auto-format: XXXX-XXXX-XXXX-XXXX
  - Validate format on blur
  - Show validation feedback
- [ ] Call license activation API
- [ ] Show success/error messages
- [ ] Test activation flow

**Day 19:**
- [ ] Implement data import choice step:
  ```tsx
  interface DataImportChoiceProps {
    onChoice: (choice: 'import' | 'fresh' | 'later') => void;
  }
  ```
- [ ] Add navigation buttons (Back, Next, Skip)
- [ ] Save wizard progress (allow resume if interrupted)
- [ ] Test complete wizard flow

**Day 20:**
- [ ] Add wizard state persistence:
  ```typescript
  // Save wizard state to localStorage
  // Allow resuming wizard if app closes
  ```
- [ ] Test wizard interruption and resume
- [ ] Test all error scenarios
- [ ] Polish UI/UX
- [ ] Write E2E tests for wizard

**Deliverables:**
- ✅ First-run wizard UI complete
- ✅ Company info step working
- ✅ License activation step working
- ✅ Data import choice step working
- ✅ Wizard persistence implemented
- ✅ E2E tests passing

**Dependencies:**
- Requires: License Validation (2.2)
- Blocks: Data Import Wizard (3.1)

**Estimated Effort:** 40 hours

---

### 2.4 License State Enforcement (2 days)

**Tasks:**

**Day 21:**
- [ ] Implement license state indicators in UI:
  ```tsx
  // src/components/License/
  ├── LicenseBadge.tsx  // Shows current state
  ├── LicenseWarning.tsx  // Warning banner
  └── LicenseLockedScreen.tsx  // Full lockdown
  ```
- [ ] Add license status polling (every 5 minutes)
- [ ] Test all states display correctly

**Day 22:**
- [ ] Implement graceful degradation:
  - Active: Full access, green badge
  - Grace: Full access, yellow badge, warning
  - Readonly: GET requests only, orange badge
  - Expired: Lockdown screen, red badge
- [ ] Test state transitions
- [ ] Test PDF blocking in readonly mode
- [ ] Test edit blocking in readonly mode

**Deliverables:**
- ✅ License state indicators in UI
- ✅ Graceful degradation working
- ✅ All states tested

**Dependencies:**
- Requires: License Validation (2.2), First-Run Wizard (2.3)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 16 hours

---

## Phase 3: Data Import Wizard (Week 5)
**Duration:** 5 business days
**Start:** Week 5, Day 23
**End:** Week 5, Day 27

### 3.1 Import File Formats (2 days)

**Tasks:**

**Day 23:**
- [ ] Define Excel/CSV templates:
  - customers.csv
  - vehicle_categories.csv
  - rate_charts.csv
  - vehicles.csv
  - drivers.csv
- [ ] Create template files with sample data
- [ ] Document template structure in user guide
- [ ] Define JSON import format:
  ```json
  {
    "customers": [...],
    "vehicle_categories": [...],
    "rate_charts": [...],
    "vehicles": [...],
    "drivers": [...]
  }
  ```

**Day 24:**
- [ ] Implement Excel parser:
  ```typescript
  // server/src/import/excel-parser.ts
  export async function parseExcelFile(
    file: File
  ): Promise<ImportData>
  ```
- [ ] Implement CSV parser:
  ```typescript
  export async function parseCSVFile(
    file: File
  ): Promise<ImportData>
  ```
- [ ] Implement JSON parser:
  ```typescript
  export async function parseJSONFile(
    file: File
  ): Promise<ImportData>
  ```
- [ ] Test parsers with valid files
- [ ] Test parsers with invalid files

**Deliverables:**
- ✅ Excel/CSV templates created
- ✅ JSON format defined
- ✅ Parsers implemented and tested

**Dependencies:**
- Requires: First-Run Wizard (2.3)
- Blocks: Import Logic & Validation (3.2)

**Estimated Effort:** 16 hours

---

### 3.2 Import Logic & Validation (2 days)

**Tasks:**

**Day 25:**
- [ ] Implement validation for each entity:
  ```typescript
  // server/src/import/validators/
  ├── customer-validator.ts
  ├── vehicle-category-validator.ts
  ├── rate-chart-validator.ts
  ├── vehicle-validator.ts
  └── driver-validator.ts
  ```
- [ ] Add duplicate detection:
  ```typescript
  export async function checkDuplicate(
    entity: string,
    data: any
  ): Promise<boolean>
  ```
- [ ] Implement foreign key validation:
  ```typescript
  export async function validateForeignKeys(
    data: ImportData
  ): Promise<ValidationResult>
  ```

**Day 26:**
- [ ] Implement import transaction:
  ```typescript
  export async function importData(
    data: ImportData,
    options: ImportOptions
  ): Promise<ImportResult>
  ```
- [ ] Add partial import support (skip invalid rows)
- [ ] Implement import progress tracking:
  ```typescript
  export class ImportProgressTracker {
    onProgress(callback: (progress: ImportProgress) => void)
  }
  ```

**Deliverables:**
- ✅ Validation rules implemented
- ✅ Duplicate detection working
- ✅ Foreign key validation working
- ✅ Import transaction implemented
- ✅ Progress tracking working

**Dependencies:**
- Requires: Import File Formats (3.1)
- Blocks: Import Wizard UI (3.3)

**Estimated Effort:** 16 hours

---

### 3.3 Import Wizard UI (1 day)

**Tasks:**

**Day 27:**
- [ ] Create import wizard UI:
  ```tsx
  // src/components/Import/
  ├── DataImportWizard.tsx
  ├── FileUploadStep.tsx
  ├── ImportPreviewStep.tsx
  ├── ImportProgressStep.tsx
  └── ImportSummaryStep.tsx
  ```
- [ ] Implement file upload with drag-and-drop
- [ ] Show import preview with validation errors
- [ ] Show import progress with real-time updates
- [ ] Show import summary with success/error counts
- [ ] Test complete import flow
- [ ] Write E2E tests

**Deliverables:**
- ✅ Import wizard UI complete
- ✅ File upload working
- ✅ Preview/validation working
- ✅ Progress tracking working
- ✅ Summary showing correctly
- ✅ E2E tests passing

**Dependencies:**
- Requires: Import Logic & Validation (3.2)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 8 hours

---

## Phase 4: Auto-Updater (Week 6)
**Duration:** 5 business days
**Start:** Week 6, Day 28
**End:** Week 6, Day 32

### 4.1 Update Server Setup (2 days)

**Tasks:**

**Day 28:**
- [ ] Set up update server:
  - Create `releases.intelligrup.com` directory structure
  - Configure HTTPS/SSL certificate
  - Set up file permissions
- [ ] Create `latest.json` endpoint:
  ```json
  {
    "version": "1.0.0",
    "release_date": "2026-03-25T10:30:00Z",
    "installer_url": "...",
    "size_bytes": 185000000,
    "mandatory": false,
    "changelog": "..."
  }
  ```
- [ ] Test endpoint accessibility

**Day 29:**
- [ ] Create release directory structure:
  ```
  releases/
  ├── 1.0.0/
  │   ├── TravelERP-Lite-Setup-1.0.0.exe
  │   ├── RELEASES.json
  │   └── notes.md
  └── latest.json
  ```
- [ ] Create `RELEASES.json` generator:
  ```typescript
  // scripts/generate-release-json.ts
  export function generateReleasesJSON(
    version: string,
    files: string[]
  ): ReleasesJSON
  ```
- [ ] Test update endpoint with sample release

**Deliverables:**
- ✅ Update server set up
- ✅ `latest.json` endpoint working
- ✅ Release directory structure created
- ✅ `RELEASES.json` generator working

**Dependencies:**
- Requires: Foundation (Phase 1)
- Blocks: Electron Auto-Updater (4.2)

**Estimated Effort:** 16 hours

---

### 4.2 Electron Auto-Updater (2 days)

**Tasks:**

**Day 30:**
- [ ] Install `electron-updater`
- [ ] Configure auto-updater in main process:
  ```typescript
  // electron/main.ts
  import { autoUpdater } from 'electron-updater'

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://releases.intelligrup.com/travelerp-lite'
  })

  autoUpdater.checkForUpdatesAndNotify()
  ```
- [ ] Implement update check on startup (if internet available)
- [ ] Implement manual update check (Help menu)

**Day 31:**
- [ ] Create update notification dialogs:
  ```typescript
  // electron/update-handler.ts
  autoUpdater.on('update-available', (info) => {
    // Show notification
  })

  autoUpdater.on('update-downloaded', (info) => {
    // Show dialog with "Install Now" button
  })
  ```
- [ ] Add "Check for Updates" menu item
- [ ] Create About dialog with version info
- [ ] Test update flow (1.0.0 → 1.0.1)

**Deliverables:**
- ✅ Auto-updater configured
- ✅ Update check on startup working
- ✅ Manual update check working
- ✅ Update notifications working
- ✅ Update flow tested

**Dependencies:**
- Requires: Update Server Setup (4.1)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 16 hours

---

### 4.3 Update Build Process (1 day)

**Tasks:**

**Day 32:**
- [ ] Create release build script:
  ```bash
  npm run release -- --version 1.0.0
  ```
- [ ] Automate `RELEASES.json` generation
- [ ] Automate upload to release server
- [ ] Test complete release process
- [ ] Document release process for future

**Deliverables:**
- ✅ Release build script created
- ✅ Automated upload working
- ✅ Release process documented

**Dependencies:**
- Requires: Electron Auto-Updater (4.2)
- Blocks: Production Release (9.1)

**Estimated Effort:** 8 hours

---

## Phase 5: Multi-User Network Mode (Weeks 7-8)
**Duration:** 10 business days
**Start:** Week 7, Day 33
**End:** Week 8, Day 42

### 5.1 Network Mode Architecture (3 days)

**Tasks:**

**Day 33:**
- [ ] Design server vs client mode:
  ```typescript
  // electron/mode.ts
  export enum AppMode {
    STANDALONE = 'standalone',
    SERVER = 'server',
    CLIENT = 'client'
  }
  ```
- [ ] Create mode selection dialog (first-run)
- [ ] Implement mode detection (check config file)

**Day 34:**
- [ ] Configure PostgreSQL for remote connections:
  ```ini
  # postgresql.conf
  listen_addresses = '*'
  port = 5432
  max_connections = 10
  ```
- [ ] Configure `pg_hba.conf` for LAN access:
  ```
  host    all             all             192.168.0.0/16          md5
  host    all             all             10.0.0.0/8              md5
  ```
- [ ] Test remote connection from another machine

**Day 35:**
- [ ] Create connection dialog:
  ```tsx
  // src/components/Connection/
  ├── ServerModeDialog.tsx
  ├── ClientModeDialog.tsx
  └── ConnectionSettings.tsx
  ```
- [ ] Implement server IP input for client mode
- [ ] Test connection to server
- [ ] Test connection failure handling

**Deliverables:**
- ✅ Mode selection working
- ✅ PostgreSQL configured for remote connections
- ✅ Connection dialog implemented
- ✅ Remote connection tested

**Dependencies:**
- Requires: Foundation (Phase 1)
- Blocks: Server Mode (5.2), Client Mode (5.3)

**Estimated Effort:** 24 hours

---

### 5.2 Server Mode (3 days)

**Tasks:**

**Day 36:**
- [ ] Implement headless server mode:
  ```typescript
  // electron/server-mode.ts
  export async function startServerMode()
  export async function stopServerMode()
  export function getServerStatus(): ServerStatus
  ```
- [ ] Add server status indicator in system tray
- [ ] Create server management UI (start/stop/restart)

**Day 37:**
- [ ] Implement connection pooling:
  ```typescript
  // server/src/db/pool.ts
  export const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'travelerp_lite',
    max: 10
  })
  ```
- [ ] Add connection monitoring
- [ ] Test with 5 concurrent connections

**Day 38:**
- [ ] Add server logging:
  - Log client connections
  - Log queries
  - Log errors
- [ ] Test server startup/shutdown
- [ ] Test server with multiple clients
- [ ] Write integration tests

**Deliverables:**
- ✅ Server mode implemented
- ✅ Connection pooling working
- ✅ Server monitoring working
- ✅ Tested with multiple clients

**Dependencies:**
- Requires: Network Mode Architecture (5.1)
- Blocks: Client Mode (5.3)

**Estimated Effort:** 24 hours

---

### 5.3 Client Mode (3 days)

**Tasks:**

**Day 39:**
- [ ] Implement client mode:
  ```typescript
  // electron/client-mode.ts
  export async function connectToServer(
    serverIP: string,
    port: number
  ): Promise<boolean>
  export async function disconnectFromServer()
  export function getConnectionStatus(): ConnectionStatus
  ```
- [ ] Add connection status indicator
- [ ] Implement automatic reconnection

**Day 40:**
- [ ] Create connection settings UI:
  ```tsx
  // src/components/Settings/
  ├── ConnectionSettings.tsx
  ├── ServerList.tsx
  └── ConnectionStatus.tsx
  ```
- [ ] Save connection settings to config
- [ ] Test connection to different servers

**Day 41:**
- [ ] Implement offline detection:
  ```typescript
  export async function checkServerConnection()
  export function onConnectionLost(callback)
  export function onConnectionRestored(callback)
  ```
- [ ] Show offline banner when connection lost
- [ ] Queue operations when offline (future)
- [ ] Test connection loss and recovery

**Day 42:**
- [ ] Test concurrent user scenarios:
  - 5 users creating trips simultaneously
  - 5 users generating invoices simultaneously
  - 5 users editing different records
- [ ] Test for deadlocks
- [ ] Test for data corruption
- [ ] Write integration tests
- [ ] Performance test with 5 users

**Deliverables:**
- ✅ Client mode implemented
- ✅ Connection settings UI working
- ✅ Offline detection working
- ✅ Concurrent access tested
- ✅ No deadlocks or corruption

**Dependencies:**
- Requires: Network Mode Architecture (5.1), Server Mode (5.2)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 32 hours

---

## Phase 6: Backup & Restore (Week 9)
**Duration:** 5 business days
**Start:** Week 9, Day 43
**End:** Week 9, Day 47

### 6.1 Backup System (3 days)

**Tasks:**

**Day 43:**
- [ ] Implement `pg_dump` integration:
  ```typescript
  // server/src/backup/dump.ts
  export async function createBackup(
    type: 'auto' | 'manual'
  ): Promise<string>
  export async function listBackups(): Promise<Backup[]>
  export async function deleteBackup(id: string)
  ```
- [ ] Configure backup directory structure
- [ ] Test backup creation

**Day 44:**
- [ ] Implement automatic daily backups:
  ```typescript
  // electron/backup-scheduler.ts
  export function scheduleBackupScheduler()
  ```
- [ ] Schedule for 8:00 AM daily
- [ ] Implement backup retention (30 days)
- [ ] Test scheduler

**Day 45:**
- [ ] Implement backup compression:
  ```typescript
  export async function compressBackup(
    backupPath: string
  ): Promise<string>
  ```
- [ ] Test backup size reduction
- [ ] Implement backup cleanup:
  ```typescript
  export async function cleanOldBackups(
    retentionDays: number
  )
  ```

**Deliverables:**
- ✅ Backup system implemented
- ✅ Automatic backups working
- ✅ Backup compression working
- ✅ Backup cleanup working

**Dependencies:**
- Requires: Foundation (Phase 1)
- Blocks: Restore System (6.2)

**Estimated Effort:** 24 hours

---

### 6.2 Restore System (2 days)

**Tasks:**

**Day 46:**
- [ ] Implement `pg_restore` integration:
  ```typescript
  export async function restoreBackup(
    backupPath: string
  ): Promise<void>
  ```
- [ ] Add pre-restore backup (safety):
  ```typescript
  export async function restoreWithSafetyBackup(
    backupPath: string
  ): Promise<void>
  ```
- [ ] Test restore on clean machine

**Day 47:**
- [ ] Create backup/restore UI:
  ```tsx
  // src/components/Backup/
  ├── BackupManager.tsx
  ├── BackupList.tsx
  ├── RestoreDialog.tsx
  └── BackupSettings.tsx
  ```
- [ ] Add backup history view
- [ ] Add restore confirmation dialog
- [ ] Test complete backup/restore flow
- [ ] Test with 10,000 records
- [ ] Verify data integrity

**Deliverables:**
- ✅ Restore system implemented
- ✅ Backup/restore UI working
- ✅ Restore tested with large datasets
- ✅ Data integrity verified

**Dependencies:**
- Requires: Backup System (6.1)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 16 hours

---

## Phase 7: Testing & QA (Week 10)
**Duration:** 5 business days
**Start:** Week 10, Day 48
**End:** Week 10, Day 52

### 7.1 Unit Tests (2 days)

**Tasks:**

**Day 48:**
- [ ] Write unit tests for rate calculations
- [ ] Write unit tests for tax calculations
- [ ] Write unit tests for license validation
- [ ] Write unit tests for data validation
- [ ] Target: 80%+ code coverage

**Day 49:**
- [ ] Write unit tests for import logic
- [ ] Write unit tests for export logic
- [ ] Write unit tests for backup/restore
- [ ] Fix any failing tests
- [ ] Generate coverage report

**Deliverables:**
- ✅ Unit tests written
- ✅ 80%+ coverage achieved
- ✅ All tests passing

**Dependencies:**
- Requires: All previous phases
- Blocks: Integration Tests (7.2)

**Estimated Effort:** 16 hours

---

### 7.2 Integration Tests (1 day)

**Tasks:**

**Day 50:**
- [ ] Write integration tests for API endpoints
- [ ] Write integration tests for database operations
- [ ] Write integration tests for PDF generation
- [ ] Write integration tests for license middleware
- [ ] Test with test database

**Deliverables:**
- ✅ Integration tests written
- ✅ All tests passing

**Dependencies:**
- Requires: Unit Tests (7.1)
- Blocks: E2E Tests (7.3)

**Estimated Effort:** 8 hours

---

### 7.3 End-to-End Tests (2 days)

**Tasks:**

**Day 51:**
- [ ] Write E2E tests for first-run wizard
- [ ] Write E2E tests for license activation
- [ ] Write E2E tests for trip creation flow
- [ ] Write E2E tests for invoice generation
- [ ] Write E2E tests for PDF download

**Day 52:**
- [ ] Write E2E tests for data import
- [ ] Write E2E tests for license expiry
- [ ] Write E2E tests for backup/restore
- [ ] Fix any failing tests
- [ ] Run full test suite

**Deliverables:**
- ✅ E2E tests written
- ✅ All tests passing
- ✅ Test suite complete

**Dependencies:**
- Requires: Integration Tests (7.2)
- Blocks: Beta Testing (8.1)

**Estimated Effort:** 16 hours

---

## Phase 8: Beta Release & Feedback (Weeks 11-12)
**Duration:** 10 business days
**Start:** Week 11, Day 53
**End:** Week 12, Day 62

### 8.1 Beta Release Preparation (3 days)

**Tasks:**

**Day 53:**
- [ ] Tag beta version: `v1.0.0-beta.1`
- [ ] Create beta build
- [ ] Test installer on clean machine
- [ ] Create beta release notes

**Day 54:**
- [ ] Generate license keys for Gayatri Travels
- [ ] Create beta installer
- [ ] Prepare deployment package
- [ ] Set up beta environment

**Day 55:**
- [ ] Create user documentation:
  - Installation guide
  - First-run setup guide
  - Feature overview
  - FAQ
- [ ] Record video tutorials:
  - Installation walkthrough
  - First-run setup
  - Creating trips
  - Generating invoices

**Deliverables:**
- ✅ Beta version tagged
- ✅ Beta installer created
- ✅ License keys generated
- ✅ Documentation complete
- ✅ Video tutorials recorded

**Dependencies:**
- Requires: Testing & QA (Phase 7)
- Blocks: Beta Deployment (8.2)

**Estimated Effort:** 24 hours

---

### 8.2 Beta Deployment (2 days)

**Tasks:**

**Day 56:**
- [ ] Deploy beta to Gayatri Travels
- [ ] Conduct training session
- [ ] Provide support contact information
- [ ] Monitor initial usage

**Day 57:**
- [ ] Set up bug tracking system (GitHub Issues)
- [ ] Create feedback form
- [ ] Monitor error logs
- [ ] Respond to initial issues

**Deliverables:**
- ✅ Beta deployed
- ✅ Training completed
- ✅ Support channels established
- ✅ Bug tracking set up

**Dependencies:**
- Requires: Beta Release Preparation (8.1)
- Blocks: Beta Feedback Loop (8.3)

**Estimated Effort:** 16 hours

---

### 8.3 Beta Feedback Loop (5 days)

**Tasks:**

**Day 58-62:**
- [ ] Collect feedback from Gayatri Travels
- [ ] Track and categorize issues
- [ ] Prioritize bugs (critical, major, minor)
- [ ] Fix critical bugs immediately
- [ ] Release beta.2, beta.3 as needed
- [ ] Incorporate user feedback
- [ ] Refine UX issues
- [ ] Performance tuning
- [ ] Document lessons learned

**Deliverables:**
- ✅ Feedback collected
- ✅ Critical bugs fixed
- [ ] Beta.2/beta.3 released if needed
- ✅ UX refinements complete
- ✅ Ready for production

**Dependencies:**
- Requires: Beta Deployment (8.2)
- Blocks: Production Release (9.1)

**Estimated Effort:** 40 hours

---

## Phase 9: Production Release (Week 13)
**Duration:** 5 business days
**Start:** Week 13, Day 63
**End:** Week 13, Day 67

### 9.1 Production Release (5 days)

**Tasks:**

**Day 63:**
- [ ] Fix all remaining beta bugs
- [ ] Final code review
- [ ] Update documentation
- [ ] Create release notes

**Day 64:**
- [ ] Generate full key pool (170 keys)
- [ ] Create final installer
- [ ] Test installer on multiple machines
- [ ] Verify all features working

**Day 65:**
- [ ] Tag production version: `v1.0.0`
- [ ] Create production build
- [ ] Upload to release server
- [ ] Update latest.json

**Day 66:**
- [ ] Prepare release announcement
- [ ] Send announcement to customers
- [ ] Update website/download page
- [ ] Prepare support team

**Day 67:**
- [ ] Monitor release
- [ ] Respond to support requests
- [ ] Track initial metrics
- [ ] Prepare hotfix process
- [ ] Plan v1.1.0 features

**Deliverables:**
- ✅ Production v1.0.0 released
- ✅ Release notes published
- ✅ Documentation updated
- ✅ Support process ready
- ✅ Post-release monitoring active

**Dependencies:**
- Requires: Beta Feedback Loop (8.3)
- Blocks: Post-Release Maintenance (Phase 10)

**Estimated Effort:** 40 hours

---

## Phase 10: Post-Release Maintenance (Ongoing)
**Duration:** Ongoing
**Start:** Week 14, Day 68

### 10.1 Monitoring & Support

**Tasks:**
- [ ] Monitor error logs daily
- [ ] Track performance metrics
- [ ] Gather user feedback
- [ ] Respond to support requests
- [ ] Identify improvement areas

### 10.2 Bug Fixes & Releases

**Tasks:**
- [ ] Release v1.0.1, v1.0.2 as needed
- [ ] Fix reported issues
- [ ] Improve stability

### 10.3 Feature Releases

**Tasks:**
- [ ] Plan v1.1.0 features
- [ ] Plan v1.2.0 features
- [ ] Add requested features
- [ ] Improve UX

### 10.4 Customer Support

**Tasks:**
- [ ] Respond to inquiries
- [ ] Provide training
- [ ] Issue license keys
- [ ] Assist with migrations

---

## Summary

**Total Duration:** 13 weeks (67 business days)
**Total Estimated Effort:** ~600 hours

### Critical Path:
1. Foundation (Phase 1) → Licensing (Phase 2) → Beta (Phase 8) → Production (Phase 9)

### Key Milestones:
- **Week 2:** Electron app running with PostgreSQL
- **Week 4:** License system working
- **Week 6:** Auto-updater working
- **Week 8:** Multi-user mode working
- **Week 10:** All tests passing
- **Week 12:** Beta testing complete
- **Week 13:** Production release

### Risk Mitigation:
- Weekly progress reviews
- Demo after each phase
- Early feedback from Gayatri Travels
- Buffer time in beta phase

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-25
**Next Review:** End of Week 1
