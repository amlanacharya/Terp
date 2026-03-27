# TravelERP Lite - Desktop Application Design Document

**Project:** TravelERP Lite (Desktop ERP for Travel Agencies)
**Version:** 1.0.0
**Date:** 2026-03-25
**Developer:** Intelligrip
**Customer:** Gayatri Travels (and others)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Licensing & Subscription System](#3-licensing--subscription-system)
4. [Setup Wizards](#4-setup-wizards)
5. [Auto-Updater System](#5-auto-updater-system)
6. [Data Architecture & Offline Handling](#6-data-architecture--offline-handling)
7. [Error Handling & Recovery](#7-error-handling--recovery)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment & Release Process](#9-deployment--release-process)
10. [Development Roadmap](#10-development-roadmap)
11. [Risk Assessment](#11-risk-assessment)
12. [Open Questions](#12-open-questions)

---

## 1. Project Overview

### 1.1 Objective

Transform TravelERP (web-based) into **TravelERP Lite** (desktop-based) for travel agencies who prefer offline, local installation with strong licensing control.

### 1.2 Key Requirements

- **Offline-First:** Complete functionality without internet
- **Desktop Installer:** Windows .exe installer (200MB)
- **Licensing:** Pre-encrypted product keys, offline validation, subscription expiry
- **Multi-User:** 4-5 concurrent users via LAN
- **Auto-Updates:** Silent updates when internet available
- **Data Import:** Excel/CSV/JSON import for quick setup
- **Backup/Restore:** Automatic daily backups

### 1.3 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Express 4 + TypeScript |
| Database | PostgreSQL (bundled, local) |
| Desktop Framework | Electron |
| PDF Generation | PDFKit |
| Build Tools | electron-builder + NSIS |

### 1.4 Distribution Model

- **Developer:** Intelligrip
- **Customer:** Gayatri Travels (and other travel agencies)
- **Licensing:** Pre-generated keys (100 monthly, 50 quarterly, 20 annual)
- **Key Tracking:** Intelligrip maintains Excel spreadsheet
- **Key Distribution:** Email/shared drive to customers

---

## 2. Architecture

### 2.1 High-Level Structure

```
TravelERP-Lite-Installer.exe
├── Electron Runtime (Chromium + Node.js)
├── React Frontend (Existing code)
├── Express Backend (Existing code)
├── PostgreSQL 14/15 (Bundled as Windows service)
├── Node.js 18/20 (Bundled runtime)
├── First-run Wizard (Company setup + License activation)
├── Data Import Wizard (Excel/CSV/JSON import)
└── Auto-updater (electron-updater)
```

### 2.2 Process Architecture

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
└────────────────────┘
```

### 2.3 Key Components

1. **Electron Main Process** (`electron/main.ts`)
   - Entry point for desktop app
   - Creates main window, loads React app
   - Handles license validation on startup
   - Manages auto-updater
   - Controls Postgres service lifecycle

2. **React Frontend** (Existing code, minimal changes)
   - Runs in Electron's renderer process
   - No major UI changes needed
   - API calls to `http://localhost:3001`

3. **Express Backend** (Existing code, minimal changes)
   - Runs as child process from Electron
   - Database config changed to local Postgres
   - New license validation middleware

4. **PostgreSQL** (Bundled)
   - Portable PostgreSQL for Windows
   - Runs as Windows service on localhost:5432
   - Database stored in user's AppData

5. **Licensing Module** (New)
   - Product key validation
   - Hardware fingerprinting
   - Subscription expiry tracking
   - Tamper detection

6. **Setup Wizards** (New)
   - First-run wizard: Company info + License activation
   - Data import wizard: Excel/CSV/JSON import

7. **Auto-Updater** (New)
   - Checks for updates on startup (when internet available)
   - Downloads and installs updates silently
   - User can also check manually via menu

---

## 3. Licensing & Subscription System

### 3.1 Product Key Format (16 Digits)

```
XXXX-XXXX-XXXX-XXXX
│    │    │    │
│    │    │    └─ CHECKSUM (4 digits) - Luhn algorithm
│    │    └────── RANDOM (4 digits) - For uniqueness
│    └─────────── TYPE (2 digits) + RANDOM (2 digits)
└──────────────── VERSION/PUBLISHER (4 digits) - "GT01" = Intelligrip
```

**Subscription Type Codes (digits 5-6):**
- `10` = Monthly
- `20` = Quarterly
- `30` = Annual

**Example Keys:**
- `GT01-10XY-ABCD-E4K7` → Monthly subscription
- `GT01-20XY-ABCD-J9M2` → Quarterly subscription
- `GT01-30XY-ABCD-P3Q8` → Annual subscription

### 3.2 Cryptographic Algorithm (HMAC-SHA256)

**Key Generation (Intelligrip Side - Done Once):**

```typescript
// SECRET: Known only to Intelligrip, hardcoded in TravelERP Lite
const SECRET_KEY = "INTELLIGRIP-TRAVELERP-LITE-SECRET-2026";

function generateProductKey(type: 'monthly' | 'quarterly' | 'annual'): string {
  const typeCode = type === 'monthly' ? '10' : type === 'quarterly' ? '20' : '30';

  // Generate random components
  const random1 = generateRandomDigits(2);
  const random2 = generateRandomDigits(4);
  const random3 = generateRandomDigits(4);

  // Build key without checksum
  const baseKey = `GT01${typeCode}${random1}-${random2}-${random3}-`;

  // Calculate checksum using HMAC-SHA256
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(baseKey.replace(/-/g, ''));
  const hash = hmac.digest('hex');

  // Take first 4 characters of hash, convert to 4-digit number
  const checksum = parseInt(hash.substring(0, 4), 16).toString().padStart(4, '0').slice(0, 4);

  return `GT01-${typeCode}${random1}-${random2}-${random3}-${checksum}`;
}
```

**Offline Validation (TravelERP Lite Side - Local):**

```typescript
function validateProductKey(productKey: string): { valid: boolean; type?: string; error?: string } {
  // Format validation
  const formatRegex = /^GT01-(10|20|30)\d{2}-\d{4}-\d{4}-\d{4}$/;
  if (!formatRegex.test(productKey)) {
    return { valid: false, error: 'Invalid key format' };
  }

  // Extract type from key
  const typeCode = productKey.substring(5, 7);
  const type = typeCode === '10' ? 'monthly' : typeCode === '20' ? 'quarterly' : 'annual';

  // Recalculate checksum
  const providedChecksum = productKey.split('-')[3];
  const baseKey = productKey.substring(0, 14) + productKey.substring(15, 19) + '-';
  const SECRET_KEY = "INTELLIGRIP-TRAVELERP-LITE-SECRET-2026";

  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(baseKey.replace(/-/g, ''));
  const hash = hmac.digest('hex');
  const calculatedChecksum = parseInt(hash.substring(0, 4), 16).toString().padStart(4, '0').slice(0, 4);

  // Verify checksum
  if (providedChecksum !== calculatedChecksum) {
    return { valid: false, error: 'Invalid product key' };
  }

  return { valid: true, type };
}
```

### 3.3 Subscription Duration Calculation

```typescript
function calculateExpiryDate(type: string, activationDate: Date): Date {
  const expiry = new Date(activationDate);

  switch (type) {
    case 'monthly':
      expiry.setMonth(expiry.getMonth() + 1);
      break;
    case 'quarterly':
      expiry.setMonth(expiry.getMonth() + 3);
      break;
    case 'annual':
      expiry.setFullYear(expiry.getFullYear() + 1);
      break;
  }

  return expiry;
}
```

### 3.4 Expiry Stages Implementation

```typescript
function getLicenseStatus(license: License): 'active' | 'grace' | 'readonly' | 'expired' {
  const now = new Date();
  const expiryDate = new Date(license.expiry_date);
  const daysPastExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysPastExpiry <= 0) return 'active';           // Within subscription period
  if (daysPastExpiry <= 7) return 'grace';            // Days 1-7: Full functionality
  if (daysPastExpiry <= 27) return 'readonly';        // Days 8-27: Read-only, no PDFs
  return 'expired';                                    // Day 28+: Complete lockdown
}
```

### 3.5 Middleware Enforcement

```typescript
export async function licenseCheck(req: Request, res: Response, next: NextFunction) {
  const license = await getCurrentLicense();
  const status = getLicenseStatus(license);

  // Always allow license verification endpoint
  if (req.path === '/api/license/verify') return next();

  // Read-only endpoints (GET) work in readonly mode
  const isReadOnlyRequest = req.method === 'GET' && !req.path.includes('/pdf');

  if (status === 'active' || status === 'grace') {
    return next();  // Full access
  }

  if (status === 'readonly' && isReadOnlyRequest) {
    return next();  // Allow GET requests (browsing data)
  }

  if (status === 'readonly' && req.path.includes('/pdf')) {
    return res.status(403).json({ error: 'PDF generation disabled. Please renew subscription.' });
  }

  return res.status(403).json({
    error: 'Subscription expired. Please contact administrator to renew.',
    status,
    expiryDate: license.expiry_date
  });
}
```

### 3.6 Database Schema

```sql
-- Available key pool (imported but not yet activated)
CREATE TABLE license_pool (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key text NOT NULL UNIQUE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'quarterly', 'annual')),
  date_added timestamptz DEFAULT now(),
  is_available boolean DEFAULT true
);

-- Activated licenses
CREATE TABLE licenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key text NOT NULL UNIQUE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'quarterly', 'annual')),
  activation_date timestamptz NOT NULL,
  expiry_date timestamptz NOT NULL,
  hardware_fingerprint text NOT NULL,
  last_verified timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Import logs (Intelligrip's audit trail)
CREATE TABLE license_import_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_date timestamptz DEFAULT now(),
  keys_imported integer NOT NULL,
  monthly_count integer DEFAULT 0,
  quarterly_count integer DEFAULT 0,
  annual_count integer DEFAULT 0,
  file_name text,
  notes jsonb
);
```

### 3.7 Frontend States

| State | Access | UI Badge | Behavior |
|-------|--------|----------|----------|
| **Active** | Full | Green (days remaining) | Normal operation |
| **Grace** | Full | Yellow (renew soon) | Warning banner, full access |
| **Readonly** | View only | Orange (expired) | No edits, no PDFs, view data only |
| **Expired** | None | Red (contact admin) | Lockdown screen, app unusable |

---

## 4. Setup Wizards

### 4.1 First-Run Wizard Flow

```
Welcome → Company Info → License Activation → Data Import → Dashboard
```

**Step 1: Welcome Screen**
- Welcome message
- Brief overview of TravelERP Lite
- "Get Started" button

**Step 2: Company Information**

```typescript
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

**Step 3: License Activation**
- Product key input (16 digits, auto-formatted)
- Activate button
- Validation feedback
- Success message with expiry date

**Step 4: Data Import Choice**
- "Yes, Import Data" → Launch import wizard
- "No, Start Fresh" → Go to dashboard
- "Do It Later" → Go to dashboard, show reminder later

### 4.2 Data Import Wizard

**Supported Formats:**
- Excel (.xlsx, .xls)
- CSV (.csv)
- JSON (.json)

**Importable Entities:**
- Customers
- Vehicle Categories
- Rate Charts
- Vehicles
- Drivers

**Excel/CSV Template Structure:**

```csv
# customers.csv
customer_name,contact_person,phone,email,address,city,state,pin_code,gst_number

# vehicle_categories.csv
category_name,description,seating_capacity

# rate_charts.csv
customer_name,vehicle_category,duty_type,base_km,base_hrs,base_rate,extra_km_rate,extra_hr_rate

# vehicles.csv
vehicle_number,vehicle_category,registration_year,insurance_expiry,pollution_expiry

# drivers.csv
driver_name,phone,license_number,license_expiry,address
```

**JSON Import Format:**

```json
{
  "customers": [...],
  "vehicle_categories": [...],
  "rate_charts": [...],
  "vehicles": [...],
  "drivers": [...]
}
```

**Import Validation:**
- Required fields check
- Duplicate detection
- Foreign key validation
- Data type validation
- Format validation (GST, phone, email)

**Import Progress Tracking:**
- Real-time progress bar
- Success/failure counts
- Error summaries
- Partial import support

### 4.3 Database Schema for Company Settings

```sql
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name text NOT NULL,
  business_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pin_code text NOT NULL,
  gst_number text,
  phone text NOT NULL,
  email text NOT NULL,
  pan_number text,
  sac_code text DEFAULT '998511',
  default_duty_start_time text DEFAULT '09:00',
  default_duty_hours integer DEFAULT 8,
  invoice_pdf_mode text DEFAULT 'invoice_only',
  tax_config jsonb DEFAULT '{
    "intra_state": {"cgst_rate": 2.5, "sgst_rate": 2.5},
    "inter_state": {"igst_rate": 5.0}
  }',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## 5. Auto-Updater System

### 5.1 Update Architecture

```
Intelligrup Server (releases.intelligrup.com)
  └── /releases/travelerp-lite/latest.json
       ↓
TravelERP Lite (Electron)
  └── electron-updater
       ├── Check on startup
       ├── Download in background
       └── Install on restart
```

### 5.2 Update Check Triggers

- **App startup:** Check if internet available
- **Manual check:** Help → Check for Updates
- **Scheduled:** Every 7 days (if internet available)

### 5.3 Update Events

```typescript
// Update available
autoUpdater.on('update-available', (info) => {
  // Show silent notification
  new Notification({
    title: 'TravelERP Lite Update Available',
    body: `Version ${info.version} ready to download.`
  }).show();
});

// Downloaded and ready
autoUpdater.on('update-downloaded', (info) => {
  // Show prominent dialog
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready to Install',
    message: `Version ${info.version} has been downloaded.`,
    buttons: ['Install Now', 'Later']
  });
});
```

### 5.4 Release Server Structure

```
/var/www/releases.intelligrup.com/travelerp-lite/
├── latest.json
├── releases/
│   ├── 1.0.0/
│   │   ├── TravelERP-Lite-Setup-1.0.0.exe
│   │   └── RELEASES.json
│   ├── 1.0.1/
│   └── 1.2.0/
└── history.json
```

**latest.json Format:**

```json
{
  "version": "1.2.3",
  "release_date": "2026-03-25T10:30:00Z",
  "installer_url": "https://releases.intelligrup.com/travelerp-lite/releases/1.2.3/TravelERP-Lite-Setup-1.2.3.exe",
  "size_bytes": 185000000,
  "mandatory": false,
  "changelog": "Bug fixes and improvements..."
}
```

---

## 6. Data Architecture & Offline Handling

### 6.1 Local PostgreSQL Setup

**Database Storage Location:**

```
C:\Users\[Username]\AppData\Local\TravelERP-Lite\
├── postgres\
│   ├── data\                    # Database files
│   └── postgres.conf
├── backups\                     # Automatic backups
│   ├── manual\
│   └── auto\
├── exports\                     # User exports
├── imports\                     # User imports
├── logs\
└── config\
```

### 6.2 PostgreSQL Configuration

**postgres.conf (Optimized for Desktop):**

```ini
# Memory settings
shared_buffers = 128MB
effective_cache_size = 256MB
work_mem = 16MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 10

# Performance
random_page_cost = 1.1  # SSD optimization
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = 'C:\\Users\\[Username]\\AppData\\Local\\TravelERP-Lite\\logs'
log_filename = 'postgres-%Y-%m-%d.log'
```

### 6.3 Multi-User Data Access

**Solution A: Network Shared Database (Recommended)**

```
Server Machine (Main PC)
  └── TravelERP-Lite Server (Headless Mode)
       └── PostgreSQL on localhost:5432 (exposed to LAN)
            ↓
Client PC 1, 2, 3, 4
  └── TravelERP-Lite (Client Mode)
       └── Connects to server IP:192.168.1.100:5432
```

**Server Mode:**
```json
{
  "mode": "server",
  "listenAddress": "0.0.0.0",
  "port": 5432,
  "maxConnections": 10
}
```

**Client Mode:**
```json
{
  "mode": "client",
  "serverAddress": "192.168.1.100",
  "port": 5432
}
```

### 6.4 Automatic Backup System

**Backup Schedule:**
- **Daily:** 8:00 AM (before business hours)
- **Manual:** User-triggered via Settings
- **Retention:** Last 30 daily backups

**Backup Script:**

```typescript
async function createBackup(type: 'auto' | 'manual'): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `backup-${timestamp}.sql`;
  const backupPath = path.join(app.getPath('userData'), 'backups', type, filename);

  // Use pg_dump for backup
  const command = `pg_dump -U travelerp_user -Fc -f "${backupPath}" travelerp_lite`;
  await execAsync(command);

  // Clean old backups (keep last 30)
  await cleanOldBackups(backupPath, 30);

  return backupPath;
}
```

**Restore Functionality:**

```typescript
async function restoreBackup(backupPath: string): Promise<void> {
  // Confirm with user
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Restore Backup',
    message: 'This will replace all current data. Are you sure?',
    buttons: ['Cancel', 'Create Backup & Restore', 'Restore Anyway']
  });

  if (result.response === 1) {
    await createBackup('manual'); // Safety backup
  }

  // Stop Postgres, restore, restart
  await stopPostgresService();
  await execAsync(`dropdb -U travelerp_user travelerp_lite`);
  await execAsync(`createdb -U travelerp_user travelerp_lite`);
  await execAsync(`pg_restore -U travelerp_user -d travelerp_lite "${backupPath}"`);
  await startPostgresService();
}
```

### 6.5 Data Export Capabilities

**Supported Formats:**
1. **Excel** (.xlsx) - Reports, invoices, customer lists
2. **PDF** (.pdf) - Invoices, receipts, reports
3. **CSV** (.csv) - Raw data for analysis
4. **Backup** (.backup) - Full database backup

---

## 7. Error Handling & Recovery

### 7.1 Error Categories

| Category | Handling Strategy |
|----------|-------------------|
| **CRITICAL** | App cannot continue → Show error, log crash, offer restart |
| **WARNING** | App can continue → Show warning, log, allow workaround |
| **RECOVERABLE** | Can be fixed → Retry, fallback, silent recovery |
| **USER_ACTION** | Requires user → Show solution, guide user |

### 7.2 Common Error Scenarios

**Database Connection Failed**
- Try to start Postgres service
- Retry connection
- Show user-friendly error with solutions

**License Validation Failed**
- Invalid key → Return to activation screen
- Subscription expired → Show appropriate mode (grace/readonly/expired)
- Tamper detected → Lock app, show support contact

**PDF Generation Failed**
- Retry with fallback font
- Fallback to HTML version
- Offer Excel export alternative

**Data Import Failed**
- Show validation errors clearly
- Allow partial imports (skip invalid rows)
- Provide detailed error summary

### 7.3 Automatic Recovery Mechanisms

**Transaction Rollback:**
```typescript
async function createInvoice(invoiceData: InvoiceData): Promise<Invoice> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO invoices ...');
    for (const item of invoiceData.items) {
      await client.query('INSERT INTO invoice_items ...');
    }
    await client.query('COMMIT');
    return invoiceResult;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**Auto-Retry with Exponential Backoff:**
```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      await sleep(waitTime);
    }
  }
}
```

### 7.4 Crash Reporting & Logging

**Log Levels:**
- `ERROR` → Critical errors, crashes, security issues
- `WARN` → Warnings, degraded functionality
- `INFO` → Normal operations, user actions
- `DEBUG` → Detailed diagnostics (development only)

**Log Rotation:**
- Keep last 7 days of logs
- Max file size: 10MB per file
- Compress old logs

---

## 8. Testing Strategy

### 8.1 Testing Pyramid

```
         E2E Tests (10%)
      Integration Tests (30%)
         Unit Tests (60%)
```

### 8.2 Unit Tests

**Coverage:**
- Business logic (rate calculations, tax calculations)
- License validation (key format, checksum, expiry)
- Data validation (GST, phone, email formats)

**Example:**
```typescript
describe('Rate Calculator', () => {
  it('should calculate local trip with base package', () => {
    const trip = {
      dutyType: 'local',
      baseKm: 80,
      baseHrs: 8,
      baseRate: 3500,
      extraKmRate: 18,
      extraHrRate: 180,
      actualKm: 95,
      actualHrs: 9
    };

    const result = calculateInvoiceAmount(trip);

    expect(result.baseAmount).toBe(3500);
    expect(result.extraKmCharge).toBe(270);
    expect(result.totalBeforeTax).toBe(3950);
  });
});
```

### 8.3 Integration Tests

**Coverage:**
- Database operations (CRUD, transactions)
- API endpoints (request/response, error handling)
- PDF generation (data rendering, font fallbacks)

**Example:**
```typescript
describe('Invoice API Integration Tests', () => {
  it('should create invoice with trip data', async () => {
    const trip = await pool.query('INSERT INTO trips ... RETURNING *');

    const response = await app.request('/api/invoices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ trip_id: trip.rows[0].id })
    });

    expect(response.status).toBe(201);
    expect(response.data.invoice_number).toBeDefined();
  });
});
```

### 8.4 End-to-End Tests (Playwright)

**Coverage:**
- First-run wizard → License activation
- Create trip → Generate invoice → Print PDF
- Data import wizard
- License expiry handling

**Example:**
```typescript
test('should complete setup and activate license', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Step 1: Company Information
  await page.fill('[name="company_name"]', 'Test Travels');
  await page.click('button:has-text("Next")');

  // Step 2: License Activation
  await page.fill('[name="product_key"]', 'GT01-10AB-1234-5678-E9K2');
  await page.click('button:has-text("Activate")');

  // Should redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
});
```

### 8.5 Performance Testing

**Scenarios:**
- Retrieve 10,000 trips in under 2 seconds
- Handle 5 concurrent invoice creations
- Generate PDF for 50-page invoice
- Import 1,000 customers

---

## 9. Deployment & Release Process

### 9.1 Versioning Strategy

**Semantic Versioning:**
```
MAJOR.MINOR.PATCH

1.2.3
 │ │ │
 │ │ └─ PATCH: Bug fixes, hotfixes
 │ └─── MINOR: New features (backward compatible)
 └────── MAJOR: Breaking changes, major redesign
```

### 9.2 Build Process

```bash
# Frontend build
cd src
npm run build

# Backend build
cd server
npm run build

# Electron build
npm run build:windows

# Output:
# dist/TravelERP-Lite-Setup-1.2.3.exe     (Installer)
# dist/TravelERP-Lite-1.2.3.exe           (Portable)
```

### 9.3 electron-builder Configuration

```yaml
# electron-builder.yml
appId: 'com.intelligrip.travelerp-lite'
productName: 'TravelERP Lite'

win:
  target:
    - target: nsis         # Windows installer
      arch: [x64]
    - target: portable     # Portable version

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true

publish:
  provider: generic
  url: 'https://releases.intelligrup.com/travelerp-lite/'
```

### 9.4 Release Checklist

**Pre-Release:**
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version number bumped
- [ ] License keys pool generated
- [ ] Manual testing on clean Windows machine

**Release Process:**
```bash
# 1. Create release branch
git checkout -b release/1.2.3

# 2. Update version numbers
# 3. Build for production
npm run build:windows

# 4. Test installer on clean machine

# 5. Tag release
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin v1.2.3

# 6. Upload to release server
# Upload dist/TravelERP-Lite-Setup-1.2.3.exe
# Update releases.intelligrup.com/latest.json

# 7. Create GitHub Release
gh release create v1.2.3 \
  --title "TravelERP Lite v1.2.3" \
  dist/TravelERP-Lite-Setup-1.2.3.exe
```

### 9.5 Key Generation & Distribution

**Pre-release Key Generation:**

```typescript
// scripts/generate-keys.ts
async function generateKeyPool(version: string): Promise<void> {
  const monthlyKeys = Array.from({ length: 100 }, () => generateProductKey('monthly'));
  const quarterlyKeys = Array.from({ length: 50 }, () => generateProductKey('quarterly'));
  const annualKeys = Array.from({ length: 20 }, () => generateProductKey('annual'));

  const keyPool = {
    version,
    generated_date: new Date().toISOString(),
    keys: { monthly: monthlyKeys, quarterly: quarterlyKeys, annual: annualKeys }
  };

  // Save to encrypted file (Intelligrup records only)
  fs.writeFileSync(`keys-${version}.json.enc`, encrypt(JSON.stringify(keyPool)));
}
```

**Key Distribution (Excel Tracker):**

```
Customer Name       | Contact   | Keys Issued               | Issue Date   | Type
Gayatri Travels     | Premdeep  | GT01-10AB-1234-E4K7        | 2026-03-25   | Monthly
Gayatri Travels     | Premdeep  | GT01-20CD-5678-J9M2        | 2026-03-25   | Quarterly
```

---

## 10. Development Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up Electron packaging infrastructure

**Tasks:**
- Initialize Electron project
- Configure `electron-builder`
- Set up main/renderer process structure
- Download portable PostgreSQL for Windows
- Create initialization scripts
- Test database creation on fresh machine
- Configure NSIS installer script
- Test installer on clean Windows machine

**Deliverables:**
- Working Electron app that launches React frontend
- Bundled PostgreSQL that starts on installation
- Windows installer (.exe) that works end-to-end

**Success Criteria:**
- Can install app on fresh Windows machine
- Database initializes automatically
- App launches and shows login screen

---

### Phase 2: Licensing System (Weeks 3-4)

**Goal:** Implement offline license validation

**Tasks:**
- Design key format (GT01-XXXX-XXXX-XXXX)
- Implement HMAC-SHA256 checksum algorithm
- Generate initial key pool (100M, 50Q, 20A)
- Create key generation CLI tool
- Implement key format validation
- Implement checksum verification
- Create license activation flow
- Store activated licenses in database
- Implement expiry calculation
- Build expiry status system
- Create license middleware for Express routes
- Implement hardware fingerprinting
- Design first-run wizard UI
- Implement form validation
- Create license activation screen
- Test activation flow end-to-end

**Deliverables:**
- Working license validation system
- Pre-generated key pool (170 keys)
- First-run wizard for setup
- License expiry enforcement

**Success Criteria:**
- Invalid keys are rejected
- Valid keys activate successfully
- Expiry dates calculate correctly
- Grace/readonly/expired modes work

---

### Phase 3: Data Import Wizard (Week 5)

**Goal:** Build initial data import system

**Tasks:**
- Define Excel/CSV template structure
- Define JSON import format
- Create validation rules for each entity
- Implement Excel parser (using `xlsx` library)
- Build Excel/CSV parser
- Build JSON parser
- Implement data validation
- Handle duplicates and conflicts
- Design multi-step import flow UI
- Create file upload interface
- Build import preview screen
- Show import progress
- Display validation errors clearly
- Allow partial imports
- Show import summary
- Log all import activities

**Deliverables:**
- Working Excel/CSV import
- Working JSON import
- Import wizard UI
- Import error handling

**Success Criteria:**
- Can import 100+ customers
- Can import 50+ rate charts
- Validation errors show clearly
- Partial imports work correctly

---

### Phase 4: Auto-Updater (Week 6)

**Goal:** Implement automatic update system

**Tasks:**
- Set up releases.intelligrup.com
- Create `latest.json` structure
- Configure HTTPS/SSL
- Test endpoint accessibility
- Install `electron-updater`
- Configure update checks
- Implement download in background
- Create update notification UI
- Add "Check for Updates" menu item
- Create update dialogs
- Add update progress indicator
- Generate RELEASES.json
- Upload builds to server
- Test update flow (1.0.0 → 1.0.1)
- Verify rollback capability

**Deliverables:**
- Working auto-updater
- Update server infrastructure
- Update UI/UX
- Tested update flow

**Success Criteria:**
- App checks for updates on startup
- Updates download in background
- User can install updates with one click
- Manual update check works

---

### Phase 5: Multi-User Network Mode (Weeks 7-8)

**Goal:** Enable 4-5 concurrent users

**Tasks:**
- Design server vs client mode
- Configure PostgreSQL for remote connections
- Implement connection dialog
- Test LAN connectivity
- Create headless server mode
- Configure Postgres to listen on 0.0.0.0
- Implement connection pooling
- Add server status indicator
- Build server discovery (IP input)
- Implement remote connection
- Handle connection failures
- Test concurrent access (5 users)
- Verify data consistency
- Check for deadlocks
- Test concurrent invoice creation

**Deliverables:**
- Working network mode
- Server selection dialog
- Tested multi-user access
- Connection error handling

**Success Criteria:**
- 5 users can work simultaneously
- No data corruption
- No deadlocks
- Connection failures handled gracefully

---

### Phase 6: Backup & Restore (Week 9)

**Goal:** Implement data backup system

**Tasks:**
- Implement `pg_dump` integration
- Create automatic daily backups
- Add manual backup trigger
- Implement backup retention (30 days)
- Build restore UI
- Implement `pg_restore` integration
- Add pre-restore backup (safety)
- Test restore on clean machine
- Show backup history
- Allow backup deletion
- Add export backup option
- Implement backup compression
- Test backup on 10,000 records
- Test restore on fresh machine
- Verify data integrity
- Test corrupted backup handling

**Deliverables:**
- Automatic daily backups
- Manual backup/restore
- Backup management UI
- Tested backup/restore flow

**Success Criteria:**
- Backups create automatically
- Restores work correctly
- No data loss after restore
- Backup files are compressed

---

### Phase 7: Testing & QA (Week 10)

**Goal:** Comprehensive testing

**Tasks:**
- Write tests for rate calculations
- Write tests for tax calculations
- Write tests for license validation
- Write tests for data validation
- Test database operations
- Test API endpoints
- Test PDF generation
- Test import/export
- Test first-run wizard
- Test trip creation flow
- Test invoice generation
- Test license expiry
- Test on Windows 10
- Test on Windows 11
- Test on fresh machine
- Test upgrade from previous version
- Test 10,000 trips retrieval
- Test concurrent users
- Test large PDF generation
- Test import of 1,000 records

**Deliverables:**
- 80%+ test coverage
- All E2E tests passing
- Performance benchmarks met
- Manual testing checklist complete

**Success Criteria:**
- All tests passing
- No critical bugs
- Performance acceptable
- Ready for beta release

---

### Phase 8: Beta Release & Feedback (Weeks 11-12)

**Goal:** Real-world testing with Gayatri Travels

**Tasks:**
- Tag beta version (v1.0.0-beta.1)
- Create installer for Gayatri Travels
- Provide license keys
- Deploy to test environment
- Create user documentation
- Record video tutorials
- Conduct training session
- Provide support contact
- Set up bug tracking system
- Collect feedback from users
- Prioritize issues
- Fix critical bugs immediately
- Release beta.2, beta.3 as needed
- Incorporate user feedback
- Refine UX issues
- Stabilize for production

**Deliverables:**
- Beta release deployed
- User documentation
- Bug tracking system
- Feedback collected

**Success Criteria:**
- Gayatri Travels can use app for daily operations
- No critical bugs remaining
- User feedback is positive
- Ready for production release

---

### Phase 9: Production Release (Week 13)

**Goal:** Stable v1.0.0 release

**Tasks:**
- Fix all beta bugs
- Polish UI/UX
- Update documentation
- Create release notes
- Generate full key pool (170 keys)
- Create final installer
- Test installer on fresh machines
- Prepare release announcement
- Tag v1.0.0
- Upload to release server
- Send announcement to customers
- Monitor for issues
- Respond to support requests
- Prepare hotfix process
- Plan v1.1.0 features

**Deliverables:**
- Production v1.0.0 release
- Release notes
- User documentation
- Support process

**Success Criteria:**
- Clean production release
- No critical issues in first week
- Positive user feedback
- Support process working

---

### Phase 10: Post-Release Maintenance (Ongoing)

**Goal:** Continuous improvement

**Tasks:**
- Monitor error logs
- Track performance metrics
- Gather user feedback
- Identify improvement areas
- Release v1.0.1, v1.0.2 as needed
- Fix reported issues
- Improve stability
- Add requested features
- Improve UX
- Enhance performance
- Expand capabilities
- Respond to inquiries
- Provide training
- Issue license keys
- Assist with migrations

---

### Timeline Summary

| Phase | Duration | Weeks | Deliverables |
|-------|----------|-------|--------------|
| Phase 1: Foundation | 2 weeks | 1-2 | Electron + PostgreSQL bundling |
| Phase 2: Licensing | 2 weeks | 3-4 | License validation system |
| Phase 3: Data Import | 1 week | 5 | Import wizard |
| Phase 4: Auto-Updater | 1 week | 6 | Auto-update system |
| Phase 5: Multi-User | 2 weeks | 7-8 | Network mode |
| Phase 6: Backup/Restore | 1 week | 9 | Backup system |
| Phase 7: Testing & QA | 1 week | 10 | Comprehensive testing |
| Phase 8: Beta Release | 2 weeks | 11-12 | Beta + feedback |
| Phase 9: Production Release | 1 week | 13 | v1.0.0 release |
| **Total** | **13 weeks** | | **Production-ready app** |

---

## 11. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **PostgreSQL corruption** | High | Low | Daily backups, backup testing, restore procedures |
| **License key cracking** | Medium | Low | HMAC-SHA256 encryption, hardware fingerprinting, tamper detection |
| **Database performance degradation** | Medium | Low | Optimized queries, indexes, connection pooling |
| **Windows compatibility issues** | Medium | Low | Test on Win10/11, provide system requirements |
| **Installer fails** | High | Low | Test on clean machines, troubleshooting guide |
| **Multi-user deadlocks** | Medium | Medium | Transaction handling, retry logic, thorough testing |
| **Auto-updater fails** | Low | Low | Graceful degradation, manual download option |
| **Data import errors** | Medium | High | Validation, partial imports, error summaries |
| **Concurrent data conflicts** | Medium | Medium | Database constraints, transaction isolation |
| **Customer loses license keys** | High | Medium | Intelligrip maintains master list, can reissue |

---

## 12. Open Questions

1. **Installer Testing Environment**
   - Access to multiple Windows machines for testing?
   - Test on Windows 10, Windows 11, or both?
   - Specific Windows editions to target?

2. **Key Generation Secret Storage**
   - Where will the SECRET_KEY for HMAC be stored?
   - Hardcoded in app (risk of reverse engineering)?
   - Or use key derivation function?

3. **Network Mode Configuration**
   - Server IP configurable by customers?
   - Implement auto-discovery (mDNS/Bonjour)?
   - What if server IP changes (DHCP)?

4. **Backup Storage Location**
   - Backups in AppData (default)?
   - Allow users to choose backup location?
   - Support cloud backup in future?

5. **PDF Generation Performance**
   - Implement PDF generation caching?
   - Maximum invoice size expected (pages/items)?
   - Special fonts for Hindi/local language?

6. **Error Reporting**
   - Send anonymous error reports to Intelligrip?
   - Keep everything local?
   - Which crash reporting tool to use?

---

## Conclusion

This design document outlines a comprehensive approach to transforming TravelERP from a web-based application to a desktop-based ERP system. The key decisions include:

- **Electron + PostgreSQL** for proven scalability and strong licensing
- **Offline-only licensing** for simplicity and reliability
- **Pre-generated key pool** for easy distribution
- **Graceful subscription expiry** for customer-friendliness
- **Multi-user network mode** for collaborative work
- **Auto-updater** for seamless updates

The 13-week development roadmap provides a structured path from initial setup to production release, with built-in testing and feedback cycles.

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-25
**Status:** Design Complete - Awaiting Approval
