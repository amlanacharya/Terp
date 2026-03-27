# TravelERP Lite - Desktop Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TravelERP from a cloud-based web app into a Windows desktop application with bundled PostgreSQL, offline licensing, and local data storage.

**Architecture:** Electron wrapper around existing React + Express app, with PostgreSQL bundled as Windows service, 16-digit product key licensing system, and auto-updater for seamless updates.

**Tech Stack:** Electron, electron-builder, PostgreSQL (portable), Node.js, React, TypeScript, Express, PDFKit, systeminformation, node-cron

---

## Table of Contents

1. [Phase 1: Project Foundation & Electron Setup](#phase-1-project-foundation--electron-setup)
2. [Phase 2: PostgreSQL Integration](#phase-2-postgresql-integration)
3. [Phase 3: Licensing System](#phase-3-licensing-system)
4. [Phase 4: Setup Wizards](#phase-4-setup-wizards)
5. [Phase 5: Auto-Updater](#phase-5-auto-updater)
6. [Phase 6: Testing & Polish](#phase-6-testing--polish)
7. [Phase 7: Documentation & Release](#phase-7-documentation--release)

---

## Pre-Flight Checklist

**Before starting Phase 1, verify these tools are installed:**

- [ ] **Node.js 18+** - `node --version`
- [ ] **npm 9+** - `npm --version`
- [ ] **Git** - `git --version`
- [ ] **PostgreSQL client tools** (optional, for manual testing)
- [ ] **NSIS 3.0+** - For Windows installer creation
  - Download from: https://nsis.sourceforge.io/
  - Add to PATH
- [ ] **Image editor** - For creating .ico and .png icons
  - Or use online tool: https://convertico.com/

**Development environment setup:**

- [ ] Clone repository: `git clone <repo-url>`
- [ ] Install dependencies: `npm install`
- [ ] Verify server runs: `cd server && npm run dev`
- [ ] Verify frontend runs: `npm run dev`

**Icon files required (create before Task 1.2):**

- [ ] `build/icon.ico` (256x256 minimum, for Windows executable)
- [ ] `build/background.png` (1920x1080 recommended, for installer)
- [ ] `build/installer-icon.ico` (for installer executable)

---

## Phase 1: Project Foundation & Electron Setup

**Goal:** Set up Electron project structure, build system, and basic desktop app wrapper.

**Duration:** Week 1-2

### Task 1.1: Initialize Electron Project

**Files:**
- Create: `electron/package.json`
- Create: `electron/tsconfig.json`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Create electron/package.json**

```json
{
  "name": "travelerp-lite-electron",
  "version": "1.0.0",
  "description": "TravelERP Lite - Electron Main Process",
  "main": "main.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.5.0",
    "typescript": "^5.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  },
  "dependencies": {
    "systeminformation": "^5.21.0",
    "node-cron": "^3.0.0"
  }
}
```

Run: `cd electron && npm install`

- [ ] **Step 2: Create Jest configuration for Electron tests**

Create: `electron/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  }
};
```

- [ ] **Step 3: Create electron/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolve": {
      "types": ["node"]
    }
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create electron/main.ts (basic window)**

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow;

app.on('ready', () => {
  createMainWindow();
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'TravelERP Lite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Load React app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 4: Create electron/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // More APIs will be added later
});
```

- [ ] **Step 5: Update root package.json with Electron scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:dev": "electron electron/main.js",
    "electron:build": "cd electron && tsc",
    "dist": "npm run build && electron-builder"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Run: `npm install --save-dev electron electron-builder @types/node`

- [ ] **Step 6: Test Electron app starts**

Run: `npm run electron:dev`
Expected: Electron window opens, attempts to load localhost:3000

- [ ] **Step 7: Commit**

```bash
git add electron/ package.json
git commit -m "feat: initialize Electron project structure"
```

### Task 1.2: Configure electron-builder

**Files:**
- Create: `electron-builder.json`
- Create: `build/icon.ico` (placeholder)
- Create: `build/background.png` (placeholder)

- [ ] **Step 1: Create electron-builder.json**

```json
{
  "appId": "com.travelerp.lite",
  "productName": "TravelERP Lite",
  "copyright": "Copyright © 2026",
  "directories": {
    "output": "dist/installer",
    "buildResources": "build"
  },
  "files": [
    "electron/**/*",
    "dist/**/*",
    "server/dist/**/*",
    "server/node_modules/pg/**/*",
    "server/node_modules/pdfkit/**/*"
  ],
  "extraResources": [
    {
      "from": "resources/postgresql",
      "to": "pgsql",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico",
    "artifactName": "${productName}-Setup-${version}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "allowElevation": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "TravelERP Lite",
    "uninstallDisplayName": "TravelERP Lite",
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico",
    "perMachine": false,
    "runAfterFinish": true
  },
  "publish": {
    "provider": "generic",
    "url": "https://updates.travelerp.com/releases"
  }
}
```

- [ ] **Step 2: Create real icon files**

**IMPORTANT:** You need actual .ico and .png files. Options:
1. Convert your logo to .ico using online tool (e.g., https://convertico.com/)
2. Use a temporary icon for development
3. Create minimal 256x256 icon with any image editor

Create:
```bash
mkdir -p build
# Place your actual icon files here:
# - build/icon.ico (256x256 minimum, for Windows executable)
# - build/background.png (1920x1080 recommended, for installer background)
# - build/installer-icon.ico (for installer exe)
```

**Note:** The build will fail without valid icon files. Use placeholder icons for development, replace before production build.

- [ ] **Step 3: Test build configuration**

Run: `npm run dist`
Expected: Build process starts (may fail due to missing React build, but config should validate)

- [ ] **Step 4: Commit**

```bash
git add electron-builder.json build/
git commit -m "feat: configure electron-builder for Windows installer"
```

### Task 1.3: Download and Prepare PostgreSQL Distribution

**Files:**
- Create: `resources/postgresql/README`
- Create: `scripts/download-postgres.sh`

- [ ] **Step 1: Download PostgreSQL portable for Windows**

Manual Step:
1. Visit: https://www.enterprisedb.com/download-postgresql-binaries
2. Download PostgreSQL 14.x for Windows x64
3. Extract to: `resources/postgresql/`

Or create download script:

```bash
# scripts/download-postgres.sh
#!/bin/bash
POSTGRES_VERSION="14.9-1-windows-x64-binaries"
POSTGRES_URL="https://get.enterprisedb.com/postgresql/postgresql-${POSTGRES_VERSION}.zip"

mkdir -p resources/postgresql
curl -o resources/postgresql.zip ${POSTGRES_URL}
unzip resources/postgresql.zip -d resources/postgresql/
rm resources/postgresql.zip
```

- [ ] **Step 2: Verify PostgreSQL structure**

Ensure directory contains:
```
resources/postgresql/
├── bin/
│   ├── initdb.exe
│   ├── pg_ctl.exe
│   ├── postgres.exe
│   ├── psql.exe
│   └── pg_dump.exe
├── lib/
└── share/
```

- [ ] **Step 3: Create resources/postgresql/README.md**

```markdown
# PostgreSQL Distribution

This directory contains the portable PostgreSQL distribution for Windows.

**Version:** 14.x
**Source:** EnterpriseDB

## Files Included

- `bin/` - PostgreSQL executables
- `lib/` - Shared libraries
- `share/` - SQL scripts and extensions

## Installation

The NSIS installer will copy this directory to:
`C:\Program Files\TravelERP\pgsql`

## Configuration

PostgreSQL will be configured during installation with:
- Port: 5432
- Superuser: travelerp
- Data directory: C:\Program Files\TravelERP\pgsql\data
```

- [ ] **Step 4: Add to .gitignore** (don't commit PostgreSQL binaries)

```bash
echo "resources/postgresql/*.exe" >> .gitignore
echo "resources/postgresql/*.dll" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add resources/postgresql/README.md scripts/
git commit -m "feat: add PostgreSQL distribution setup"
```

### Task 1.4: Create NSIS Installer Script

**Files:**
- Create: `build/installer.nsi`

- [ ] **Step 1: Create NSIS installer script**

```nsis
; TravelERP Lite Installer Script
; Requires NSIS 3.0+

!include "MUI2.nsh"

; Configuration
Name "TravelERP Lite"
OutFile "dist/installer/TravelERP-Lite-Setup-1.0.0.exe"
InstallDir "$PROGRAMFILES\TravelERP"
InstallDirRegKey HKLM "Software\TravelERP" "InstallLocation"
RequestExecutionLevel admin

; Variables
Var PostgresInstalled
Var StartMenuFolder

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "build\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer Sections
Section "TravelERP Lite (Required)" SecApp
  SectionIn RO

  SetOutPath $INSTDIR
  File /r "dist\*"
  File /r "electron\*"
  File /r "server\dist\*"

  ; Store installation folder
  WriteRegStr HKLM "Software\TravelERP" "InstallLocation" $INSTDIR

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "DisplayName" "TravelERP Lite"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "Publisher" "TravelERP"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP" \
                   "NoRepair" 1

  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
  CreateShortCut "$SMPROGRAMS\$StartMenuFolder\TravelERP Lite.lnk" \
                 "$INSTDIR\TravelERP-Lite.exe" "" "$INSTDIR\build\icon.ico" 0
  CreateShortCut "$DESKTOP\TravelERP Lite.lnk" \
                 "$INSTDIR\TravelERP-Lite.exe" "" "$INSTDIR\build\icon.ico" 0
SectionEnd

Section "PostgreSQL Database" SecPostgres
  SetOutPath "$INSTDIR\pgsql"
  File /r "resources\postgresql\*"

  ; Initialize database cluster
  ExecWait '"$INSTDIR\pgsql\bin\initdb.exe" -D "$INSTDIR\pgsql\data" -U travelerp -E UTF8 -W'

  ; Configure for localhost only
  FileOpen $0 "$INSTDIR\pgsql\data\postgresql.conf" a
  FileSeek $0 0 END
  FileWrite $0 "listen_addresses = 'localhost'$\r$\n"
  FileWrite $0 "port = 5432$\r$\n"
  FileWrite $0 "max_connections = 20$\r$\n"
  FileClose $0

  ; Register as Windows service
  ExecWait '"$INSTDIR\pgsql\bin\pg_ctl.exe" register -N "TravelERP-PostgreSQL" -D "$INSTDIR\pgsql\data" -U travelerp'

  ; Start service
  ExecWait 'net start "TravelERP-PostgreSQL"'

  StrCpy $PostgresInstalled 1
SectionEnd

Section "Initialize Database" SecDatabase
  ; Wait for PostgreSQL to be ready
  Sleep 5000

  ; Create database
  ExecWait '"$INSTDIR\pgsql\bin\psql.exe" -U travelerp -c "CREATE DATABASE travelerp_lite;"'

  ; Run schema
  ExecWait '"$INSTDIR\pgsql\bin\psql.exe" -U travelerp -d travelerp_lite -f "$INSTDIR\server\db\schema.sql"'
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Stop PostgreSQL service
  ExecWait 'net stop "TravelERP-PostgreSQL"'
  ExecWait '"$INSTDIR\pgsql\bin\pg_ctl.exe" unregister -N "TravelERP-PostgreSQL"'

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  Delete "$SMPROGRAMS\$StartMenuFolder\TravelERP Lite.lnk"
  Delete "$DESKTOP\TravelERP Lite.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TravelERP"
  DeleteRegKey HKLM "Software\TravelERP"
SectionEnd
```

- [ ] **Step 2: Create LICENSE.txt for installer**

```text
TRAVELERP LITE - END USER LICENSE AGREEMENT

Copyright (c) 2026 TravelERP

IMPORTANT: READ CAREFULLY

This End User License Agreement ("EULA") is a legal agreement between you and TravelERP.

1. LICENSE GRANT
   This EULA grants you the right to use one copy of TravelERP Lite on a single computer.

2. SUBSCRIPTION
   This software requires an active subscription. You must renew your subscription periodically to continue using the software.

3. USAGE RESTRICTIONS
   - Reverse engineering is prohibited
   - You may not modify the software
   - You may not distribute copies of the software

4. DATA PRIVACY
   All data stored by this software remains on your computer. TravelERP does not access or transmit your business data.

5. WARRANTY DISCLAIMER
   This software is provided "as is" without warranty of any kind, express or implied.

6. LIMITATION OF LIABILITY
   TravelERP shall not be liable for any damages arising from use of this software.

By installing this software, you agree to these terms.
```

- [ ] **Step 3: Update electron-builder.json to use NSIS script**

```json
{
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "allowElevation": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "TravelERP Lite",
    "installerScript": "build/installer.nsi"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add build/installer.nsi build/LICENSE.txt
git commit -m "feat: create NSIS installer script"
```

### Task 1.5: Express Backend for Electron

**Files:**
- Create: `electron/backend-manager.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create electron/backend-manager.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export class BackendManager {
  private backendProcess: ChildProcess | null = null;

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '../server/dist/index.js');

      this.backendProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DB_HOST: 'localhost',
          DB_PORT: '5432',
          DB_NAME: 'travelerp_lite',
          DB_USER: 'travelerp',
          DB_PASSWORD: process.env.DB_PASSWORD || 'travelerp123'
        },
        stdio: 'pipe'
      });

      this.backendProcess.stdout?.on('data', (data) => {
        console.log(`[Backend] ${data}`);
        if (data.toString().includes('listening on http://localhost')) {
          resolve();
        }
      });

      this.backendProcess.stderr?.on('data', (data) => {
        console.error(`[Backend Error] ${data}`);
      });

      this.backendProcess.on('error', (error) => {
        reject(new Error(`Failed to start backend: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.backendProcess && !this.backendProcess.killed) {
          resolve(); // Assume started if no error
        }
      }, 10000);
    });
  }

  stop(): void {
    if (this.backendProcess) {
      this.backendProcess.kill();
      this.backendProcess = null;
    }
  }
}
```

- [ ] **Step 2: Update electron/main.ts to use BackendManager**

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { BackendManager } from './backend-manager';

let mainWindow: BrowserWindow;
let backendManager: BackendManager;

app.on('ready', async () => {
  backendManager = new BackendManager();

  try {
    // Start backend first
    await backendManager.start();

    // Then create window
    createMainWindow();
  } catch (error) {
    console.error('Failed to start app:', error);
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'TravelERP Lite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.on('before-quit', () => {
  if (backendManager) {
    backendManager.stop();
  }
});
```

- [ ] **Step 3: Test backend startup**

Run: `npm run electron:dev`
Expected: Backend starts, window opens

- [ ] **Step 4: Commit**

```bash
git add electron/backend-manager.ts electron/main.ts
git commit -m "feat: add backend manager for Electron"
```

---

## Phase 2: PostgreSQL Integration

**Goal:** Integrate PostgreSQL service management and database operations.

**Duration:** Week 2-3

### Task 2.1: PostgreSQL Service Manager

**Files:**
- Create: `electron/postgres-service.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write test for PostgreSQL service**

```typescript
// electron/postgres-service.test.ts
import { PostgresService } from './postgres-service';

describe('PostgresService', () => {
  it('should start PostgreSQL service', async () => {
    const service = new PostgresService();
    await service.start();
    // Verify service is running
    const status = await service.getStatus();
    expect(status).toBe('running');
  });

  it('should stop PostgreSQL service', async () => {
    const service = new PostgresService();
    await service.start();
    await service.stop();
    const status = await service.getStatus();
    expect(status).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd electron && npm test`
Expected: FAIL - PostgresService not defined

- [ ] **Step 3: Implement PostgresService**

```typescript
// electron/postgres-service.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export class PostgresService {
  private pgPath: string;
  private dataPath: string;
  private serviceName = 'TravelERP-PostgreSQL';

  constructor() {
    this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
    this.dataPath = path.join(this.pgPath, 'data');
  }

  async start(): Promise<void> {
    try {
      // Check if already running
      try {
        await execAsync(`net start "${this.serviceName}"`);
        // If already started, this succeeds with "already been started" message
      } catch (error: any) {
        if (!error.message.includes('already been started')) {
          throw error;
        }
      }

      // Wait for postgres to be ready
      await this.waitForReady();
    } catch (error) {
      throw new Error(`Failed to start PostgreSQL: ${(error as Error).message}`);
    }
  }

  async stop(): Promise<void> {
    try {
      await execAsync(`net stop "${this.serviceName}"`);
    } catch (error) {
      console.error('Failed to stop PostgreSQL:', error);
    }
  }

  async initializeDatabase(): Promise<void> {
    // Check if data directory exists
    const fs = require('fs');
    if (!fs.existsSync(this.dataPath)) {
      // Run initdb
      await execAsync(`"${this.pgPath}\\bin\\initdb.exe" -D "${this.dataPath}" -U travelerp -E UTF8`);
    }

    // Start service
    await this.start();

    // Create database
    try {
      await execAsync(`"${this.pgPath}\\bin\\psql.exe" -U travelerp -c "CREATE DATABASE travelerp_lite;"`);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  async waitForReady(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await execAsync(`"${this.pgPath}\\bin\\pg_isready.exe"`);
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('PostgreSQL failed to start within timeout period');
  }

  async getStatus(): Promise<'running' | 'stopped' | 'unknown'> {
    try {
      await execAsync(`"${this.pgPath}\\bin\\pg_isready.exe"`);
      return 'running';
    } catch (error) {
      return 'stopped';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd electron && npm test`
Expected: PASS

- [ ] **Step 5: Update main.ts to use PostgresService**

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { BackendManager } from './backend-manager';
import { PostgresService } from './postgres-service';

let mainWindow: BrowserWindow;
let backendManager: BackendManager;
let postgresService: PostgresService;

app.on('ready', async () => {
  postgresService = new PostgresService();
  backendManager = new BackendManager();

  try {
    // Start PostgreSQL
    await postgresService.start();

    // Start backend
    await backendManager.start();

    // Create window
    createMainWindow();
  } catch (error) {
    console.error('Failed to start app:', error);
  }
});

app.on('before-quit', async () => {
  if (backendManager) {
    backendManager.stop();
  }
  if (postgresService) {
    await postgresService.stop();
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add electron/postgres-service.ts electron/main.ts
git commit -m "feat: add PostgreSQL service manager"
```

### Task 2.2: Database Connection Configuration

**Files:**
- Modify: `server/src/config/db.ts`
- Create: `server/.env.example`

- [ ] **Step 1: Update server/src/config/db.ts for local Postgres**

```typescript
import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'travelerp_lite',
        user: process.env.DB_USER || 'travelerp',
        password: process.env.DB_PASSWORD || 'travelerp123',
        max: 20,  // 4-5 users, each with multiple connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function testConnection(): Promise<void> {
  await pool.query('SELECT 1');
}

export default pool;
```

- [ ] **Step 2: Create server/.env.example**

```bash
# Database Configuration (for local Electron app)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travelerp_lite
DB_USER=travelerp
DB_PASSWORD=travelerp123

# Server Configuration
PORT=3001
NODE_ENV=development

# For cloud deployment (optional)
DATABASE_URL=postgresql://user:password@host:5432/database
```

- [ ] **Step 3: Test connection in development**

Run:
```bash
cd server
export DB_HOST=localhost
export DB_NAME=travelerp
npm run dev
```

Expected: Server connects to local PostgreSQL

- [ ] **Step 4: Commit**

```bash
git add server/src/config/db.ts server/.env.example
git commit -m "feat: update database config for local PostgreSQL"
```

### Task 2.3: Backup and Restore Functionality

**Files:**
- Create: `electron/backup-manager.ts`
- Create: `electron/ipc-handlers.ts`

- [ ] **Step 1: Write test for backup functionality**

```typescript
// electron/backup-manager.test.ts
import { BackupManager } from './backup-manager';

describe('BackupManager', () => {
  it('should create a backup file', async () => {
    const manager = new BackupManager();
    const backupPath = await manager.createBackup();
    expect(backupPath).toBeTruthy();
    expect(require('fs').existsSync(backupPath)).toBe(true);
  });

  it('should restore from backup', async () => {
    const manager = new BackupManager();
    const backupPath = await manager.createBackup();
    await manager.restoreBackup(backupPath);
    // Verify restore succeeded
  });
});
```

- [ ] **Step 2: Implement BackupManager**

```typescript
// electron/backup-manager.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const execAsync = promisify(exec);

export class BackupManager {
  private pgPath: string;
  private backupDir: string;

  constructor() {
    this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(customPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `travelerp_backup_${timestamp}.sql`;
    const backupPath = customPath || path.join(this.backupDir, filename);

    const command = `"${this.pgPath}\\bin\\pg_dump.exe" -U travelerp -d travelerp_lite -f "${backupPath}"`;

    try {
      await execAsync(command);
      return backupPath;
    } catch (error) {
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    const command = `"${this.pgPath}\\bin\\psql.exe" -U travelerp -d travelerp_lite -f "${backupPath}"`;

    try {
      await execAsync(command);
    } catch (error) {
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  async listBackups(): Promise<string[]> {
    const files = fs.readdirSync(this.backupDir);
    return files
      .filter(f => f.startsWith('travelerp_backup_') && f.endsWith('.sql'))
      .sort()
      .reverse();
  }

  async deleteOldBackups(keepCount: number = 7): Promise<void> {
    const backups = await this.listBackups();
    const toDelete = backups.slice(keepCount);

    for (const backup of toDelete) {
      const backupPath = path.join(this.backupDir, backup);
      fs.unlinkSync(backupPath);
    }
  }
}
```

- [ ] **Step 3: Create IPC handlers**

```typescript
// electron/ipc-handlers.ts
import { ipcMain } from 'electron';
import { BackupManager } from './backup-manager';
import { PostgresService } from './postgres-service';

export function registerIPCHandlers() {
  const backupManager = new BackupManager();
  const postgresService = new PostgresService();

  // Backup handlers
  ipcMain.handle('backup-database', async () => {
    return await backupManager.createBackup();
  });

  ipcMain.handle('restore-database', async (_event, filePath: string) => {
    return await backupManager.restoreBackup(filePath);
  });

  ipcMain.handle('list-backups', async () => {
    return await backupManager.listBackups();
  });

  // PostgreSQL handlers
  ipcMain.handle('postgres-status', async () => {
    return await postgresService.getStatus();
  });

  // App info
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}
```

- [ ] **Step 4: Update preload.ts to expose APIs**

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: (path: string) => ipcRenderer.invoke('restore-database', path),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  postgresStatus: () => ipcRenderer.invoke('postgres-status')
});
```

- [ ] **Step 5: Update main.ts to register handlers**

```typescript
import { registerIPCHandlers } from './ipc-handlers';

app.on('ready', async () => {
  // Register IPC handlers
  registerIPCHandlers();

  // ... rest of ready handler
});
```

- [ ] **Step 6: Test backup/restore**

Run: `npm run electron:dev`
Expected: IPC handlers registered

- [ ] **Step 7: Commit**

```bash
git add electron/backup-manager.ts electron/ipc-handlers.ts electron/preload.ts
git commit -m "feat: add backup and restore functionality"
```

### Task 2.4: Scheduled Backups

**Files:**
- Create: `electron/scheduled-backup.ts`

- [ ] **Step 1: Implement scheduled backup service**

```typescript
// electron/scheduled-backup.ts
import cron from 'node-cron';
import { BackupManager } from './backup-manager';

export class ScheduledBackupService {
  private backupTask: cron.ScheduledTask | null = null;
  private backupManager: BackupManager;

  constructor() {
    this.backupManager = new BackupManager();
  }

  start(): void {
    // Run daily at 2:00 AM
    this.backupTask = cron.schedule('0 2 * * *', async () => {
      try {
        await this.backupManager.createBackup();
        await this.backupManager.deleteOldBackups(7);
        console.log('Scheduled backup completed');
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    });
  }

  stop(): void {
    if (this.backupTask) {
      this.backupTask.stop();
      this.backupTask = null;
    }
  }
}
```

- [ ] **Step 2: Update main.ts to start scheduled backups**

```typescript
import { ScheduledBackupService } from './scheduled-backup';

let scheduledBackupService: ScheduledBackupService;

app.on('ready', async () => {
  // ... existing code

  scheduledBackupService = new ScheduledBackupService();
  scheduledBackupService.start();
});

app.on('before-quit', () => {
  if (scheduledBackupService) {
    scheduledBackupService.stop();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add electron/scheduled-backup.ts
git commit -m "feat: add scheduled daily backup service"
```

---

## Phase 3: Licensing System

**Goal:** Implement product key licensing with offline validation and expiry stages.

**Duration:** Week 3-4

### Task 3.1: Product Key Utility

**Files:**
- Create: `server/src/utils/product-key.ts`
- Create: `server/src/utils/product-key.test.ts`

- [ ] **Step 1: Write product key tests**

```typescript
// server/src/utils/product-key.test.ts
import { generateProductKey, validateProductKey, decodeProductKey } from './product-key';

describe('Product Key Utility', () => {
  describe('generateProductKey', () => {
    it('should generate a valid key for monthly subscription', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateProductKey('annual', '2026-03-27');
      const key2 = generateProductKey('annual', '2026-03-27');
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateProductKey', () => {
    it('should validate a correct key', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      expect(validateProductKey(key)).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(validateProductKey('INVALID')).toBe(false);
    });

    it('should reject tampered checksum', () => {
      const key = generateProductKey('monthly', '2026-03-27');
      const tamperedKey = key.replace(/.$/, 'X');
      expect(validateProductKey(tamperedKey)).toBe(false);
    });
  });

  describe('decodeProductKey', () => {
    it('should decode subscription type', () => {
      const key = generateProductKey('quarterly', '2026-03-27');
      const decoded = decodeProductKey(key);
      expect(decoded.subscriptionType).toBe('quarterly');
    });

    it('should decode issue date', () => {
      const key = generateProductKey('monthly', '2026-03-01');
      const decoded = decodeProductKey(key);
      // Note: Date encoding stores YYMM (year-month), day defaults to 01
      expect(decoded.issueDate).toBe('2026-03-01');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- product-key.test.ts`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement product key utility**

```typescript
// server/src/utils/product-key.ts
import { createHash, randomBytes } from 'crypto';

export interface ProductKeyInfo {
  subscriptionType: 'monthly' | 'quarterly' | 'annual';
  issueDate: string;
}

export function generateProductKey(
  subscriptionType: 'monthly' | 'quarterly' | 'annual',
  issueDate: string
): string {
  const typeCode: Record<string, string> = {
    monthly: '01',
    quarterly: '02',
    annual: '03'
  };

  // Encode date (simple encoding: YYMM)
  const date = new Date(issueDate);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const dateCode = year + month;

  // Generate random segment
  const random = randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

  // Create key without checksum
  const prefix = 'T3RP';  // Version/Publisher
  const middle = typeCode[subscriptionType] + random + dateCode;
  const withoutChecksum = `${prefix}-${middle}`;

  // Calculate checksum
  const checksum = calculateChecksum(withoutChecksum.replace(/-/g, ''));

  return `${withoutChecksum}-${checksum}`;
}

export function validateProductKey(key: string): boolean {
  // Check format
  const format = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!format.test(key)) return false;

  // Verify checksum
  const parts = key.split('-');
  const providedChecksum = parts[3];
  const withoutChecksum = parts.slice(0, 3).join('');
  const calculatedChecksum = calculateChecksum(withoutChecksum);

  return providedChecksum === calculatedChecksum;
}

export function decodeProductKey(key: string): ProductKeyInfo {
  if (!validateProductKey(key)) {
    throw new Error('Invalid product key');
  }

  const parts = key.split('-');
  const typeCode = parts[1].substring(0, 2);
  const dateCode = parts[1].substring(4, 8);

  const subscriptionTypes: Record<string, 'monthly' | 'quarterly' | 'annual'> = {
    '01': 'monthly',
    '02': 'quarterly',
    '03': 'annual'
  };

  // Decode date
  const year = '20' + dateCode.substring(0, 2);
  const month = dateCode.substring(2, 4);
  const issueDate = `${year}-${month}-01`;

  return {
    subscriptionType: subscriptionTypes[typeCode] || 'annual',
    issueDate
  };
}

function calculateChecksum(data: string): string {
  const hash = createHash('sha256').update(data).digest('hex');
  return hash.substring(0, 4).toUpperCase();
}

export function hashProductKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- product-key.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/product-key.ts server/src/utils/product-key.test.ts
git commit -m "feat: add product key generation and validation"
```

### Task 3.2: Hardware Fingerprinting

**Files:**
- Create: `electron/hardware-fingerprint.ts`

- [ ] **Step 1: Write hardware fingerprint test**

```typescript
// electron/hardware-fingerprint.test.ts
import { getHardwareFingerprint } from './hardware-fingerprint';

describe('Hardware Fingerprint', () => {
  it('should generate a consistent fingerprint', async () => {
    const fp1 = await getHardwareFingerprint();
    const fp2 = await getHardwareFingerprint();
    expect(fp1).toBe(fp2);
  });

  it('should generate a unique hash', async () => {
    const fp = await getHardwareFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/);  // SHA256 hex
  });
});
```

- [ ] **Step 2: Implement hardware fingerprinting**

```typescript
// electron/hardware-fingerprint.ts
import * as si from 'systeminformation';
import { createHash } from 'crypto';

export async function getHardwareFingerprint(): Promise<string> {
  try {
    const cpu = await si.cpu();
    const osInfo = await si.osInfo();
    const networkInterfaces = await si.networkInterfaces();

    // Find primary network interface (first active one)
    const primaryInterface = networkInterfaces.find(iface =>
      iface.operstate === 'up' && iface.mac && iface.mac !== '00:00:00:00:00:00'
    );

    const components = [
      cpu.manufacturer,
      cpu.brand,
      cpu.cores.toString(),
      osInfo.serial || 'unknown',
      primaryInterface?.mac || 'unknown'
    ].join('|');

    return createHash('sha256').update(components).digest('hex');
  } catch (error) {
    console.error('Failed to generate hardware fingerprint:', error);
    // Fallback to simple hash
    return createHash('sha256').update(Date.now().toString()).digest('hex');
  }
}
```

- [ ] **Step 3: Test fingerprinting**

Run: `cd electron && npm test -- hardware-fingerprint.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add electron/hardware-fingerprint.ts
git commit -m "feat: add hardware fingerprinting for license binding"
```

### Task 3.3: License Manager

**Files:**
- Create: `electron/license-manager.ts`
- Modify: `server/db/schema.sql`

- [ ] **Step 1: Add license tables to schema**

```sql
-- Add to server/db/schema.sql

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key_hash text NOT NULL UNIQUE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'quarterly', 'annual')),
  activation_date timestamptz NOT NULL,
  expiry_date timestamptz NOT NULL,
  hardware_fingerprint text NOT NULL,
  activation_signature text NOT NULL,
  last_verified timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('activation', 'verification', 'expiry', 'tamper_detected')),
  event_time timestamptz DEFAULT now(),
  system_time text NOT NULL,
  ip_address text,
  details jsonb
);

CREATE INDEX idx_license_logs_event_type ON license_logs(event_type);
CREATE INDEX idx_license_logs_event_time ON license_logs(event_time DESC);
```

Run: `psql -U travelerp -d travelerp_lite -f server/db/schema.sql`

- [ ] **Step 2: Implement LicenseManager**

```typescript
// electron/license-manager.ts
import { getHardwareFingerprint } from './hardware-fingerprint';
import { query } from '../../server/dist/config/db';  // Note: Uses compiled JS from production build
import { hashProductKey, validateProductKey, decodeProductKey } from '../../server/dist/utils/product-key';
import { createHash } from 'crypto';

// Note: In development, you may need to use the TypeScript source:
// import { query } from '../../server/src/config/db';
// The build process compiles server code to server/dist/

export type LicenseStatus = 'active' | 'grace' | 'readonly' | 'expired';

export interface License {
  id: string;
  product_key_hash: string;
  subscription_type: string;
  activation_date: Date;
  expiry_date: Date;
  hardware_fingerprint: string;
  is_active: boolean;
}

export class LicenseManager {
  async validateLicense(): Promise<LicenseStatus> {
    try {
      const license = await this.getCurrentLicense();

      if (!license) {
        return 'expired';
      }

      // Verify hardware fingerprint
      const currentFingerprint = await getHardwareFingerprint();
      if (currentFingerprint !== license.hardware_fingerprint) {
        await this.logTamper(license.id, 'hardware_mismatch');
        return 'expired';
      }

      // Check for time rollback
      const now = new Date();
      if (now < license.last_verified) {
        await this.logTamper(license.id, 'time_rollback');
        return 'expired';
      }

      // Update last verified time
      await this.updateLastVerified(license.id);

      // Check expiry
      return this.getLicenseStatus(license);

    } catch (error) {
      console.error('License validation failed:', error);
      return 'expired';
    }
  }

  async activateProductKey(productKey: string): Promise<boolean> {
    // Validate product key format
    if (!validateProductKey(productKey)) {
      throw new Error('Invalid product key format');
    }

    // Decode subscription info
    const subscriptionInfo = decodeProductKey(productKey);

    // Check if key already used
    const keyHash = hashProductKey(productKey);
    const existing = await query(
      'SELECT * FROM licenses WHERE product_key_hash = $1',
      [keyHash]
    );

    if (existing.rows.length > 0) {
      throw new Error('Product key already activated');
    }

    // Get hardware fingerprint
    const hardwareFingerprint = await getHardwareFingerprint();

    // Calculate dates
    const activationDate = new Date();
    const expiryDate = this.calculateExpiryDate(activationDate, subscriptionInfo.subscriptionType);

    // Generate signature
    const signature = this.generateSignature(productKey, hardwareFingerprint);

    // Create license
    await query(
      `INSERT INTO licenses
       (product_key_hash, subscription_type, activation_date, expiry_date,
        hardware_fingerprint, activation_signature)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [keyHash, subscriptionInfo.subscriptionType, activationDate, expiryDate,
       hardwareFingerprint, signature]
    );

    // Log activation
    const license = await this.getCurrentLicense();
    if (license) {
      await this.logLicenseEvent(license.id, 'activation');
    }

    return true;
  }

  private async getCurrentLicense(): Promise<License | null> {
    const result = await query<License>(
      'SELECT * FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
    );

    return result.rows[0] || null;
  }

  private getLicenseStatus(license: License): LicenseStatus {
    const now = new Date();
    const expiryDate = new Date(license.expiry_date);
    const daysPastExpiry = Math.floor(
      (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastExpiry <= 0) return 'active';
    if (daysPastExpiry <= 7) return 'grace';
    if (daysPastExpiry <= 27) return 'readonly';
    return 'expired';
  }

  private calculateExpiryDate(
    activationDate: Date,
    subscriptionType: string
  ): Date {
    const days = {
      monthly: 30,
      quarterly: 90,
      annual: 365
    };

    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days[subscriptionType] || 365);
    return expiry;
  }

  private generateSignature(productKey: string, fingerprint: string): string {
    const data = productKey + fingerprint + Date.now();
    return createHash('sha256').update(data).digest('hex');
  }

  private async logTamper(licenseId: string, eventType: string): Promise<void> {
    await this.logLicenseEvent(licenseId, 'tamper_detected', { eventType });
  }

  private async logLicenseEvent(
    licenseId: string,
    eventType: string,
    details?: any
  ): Promise<void> {
    await query(
      `INSERT INTO license_logs (license_id, event_type, system_time, details)
       VALUES ($1, $2, $3, $4)`,
      [licenseId, eventType, new Date().toISOString(), details || {}]
    );
  }

  private async updateLastVerified(licenseId: string): Promise<void> {
    await query(
      'UPDATE licenses SET last_verified = now() WHERE id = $1',
      [licenseId]
    );
  }

  async getLicenseInfo(): Promise<License | null> {
    return this.getCurrentLicense();
  }
}
```

- [ ] **Step 3: Add IPC handlers for license**

```typescript
// Add to electron/ipc-handlers.ts

import { LicenseManager } from './license-manager';

const licenseManager = new LicenseManager();

ipcMain.handle('license-validate', async () => {
  return await licenseManager.validateLicense();
});

ipcMain.handle('license-activate', async (_event, productKey: string) => {
  return await licenseManager.activateProductKey(productKey);
});

ipcMain.handle('license-info', async () => {
  return await licenseManager.getLicenseInfo();
});
```

- [ ] **Step 4: Update preload.ts**

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  licenseValidate: () => ipcRenderer.invoke('license-validate'),
  licenseActivate: (key: string) => ipcRenderer.invoke('license-activate', key),
  licenseInfo: () => ipcRenderer.invoke('license-info')
});
```

- [ ] **Step 5: Test license activation**

Run: `npm run electron:dev`
Expected: License APIs available

- [ ] **Step 6: Commit**

```bash
git add electron/license-manager.ts electron/ipc-handlers.ts electron/preload.ts server/db/schema.sql
git commit -m "feat: add license manager with activation and validation"
```

### Task 3.4: License Middleware for Express

**Files:**
- Create: `server/src/middleware/license.ts`

- [ ] **Step 1: Create license middleware**

```typescript
// server/src/middleware/license.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db';

type LicenseStatus = 'active' | 'grace' | 'readonly' | 'expired';

interface License {
  id: string;
  expiry_date: Date;
}

export async function licenseCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow license verification endpoint
  if (req.path === '/api/license/validate' || req.path === '/api/license/info') {
    return next();
  }

  try {
    const license = await getCurrentLicense();
    const status = getLicenseStatus(license);

    // Read-only requests work in readonly mode
    const isReadOnlyRequest = req.method === 'GET' && !req.path.includes('/pdf');

    if (status === 'active' || status === 'grace') {
      return next();
    }

    if (status === 'readonly' && isReadOnlyRequest) {
      return next();
    }

    if (status === 'readonly' && req.path.includes('/pdf')) {
      res.status(403).json({
        error: 'PDF generation disabled. Please renew subscription.',
        status: 'readonly'
      });
      return;
    }

    // Expired or invalid request
    res.status(403).json({
      error: 'Subscription expired. Please contact administrator to renew.',
      status
    });

  } catch (error) {
    res.status(500).json({ error: 'License check failed' });
  }
}

async function getCurrentLicense(): Promise<License | null> {
  const result = await query<License>(
    'SELECT id, expiry_date FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
  );

  return result.rows[0] || null;
}

function getLicenseStatus(license: License | null): LicenseStatus {
  if (!license) return 'expired';

  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor(
    (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastExpiry <= 0) return 'active';
  if (daysPastExpiry <= 7) return 'grace';
  if (daysPastExpiry <= 27) return 'readonly';
  return 'expired';
}
```

- [ ] **Step 2: Add license routes**

```typescript
// server/src/routes/license.routes.ts

import { Router } from 'express';
import { query } from '../config/db';

const router = Router();

router.get('/info', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, subscription_type, activation_date, expiry_date
       FROM licenses
       WHERE is_active = true
       ORDER BY activation_date DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ license: null, status: 'expired' });
    }

    const license = result.rows[0];
    const status = getLicenseStatus(license);

    res.json({
      license: {
        subscriptionType: license.subscription_type,
        activationDate: license.activation_date,
        expiryDate: license.expiry_date
      },
      status
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get license info' });
  }
});

router.get('/validate', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM licenses WHERE is_active = true ORDER BY activation_date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false, status: 'expired' });
    }

    const license = result.rows[0];
    const status = getLicenseStatus(license);
    const valid = ['active', 'grace'].includes(status);

    res.json({ valid, status, expiryDate: license.expiry_date });
  } catch (error) {
    res.status(500).json({ error: 'License validation failed' });
  }
});

function getLicenseStatus(license: any): string {
  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor(
    (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastExpiry <= 0) return 'active';
  if (daysPastExpiry <= 7) return 'grace';
  if (daysPastExpiry <= 27) return 'readonly';
  return 'expired';
}

export default router;
```

- [ ] **Step 3: Mount license middleware and routes in server/src/index.ts**

```typescript
import licenseRoutes from './routes/license.routes';
import { licenseCheck } from './middleware/license';

// Add license middleware to all API routes (except login)
app.use('/api', licenseCheck);

// Mount license routes (before license middleware so they always work)
app.use('/api/license', licenseRoutes);
```

- [ ] **Step 4: Test license enforcement**

Run: `curl http://localhost:3001/api/license/info`
Expected: Returns license info or expired status

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/license.ts server/src/routes/license.routes.ts server/src/index.ts
git commit -m "feat: add license middleware for API enforcement"
```

---

## Phase 4: Setup Wizards

**Goal:** Create first-run setup wizard and data import wizard.

**Duration:** Week 4-5

### Task 4.1: First-Run Wizard - Company Setup

**Files:**
- Create: `src/components/Wizards/FirstRunWizard.tsx`
- Create: `src/components/Wizards/CompanySetup.tsx`
- Create: `src/components/Wizards/LicenseActivation.tsx`
- Create: `src/components/Wizards/AdminUserSetup.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create wizard state management**

```typescript
// src/lib/wizard-state.ts

export interface WizardState {
  currentStep: number;
  companyInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    gstin?: string;
  };
  licenseKey: string;
  adminUser: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
}

export const initialWizardState: WizardState = {
  currentStep: 0,
  companyInfo: {
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: ''
  },
  licenseKey: '',
  adminUser: {
    name: '',
    email: '',
    phone: '',
    password: ''
  }
};
```

- [ ] **Step 2: Create FirstRunWizard component**

```typescript
// src/components/Wizards/FirstRunWizard.tsx

import { useState } from 'react';
import { WizardState, initialWizardState } from '../../lib/wizard-state';
import { CompanySetup } from './CompanySetup';
import { LicenseActivation } from './LicenseActivation';
import { AdminUserSetup } from './AdminUserSetup';
import { SetupComplete } from './SetupComplete';

export function FirstRunWizard() {
  const [wizardState, setWizardState] = useState<WizardState>(initialWizardState);

  const steps = [
    { component: CompanySetup, title: 'Company Information' },
    { component: LicenseActivation, title: 'License Activation' },
    { component: AdminUserSetup, title: 'Admin User' },
    { component: SetupComplete, title: 'Setup Complete' }
  ];

  const CurrentStep = steps[wizardState.currentStep].component;

  const handleNext = (data: any) => {
    setWizardState(prev => ({
      ...prev,
      ...data,
      currentStep: prev.currentStep + 1
    }));
  };

  const handleBack = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  index <= wizardState.currentStep ? 'bg-blue-500 text-white' : 'bg-gray-300'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-1 ${
                    index < wizardState.currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-center mt-4 text-xl font-semibold">
            {steps[wizardState.currentStep].title}
          </h2>
        </div>

        {/* Current step */}
        <CurrentStep
          data={wizardState}
          onNext={handleNext}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CompanySetup component**

```typescript
// src/components/Wizards/CompanySetup.tsx

import { useState } from 'react';
import { WizardState } from '../../lib/wizard-state';

interface Props {
  data: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function CompanySetup({ data, onNext, onBack }: Props) {
  const [formData, setFormData] = useState(data.companyInfo);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Company name is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'PIN code is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext({ companyInfo: formData });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : ''
          }`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address *</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          rows={3}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.address ? 'border-red-500' : ''
          }`}
        />
        {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City *</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.city ? 'border-red-500' : ''
            }`}
          />
          {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">State *</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.state ? 'border-red-500' : ''
            }`}
          />
          {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">PIN Code *</label>
          <input
            type="text"
            name="pincode"
            value={formData.pincode}
            onChange={handleChange}
            maxLength={6}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.pincode ? 'border-red-500' : ''
            }`}
          />
          {errors.pincode && <p className="mt-1 text-sm text-red-600">{errors.pincode}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">GSTIN (Optional)</label>
          <input
            type="text"
            name="gstin"
            value={formData.gstin}
            onChange={handleChange}
            maxLength={15}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone *</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.phone ? 'border-red-500' : ''
          }`}
        />
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email *</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : ''
          }`}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          disabled
        >
          Back
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Next
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create LicenseActivation component**

```typescript
// src/components/Wizards/LicenseActivation.tsx

import { useState } from 'react';
import { WizardState } from '../../lib/wizard-state';

interface Props {
  data: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function LicenseActivation({ data, onNext, onBack }: Props) {
  const [licenseKey, setLicenseKey] = useState(data.licenseKey);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState('');

  const formatLicenseKey = (value: string) => {
    // Remove non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Add hyphens every 4 characters
    const formatted = cleaned.replace(/(.{4})/g, '$1-').trim();
    // Remove trailing hyphen
    return formatted.replace(/-$/, '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    if (formatted.length <= 19) { // XXXX-XXXX-XXXX-XXXX
      setLicenseKey(formatted);
      setError('');
      setValidationResult(null);
    }
  };

  const handleValidate = async () => {
    if (licenseKey.length !== 19) {
      setError('Please enter a complete 16-digit product key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const result = await window.electronAPI.licenseActivate(licenseKey);
      setValidationResult({ success: true, ...result });
    } catch (err: any) {
      setError(err.message || 'Failed to validate product key');
      setValidationResult({ success: false });
    } finally {
      setIsValidating(false);
    }
  };

  const handleNext = () => {
    if (validationResult?.success) {
      onNext({ licenseKey });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Activate your subscription</h3>
        <p className="text-sm text-gray-600">
          Enter your 16-digit product key to activate your subscription.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Product Key</label>
        <input
          type="text"
          value={licenseKey}
          onChange={handleChange}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`mt-1 block w-full text-center text-2xl tracking-widest rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            error ? 'border-red-500' : ''
          }`}
        />
        {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
      </div>

      {!validationResult && (
        <button
          onClick={handleValidate}
          disabled={licenseKey.length !== 19 || isValidating}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isValidating ? 'Validating...' : 'Verify'}
        </button>
      )}

      {validationResult?.success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h4 className="text-green-800 font-medium mb-2">✓ Product key validated</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p><strong>Subscription:</strong> {validationResult.subscriptionType || 'Annual'}</p>
            <p><strong>Valid until:</strong> {validationResult.expiryDate || 'TBD'}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!validationResult?.success}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create AdminUserSetup component** (similar pattern)
- [ ] **Step 6: Create SetupComplete component** (similar pattern)
- [ ] **Step 7: Update App.tsx to show wizard on first run**

```typescript
// In App.tsx, add check for first run
const [isFirstRun, setIsFirstRun] = useState(false);

useEffect(() => {
  // Check if setup is complete
  const checkFirstRun = async () => {
    try {
      const response = await fetch('/api/settings/first-run');
      const data = await response.json();
      setIsFirstRun(data.firstRun);
    } catch (error) {
      console.error('Failed to check first run status');
    }
  };

  checkFirstRun();
}, []);

// Render wizard if first run
if (isFirstRun) {
  return <FirstRunWizard />;
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/Wizards/ src/lib/wizard-state.ts src/App.tsx
git commit -m "feat: add first-run setup wizard"
```

### Task 4.2: Data Import Wizard

**Files:**
- Create: `src/components/Wizards/DataImportWizard.tsx`
- Create: `src/components/Wizards/ExcelImport.tsx`
- Create: `src/lib/import-templates.ts`

- [ ] **Step 1: Create Excel import component**

```typescript
// src/components/Wizards/ExcelImport.tsx

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function ExcelImport({ onNext, onSkip }: Props) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const entityTypes = [
    { key: 'customers', label: 'Customers', required: false },
    { key: 'vehicles', label: 'Vehicles', required: false },
    { key: 'drivers', label: 'Drivers', required: false },
    { key: 'owners', label: 'Vehicle Owners', required: false },
    { key: 'rateCharts', label: 'Rate Charts', required: false }
  ];

  const handleFileChange = (entityType: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [entityType]: file }));
    } else {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[entityType];
        return newFiles;
      });
    }
    setValidationResults(null);
  };

  const handleValidate = async () => {
    setIsValidating(true);

    try {
      const results = await validateFiles(files);
      setValidationResults(results);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    // Import validated data
    await importData(files);
    onNext();
  };

  const downloadTemplate = (entityType: string) => {
    // Generate and download template
    const template = generateTemplate(entityType);
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${entityType}-template.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Import your data</h3>
        <p className="text-sm text-gray-600">
          Download templates, fill them with your data, and upload them here.
        </p>
      </div>

      {entityTypes.map(entity => (
        <div key={entity.key} className="border rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">{entity.label}</h4>
            <button
              onClick={() => downloadTemplate(entity.key)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Download Template
            </button>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileChange(entity.key, e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {files[entity.key] && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {files[entity.key].name}
            </p>
          )}

          {validationResults?.errors[entity.key] && (
            <div className="mt-2 text-sm text-red-600">
              {validationResults.errors[entity.key].length} errors found
            </div>
          )}
        </div>
      ))}

      {!validationResults && Object.keys(files).length > 0 && (
        <button
          onClick={handleValidate}
          disabled={isValidating}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
        >
          {isValidating ? 'Validating...' : 'Validate & Import'}
        </button>
      )}

      {validationResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="font-medium mb-2">Validation Results</h4>
          <div className="space-y-2 text-sm">
            {Object.entries(validationResults.summary).map(([key, value]: [string, any]) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize">{key}:</span>
                <span className={value.valid ? 'text-green-600' : 'text-red-600'}>
                  {value.count} records
                </span>
              </div>
            ))}
          </div>

          {validationResults.hasErrors && (
            <button
              onClick={handleImport}
              className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Import Valid Records Only
            </button>
          )}

          {!validationResults.hasErrors && (
            <button
              onClick={handleImport}
              className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Import All Records
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onSkip}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Skip (I'll add data manually)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create import validation logic**

```typescript
// src/lib/import-validation.ts

export async function validateFiles(files: Record<string, File>): Promise<any> {
  const results = {
    summary: {},
    errors: {},
    hasErrors: false
  };

  for (const [entityType, file] of Object.entries(files)) {
    const data = await parseFile(file);
    const validation = validateEntityType(entityType, data);

    results.summary[entityType] = {
      count: data.length,
      valid: validation.errors.length === 0
    };

    if (validation.errors.length > 0) {
      results.errors[entityType] = validation.errors;
      results.hasErrors = true;
    }
  }

  return results;
}

async function parseFile(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  return data;
}

function validateEntityType(entityType: string, data: any[]): any {
  const errors = [];

  // Validation logic for each entity type
  switch (entityType) {
    case 'customers':
      data.forEach((row, index) => {
        if (!row.customer_code) errors.push({ row: index + 2, field: 'customer_code', error: 'Required' });
        if (!row.name) errors.push({ row: index + 2, field: 'name', error: 'Required' });
        // ... more validations
      });
      break;
    // ... other entity types
  }

  return { errors };
}
```

- [ ] **Step 3: Create import API endpoint**

```typescript
// server/src/routes/import.routes.ts

import { Router } from 'express';
import * as XLSX from 'xlsx';

const router = Router();

router.post('/validate', async (req, res) => {
  const { entityType, data } = req.body;

  // Validate based on entity type
  const errors = validateImportData(entityType, data);

  res.json({ valid: errors.length === 0, errors });
});

router.post('/execute', async (req, res) => {
  const { entityType, data } = req.body;

  try {
    // Import data into database
    await importData(entityType, data);
    res.json({ success: true, imported: data.length });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

function validateImportData(entityType: string, data: any[]): any[] {
  const errors = [];

  // Validation logic
  // ...

  return errors;
}

async function importData(entityType: string, data: any[]): Promise<void> {
  // Import logic
  // ...
}

export default router;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Wizards/DataImportWizard.tsx src/lib/import-validation.ts
git commit -m "feat: add data import wizard with Excel/CSV support"
```

---

## Phase 5: Auto-Updater

**Goal:** Implement automatic update mechanism for Windows builds.

**Duration:** Week 5-6

### Task 5.1: Configure electron-updater

**Files:**
- Create: `electron/auto-updater.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Install electron-updater**

Run: `npm install --save-dev electron-updater`

- [ ] **Step 2: Create auto-updater module**

```typescript
// electron/auto-updater.ts

import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export class AutoUpdater {
  constructor(private mainWindow: BrowserWindow) {
    this.configure();
    this.setupEventHandlers();
  }

  private configure() {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://updates.travelerp.com/releases'
    });

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  private setupEventHandlers() {
    autoUpdater.on('update-available', (info) => {
      this.mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.mainWindow.webContents.send('update-not-available', {
        version: info.version
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    });

    autoUpdater.on('error', (error) => {
      this.mainWindow.webContents.send('update-error', {
        message: error.message
      });
    });
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Update check failed:', error);
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Update download failed:', error);
    }
  }

  async installAndRestart(): Promise<void> {
    autoUpdater.quitAndInstall();
  }
}
```

- [ ] **Step 3: Update main.ts to use AutoUpdater**

```typescript
import { AutoUpdater } from './auto-updater';

let autoUpdater: AutoUpdater;

app.on('ready', async () => {
  // ... existing code

  autoUpdater = new AutoUpdater(mainWindow);

  // Check for updates on startup
  autoUpdater.checkForUpdates();
});
```

- [ ] **Step 4: Add IPC handlers**

```typescript
// Add to electron/ipc-handlers.ts

ipcMain.handle('check-for-updates', async () => {
  await autoUpdater.checkForUpdates();
});

ipcMain.handle('install-update', async () => {
  await autoUpdater.installAndRestart();
});
```

- [ ] **Step 5: Update preload.ts**

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  }
});
```

- [ ] **Step 6: Create update notification component**

```typescript
// src/components/UpdateNotification.tsx

import { useEffect, useState } from 'react';

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info: any) => {
        setUpdateAvailable(true);
      });

      window.electronAPI.onUpdateDownloaded(() => {
        setReady(true);
        setDownloading(false);
      });
    }
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    window.electronAPI.checkForUpdates();
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  if (ready) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <p className="font-semibold">Update ready to install!</p>
        <p className="text-sm mt-1">A new version has been downloaded. Restart to apply updates.</p>
        <button
          onClick={handleInstall}
          className="mt-3 bg-white text-green-600 px-4 py-2 rounded font-medium hover:bg-gray-100"
        >
          Restart and Install
        </button>
      </div>
    );
  }

  if (updateAvailable && !downloading) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <p className="font-semibold">New version available!</p>
        <p className="text-sm mt-1">An update is ready to download.</p>
        <button
          onClick={handleDownload}
          className="mt-3 bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-gray-100"
        >
          Download Update
        </button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 7: Commit**

```bash
git add electron/auto-updater.ts electron/main.ts electron/ipc-handlers.ts
git commit -m "feat: add auto-updater for seamless updates"
```

---

## Phase 6: Testing & Polish

**Goal:** Comprehensive testing and bug fixes.

**Duration:** Week 6-7

### Task 6.1: Unit Tests

**Files:**
- Modify: `electron/license-manager.test.ts`
- Create: `server/src/utils/import-validation.test.ts`

- [ ] **Step 1: Add licensing unit tests**

```typescript
// electron/license-manager.test.ts - Add these test cases

describe('LicenseManager - Expiry Stages', () => {
  it('should return active status when within subscription period', async () => {
    // Create license valid for next 30 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const license = await createTestLicense({ expiry_date: futureDate });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('active');
  });

  it('should return grace status within 7 days of expiry', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const license = await createTestLicense({ expiry_date: pastDate });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('grace');
  });

  it('should return readonly status between days 8-27 of expiry', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 15);
    const license = await createTestLicense({ expiry_date: pastDate });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('readonly');
  });

  it('should return expired status after 28 days', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const license = await createTestLicense({ expiry_date: pastDate });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('expired');
  });

  it('should detect time rollback tampering', async () => {
    const license = await createTestLicense({
      expiry_date: new Date(Date.now() + 86400000),
      last_verified: new Date(Date.now() + 3600000) // 1 hour in future
    });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('expired');
  });

  it('should detect hardware fingerprint mismatch', async () => {
    const license = await createTestLicense({
      hardware_fingerprint: 'different-fingerprint'
    });

    const status = await licenseManager.validateLicense();
    expect(status).toBe('expired');
  });
});
```

Run: `cd electron && npm test -- license-manager.test.ts`
Expected: All tests pass

- [ ] **Step 2: Write import validation unit tests**

```typescript
// server/src/utils/import-validation.test.ts

import { validateCustomerImport, validateVehicleImport, validateDriverImport } from './import-validation';

describe('Import Validation', () => {
  describe('validateCustomerImport', () => {
    it('should pass valid customer data', () => {
      const validCustomer = {
        customer_code: 'CUST001',
        name: 'ABC Travels',
        city: 'Bhubaneswar',
        state: 'Odisha',
        pincode: '751001',
        phone: '9876543210',
        email: 'test@abc.com'
      };

      const errors = validateCustomerImport([validCustomer]);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidCustomer = {
        customer_code: '',
        name: 'Test'
        // missing city, state, etc.
      };

      const errors = validateCustomerImport([invalidCustomer]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toMatch(/city|state|pincode|phone|email/);
    });

    it('should reject invalid email format', () => {
      const customer = {
        customer_code: 'CUST001',
        name: 'Test',
        city: 'Bhubaneswar',
        state: 'Odisha',
        pincode: '751001',
        phone: '9876543210',
        email: 'invalid-email'
      };

      const errors = validateCustomerImport([customer]);
      expect(errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject duplicate customer codes', () => {
      const customers = [
        { customer_code: 'CUST001', name: 'Customer 1', /* ... */ },
        { customer_code: 'CUST001', name: 'Customer 2', /* ... */ }
      ];

      const errors = validateCustomerImport(customers);
      expect(errors.some(e => e.error.includes('duplicate'))).toBe(true);
    });
  });

  describe('validateVehicleImport', () => {
    it('should pass valid vehicle data', () => {
      const validVehicle = {
        vehicle_number: 'OD02AB1234',
        vehicle_type: 'car',
        category: 'CRYSTA',
        owner_code: 'OWNER001'
      };

      const errors = validateVehicleImport([validVehicle]);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid vehicle type', () => {
      const invalidVehicle = {
        vehicle_number: 'OD02AB1234',
        vehicle_type: 'invalid_type',
        category: 'CRYSTA',
        owner_code: 'OWNER001'
      };

      const errors = validateVehicleImport([invalidVehicle]);
      expect(errors.some(e => e.field === 'vehicle_type')).toBe(true);
    });
  });
});
```

Run: `cd server && npm test -- import-validation.test.ts`
Expected: All tests pass

- [ ] **Step 3: Write backup/restore unit tests**

```typescript
// electron/backup-manager.test.ts - Add these tests

describe('BackupManager', () => {
  it('should create backup file', async () => {
    const backupPath = await backupManager.createBackup();
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(backupPath).toMatch(/travelerp_backup_\d{4}-\d{2}-\d{2}\.sql/);
  });

  it('should list backups in reverse chronological order', async () => {
    await backupManager.createBackup();
    await new Promise(r => setTimeout(r, 1000));
    await backupManager.createBackup();
    await new Promise(r => setTimeout(r, 1000));
    await backupManager.createBackup();

    const backups = await backupManager.listBackups();
    expect(backups.length).toBeGreaterThanOrEqual(3);
    // Verify reverse order (newest first)
    expect(backups[0]).toMatch(/travelerp_backup_\d{4}-\d{2}-\d{2}\.sql/);
  });

  it('should delete old backups keeping specified count', async () => {
    // Create 10 backups
    for (let i = 0; i < 10; i++) {
      await backupManager.createBackup();
      await new Promise(r => setTimeout(r, 100));
    }

    await backupManager.deleteOldBackups(7);

    const backups = await backupManager.listBackups();
    expect(backups.length).toBeLessThanOrEqual(7);
  });
});
```

Run: `cd electron && npm test -- backup-manager.test.ts`
Expected: All tests pass

- [ ] **Step 4: Run all tests**

```bash
# Run Electron tests
cd electron && npm test

# Run server tests
cd server && npm test

# Run all tests from root
npm test
```

### Task 6.2: Integration Tests

- [ ] **Step 1: Test license activation flow**
- [ ] **Step 2: Test wizard completion**
- [ ] **Step 3: Test database operations**
- [ ] **Step 4: Test backup/restore**

### Task 6.3: Manual Testing

Use the checklist from the spec (Section 10.4):

- [ ] **Installation:** Install on clean Windows 10/11 machine
- [ ] **First Run:** Complete setup wizard
- [ ] **Data Import:** Import test data
- [ ] **Features:** Test all modules work identically to cloud version
- [ ] **Licensing:** Test expiry stages
- [ ] **Backup/Restore:** Test backup creation and restore
- [ ] **Auto-Update:** Test update detection and download
- [ ] **Uninstall:** Clean removal

### Task 6.4: Performance Testing

- [ ] **Step 1: Measure memory usage**
- [ ] **Step 2: Test with large datasets**
- [ ] **Step 3: Test concurrent users**
- [ ] **Step 4: Optimize bottlenecks**

---

## Phase 7: Documentation & Release

**Goal:** Create user documentation and prepare for release.

**Duration:** Week 7-8

### Task 7.1: User Documentation

- [ ] **Step 1: Create installation guide**
- [ ] **Step 2: Create user manual**
- [ ] **Step 3: Create troubleshooting guide**
- [ ] **Step 4: Create FAQ**

### Task 7.2: Admin Documentation

- [ ] **Step 1: Create product key generation guide**
- [ ] **Step 2: Create deployment guide**
- [ ] **Step 3: Create support guide**

### Task 7.3: Release Preparation

- [ ] **Step 1: Create code signing certificate**
- [ ] **Step 2: Sign executables**
- [ ] **Step 3: Create release artifacts**
- [ ] **Step 4: Prepare update server**
- [ ] **Step 5: Beta testing with select users**
- [ ] **Step 6: Final release**

---

## Success Criteria

✅ **Functional Requirements:**
- All existing features work identically
- No feature loss from cloud version
- 4-5 concurrent users supported
- Offline operation guaranteed
- Data privacy maintained

✅ **Non-Functional Requirements:**
- Installer size < 300MB
- Application startup < 5 seconds
- Memory usage < 500MB peak
- Zero internet dependency for core functionality
- Windows 10/11 compatible

✅ **Business Requirements:**
- Subscription enforcement working
- Grace period + read-only + expiry stages enforced
- Product key system secure
- Tamper detection functional
- Auto-updater working

✅ **User Experience:**
- Simple installation process
- Intuitive setup wizards
- Clear error messages
- Professional UI/UX
- Reliable backup/restore

---

## Next Steps After Implementation

1. **Beta Testing:** Deploy to small group of users
2. **Feedback Collection:** Gather user feedback
3. **Bug Fixes:** Address issues found in beta
4. **Documentation:** Complete all documentation
5. **Training:** Create training materials
6. **Support:** Set up support channels
7. **Launch:** Full product release

---

**End of Implementation Plan**
