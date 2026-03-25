# TravelERP Lite - Installation Guide

**Version:** 1.0.0-beta.1
**Last Updated:** March 2026

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Checklist](#pre-installation-checklist)
3. [Installation Steps](#installation-steps)
4. [First-Time Setup](#first-time-setup)
5. [Post-Installation Configuration](#post-installation-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Uninstallation](#uninstallation)

---

## System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|--------------|
| **Operating System** | Windows 10/11 (64-bit) |
| **Processor** | Intel Core i3 or equivalent |
| **Memory (RAM)** | 4 GB |
| **Disk Space** | 500 MB for application + 2 GB for data |
| **Database** | PostgreSQL 15.3 (included) |
| **Network** | Local network for multi-user mode |

### Recommended Requirements

| Component | Specification |
|-----------|--------------|
| **Operating System** | Windows 11 (64-bit) |
| **Processor** | Intel Core i5 or equivalent |
| **Memory (RAM)** | 8 GB or more |
| **Disk Space** | 5 GB or more (SSD recommended) |
| **Database** | PostgreSQL 15.3 (included) |
| **Network** | Gigabit Ethernet for multi-user mode |

### Supported Versions

- **Windows 10:** Version 1903 (May 2019 Update) or later
- **Windows 11:** All versions
- **Architecture:** 64-bit only (x64)

---

## Pre-Installation Checklist

Before installing TravelERP Lite, ensure:

- [ ] You have administrator rights on the computer
- [ ] Windows 10/11 is 64-bit version
- [ ] At least 3 GB free disk space
- [ ] No firewall rules blocking port 5433 (for PostgreSQL)
- [ ] Beta product key is available
- [ ] Previous version (if any) is uninstalled or backed up

---

## Installation Steps

### Step 1: Download the Installer

1. Download `TravelERP-Lite-Setup-1.0.0-beta.1.exe` from:
   - Beta portal: https://beta.travelerp-lite.intelligrip.com
   - Direct download link provided in beta email

2. Verify file size (~250 MB)
3. Right-click → Properties → Check "Unblock" if present

### Step 2: Run the Installer

1. **Double-click** the installer file
2. **User Account Control (UAC) Prompt:**
   - Click "Yes" to allow installation
3. **Welcome Screen:**
   - Click "Next" to continue
4. **License Agreement:**
   - Read the license agreement
   - Select "I accept the agreement"
   - Click "Next"

### Step 3: Choose Installation Location

1. **Default Location:** `C:\Program Files\TravelERP Lite`
2. **To change:**
   - Click "Browse"
   - Select destination folder
   - Click "OK"
3. **Requirements:**
   - At least 500 MB free space
   - Avoid network paths
   - Use local drives only (C:, D:, etc.)
4. Click "Next"

### Step 4: Select Start Menu Folder

1. **Default Folder:** "TravelERP Lite"
2. **To change:**
   - Enter new folder name
   - Or select existing folder
3. Check/uncheck "Don't create a Start Menu folder"
4. Check "Create a desktop shortcut" for quick access
5. Click "Next"

### Step 5: Ready to Install

1. Review installation settings:
   - Destination location
   - Start menu folder
   - Shortcuts
2. Click "Install" to begin
3. **Wait for installation:**
   - Usually takes 2-5 minutes
   - Progress bar shows status
   - Do NOT interrupt the process

### Step 6: Installation Complete

1. **Success Screen:**
   - Check "Launch TravelERP Lite" to open immediately
   - Click "Finish"
2. **Post-Installation:**
   - Desktop shortcut created (if selected)
   - Start menu entry added
   - Application ready for first-run setup

---

## First-Time Setup

### Step 1: Launch the Application

**First Launch:**
1. Double-click desktop shortcut
2. Or go to Start → TravelERP Lite → TravelERP Lite

**First-Run Wizard:**
- Appears automatically on first launch
- 4-step guided setup process
- Takes approximately 5 minutes

### Step 2: Welcome Screen

- Read welcome message
- Click "Next" to continue

### Step 3: Company Information

**Enter Details:**

| Field | Description | Required |
|-------|-------------|----------|
| **Company Name** | Your travel agency name | Yes |
| **GSTIN** | 15-digit GST number | Yes |
| **Phone** | Contact number | Yes |
| **Email** | Contact email | Yes |
| **Address** | Business address | Yes |

**Validation:**
- GSTIN format: `##AAAAA####A#Z#` (15 characters)
- Email: valid email format
- Phone: 10-digit number

Click "Next" after entering all details.

### Step 4: License Activation

**Enter Product Key:**

1. Enter beta product key: `GT01-XXXX-XXXX-XXXX-XXXX`
2. Key auto-formats as you type (groups of 4 characters)
3. Click "Activate License"

**Activation Process:**
- Validates key format
- Checks online authorization (if connected)
- Binds license to your hardware
- Creates activation record

**Success:**
- Green checkmark appears
- License details shown
- Click "Next"

**Error:**
- Verify key is entered correctly
- Check internet connection
- Contact beta support if issue persists

### Step 5: Data Import (Optional)

**Options:**

1. **Start Fresh**
   - Begin with empty database
   - Add customers, vehicles manually
   - Recommended for new users

2. **Import Data**
   - Import from Excel, CSV, or JSON
   - Supported entities:
     - Customers
     - Vehicles
     - Drivers
     - Vehicle Owners
     - Rate Charts
   - Click "Browse" to select file
   - Preview validation results
   - Click "Import" to proceed

**Import Tips:**
- Download template from wizard
- Ensure data matches template format
- Review validation warnings
- Backup import file for reference

Click "Next" after making selection.

### Step 6: Complete Setup

- Review all entered information
- Click "Complete Setup"
- **Application Opens:**
  - Main dashboard appears
  - Ready for use
  - Sample data visible (if imported)

---

## Post-Installation Configuration

### Network Mode Setup (Optional)

**For Multi-User Teams:**

1. Go to **Settings → Network Settings**
2. Choose mode:
   - **Standalone:** Single computer (default)
   - **Server:** Main computer hosting database
   - **Client:** Connect to server computer

**Server Setup:**
1. Select "Server" mode
2. Enable "Allow Remote Connections" (if needed)
3. Adjust max connections (default: 10)
4. Click "Start Server"
5. Note the IP address shown

**Client Setup:**
1. Select "Client" mode
2. Enter server IP address
3. Ensure port matches (default: 5433)
4. Click "Connect"

### Backup Configuration

**Recommended Settings:**

1. Go to **Settings → Backup & Restore**
2. Configure automatic backups:
   - **Frequency:** Daily (recommended)
   - **Time:** After business hours
   - **Retention:** 30 days
3. Enable "Automatic Backups"
4. Click "Save Configuration"

### Firewall Configuration

**Windows Firewall:**

If using network mode, allow PostgreSQL port:

1. Open Windows Firewall
2. Go to "Advanced Settings"
3. Click "Inbound Rules" → "New Rule"
4. Rule Type: Port
5. Protocol: TCP
6. Port: 5433 (or custom port)
7. Action: Allow the connection
8. Profile: Domain, Private, Public (as needed)
9. Name: "TravelERP Lite PostgreSQL"

### Auto-Update Settings

**Configure Updates:**

1. Go to **Settings → System**
2. Update settings:
   - **Check for updates:** Automatic (default)
   - **Download updates:** Automatic (recommended)
   - **Install updates:** Manual (restart required)

---

## Troubleshooting

### Installation Issues

**Installer Won't Run:**

```
Problem: Double-clicking installer does nothing
Solution:
1. Right-click → "Run as Administrator"
2. Check antivirus software isn't blocking
3. Verify download completed fully
4. Temporarily disable antivirus
5. Run installer again
```

**Insufficient Disk Space:**

```
Problem: "Not enough disk space" error
Solution:
1. Free up space on C: drive
2. Install to different drive (D:, E:)
3. Run Disk Cleanup
4. Remove temporary files
```

**Port 5433 Already in Use:**

```
Problem: PostgreSQL port conflict
Solution:
1. Check if PostgreSQL already installed:
   netstat -ano | findstr :5433
2. If present, note PID and investigate process
3. Use different port in Network Settings
4. Or uninstall existing PostgreSQL
```

### First-Run Wizard Issues

**License Activation Fails:**

```
Problem: "Invalid license key" error
Solution:
1. Verify key format: GT01-XXXX-XXXX-XXXX-XXXX
2. Check for typos (O vs 0, I vs 1)
3. Ensure beta key not already used
4. Check internet connection
5. Contact beta support
```

**Company Info Validation Errors:**

```
Problem: GSTIN validation fails
Solution:
1. Verify 15-digit GSTIN format
2. Check for correct checksum
3. Ensure no spaces or special characters
4. Use uppercase letters only
```

**Import Fails:**

```
Problem: Data import errors
Solution:
1. Download fresh template
2. Ensure file is .xlsx, .csv, or .json
3. Check required columns present
4. Verify data formats (dates, numbers)
5. Review validation warnings
6. Import in smaller batches
```

### Application Won't Start

**Tray Icon Not Showing:**

```
Problem: No TravelERP Lite icon in system tray
Solution:
1. Check Task Manager for process
2. If running, try launching from Start Menu
3. If not running, restart application
4. Check Windows Event Viewer for errors
```

**Application Crashes on Launch:**

```
Problem: Application closes immediately
Solution:
1. Check Windows Event Viewer → Application logs
2. Verify .NET Framework installed
3. Reinstall application
4. Contact beta support with logs
```

**Database Connection Failed:**

```
Problem: "Cannot connect to database" error
Solution:
1. Check if PostgreSQL service running:
   services.msc → PostgreSQL 15.3
2. If stopped, start the service
3. Check port 5433 not blocked by firewall
4. Verify database files exist:
   %APPDATA%\TravelERP-Lite\postgres\data
5. Restart computer
```

### Performance Issues

**Application Slow:**

```
Problem: Laggy interface, slow response
Solution:
1. Close other applications
2. Check available RAM (Task Manager)
3. Run on SSD instead of HDD
4. Vacuum database (Settings → Maintenance)
5. Reduce data in current view (filters)
```

**Network Mode Slow:**

```
Problem: Database access slow over network
Solution:
1. Use wired Ethernet instead of WiFi
2. Check network speed (ping server IP)
3. Reduce max concurrent connections
4. Place server on dedicated machine
5. Check network bandwidth usage
```

---

## Uninstallation

### Standard Uninstall

**Step 1: Backup Data (Important!)**

1. Go to **Settings → Backup & Restore**
2. Click "Create Backup"
3. Enter description: "Pre-uninstall backup"
4. Wait for backup to complete
5. Copy backup file to safe location:
   `%APPDATA%\TravelERP-Lite\backups\`

**Step 2: Uninstall Application**

**Method 1: Windows Settings**

1. Go to **Settings → Apps → Installed Apps**
2. Find "TravelERP Lite"
3. Click "..." → "Uninstall"
4. Confirm uninstall

**Method 2: Control Panel**

1. Open **Control Panel**
2. Go to "Programs and Features"
3. Find "TravelERP Lite"
4. Right-click → "Uninstall"
5. Follow uninstall wizard

**Step 3: Remove User Data (Optional)**

**Warning:** This deletes ALL your data!

1. Navigate to: `%APPDATA%\TravelERP-Lite\`
2. Verify this is the correct folder
3. Delete folder (if you're certain)

**Step 4: Remove PostgreSQL (Optional)**

**Only if not used by other applications:**

1. Open **Services** (services.msc)
2. Stop PostgreSQL 15.3 service
3. Delete service:
   ```
   sc delete "PostgreSQL 15.3"
   ```
4. Delete PostgreSQL data directory

### Clean Reinstall

**If experiencing issues, try clean reinstall:**

1. Backup data (see above)
2. Uninstall application
3. Delete application folder if remains:
   `C:\Program Files\TravelERP Lite`
4. Delete user data folder if desired:
   `%APPDATA%\TravelERP-Lite`
5. Restart computer
6. Reinstall from fresh download
7. Restore data from backup (if needed)

---

## Installation Verification

**Verify Successful Installation:**

1. **Check Desktop:** Shortcut icon visible
2. **Check Start Menu:** TravelERP Lite entry present
3. **Launch Application:** Opens without errors
4. **Check Services:** PostgreSQL 15.3 running (services.msc)
5. **Check Database:** Can access dashboard
6. **Test Features:** Create test customer/trip

**If all checks pass:**
- Installation successful!
- Proceed with configuration
- Enjoy using TravelERP Lite

**If any check fails:**
- Review troubleshooting section
- Contact beta support
- Provide error details

---

## Getting Help

### Installation Support

**Email:** support@travelerp-lite.intelligrip.com
**Phone:** +91-XXXXXXXXXX (Mon-Fri 9 AM - 6 PM IST)
**WhatsApp:** +91-XXXXXXXXXX
**Documentation:** https://docs.travelerp-lite.intelligrip.com

### Information to Provide

When reporting installation issues, include:

- Windows version (Settings → System → About)
- Error messages (screenshots if possible)
- Installation steps taken
- Installer file name and size
- System specifications (RAM, disk space)
- Firewall/antivirus software

### Beta Community

- **Forum:** https://community.travelerp-lite.intelligrip.com
- **Knowledge Base:** https://learn.travelerp-lite.intelligrip.com
- **Video Tutorials:** https://learn.travelerp-lite.intelligrip.com/videos

---

**Installation Guide Complete!**

Welcome to TravelERP Lite. We hope you enjoy using the application.

*© 2026 Intelligrip. All Rights Reserved.*
