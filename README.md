# TravelERP Lite

<div align="center">

**Desktop ERP for Travel Agencies**

[![Beta](https://img.shields.io/badge/status-beta-orange)](https://beta.travelerp-lite.intelligrip.com)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.1-blue)](https://github.com/intelligrip/travelerp-lite)
[![License](https://img.shields.io/badge/license-proprietary-red)](https://intelligrip.com)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)](https://.microsoft.com/windows)

</div>

---

## 🎯 Overview

**TravelERP Lite** is a standalone desktop ERP solution designed specifically for travel agencies. It brings you the power of a full-featured business management system without requiring internet connectivity or cloud subscriptions.

### Key Features

- ✅ **Offline-First**: Complete functionality without internet
- ✅ **Multi-User**: Share database across your team via network mode
- ✅ **Comprehensive**: Leads, trips, invoices, collections, settlements
- ✅ **GST-Compliant**: Built for Indian tax regulations
- ✅ **Auto-Updates**: Stay current with latest features
- ✅ **Local Data**: Your data stays on your machine

---

## 📋 What's New in Beta 1.0.0

### Desktop Application
- Standalone Windows application (no browser required)
- PostgreSQL 15.3 bundled with installer
- Hardware-bound licensing system
- First-run setup wizard (< 5 minutes)
- Automatic background updates

### Multi-User Network Mode
- Server/Client architecture
- Share database across multiple computers
- Remote connection support
- Connection pooling and management
- Server discovery on local network

### Data Import/Export
- Import from Excel (.xlsx, .xls), CSV, or JSON
- Support for customers, vehicles, drivers, owners, rate charts
- Comprehensive validation and error reporting
- Template downloads for easy data preparation

### Backup & Restore
- Scheduled automatic backups
- Manual backup creation
- One-click restore
- Retention policy-based cleanup
- Backup statistics and management

### Testing & Quality
- Comprehensive test suite with Vitest
- Component and integration tests
- 80%+ code coverage target
- Continuous integration ready

---

## 🚀 Quick Start

### Installation

**Windows (10/11, 64-bit):**

1. Download the installer from [Beta Portal](https://beta.travelerp-lite.intelligrip.com)
2. Run `TravelERP-Lite-Setup-1.0.0-beta.1.exe`
3. Follow the installation wizard
4. Complete first-run setup

For detailed installation instructions, see [INSTALL.md](INSTALL.md).

### First-Time Setup

1. **Launch Application** - Double-click desktop shortcut
2. **Enter Company Info** - Name, GSTIN, address, contact
3. **Activate License** - Enter your beta product key
4. **Import Data** - Start fresh or import from Excel/CSV

### Beta Product Key Format

```
GT01-XXXX-XXXX-XXXX-XXXX
```

- **GT01**: Monthly (GT02 = Quarterly, GT03 = Annual)
- **X**: Random alphanumeric characters
- **Checksum**: Last 4 characters for validation

---

## 📚 Documentation

- **[Release Notes](RELEASE_NOTES.md)** - Beta 1.0.0 features and known issues
- **[Installation Guide](INSTALL.md)** - Detailed installation steps
- **[Beta Onboarding](BETA_ONBOARDING.md)** - Testing guide for beta testers
- **[Testing Guide](TESTING.md)** - Running and writing tests
- **[Implementation Progress](TRAVELERP-LITE-PROGRESS.md)** - Development status

---

## 🛠️ Development

### Prerequisites

- **Node.js** 20.x or higher
- **npm** or **yarn**
- **PostgreSQL** 15.3 (bundled for production)
- **Windows** 10/11 (64-bit)

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/intelligrip/travelerp-lite.git
cd travelerp-lite

# Install dependencies
npm install
cd server && npm install && cd ..

# Download PostgreSQL portable (Windows)
npm run download:postgres

# Run development server
npm run dev

# Run backend (separate terminal)
cd server
npm run dev
```

### Build for Production

```bash
# Build all (frontend + backend + electron)
npm run build:all

# Build Windows installer
npm run electron:build:win

# Build Linux (AppImage, deb)
npm run electron:build:linux

# Build macOS (DMG, ZIP)
npm run electron:build:mac
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests once (CI mode)
npm run test:run
```

---

## 📁 Project Structure

```
travelerp-lite/
├── electron/              # Electron main process
│   ├── main.ts           # Application entry point
│   ├── preload.ts        # Secure IPC bridge
│   └── auto-updater.ts   # Auto-update service
├── server/               # Express backend API
│   ├── src/
│   │   ├── license/      # Licensing system
│   │   ├── import/       # Data import
│   │   ├── network/      # Network mode
│   │   ├── backup/       # Backup & restore
│   │   └── routes/       # API routes
│   └── db/               # Database schema & migrations
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── lib/              # Utilities & types
│   └── test/             # Test files
├── build/                # Build resources
│   └── postgres/         # PostgreSQL portable
├── docs/                 # Documentation
│   └── superpowers/plans/ # Implementation plans
└── scripts/              # Build and utility scripts
```

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 34.2.0, electron-builder 25.1.8 |
| **Frontend** | React 18.3.1, TypeScript 5.5.3, Vite 5.4.2, Tailwind CSS 3.4.1 |
| **Backend** | Express 4.x, TypeScript, PostgreSQL 15.3 |
| **Testing** | Vitest, React Testing Library, Supertest |
| **Build** | Vite, tsc, electron-builder |

---

## 🌐 Network Mode

TravelERP Lite supports multi-user collaboration through network mode:

### Server Setup

1. Go to **Settings → Network Settings**
2. Select **Server** mode
3. Enable remote connections if needed
4. Click **Start Server**
5. Note the IP address

### Client Setup

1. Install TravelERP Lite on client machine
2. Go to **Settings → Network Settings**
3. Select **Client** mode
4. Enter server IP address
5. Click **Connect**

**Default Port:** 5433 (configurable)

---

## 💾 Backup & Restore

### Automatic Backups

- **Frequency:** Daily (configurable)
- **Retention:** 30 days (configurable)
- **Location:** `%APPDATA%\TravelERP-Lite\backups\`

### Manual Backup

1. Go to **Settings → Backup & Restore**
2. Click **Create Backup**
3. Enter description
4. Backup created automatically

### Restore

1. Go to **Settings → Backup & Restore**
2. Select backup from list
3. Click **Restore**
4. Confirm restore operation

---

## 🔐 Licensing

### License Activation

- **Hardware-Bound**: Each key locked to one machine
- **Subscription Types**: Monthly, Quarterly, Annual
- **Beta Keys**: Format `GT01-XXXX-XXXX-XXXX-XXXX`
- **Reactivation**: Required for hardware changes

### Generate Beta Keys

```bash
# Generate 10 monthly keys
npx tsx server/src/license/beta-key-generator.ts

# Generate 50 quarterly keys
npx tsx server/src/license/beta-key-generator.ts --count 50 --type quarterly

# Generate 100 annual keys
npx tsx server/src/license/beta-key-generator.ts -c 100 -t annual
```

---

## 🐛 Known Issues

See [RELEASE_NOTES.md](RELEASE_NOTES.md#known-issues) for a complete list of known issues.

### High Priority
- Large data imports (>1000 rows) may appear frozen
- Network mode on WiFi may be slower than wired

### Medium Priority
- PDF generation in network mode may be slower
- Auto-update notification may appear behind other windows

### Low Priority
- Tooltip text truncation in some areas
- Minor scrollbar positioning issues

---

## 📝 Contributing

### Beta Testing

We welcome beta testers! Please join:

- **Beta Portal:** https://beta.travelerp-lite.intelligrip.com
- **Community Forum:** https://community.travelerp-lite.intelligrip.com
- **Report Issues:** beta@travelerp-lite.intelligrip.com

### Feedback

When reporting issues, please include:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- System information (Windows version, RAM)

---

## 📞 Support

### Contact Information

- **Email:** support@travelerp-lite.intelligrip.com
- **Phone:** +91-XXXXXXXXXX (Mon-Fri 9 AM - 6 PM IST)
- **WhatsApp:** +91-XXXXXXXXXX

### Resources

- **Documentation:** https://docs.travelerp-lite.intelligrip.com
- **Video Tutorials:** https://learn.travelerp-lite.intelligrip.com
- **Community Forum:** https://community.travelerp-lite.intelligrip.com

---

## 📜 License

Proprietary software. Copyright © 2026 Intelligrip. All rights reserved.

---

## 🗺️ Roadmap

### Beta 1.0.0 (March 2026)
- ✅ Desktop application with Electron
- ✅ Licensing system
- ✅ Data import/export
- ✅ Multi-user network mode
- ✅ Backup & restore
- ✅ Comprehensive testing

### Final Release (May 2026)
- 🔲 Performance optimization
- 🔲 Security audit
- 🔲 Enhanced reporting
- 🔲 Additional integrations

### Future Enhancements
- 🔲 Linux and macOS support
- 🔲 Mobile companion app
- 🔲 Cloud sync (optional)
- 🔲 Advanced analytics dashboard
- 🔲 SMS/WhatsApp notifications

---

## 🙏 Acknowledgments

Built with passion for the travel industry community.

Special thanks to our beta testers for their valuable feedback and contributions.

---

<div align="center">

**[Website](https://travelerp-lite.intelligrip.com)** •
**[Documentation](https://docs.travelerp-lite.intelligrip.com)** •
**[Support](https://support.travelerp-lite.intelligrip.com)**

Made with ❤️ by [Intelligrip](https://intelligrip.com)

</div>
