# TravelERP Lite - Desktop Application Design Specification

**Date:** 2026-03-27
**Status:** Draft
**Version:** 1.0

## Executive Summary

TravelERP Lite is a desktop version of the TravelERP business management system designed for local deployment with complete data privacy. The application targets 4-5 concurrent users and requires no internet connectivity or cloud hosting. It features a subscription-based licensing model with offline enforcement, automated updates, and full feature parity with the cloud version.

### Key Requirements

- **No Postgres cloud hosting** - Fully local installation
- **4-5 concurrent users** - Small business usage
- **SQLite alternative rejected** - Bundled Postgres for scalability and licensing
- **All features intact** - Zero feature loss from cloud version
- **Local data privacy** - Customer data never leaves their machine
- **Subscription enforcement** - 16-digit product key with offline validation
- **Windows installer** - Desktop .exe with all dependencies bundled

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Licensing & Subscription System](#3-licensing--subscription-system)
4. [Setup Wizards](#4-setup-wizards)
5. [Database & PostgreSQL Bundling](#5-database--postgresql-bundling)
6. [Electron Integration](#6-electron-integration)
7. [Auto-Updater](#7-auto-updater)
8. [Build & Installation](#8-build--installation)
9. [Security Considerations](#9-security-considerations)
10. [Testing Strategy](#10-testing-strategy)
11. [Performance & Scalability](#11-performance--scalability)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
TravelERP-Lite-Installer.exe (Windows Installer)
├── Electron Runtime (Chromium + Node.js)
├── React Frontend (Existing codebase)
├── Express Backend (Existing codebase)
├── PostgreSQL 14/15 (Bundled as Windows service)
├── Node.js 18/20 (Bundled runtime)
├── First-run Wizard (Company setup + License activation)
├── Data Import Wizard (Excel/CSV/JSON import)
└── Auto-updater (electron-updater)
```

### 1.2 Process Architecture

```
┌─────────────────────────────────────────┐
│         Electron Main Process            │
│  - App lifecycle                        │
│  - Window management                    │
│  - Auto-updater                         │
│  - License validation                   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────────────┐
│   Renderer  │  │  Backend Process   │
│   Process   │  │  (Express Server)  │
│             │  │                    │
│  (React     │  │  - API Routes      │
│   Frontend) │  │  - Business Logic  │
│             │  │  - PDF Generation  │
└──────┬──────┘  └─────┬──────────────┘
       │                │
       │         ┌──────▼────────┐
       │         │  PostgreSQL   │
       │         │  (Windows     │
       │         │   Service)    │
       │         └───────────────┘
       │
┌──────▼─────────────┐
│  Local File System │
│  - App data        │
│  - Database files  │
│  - PDF exports     │
│  - Import files    │
└────────────────────┘
```

### 1.3 Key Components

| Component | Description | Changes Required |
|-----------|-------------|------------------|
| **Electron Main Process** | Entry point, window management, lifecycle | New - create from scratch |
| **React Frontend** | User interface | Minimal - mostly unchanged |
| **Express Backend** | API server, business logic | Minimal - DB config change |
| **PostgreSQL** | Database server | Bundle portable distribution |
| **Licensing Module** | Subscription enforcement | New - complete implementation |
| **Setup Wizards** | Initial configuration | New - UI + backend |
| **Auto-Updater** | Application updates | New - electron-updater integration |

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| TypeScript | Latest | Type safety |
| Vite | Latest | Build tool |
| Tailwind CSS | Latest | Styling |

**Status:** Existing codebase, no changes required

### 2.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 4.x | API framework |
| TypeScript | Latest | Type safety |
| Node.js | 18/20 | Runtime |
| pg (node-postgres) | Latest | PostgreSQL driver |
| PDFKit | Latest | PDF generation |

**Status:** Existing codebase, minimal changes required

### 2.3 Desktop Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | Latest | Desktop app framework |
| electron-builder | Latest | Installer creation |
| electron-updater | Latest | Auto updates |

**Status:** New - must be integrated

### 2.4 Database

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 14/15 | Relational database |
| Portable distribution | EnterpriseDB | Windows bundling |

**Status:** Bundle existing distribution

### 2.5 Additional Libraries

| Library | Purpose |
|---------|---------|
| systeminformation | Hardware fingerprinting |
| node-cron | Scheduled backups |
| exceljs | Excel import/export |
| csv-parser | CSV parsing |
| crypto | Cryptographic operations |

---

## 3. Licensing & Subscription System

### 3.1 Product Key Format

**Structure:** 16-digit alphanumeric key with embedded information

```
XXXX-XXXX-XXXX-XXXX
│    │    │    │
│    │    │    └─ Checksum (4 digits)
│    │    └────── Issue Date (encoded, 4 digits)
│    └─────────── Subscription Type (2 digits) + Random (2 digits)
└──────────────── Version/Publisher (4 digits)
```

**Subscription Type Codes:**
- `01` = Monthly (30 days)
- `02` = Quarterly (90 days)
- `03` = Annual (365 days)

**Example Keys:**
- Monthly: `T3RP-M01X-2023-A7B9`
- Quarterly: `T3RP-Q02X-2023-C8D2`
- Annual: `T3RP-Y03X-2023-E9F4`

### 3.2 License Expiry Stages

Three-stage graduated enforcement:

| Stage | Timeframe | Functionality | User Experience |
|-------|-----------|---------------|-----------------|
| **Active** | Within subscription | Full access | Green badge, no warnings |
| **Grace Period** | Days 1-7 post-expiry | Full access | Yellow badge, "Renew soon" |
| **Read-Only** | Days 8-27 post-expiry | View data only | Orange badge, no edits/PDFs |
| **Expired** | Day 28+ onwards | Complete lockdown | Red screen, "Contact admin" |

### 3.3 Database Schema

```sql
-- License storage table
CREATE TABLE licenses (
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

-- License audit log
CREATE TABLE license_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('activation', 'verification', 'expiry', 'tamper_detected')),
  event_time timestamptz DEFAULT now(),
  system_time text NOT NULL,
  ip_address text,
  details jsonb
);

-- Index for performance
CREATE INDEX idx_license_logs_event_type ON license_logs(event_type);
CREATE INDEX idx_license_logs_event_time ON license_logs(event_time DESC);
```

### 3.4 Hardware Fingerprinting

**Components:**
- CPU ID (WMI: `Win32_Processor.ProcessorId`)
- Primary MAC address (First active network adapter)
- Machine GUID (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`)
- Volume serial number (System drive)

**Implementation:**
```typescript
import { systeminformation } from 'systeminformation';

async function getHardwareFingerprint(): Promise<string> {
  const cpu = await systeminformation.cpu();
  const osInfo = await systeminformation.osInfo();
  const network = await systeminformation.networkInterfaces();

  // Combine and hash
  const components = [
    cpu.manufacturer + cpu.brand,
    osInfo.serial,
    network.find(n => n.operstate === 'up')?.mac || 'unknown'
  ].join('|');

  return createHash('sha256').update(components).digest('hex');
}
```

### 3.5 License Validation Logic

```typescript
enum LicenseStatus {
  ACTIVE = 'active',
  GRACE = 'grace',
  READONLY = 'readonly',
  EXPIRED = 'expired'
}

function getLicenseStatus(license: License): LicenseStatus {
  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor(
    (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastExpiry <= 0) return LicenseStatus.ACTIVE;
  if (daysPastExpiry <= 7) return LicenseStatus.GRACE;
  if (daysPastExpiry <= 27) return LicenseStatus.READONLY;
  return LicenseStatus.EXPIRED;
}
```

### 3.6 Middleware Enforcement

```typescript
export async function licenseCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const license = await getCurrentLicense();
  const status = getLicenseStatus(license);

  // Always allow license verification
  if (req.path === '/api/license/verify') {
    return next();
  }

  // Read-only requests work in readonly mode
  const isReadOnlyRequest = req.method === 'GET' && !req.path.includes('/pdf');

  if (status === LicenseStatus.ACTIVE || status === LicenseStatus.GRACE) {
    return next();  // Full access
  }

  if (status === LicenseStatus.READONLY && isReadOnlyRequest) {
    return next();  // Allow GET requests
  }

  if (status === LicenseStatus.READONLY && req.path.includes('/pdf')) {
    res.status(403).json({
      error: 'PDF generation disabled. Please renew subscription.'
    });
    return;
  }

  // Expired or invalid request in readonly mode
  res.status(403).json({
    error: 'Subscription expired. Please contact administrator to renew.',
    status,
    expiryDate: license.expiry_date
  });
}
```

### 3.7 Tamper Detection

**Detection Mechanisms:**

1. **System Time Rollback**
   ```typescript
   if (systemTime < lastVerifiedTime) {
     logTamperEvent('time_rollback');
     // Invalidate license or require reactivation
   }
   ```

2. **Hardware Fingerprint Mismatch**
   ```typescript
   const currentFingerprint = await getHardwareFingerprint();
   if (currentFingerprint !== storedFingerprint) {
     logTamperEvent('hardware_changed');
     // Require reactivation
   }
   ```

3. **Database File Integrity**
   - Periodic checksum validation
   - Detect unauthorized modifications

4. **Checksum Validation**
   ```typescript
   const calculatedChecksum = sha256(licenseData);
   if (calculatedChecksum !== storedChecksum) {
     logTamperEvent('data_tampered');
   }
   ```

### 3.8 Frontend UI States

**Active Status:**
```
[Green Badge] Active
✓ All features available
Subscription valid until: 27-March-2027
```

**Grace Period:**
```
[Yellow Badge] Renew Soon
⚠ Subscription expires in 5 days
Please renew to continue uninterrupted service
[Renew Now]
```

**Read-Only Mode:**
```
[Orange Badge] Read-Only Mode
🔒 Your subscription has expired.
You can view your data but cannot make changes.
Days overdue: 12
Please contact administrator to renew.
```

**Expired:**
```
[Red Badge] Subscription Expired
❌ This application is locked.
Please contact your administrator to renew your subscription.
Days overdue: 35
Contact: support@travelerp.com | +91-9876543210
```

---

## 4. Setup Wizards

### 4.1 Wizard Overview

Two-wizard setup process:

```
┌──────────────────┐
│  First Launch    │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  Wizard 1:       │
│  Company Setup   │
│  + License       │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  Activate DB     │
│  Start Services  │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  Wizard 2:       │
│  Data Import     │
│  (Optional)      │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  Main Dashboard  │
│  (App Ready)     │
└──────────────────┘
```

### 4.2 Wizard 1: Company Setup & License Activation

#### Screen 1: Welcome

```
┌────────────────────────────────────────┐
│  Welcome to TravelERP Lite!            │
│                                        │
│  Let's get you set up in a few        │
│  simple steps.                         │
│                                        │
│  This will take about 2-3 minutes.     │
│                                        │
│  [Get Started]                         │
└────────────────────────────────────────┘
```

#### Screen 2: Company Information

**Fields Required:**
- Company Name *
- Address *
- City *
- State *
- PIN Code *
- Phone *
- Email *
- GSTIN (optional)

**Validation:**
- All required fields must be filled
- Email format validation
- GSTIN format validation (if provided)
- Phone number validation

#### Screen 3: License Activation

```
┌────────────────────────────────────────┐
│  Activate your subscription            │
│                                        │
│  Enter your 16-digit product key:      │
│  ┌────────────────────────────────┐   │
│  │ XXXX-XXXX-XXXX-XXXX             │   │
│  └────────────────────────────────┘   │
│                                        │
│  [Verify]                              │
│                                        │
│  ✓ Product key validated               │
│  ✓ Subscription: Annual                │
│  ✓ Valid until: 27-March-2027          │
│                                        │
│  [Back]          [Activate]            │
└────────────────────────────────────────┘
```

#### Screen 4: Admin User Setup

**Fields:**
- Full Name *
- Email *
- Phone *
- Password *
- Confirm Password *

**Validation:**
- Password minimum 8 characters
- Password strength indicator
- Passwords must match
- Email uniqueness

#### Screen 5: Setup Complete

```
┌────────────────────────────────────────┐
│  Setup complete!                       │
│                                        │
│  Your TravelERP Lite is ready to use.  │
│  Database initialized, services        │
│  started.                              │
│                                        │
│  [Go to Data Import] [Skip to Dash]    │
└────────────────────────────────────────┘
```

### 4.3 Wizard 2: Data Import

#### Screen 1: Import Welcome

```
┌────────────────────────────────────────┐
│  Import your existing data             │
│                                        │
│  You can import:                       │
│  • Customers                            │
│  • Vehicles                             │
│  • Drivers                              │
│  • Vehicle Owners                       │
│  • Rate Charts                          │
│                                        │
│  Choose your import method:            │
│                                        │
│  ○ Import from Excel/CSV files         │
│  ○ Import from JSON file               │
│  ○ Skip (I'll add data manually)       │
│                                        │
│  [Back]          [Next]                │
└────────────────────────────────────────┘
```

#### Screen 2: Excel/CSV Import

**Template Downloads:**
- Customer Template
- Vehicle Template
- Driver Template
- Owner Template
- Rate Chart Template

**Upload Interface:**
```
Customers:        [Choose File]  none selected
Vehicles:         [Choose File]  none selected
Drivers:          [Choose File]  none selected
Owners:           [Choose File]  none selected
Rate Charts:      [Choose File]  none selected

[Back]          [Validate & Import]
```

#### Screen 3: JSON Import

**Expected Format:**
```json
{
  "customers": [
    {
      "customer_code": "CUST001",
      "name": "ABC Travels",
      "contact_person": "John Doe",
      "phone": "9876543210",
      "email": "john@abc.com",
      "address": "123 Main St",
      "city": "Bhubaneswar",
      "state": "Odisha",
      "pincode": "751001",
      "gstin": "21AAAAA0000A1Z5"
    }
  ],
  "vehicles": [...],
  "drivers": [...],
  "owners": [...],
  "rateCharts": [...]
}
```

#### Screen 4: Validation Results

```
┌────────────────────────────────────────┐
│  Validation complete!                  │
│                                        │
│  ✓ Customers:        15 records        │
│  ✓ Vehicles:         8 records         │
│  ✓ Drivers:          10 records        │
│  ✓ Owners:           6 records         │
│  ✘ Rate Charts:      3 errors found    │
│     - Missing vehicle_category on row 5│
│     - Invalid date on row 12           │
│                                        │
│  [Fix Errors] [Import Valid Only]      │
└────────────────────────────────────────┘
```

#### Screen 5: Import Complete

```
┌────────────────────────────────────────┐
│  Import successful!                    │
│                                        │
│  Imported:                             │
│  • 15 customers                        │
│  • 8 vehicles                          │
│  • 10 drivers                          │
│  • 6 owners                            │
│                                        │
│  Go to Dashboard to start using        │
│  TravelERP Lite.                       │
│                                        │
│  [Go to Dashboard]                     │
└────────────────────────────────────────┘
```

### 4.4 Template Specifications

**Customers Template (Excel/CSV):**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| customer_code | string | Yes | Unique, max 50 chars |
| name | string | Yes | Max 200 chars |
| contact_person | string | No | Max 100 chars |
| phone | string | No | 10 digits |
| email | string | No | Valid email format |
| address | string | No | Max 500 chars |
| city | string | Yes | Max 100 chars |
| state | string | Yes | Max 100 chars |
| pincode | string | Yes | 6 digits |
| gstin | string | No | 15 chars, valid GST format |

**Vehicles Template:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| vehicle_number | string | Yes | Valid format, unique |
| vehicle_type | string | Yes | ENUM: bus, mini_bus, van, car, truck |
| category | string | Yes | Must exist in vehicle_categories |
| owner_code | string | Yes | Must exist in owners_vendors |
| capacity | integer | No | Positive number |
| fuel_type | string | No | PETROL, DIESEL, CNG, ELECTRIC |

### 4.5 Import Validation Rules

1. **Required Fields:** All marked fields must be present
2. **Uniqueness:** Codes cannot duplicate existing records
3. **Foreign Keys:** Referenced records must exist
4. **Format Validation:** Email, GSTIN, phone numbers
5. **Data Types:** Numeric ranges, date formats
6. **Business Rules:** Capacity > 0, dates not in past (where applicable)

### 4.6 Error Handling

```typescript
interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
  severity: 'error' | 'warning';
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportError[];
}
```

---

## 5. Database & PostgreSQL Bundling

### 5.1 PostgreSQL Distribution

**Source:** EnterpriseDB PostgreSQL for Windows (portable)

**Directory Structure:**
```
C:\Program Files\TravelERP\
├── pgsql\                          (PostgreSQL, ~150MB)
│   ├── bin\
│   │   ├── initdb.exe
│   │   ├── pg_ctl.exe
│   │   ├── postgres.exe
│   │   ├── psql.exe
│   │   └── pg_dump.exe
│   ├── data\                      (Created on install)
│   │   ├── base\
│   │   ├── global\
│   │   ├── pg_wal\
│   │   └── postgresql.conf
│   └── lib\
├── nodejs\                         (Node.js runtime, ~50MB)
├── app\                            (Application code, ~30MB)
└── TravelERP-Lite.exe              (Launcher)
```

### 5.2 Installation Process

**NSIS Installer Script:**

```nsis
; Install PostgreSQL
Section "PostgreSQL Database" SecPostgres
  SetOutPath "$INSTDIR\pgsql"
  File /r "resources\postgresql\*"

  ; Initialize database cluster
  ExecWait '"$INSTDIR\pgsql\bin\initdb.exe" -D "$INSTDIR\pgsql\data" -U travelerp -E UTF8'

  ; Configure PostgreSQL
  CopyFiles "$INSTDIR\pgsql\postgresql.conf" "$INSTDIR\pgsql\data\postgresql.conf"

  ; Create Windows service
  ExecWait '"$INSTDIR\pgsql\bin\pg_ctl.exe" register -N "TravelERP-PostgreSQL" -D "$INSTDIR\pgsql\data"'

  ; Start service
  ExecWait 'net start "TravelERP-PostgreSQL"'
SectionEnd

; Create database and run schema
Section "Initialize Database" SecDatabase
  ExecWait '$INSTDIR\pgsql\bin\psql.exe -U travelerp -c "CREATE DATABASE travelerp_lite;"'
  ExecWait '$INSTDIR\pgsql\bin\psql.exe -U travelerp -d travelerp_lite -f "$INSTDIR\app\server\db\schema.sql"'
SectionEnd
```

### 5.3 PostgreSQL Configuration

**postgresql.conf:**
```ini
# Connection settings
listen_addresses = 'localhost'
port = 5432
max_connections = 20

# Memory settings (4-5 concurrent users)
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
work_mem = 4MB

# WAL settings
min_wal_size = 1GB
max_wal_size = 4GB
wal_buffers = 16MB

# Query optimization
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_duration = off
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Performance
checkpoint_completion_target = 0.9
```

### 5.4 Database Location

**User Data Directory:**
```
C:\Users\<Username>\AppData\Roaming\TravelERP\
├── database\
│   ├── base\
│   ├── global\
│   ├── pg_wal\
│   └── postgresql.conf
├── exports\              (PDF exports, data exports)
├── imports\              (Import files from users)
├── backups\              (Automatic backups)
└── logs\                 (Application logs)
```

**Rationale:**
- AppData\Roaming survives Windows updates
- User-specific isolation
- Backup-friendly
- Follows Windows conventions

### 5.5 Connection Pool Configuration

**server/src/config/db.ts:**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'travelerp_lite',
  user: process.env.DB_USER || 'travelerp',
  password: process.env.DB_PASSWORD || '',  // Set during install
  max: 20,  // Max connections (4-5 users × multiple connections)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}

export async function testConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
```

### 5.6 Schema Compatibility

**Good News:** Zero schema changes required!

Since we're using PostgreSQL (not SQLite), all existing schema works:
- ✅ `uuid_generate_v4()` - UUID generation
- ✅ Custom ENUM types
- ✅ CHECK constraints
- ✅ Foreign keys with CASCADE
- ✅ All existing functions and triggers

### 5.7 Backup & Restore Strategy

#### Automatic Backups

**Schedule:** Daily at 2:00 AM (configurable)

**Retention:** Last 7 backups

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';

cron.schedule('0 2 * * *', async () => {
  const backupPath = getAppDataPath('backups');
  const timestamp = new Date().toISOString().split('T')[0];
  const backupFile = `${backupPath}/travelerp_backup_${timestamp}.sql`;

  // Execute pg_dump
  exec(`"${pgBinPath}/pg_dump.exe" -U travelerp -d travelerp_lite -f "${backupFile}"`);

  // Keep only last 7 backups
  cleanupOldBackups(backupPath, 7);
});
```

#### Manual Backup

**Trigger:** Menu → File → Backup Database

**User Flow:**
1. Opens file save dialog
2. User selects location
3. Shows progress bar
4. Confirms completion

#### Restore Process

**Trigger:** Menu → File → Restore Database

**User Flow:**
1. Warning: "This will replace current database. Continue?"
2. User confirms
3. Select backup file
4. Stop services
5. Execute restore
6. Restart services
7. Verify integrity
8. Confirm success

### 5.8 Migration Strategy (Cloud → Local)

For users migrating from cloud version:

```bash
# Export from cloud
pg_dump $CLOUD_DATABASE_URL > cloud_export.sql

# Import to local
psql -U travelerp -d travelerp_lite < cloud_export.sql
```

**Handling:**
- Schema is identical - no conversion needed
- Data transfers directly
- UUIDs remain same
- All foreign keys preserved

---

## 6. Electron Integration

### 6.1 Project Structure

```
travelerp-lite/
├── electron/
│   ├── main.ts              # Main process entry
│   ├── preload.ts           # Preload script (security)
│   ├── license-manager.ts   # License validation
│   ├── postgres-service.ts  # Postgres control
│   ├── auto-updater.ts      # Update management
│   └── build/
│       ├── electron-builder.json
│       └── nsis/
│           └── installer.nsi
├── src/                     # React frontend (existing)
├── server/                  # Express backend (existing)
└── package.json            # Updated configs
```

### 6.2 Main Process

**electron/main.ts:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { LicenseManager } from './license-manager';
import { PostgresService } from './postgres-service';
import { AutoUpdater } from './auto-updater';

let mainWindow: BrowserWindow;
let backendProcess: any;
let postgresService: PostgresService;
let licenseManager: LicenseManager;

app.on('ready', async () => {
  try {
    // 1. License validation
    licenseManager = new LicenseManager();
    const licenseStatus = await licenseManager.validateLicense();

    if (licenseStatus === 'expired') {
      showLockdownWindow();
      return;
    }

    // 2. Start PostgreSQL
    postgresService = new PostgresService();
    await postgresService.start();

    // 3. Start Express backend
    startBackend();

    // 4. Initialize auto-updater
    const autoUpdater = new AutoUpdater(mainWindow);

    // 5. Create main window
    createMainWindow();

  } catch (error) {
    console.error('Failed to start app:', error);
    showErrorDialog(error.message);
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'TravelERP Lite',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,  // Security
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

function startBackend() {
  backendProcess = spawn('node', ['server/index.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'travelerp_lite',
      DB_USER: 'travelerp',
      DB_PASSWORD: getStoredPassword()
    }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.on('error', (error) => {
    console.error('Backend error:', error);
  });
}

function showLockdownWindow() {
  const lockdownWindow = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  lockdownWindow.loadFile(path.join(__dirname, '../lockdown.html'));
}

app.on('before-quit', async () => {
  // Cleanup
  if (backendProcess) {
    backendProcess.kill();
  }
  if (postgresService) {
    await postgresService.stop();
  }
});
```

### 6.3 Preload Script

**electron/preload.ts:**
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // License status
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback: Event) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback: Event) => ipcRenderer.on('update-downloaded', callback),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Backup/restore
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: (filePath: string) => ipcRenderer.invoke('restore-database', filePath)
});
```

### 6.4 License Manager

**electron/license-manager.ts:**
```typescript
import { getHardwareFingerprint } from './hardware-fingerprint';
import { query } from '../server/src/config/db';

interface License {
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
        return 'expired';  // No license = need activation
      }

      // Verify hardware fingerprint
      const currentFingerprint = await getHardwareFingerprint();
      if (currentFingerprint !== license.hardware_fingerprint) {
        await this.logTamper('hardware_mismatch');
        return 'expired';
      }

      // Check expiry
      return this.getLicenseStatus(license);

    } catch (error) {
      console.error('License validation failed:', error);
      return 'expired';
    }
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

  async activateProductKey(productKey: string): Promise<boolean> {
    // Validate product key format and checksum
    if (!this.validateProductKeyFormat(productKey)) {
      throw new Error('Invalid product key format');
    }

    // Decode subscription info from key
    const subscriptionInfo = this.decodeProductKey(productKey);

    // Check if key already used
    const existing = await this.findLicenseByKey(productKey);
    if (existing) {
      throw new Error('Product key already activated');
    }

    // Create license record
    const hardwareFingerprint = await getHardwareFingerprint();
    const activationDate = new Date();
    const expiryDate = this.calculateExpiryDate(
      activationDate,
      subscriptionInfo.subscriptionType
    );

    await query(
      `INSERT INTO licenses
       (product_key_hash, subscription_type, activation_date, expiry_date, hardware_fingerprint, activation_signature)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        this.hashProductKey(productKey),
        subscriptionInfo.subscriptionType,
        activationDate,
        expiryDate,
        hardwareFingerprint,
        this.generateSignature(productKey, hardwareFingerprint)
      ]
    );

    return true;
  }

  private validateProductKeyFormat(key: string): boolean {
    const format = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!format.test(key)) return false;

    // Verify checksum
    const parts = key.split('-');
    const providedChecksum = parts[3];
    const calculatedChecksum = this.calculateChecksum(parts.slice(0, 3).join(''));

    return providedChecksum === calculatedChecksum;
  }

  private decodeProductKey(key: string): ProductKeyInfo {
    const parts = key.split('-');
    const typeCode = parts[1].substring(0, 2);
    const dateCode = parts[1].substring(2, 4);

    const subscriptionTypes: Record<string, string> = {
      '01': 'monthly',
      '02': 'quarterly',
      '03': 'annual'
    };

    return {
      subscriptionType: subscriptionTypes[typeCode] || 'annual',
      issueDate: this.decodeDate(dateCode)
    };
  }
}
```

### 6.5 PostgreSQL Service Manager

**electron/postgres-service.ts:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PostgresService {
  private pgPath: string;
  private dataPath: string;

  constructor() {
    this.pgPath = process.env.PG_PATH || 'C:\\Program Files\\TravelERP\\pgsql';
    this.dataPath = path.join(this.pgPath, 'data');
  }

  async start(): Promise<void> {
    try {
      // Check if already running
      const { stdout } = await execAsync('net start "TravelERP-PostgreSQL"');

      if (stdout.includes('already been started')) {
        return;  // Already running
      }

      // Start service
      await execAsync('net start "TravelERP-PostgreSQL"');

      // Wait for postgres to be ready
      await this.waitForReady();

    } catch (error) {
      throw new Error(`Failed to start PostgreSQL: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    try {
      await execAsync('net stop "TravelERP-PostgreSQL"');
    } catch (error) {
      console.error('Failed to stop PostgreSQL:', error);
    }
  }

  async initializeDatabase(): Promise<void> {
    // Run initdb if data directory doesn't exist
    if (!fs.existsSync(this.dataPath)) {
      await execAsync(`"${this.pgPath}\\bin\\initdb.exe" -D "${this.dataPath}" -U travelerp -E UTF8`);
    }

    // Start service
    await this.start();

    // Create database
    await execAsync(`"${this.pgPath}\\bin\\psql.exe" -U travelerp -c "CREATE DATABASE travelerp_lite;"`);

    // Run schema
    const schemaPath = path.join(__dirname, '../server/db/schema.sql');
    await execAsync(`"${this.pgPath}\\bin\\psql.exe" -U travelerp -d travelerp_lite -f "${schemaPath}"`);
  }

  private async waitForReady(): Promise<void> {
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
}
```

---

## 7. Auto-Updater

### 7.1 Update Flow

```
┌─────────────────┐
│  App Startup    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Check Updates  │◄─────│  Manual Check    │
│  (When internet │      │  (User Trigger)  │
│   available)    │      └──────────────────┘
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌─────────┐
│Update  │  │No Update│
│Available│  └────┬────┘
└───┬────┘       │
    │            ▼
    ▼      Continue
Notify User   Normally
    │
    ▼
Download (background)
    │
    ▼
┌──────────────┐
│Notify Ready  │
│Install Now/  │
│On Exit       │
└──────────────┘
```

### 7.2 Implementation

**electron/auto-updater.ts:**
```typescript
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
    autoUpdater.autoInstallOnAppQuit = false;  // User control
  }

  private setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      this.mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      this.mainWindow.webContents.send('update-not-available', {
        version: info.version
      });
    });

    // Download progress
    autoUpdater.on('download-progress', (progress) => {
      this.mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      this.mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    });

    // Error
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

### 7.3 Update Server

**Option 1: GitHub Releases**
```
Releases page with:
- TravelERP-Lite-Setup-1.0.0.exe
- latest.yml (manifest)
- RELEASES (metadata)
```

**Option 2: Custom Server**
```
https://updates.travelerp.com/
├── latest.yml
├── RELEASES
└── releases/
    ├── TravelERP-Lite-Setup-1.0.0.exe
    ├── TravelERP-Lite-Setup-1.0.1.exe
    └── ...
```

**latest.yml format:**
```yaml
version: 1.0.1
files:
  - url: TravelERP-Lite-Setup-1.0.1.exe
    sha512: [hash]
    size: 250000000
path: TravelERP-Lite-Setup-1.0.1.exe
sha512: [hash]
releaseDate: 2026-03-27T10:00:00.000Z
```

### 7.4 Frontend Integration

**Update Notification Component:**
```typescript
// UpdateNotification.tsx
import { useEffect, useState } from 'react';

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for updates
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => {
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
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded shadow-lg">
        <p className="font-semibold">Update ready to install!</p>
        <button onClick={handleInstall} className="mt-2 bg-white text-green-500 px-4 py-2 rounded">
          Restart and Install
        </button>
      </div>
    );
  }

  if (updateAvailable && !downloading) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded shadow-lg">
        <p className="font-semibold">New version available!</p>
        <button onClick={handleDownload} className="mt-2 bg-white text-blue-500 px-4 py-2 rounded">
          Download Update
        </button>
      </div>
    );
  }

  if (downloading) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-500 text-white p-4 rounded shadow-lg">
        <p className="font-semibold">Downloading update...</p>
        <div className="mt-2 bg-white rounded-full h-2">
          <div className="bg-yellow-600 h-2 rounded" style={{ width: '60%' }}></div>
        </div>
      </div>
    );
  }

  return null;
}
```

---

## 8. Build & Installation

### 8.1 Development Workflow

```bash
# 1. Install dependencies
npm install
npm install --save-dev electron electron-builder
npm install --save-dev @types/node

# 2. Start development
npm run dev                    # Start Vite dev server (React)
npm run server:dev             # Start Express backend
npm run electron:dev           # Start Electron (points to localhost:3000)

# 3. Build for production
npm run build                  # Build React frontend
cd server && npm run build     # Build Express backend
cd ..

# 4. Build installer
npm run build:installer        # Create Windows .exe installer
```

### 8.2 Package.json Configuration

```json
{
  "name": "travelerp-lite",
  "version": "1.0.0",
  "description": "TravelERP Lite - Desktop Application",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "server:dev": "cd server && npm run dev",
    "server:build": "cd server && npm run build",
    "electron:dev": "electron .",
    "electron:build": "tsc -p electron/tsconfig.json",
    "build:installer": "npm run build && npm run server:build && electron-builder --win",
    "dist": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.travelerp.lite",
    "productName": "TravelERP Lite",
    "directories": {
      "output": "dist/installer",
      "buildResources": "build"
    },
    "files": [
      "electron/**/*",
      "dist/**/*",
      "server/dist/**/*",
      "server/node_modules/**/*",
      "node_modules/**/*"
    ],
    "extraResources": [
      {
        "from": "resources/postgres",
        "to": "postgres"
      }
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "TravelERP Lite"
    }
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest",
    "@types/node": "^latest"
  }
}
```

### 8.3 Build Configuration

**electron-builder.json:**
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
    "server/node_modules/pdfkit/**/*",
    "server/node_modules/express/**/*"
  ],
  "extraResources": [
    {
      "from": "resources/postgresql",
      "to": "pgsql",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": "nsis",
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

### 8.4 Installer Size Breakdown

| Component | Size |
|-----------|------|
| Electron Runtime | ~100MB |
| Node.js | ~50MB |
| PostgreSQL | ~150MB |
| Your App (React + Express) | ~30MB |
| Dependencies | ~20MB |
| **Total** | **~350MB** (compressed ~250MB) |

### 8.5 Installation Flow

1. **User runs** `TravelERP-Lite-Setup-1.0.0.exe`
2. **NSIS installer:**
   - Shows welcome screen
   - Accepts license agreement
   - Prompts for installation directory (default: `C:\Program Files\TravelERP`)
   - Extracts all files
   - Initializes PostgreSQL
   - Creates Windows service
   - Creates desktop shortcut
   - Creates Start Menu shortcut
   - Registers for auto-update
3. **Post-install:**
   - Prompts user to launch app
   - App starts → First-run wizard
4. **Uninstall:**
   - Stops PostgreSQL service
   - Removes service
   - Deletes files (preserves user data in AppData by default)

---

## 9. Security Considerations

### 9.1 Data Security

**Database Protection:**
- PostgreSQL runs on localhost only (no external access)
- Strong password generated during installation
- Database files in user's AppData (Windows-managed permissions)

**Encryption:**
- License data cryptographically signed
- Product keys use HMAC-SHA256
- Hardware fingerprints hashed before storage

**File Permissions:**
- Application files: Program Files (admin write protected)
- User data: AppData (user-specific)
- Backups: User-controlled location

### 9.2 Application Security

**Electron Security:**
```javascript
// electron/main.ts
app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,      // Prevent require() in renderer
      contextIsolation: true,       // Isolate renderer
      sandbox: true,                // Restrict renderer capabilities
      preload: path.join(__dirname, 'preload.js')
    }
  });
});
```

**SQL Injection Prevention:**
- Continue using parameterized queries (existing practice)
- No user input concatenated into SQL

**XSS Prevention:**
- React's built-in XSS protection (existing)
- No `dangerouslySetInnerHTML` (existing practice)

### 9.3 Licensing Security

**Tamper Detection:**
- System time rollback detection
- Hardware fingerprint validation
- Database integrity checks
- Audit logging for suspicious activities

**Product Key Security:**
- Server-side generation (not client-side)
- Checksum validation
- Hashed storage (never store plaintext keys)
- One-time use enforcement

### 9.4 Network Security

**Auto-Updater:**
- HTTPS only for update downloads
- SHA512 checksum verification
- Code signing for executables

**No Cloud Dependencies:**
- All data stored locally
- No telemetry without explicit consent
- Optional silent phone-home for license verification (when internet available)

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Existing Tests (Maintain):**
- Rate engine calculations
- Tax engine logic
- PDF generation
- Business logic utilities

**New Tests Required:**
- License validation
- Product key encoding/decoding
- Checksum calculation
- Hardware fingerprinting
- Subscription expiry calculations

### 10.2 Integration Tests

**Database Operations:**
- CRUD operations with local Postgres
- Backup and restore
- Data import/export
- Transaction handling

**Licensing:**
- License activation flow
- Expiry stage transitions
- Middleware enforcement
- Tamper detection

**Wizards:**
- Setup wizard completion
- Data import validation
- Error handling

### 10.3 End-to-End Tests

**Critical Flows:**
1. Fresh install → Setup wizard → Dashboard
2. Data import → Verify data → Use features
3. License expiry → Grace → Read-only → Expired
4. Auto-update detection → Download → Install
5. Backup → Restore → Verify integrity

### 10.4 Manual Testing Checklist

**Installation:**
- [ ] Install on clean Windows 10 machine
- [ ] Install on clean Windows 11 machine
- [ ] Install with custom directory
- [ ] Verify PostgreSQL service created
- [ ] Verify desktop shortcut created
- [ ] Verify Start Menu shortcut created

**First Run:**
- [ ] First-run wizard completes successfully
- [ ] Database initialized
- [ ] Admin user created
- [ ] License activation works
- [ ] Invalid key rejected
- [ ] Duplicate key rejected

**Data Import:**
- [ ] Excel import validates correctly
- [ ] CSV import validates correctly
- [ ] JSON import validates correctly
- [ ] Error messages clear
- [ ] Valid records import
- [ ] Invalid records skipped with details

**Feature Testing:**
- [ ] All existing features work identically to cloud version
- [ ] PDF generation works
- [ ] Rate engine calculates correctly
- [ ] Tax engine works
- [ ] Reports generate correctly
- [ ] All modules functional

**Licensing:**
- [ ] Active status shows correctly
- [ ] Grace period allows full access
- [ ] Read-only mode blocks edits
- [ ] PDF generation blocked in read-only
- [ ] Expired mode shows lockdown
- [ ] Time rollback detected
- [ ] Hardware change detected

**Backup/Restore:**
- [ ] Manual backup works
- [ ] Automatic backup runs
- [ ] Restore from backup works
- [ ] Data integrity maintained

**Auto-Update:**
- [ ] Update check works (with internet)
- [ ] Update notification shown
- [ ] Download completes
- [ ] Install and restart works
- [ ] No errors when offline

**Uninstall:**
- [ ] Uninstall removes program files
- [ ] User data preserved
- [ ] PostgreSQL service removed
- [ ] Shortcuts removed
- [ ] Clean registry

### 10.5 Performance Testing

**Load Testing (4-5 concurrent users):**
- Multiple users creating records simultaneously
- Concurrent PDF generation
- Simultaneous report generation
- Database query performance under load

**Database Growth:**
- 1,000 customers
- 5,000 trips
- 10,000 invoices
- Verify query performance remains acceptable

**Memory Usage:**
- Baseline memory usage
- Memory after 8 hours operation
- Memory leak detection

---

## 11. Performance & Scalability

### 11.1 Performance Targets

| Metric | Target |
|--------|--------|
| Application startup | < 5 seconds |
| Database query (average) | < 100ms |
| PDF generation | < 3 seconds |
| Report generation | < 5 seconds |
| Memory usage (idle) | < 200MB |
| Memory usage (peak) | < 500MB |

### 11.2 Database Scalability

**PostgreSQL Configuration:**
- Optimized for 4-5 concurrent users
- Handles 10+ concurrent connections safely
- Efficient for databases up to 100GB
- Automatic VACUUM prevents bloat

**Expected Data Growth:**
- Year 1: ~100MB
- Year 2: ~300MB
- Year 3: ~600MB
- Year 5: ~1.5GB

All well within PostgreSQL's capabilities.

### 11.3 Optimization Strategies

**Database Indexing:**
- Existing indexes maintained
- Add indexes for commonly filtered fields
- Regular `ANALYZE` for query optimization

**Connection Pooling:**
- Max 20 connections (sufficient for 4-5 users)
- Idle timeout to release connections
- Connection reuse

**Caching:**
- Static data (vehicle types, tax components) cached in memory
- Reduce repeated database queries

**PDF Generation:**
- Stream large PDFs to disk
- Don't keep entire PDF in memory

### 11.4 Maintenance

**Automatic Tasks:**
- Daily backups at 2:00 AM
- Weekly VACUUM ANALYZE (Sundays at 3:00 AM)
- Log rotation (keep last 30 days)

**User Maintenance Options:**
- Manual backup trigger
- Manual restore
- Database compaction
- Clear old logs

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up Electron project structure
- Configure build system
- Bundle PostgreSQL distribution
- Create NSIS installer script
- Basic main process + window creation

### Phase 2: Database Integration (Week 2-3)
- Postgres service manager
- Database initialization
- Connection configuration
- Backup/restore implementation
- Test all database operations

### Phase 3: Licensing System (Week 3-4)
- Product key generation utility
- License manager implementation
- Hardware fingerprinting
- Expiry stage logic
- Middleware enforcement
- Frontend status indicators

### Phase 4: Setup Wizards (Week 4-5)
- First-run wizard UI
- License activation screen
- Admin user creation
- Data import wizard
- Excel/CSV/JSON parsing
- Validation logic
- Error handling

### Phase 5: Auto-Updater (Week 5-6)
- Configure electron-updater
- Update server setup
- Update UI notifications
- Download/install logic
- Testing update flow

### Phase 6: Testing & Polish (Week 6-7)
- Unit tests
- Integration tests
- E2E tests
- Manual testing on clean machines
- Performance testing
- Security review

### Phase 7: Documentation & Release (Week 7-8)
- User documentation
- Admin guide
- Installation guide
- Training materials
- Beta testing
- Final release

---

## 13. Success Criteria

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

## 14. Open Questions & Decisions Needed

1. **Product Key Generation:** Who will generate product keys? Need a server-side utility?
2. **Update Server:** Use GitHub Releases or custom server?
3. **Code Signing:** Do you have a code signing certificate? (Recommended for Windows)
4. **Beta Testing:** Who will be beta testers? How many users?
5. **Support Model:** How will users get support? Email, phone, remote?

---

## 15. Next Steps

1. **Review this specification** - Approve or request changes
2. **Create implementation plan** - Detailed task breakdown with estimates
3. **Set up development environment** - Electron, build tools, PostgreSQL bundle
4. **Begin Phase 1** - Foundation work

---

**Document Status:** Draft - Pending Approval
**Last Updated:** 2026-03-27
**Author:** Claude (AI Assistant)
**Version:** 1.0
