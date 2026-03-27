# TravelERP Lite - Beta Release Notes

**Version:** 1.0.0-beta.1
**Release Date:** March 2026
**Status:** Public Beta

---

## 🎉 Welcome to TravelERP Lite Beta!

Thank you for participating in our beta program. TravelERP Lite is a **desktop ERP solution for travel agencies** that brings you the power of our web platform in a standalone desktop application.

---

## ✨ What's New in This Beta

### Desktop Application Features
- **Standalone Desktop App** - No browser required, runs natively on Windows
- **Local Database** - PostgreSQL 15.3 bundled, no internet connection needed
- **Multi-User Network Mode** - Share database across multiple computers on your network
- **Automatic Updates** - Get the latest features without manual downloads
- **Built-in Data Import** - Import from Excel, CSV, or JSON files

### Core ERP Features
- **Lead Management** - Track potential customers and convert to bookings
- **Trip/Duty Slip Management** - Complete trip lifecycle management
- **Customer & Vehicle Management** - Master data with categorization
- **Driver & Vehicle Owner Management** - Staff and vendor management
- **Invoice Generation** - GST-compliant invoicing with multiple formats
- **Payment Collections** - Track receivables and payment status
- **Driver & Owner Settlements** - Automated settlement calculations
- **Comprehensive Reports** - Financial, operational, and analytical reports

### New in Desktop Version
- **License Management** - Hardware-bound licensing for security
- **First-Run Wizard** - Guided setup in under 5 minutes
- **Network Mode** - Work standalone or as server/client for multi-user
- **Backup & Restore** - Scheduled and manual backups with one-click restore
- **Offline Capability** - Full functionality without internet

---

## 🔧 System Requirements

### Minimum Requirements
- **OS:** Windows 10/11 (64-bit)
- **RAM:** 4 GB
- **Disk Space:** 500 MB for application, 2 GB recommended
- **Processor:** Intel Core i3 or equivalent

### Recommended Requirements
- **OS:** Windows 11 (64-bit)
- **RAM:** 8 GB or more
- **Disk Space:** 5 GB or more
- **Processor:** Intel Core i5 or equivalent

### Database
- PostgreSQL 15.3 (bundled)
- Default port: 5433 (adjustable in network mode)

---

## 📦 Installation

### Step 1: Download
Download the installer `TravelERP-Lite-Setup-1.0.0-beta.1.exe` from the beta portal.

### Step 2: Run Installer
1. Double-click the installer
2. Choose installation directory (default: `C:\Program Files\TravelERP Lite`)
3. Select Start Menu folder
4. Click "Install"

### Step 3: First Launch
1. Launch TravelERP Lite from desktop shortcut
2. First-run wizard will appear automatically
3. Follow the guided setup:
   - Enter your company information
   - Activate your beta product key
   - Choose: Start Fresh or Import Data

### Step 4: Begin Using
The main dashboard will appear, and you're ready to go!

---

## 🔑 Beta Product Keys

You should have received a beta product key in the following format:

**Format:** `GT01-XXXX-XXXX-XXXX-XXXX`

**Types Available:**
- **Monthly (GT01)** - 1 month validity
- **Quarterly (GT02)** - 3 months validity
- **Annual (GT03)** - 12 months validity

**Troubleshooting:**
- If your key doesn't work, contact beta support
- Each key can be activated on one machine only
- Hardware changes may require reactivation

---

## 🌐 Network Mode Setup

### For Multi-User Teams

**Server Mode (Main Computer):**
1. Go to **Settings → Network Settings**
2. Select **Server** mode
3. Enable "Allow Remote Connections" if needed
4. Click "Start Server"
5. Note the IP address shown

**Client Mode (Other Computers):**
1. Go to **Settings → Network Settings**
2. Select **Client** mode
3. Enter server IP address from above
4. Click "Connect"

**Port Configuration:**
- Default port: 5433
- Ensure Windows Firewall allows this port
- Router may need port forwarding for remote access

---

## 💾 Backup Recommendations

### Automatic Backups
During beta, we recommend:
- **Daily automatic backups** (enabled by default)
- **30-day retention** (configurable)
- **Before updates:** Always backup manually

### Manual Backup
1. Go to **Settings → Backup & Restore**
2. Enter description
3. Click "Create Backup"
4. Backups stored in: `%APPDATA%\TravelERP-Lite\backups`

---

## 🐛 Known Issues

### High Priority
1. **Large data imports (>1000 rows)** - May take several minutes, show as "frozen"
   - *Workaround:* Be patient, process continues in background

2. **Network mode on WiFi** - May be slower
   - *Workaround:* Use wired network when possible

### Medium Priority
1. **PDF generation in network mode** - May be slower on remote connections
2. **Auto-update notification** - May appear behind other windows
3. **Date format in Excel export** - May vary based on system settings

### Low Priority
1. **Tooltip text truncation** - Some tooltips may cut off long text
2. ** scrollbar positioning** - Minor UI issues in certain resolutions

---

## 📝 Feedback & Support

### How to Report Issues

**Bug Reports:**
Please include:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- System information (Windows version, RAM)

**Feature Requests:**
We'd love to hear your ideas! Include:
- What feature you want
- Why it would help
- How you envision it working

**General Feedback:**
- What you like
- What could be improved
- Usability issues

