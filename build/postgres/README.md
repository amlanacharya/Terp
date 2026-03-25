# PostgreSQL Portable for TravelERP Lite

This directory will contain the PostgreSQL portable binaries for TravelERP Lite desktop application.

## Directory Structure:

```
build/postgres/
├── bin/                    # Executables
│   ├── initdb.exe         # Initialize database cluster
│   ├── pg_ctl.exe         # Control PostgreSQL service
│   ├── postgres.exe       # Database server
│   ├── createdb.exe       # Create database
│   ├── psql.exe           # Command-line interface
│   └── pg_dump.exe        # Backup utility
├── lib/                   # Shared libraries
├── share/                 # Support files
│   ├── extension/         # Extensions
│   └── timezone/          # Timezone data
├── data/                  # Database data (created at runtime)
│   └── (empty, will be initialized by initdb)
└── postgresql.conf        # Configuration (optimized for desktop)
```

## Download PostgreSQL Portable:

### Option 1: EnterpriseDB Binaries (Recommended)

Download from: https://get.enterprisedb.com/postgresql/postgresql-15.3-1-windows-x64-binaries.zip

**Alternative versions:**
- PostgreSQL 14.10: https://get.enterprisedb.com/postgresql/postgresql-14.10-1-windows-x64-binaries.zip
- PostgreSQL 13.13: https://get.enterprisedb.com/postgresql/postgresql-13.13-1-windows-x64-binaries.zip

### Option 2: Official PostgreSQL FTP

FTP server: ftp://ftp.postgresql.org/pub/snapshot/dev/postgresql-snapshot-windows-binaries.zip

## Installation Steps:

1. Download the ZIP file
2. Extract to this directory (`build/postgres/`)
3. Verify executables exist in `bin/` folder
4. Test with: `build/postgres/bin/initdb.exe --version`

## Configuration:

The `postgresql.conf` file is optimized for desktop use:

- **Memory**: 128MB shared_buffers (suitable for desktop apps)
- **Connections**: 10 max connections (supports 4-5 concurrent users)
- **Performance**: Optimized for SSD storage
- **Logging**: Logs to AppData directory

## Initialization:

PostgreSQL data directory will be created at runtime in:
```
C:\Users\[Username]\AppData\Local\TravelERP-Lite\postgres\data\
```

Initialization process:
1. Check if data directory exists
2. If not, run `initdb.exe` to create it
3. Start PostgreSQL service
4. Create `travelerp_lite` database
5. Run schema.sql and seed.sql

## Security Notes:

- PostgreSQL runs on localhost only (no external access)
- Default user: `postgres` (password will be set during installation)
- In production Phase 2, password will be securely stored
- LAN access will be enabled in Phase 5 (Multi-user mode)

## Size Estimates:

- PostgreSQL 15 binaries: ~250 MB (zipped)
- Extracted size: ~500 MB
- Initial data directory: ~50 MB
- Total bundled size: ~550 MB

## License:

PostgreSQL is licensed under the PostgreSQL License, a liberal Open Source license, similar to the BSD or MIT licenses.

## Troubleshooting:

### Issue: "initdb.exe not found"
**Solution**: Verify the ZIP file was extracted correctly to `build/postgres/`

### Issue: "Visual C++ Redistributable missing"
**Solution**: Install Microsoft Visual C++ 2015-2022 Redistributable

### Issue: PostgreSQL fails to start
**Solution**:
1. Check logs in AppData
2. Verify port 5432 is not in use
3. Run `postgres.exe --version` to verify binaries work
