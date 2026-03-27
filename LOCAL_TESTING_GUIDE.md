# TravelERP Lite - Local Testing Guide

**Purpose:** Test the complete application locally before beta release
**Date:** March 27, 2026

---

## Prerequisites Check

### Required Software

- [ ] **Node.js 20+** - Check with `node --version`
- [ ] **npm** - Check with `npm --version`
- [ ] **Git** - Check with `git --version`
- [ ] **Windows 10/11** (64-bit)

### System Resources

- [ ] **RAM:** 4GB minimum (8GB recommended)
- [ ] **Disk Space:** 3GB free
- [ ] **PostgreSQL:** Will be downloaded automatically

---

## Step-by-Step Testing Guide

### Step 1: Verify Environment

```bash
# Check Node.js version (must be 20+)
node --version

# Check npm version
npm --version

# Check git
git --version

# Check available memory (Windows)
systeminfo | findstr /C:"Total Physical Memory"
```

**Expected:**
- Node.js: v20.x.x or higher
- npm: 10.x.x or higher
- Git: 2.x.x or higher

---

### Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Verify installation
ls node_modules  # Should see packages
ls server/node_modules  # Should see packages
```

**Expected:** No errors during installation

---

### Step 3: Download PostgreSQL Portable

```bash
# Run download script
npm run download:postgres
```

**Expected:**
- Downloads PostgreSQL 15.3 portable (~200MB)
- Extracts to `build/postgres/`
- Takes 5-10 minutes depending on internet

**Verify:**
```bash
ls build/postgres/bin  # Should see postgres.exe
ls build/postgres/data  # Should exist (empty initially)
```

---

### Step 4: Build Application

```bash
# Build all components
npm run build:all
```

**This builds:**
1. Frontend (React + Vite)
2. Backend (Express + TypeScript)
3. Electron (Main process)

**Expected:**
- Build completes without errors
- `dist/` directory created
- `server/dist/` directory created
- `electron/dist/` directory created

**Verify:**
```bash
ls dist/index.html  # Should exist
ls server/dist/index.js  # Should exist
ls electron/dist/main.js  # Should exist
```

---

### Step 5: Run Tests

```bash
# Run all tests
npm run test:run
```

**Expected:**
- All tests pass
- 150+ unit tests
- 50+ integration tests
- 80%+ code coverage

---

### Step 6: Development Mode Test

**Terminal 1 - Start Backend:**
```bash
cd server
npm run dev
```

**Expected:**
```
Server running on http://localhost:3001
Database connected: postgresql://localhost:5433/travelerp
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```

**Expected:**
```
VITE server running at: http://localhost:5170
```

**Terminal 3 - Start Electron (after both are running):**
```bash
npm run electron:dev
```

**Expected:**
- Application window opens
- First-run wizard appears
- No errors in console

---

### Step 7: Complete First-Run Wizard

**Test each step:**

1. **Welcome Screen**
   - [ ] Welcome message displays
   - [ ] "Next" button works
   - [ ] Company info form appears

2. **Company Information**
   - [ ] Form fields work (name, GSTIN, phone, email, address)
   - [ ] Validation works (try invalid GSTIN)
   - [ ] Save succeeds with valid data
   - [ ] Next step appears

3. **License Activation**
   - [ ] License key input auto-formats
   - [ ] Validation rejects invalid keys
   - [ ] Use test key: `GT01-TEST-TEST-TEST-0001` (for testing)
   - [ ] Activation succeeds
   - [ ] Next step appears

4. **Data Import**
   - [ ] "Start Fresh" option works
   - [ ] Dashboard appears

---

### Step 8: Test Core Features

**After first-run setup:**

**Create Customer:**
1. Go to Customers
2. Click "Add Customer"
3. Fill: Name, Phone, Email, GSTIN, Address
4. Save
5. Verify customer appears in list

**Create Vehicle:**
1. Go to Vehicles
2. Click "Add Vehicle"
3. Fill: Number, Category, Owner details
4. Save
5. Verify vehicle appears in list

**Create Driver:**
1. Go to Drivers
2. Click "Add Driver"
3. Fill: Name, License number, Phone
4. Save
5. Verify driver appears in list

**Create Trip:**
1. Go to Trips
2. Click "Add Trip"
3. Fill: Customer, Date, Vehicle, Driver
4. Save
5. Verify trip appears in list

**Generate Invoice:**
1. Go to Invoices
2. Click "Create Invoice"
3. Select trip
4. Generate invoice
5. Verify PDF generates

---

### Step 9: Test Desktop Features

**Auto-Update:**
- [ ] Check for updates works (Settings → System)
- [ ] No update available message (expected)

**Backup & Restore:**
1. Go to Settings → Backup & Restore
2. Create backup
3. Verify backup appears in list
4. Add new customer
5. Restore from backup
6. Verify new customer is gone

**Network Mode (Optional - if you have another computer):**
1. Go to Settings → Network Settings
2. Select "Server" mode
3. Start server
4. Note IP address
5. On another computer, install app
6. Select "Client" mode
7. Enter server IP
8. Connect
9. Create customer from client
10. Verify appears on server

---

### Step 10: Test Data Import

**Download Templates:**
1. Go to Settings → Data Import
2. Download customer template
3. Open in Excel
4. Fill sample data
5. Save

**Import Data:**
1. Go to Settings → Data Import
2. Select "Import Data"
3. Upload file
4. Review validation
5. Import
6. Verify data in respective modules

---

## Testing Checklist

### Application Launch
- [ ] Application opens without errors
- [ ] Window displays correctly
- [ ] No console errors
- [ ] Database initializes

### First-Run Wizard
- [ ] All 4 steps work
- [ ] Company info saves
- [ ] License activates
- [ ] Data import option works

### Core Features
- [ ] Customers CRUD works
- [ ] Vehicles CRUD works
- [ ] Drivers CRUD works
- [ ] Trips CRUD works
- [ ] Invoices generate
- [ ] Reports work

### Desktop Features
- [ ] Auto-update check works
- [ ] Backup creates successfully
- [ ] Restore works correctly
- [ ] Network mode works (if tested)

### Performance
- [ ] Startup < 5 seconds
- [ ] Navigation is smooth
- [ ] Lists load quickly
- [ ] No lag or freezing

---

## Troubleshooting

### Issue: PostgreSQL Won't Start

**Symptoms:** "Database connection failed"

**Solutions:**
```bash
# Check if port 5433 is available
netstat -ano | findstr :5433