### Feedback Channels
- **Email:** beta@travelerp-lite.intelligrip.com
- **Portal:** https://beta.travelerp-lite.intelligrip.com
- **In-App:** Settings → Send Feedback (coming soon)

### Support Hours
- **Email:** 24/7 (we'll respond within 24 hours)
- **Live Chat:** Mon-Fri 9 AM - 6 PM IST
- **Priority Support:** For critical issues affecting business operations

---

## 📊 Beta Program Details

### Duration
- **Beta Period:** 4 weeks (March-April 2026)
- **Your License Validity:** As per your subscription (1/3/12 months from activation)

### What Happens After Beta?
- You'll receive a final release license key
- Your data can be exported and migrated
- Discounted pricing for early adopters
- Priority access to new features

### Data Continuity
- Beta data can be backed up and restored in final release
- Export functionality available for all master data
- No data loss during updates

---

## ⚠️ Beta Limitations

### What Works
- All core ERP features
- Multi-user network mode
- Backup and restore
- Data import/export
- Auto-updates

### What's Being Tested
- Performance with large datasets
- Network mode stability
- Update process
- Cross-version compatibility

### Beta Stability
- **Core Features:** Production-ready
- **New Features:** Stable but may have minor issues
- **Performance:** Optimized but may need tuning

---

## 🚀 Quick Start Guide

### For New Users
1. Install the application
2. Complete first-run wizard
3. Add your first customer
4. Create your first trip
5. Generate your first invoice

### For Web Version Users Migrating
1. Backup your existing data (if needed)
2. Import from Excel/CSV or use web export
3. Explore new desktop features (network mode, auto-updates)
4. Enjoy offline capability!

---

## 🔄 Updating

### Automatic Updates
- Updates download automatically in background
- You'll be notified when ready to install
- Click "Restart Now" to apply update

### Manual Updates
1. Go to **Settings**
2. Click "Check for Updates"
3. Download and install if available

---

## 📈 Performance Tips

### For Large Databases
- Use SSD for database drive
- Minimum 8GB RAM recommended
- Regular maintenance (vacuum, reindex)

### For Network Mode
- Use Gigabit Ethernet
- Place server on dedicated machine
- Regular backups critical

---

## 🎁 Beta Benefits

### For Beta Testers
- **Free 3-Month License** for active testers providing feedback
- **50% Discount** on first year subscription
- **Priority Feature Requests** - Your ideas matter
- **Direct Support Channel** - Talk to developers

### Recognition
- Top contributors will be acknowledged in final release credits
- Case study opportunities for successful implementations
- Early access to future features

---

## 🔜 Next Steps

1. **Install** the application
2. **Activate** with your beta key
3. **Explore** features and provide feedback
4. **Report** any issues you encounter
5. **Share** your experience with us

---

## 📞 Need Help?

### Quick Links
- **Documentation:** https://docs.travelerp-lite.intelligrip.com
- **Video Tutorials:** https://learn.travelerp-lite.intelligrip.com
- **Community Forum:** https://community.travelerp-lite.intelligrip.com

### Contact
- **Email:** support@travelerp-lite.intelligrip.com
- **Phone:** +91-XXXXXXXXXX (Mon-Fri 9 AM - 6 PM IST)
- **WhatsApp:** +91-XXXXXXXXXX

---

## 💡 Tips for Beta Testing

### Try These Workflows
1. **Create a complete booking cycle:** Lead → Trip → Invoice → Collection
2. **Test network mode:** Set up server and connect from another computer
3. **Test data import:** Import sample data from Excel
4. **Test backup/restore:** Create backup, restore, verify data
5. **Generate reports:** Try different report types and filters

### Focus Areas for Testing
- **Data Import** - Test your existing data formats
- **Network Mode** - Connect multiple computers
- **Performance** - Try with your actual dataset
- **Reports** - Generate reports with real data
- **Updates** - Install updates when available

---

## ⚠️ Important Reminders

### Before Testing
- **Backup First:** Always backup before trying new features
- **Test Data:** Use test data during beta if possible
- **Document Issues:** Take screenshots and notes

### During Beta
- **Report Issues Promptly:** The earlier we know, the faster we can fix
- **Be Specific:** Include steps, errors, and context
- **Check Known Issues:** Verify issue isn't already listed

### After Beta
- **Migrate Data:** Export/import to final release smoothly
- **Provide Final Feedback:** Summary of your beta experience
- **Subscribe:** Convert to paid subscription with beta discount

---

## 🏆 Beta Goals

### What We're Testing
1. **Stability** - Crash-free operation in real-world scenarios
2. **Performance** - Responsive with large datasets
3. **Usability** - Intuitive workflows for travel agents
4. **Network Mode** - Multi-user collaboration
5. **Updates** - Smooth update experience
6. **Import/Export** - Data portability

### Success Criteria
- 95% uptime during beta period
- <5% critical bugs
- Positive feedback from 80% of testers
- Network mode stability for 50+ concurrent users

---

## 📅 Timeline

- **Beta Start:** March 25, 2026
- **Beta Duration:** 4 weeks
- **Feedback Review:** April 22-26, 2026
- **Final Release:** May 1, 2026

---

**Thank you for being part of the TravelERP Lite journey!**

Your feedback directly shapes the future of our product. We're excited to have you with us.

---

*TravelERP Lite - Desktop ERP for Travel Agencies*
*Developed by Intelligrip*
*© 2026 All Rights Reserved*
