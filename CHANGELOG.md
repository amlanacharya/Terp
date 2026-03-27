# Changelog

All notable changes to TravelERP Lite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-beta.1] - 2026-03-25

### Added

#### Desktop Application
- Electron-based standalone desktop application for Windows
- PostgreSQL 15.3 portable bundled with installer
- Hardware fingerprint-based licensing system
- First-run setup wizard with 4-step guided configuration
- Automatic background update system
- Single instance enforcement
- Secure IPC bridge between main and renderer processes

#### Licensing System
- HMAC-SHA256 based product key generation
- Product key format: GT01-TTXX-YYYY-ZZZZ-CCCC
- Three subscription types: Monthly (GT01), Quarterly (GT02), Annual (GT03)
- Hardware fingerprinting with 4-component binding (CPU, MAC, GUID, Volume)
- License activation service with validation
- 4-tier enforcement: active, grace (7 days), readonly (20 days), expired
- License key generation CLI tool
- Beta key generator for batch key creation

#### Data Import System
- Excel (.xlsx, .xls) parsing with XLSX library
- CSV parsing with entity type routing
- JSON parsing with nested data support
- Support for 5 entity types: customers, vehicles, drivers, owners, rate charts
- Comprehensive validation for each entity type
- Duplicate detection (codes, numbers, emails)
- Format validation (GSTIN, phone, email, dates)
- Cross-reference validation (customers, owners, vehicle categories)
- Multi-stage progress tracking (parsing → validating → importing)
- Template download functionality

#### Network Mode (Multi-User)
- Three network modes: Standalone, Server, Client
- NetworkConfigService for persistent settings management
- PostgreSQL server start/stop on custom port (default 5433)
- Client connection pool management
- Network connectivity testing
- Server discovery on local subnet
- Dynamic postgresql.conf and pg_hba.conf generation
- Remote connection controls
- Max connections configuration

#### Backup & Restore
- BackupService for database backup management
- pg_dump integration for PostgreSQL backups
- Automatic gzip compression
- Metadata tracking (JSON files per backup)
- Retention policy-based cleanup (default 30 days)
- Manual and automatic backup types
- psql integration for database restoration
- Pre-restore validation
- Backup statistics dashboard

#### Testing Infrastructure
- Vitest test framework with jsdom environment
- React Testing Library for component testing
- Supertest for API integration testing
- v8 coverage provider for code coverage
- Global test setup with browser API mocks
- Mock utilities for fetch, localStorage, matchMedia
- Component tests for FirstRunWizard
- Component tests for NetworkSettings
- Unit tests for NetworkConfigService
- Unit tests for BackupService
- Unit tests for key generator
- API integration tests

#### In-App Feedback System
- FeedbackForm component with modal dialog
- Four feedback categories: Bug, Feature Request, General Feedback, Question
- Bug-specific fields: severity, steps to reproduce, expected/actual behavior
- Automatic company email loading
- Optional log attachment
- Feedback submission API endpoint
- Local feedback storage with JSON files
- Feedback statistics endpoint (admin only)

#### Documentation
- Comprehensive release notes (RELEASE_NOTES.md)
- Detailed installation guide (INSTALL.md)
- Beta tester onboarding guide (BETA_ONBOARDING.md)
- Testing guide (TESTING.md)
- Implementation progress documentation (TRAVELERP-LITE-PROGRESS.md)
- Updated README with beta information
- This changelog (CHANGELOG.md)

### Changed

#### Architecture
- Migrated from web-only to desktop-first architecture
- Express server runs as child process of Electron main process
- PostgreSQL runs as portable service (not external dependency)
- File-based configuration for network and backup settings

#### Frontend
- Added Settings page with tabbed interface (System, Network, Backup)
- Integrated FirstRunWizard into main App.tsx flow
- Added NetworkSettings component for multi-user configuration
- Added BackupRestore component for backup management
- Added FeedbackForm modal for in-app feedback