# If occupied, kill the process
taskkill /PID [PID] /F

# Or change port in .env
DATABASE_URL=postgresql://localhost:5434/travelerp
```

---

### Issue: Build Fails

**Symptoms:** TypeScript errors, build fails

**Solutions:**
```bash
# Clean everything
rm -rf node_modules dist server/dist electron/dist
rm -rf server/node_modules

# Reinstall
npm install
cd server && npm install && cd ..

# Build again
npm run build:all
```

---

### Issue: Electron Won't Launch

**Symptoms:** Electron process exits immediately

**Solutions:**
```bash
# Check Electron build
npm run build:electron

# Verify main.js exists
ls electron/dist/main.js

# Check for errors
npm run electron:dev
```

---

### Issue: First-Run Wizard Not Showing

**Symptoms:** Goes straight to dashboard

**Cause:** Database already has company info

**Solution:**
```bash
# Reset database
rm -rf build/postgres/data/*
# Restart application
```

---

### Issue: License Activation Fails

**Symptoms:** "Invalid license key"

**Solutions:**
1. Use test key: `GT01-TEST-TEST-TEST-0001`
2. Check internet connection (for online verification)
3. Verify key format: `GT01-XXXX-XXXX-XXXX-XXXX`

---

## Performance Benchmarks

**Record your results:**

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Startup Time | < 5s | ___s | ☐ |
| First-Run Wizard | < 2min | ___min | ☐ |
| Create Customer | < 500ms | ___ms | ☐ |
| List 100 Trips | < 1s | ___s | ☐ |
| Generate Invoice | < 2s | ___s | ☐ |
| Create Backup | < 30s | ___s | ☐ |

---

## Known Issues to Expect

### High Priority
- Large data imports (>1000 rows) may appear frozen (be patient)

### Medium Priority
- Auto-update notification may appear behind other windows

### Low Priority
- Some tooltips may truncate long text
- Minor scrollbar positioning issues

---

## Feedback Collection

**While testing, note:**

1. **What Worked Well:**
   -
   -

2. **Issues Found:**
   -
   -

3. **Suggestions:**
   -
   -

4. **Performance Observations:**
   -
   -

---

## After Testing

### If Everything Works:
- [ ] Document all test results
- [ ] Note any issues found
- [ ] Share feedback with team
- [ ] Proceed to beta tester onboarding

### If Issues Found:
- [ ] Document issue with steps to reproduce
- [ ] Check if it's a known issue
- [ ] Try suggested fixes
- [ ] Report if unresolved

---

## Quick Reference Commands

```bash
# Install dependencies
npm install && cd server && npm install && cd ..

# Download PostgreSQL
npm run download:postgres

# Build everything
npm run build:all

# Run tests
npm run test:run

# Development mode (3 terminals)
npm run dev                    # Terminal 1 (Frontend)
cd server && npm run dev        # Terminal 2 (Backend)
npm run electron:dev           # Terminal 3 (Electron)

# Production build
node scripts/production-build.js 1.0.0

# Build installer
npm run electron:build:win
```

---

**Happy Testing!**

*Generated: 2026-03-27*
*TravelERP Lite v1.0.0-beta.1*