#### Backend
- Added license management routes (/api/license/*)
- Added data import routes (/api/import/*)
- Added network management routes (/api/network/*)
- Added backup management routes (/api/backup/*)
- Added feedback submission routes (/api/feedback/*)
- All routes include comprehensive error handling

### Fixed

- N/A (initial beta release)

### Removed

- N/A (initial beta release)

### Security

- Hardware-bound licensing prevents unauthorized use
- Secure IPC bridge with contextBridge
- Parameterized SQL queries throughout (no SQL injection risk)
- JWT authentication for API access
- bcryptjs password hashing
- License key encryption with HMAC-SHA256

### Performance

- Optimized import with transaction-based rollback support
- Connection pooling for network mode clients
- Automatic backup compression to reduce storage
- Lazy loading of PostgreSQL portable in installer

### Dependencies

#### Major Dependencies Added
- electron: 34.2.0
- electron-builder: 25.1.8
- electron-updater: 6.8.3
- xlsx: for Excel parsing
- multer: for file uploads

#### Dev Dependencies Added
- @testing-library/react: 16.3.2
- @testing-library/jest-dom: 6.9.1
- @testing-library/user-event: 14.6.1
- @vitest/ui: 4.1.1
- @vitest/coverage-v8: 4.1.1
- jsdom: 29.0.1
- supertest: 7.2.2
- @types/supertest: 7.2.0

---

## [Unreleased] - TBD

### Planned
- Performance optimization for large datasets
- Additional reporting capabilities
- Enhanced data export formats
- Linux and macOS support
- Advanced analytics dashboard
- SMS/WhatsApp integration
- Cloud sync (optional)

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0-beta.1 | 2026-03-25 | Beta Release |
| 1.0.0 (planned) | 2026-05-01 | Final Release |

---

## Beta Program

### Beta Timeline
- **Start:** March 25, 2026
- **Duration:** 4 weeks
- **Feedback Review:** April 22-26, 2026
- **Final Release:** May 1, 2026

### Beta Goals
- Stability testing in real-world scenarios
- Performance validation with large datasets
- Usability feedback from travel agents
- Network mode stress testing
- Import/export data portability verification
- Update process testing

### Beta Tester Benefits
- Free 3-month license extension for active testers
- 50% discount on first year subscription
- Priority feature request consideration
- Direct support channel to development team
- Recognition in final release credits

---

## Upgrade Notes

### From Web Version to Desktop Beta

If you're migrating from the web version:

1. **Export Data:** Export all data from web version
2. **Install Desktop:** Download and install beta
3. **Import Data:** Use Data Import Wizard
4. **Verify:** Check all imported data
5. **Enjoy:** Experience offline capability and new features!

### Beta to Final Release Migration

When final release is available (May 1, 2026):

1. **Backup:** Create final backup from beta version
2. **Update:** Install final release (auto-update or manual)
3. **Migrate:** Data migrates automatically
4. **Activate:** Use final license key
5. **Verify:** Confirm all data intact

---

## Support

### Beta Support Channels
- **Email:** beta@travelerp-lite.intelligrip.com
- **Forum:** https://community.travelerp-lite.intelligrip.com
- **Phone:** +91-XXXXXXXXXX (Mon-Fri 9 AM - 6 PM IST)

### Documentation
- **Release Notes:** RELEASE_NOTES.md
- **Installation Guide:** INSTALL.md
- **Beta Onboarding:** BETA_ONBOARDING.md
- **Online Docs:** https://docs.travelerp-lite.intelligrip.com

---

## Contributing

### Beta Testing
Join our beta program and help shape the future of TravelERP Lite!

1. Sign up at: https://beta.travelerp-lite.intelligrip.com
2. Download beta installer
3. Install and test
4. Provide feedback
5. Report issues

### Bug Reports
When reporting bugs, please include:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- System information
- Application logs

### Feature Requests
We'd love to hear your ideas! Include:
- What feature you want
- Why it would help
- How you envision it working

---

## License

Proprietary software. Copyright © 2026 Intelligrip. All rights reserved.

---

**Thank you for being part of the TravelERP Lite journey!**

*Generated: 2026-03-25*
*Beta Version: 1.0.0-beta.1*
