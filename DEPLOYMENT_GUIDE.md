# TravelERP Lite - Production Deployment Guide

**Version:** 1.0.0
**Target Release:** May 1, 2026
**Deployment Team:** DevOps + Release Management

---

## Pre-Deployment Checklist

### Build Verification

- [ ] **Clean Build**
  ```bash
  git checkout main
  git pull origin main
  rm -rf node_modules dist
  npm install
  npm run build:all
  ```

- [ ] **Build Output Verification**
  - [ ] `dist/` directory exists and contains frontend build
  - [ ] `server/dist/` directory exists and contains backend build
  - [ ] `electron/dist/` directory exists and contains Electron build
  - [ ] No TypeScript errors
  - [ ] No console errors in DevTools

- [ ] **Installer Build**
  ```bash
  npm run electron:build:win
  ```
  - [ ] `dist/installers/TravelERP-Lite-Setup-1.0.0.exe` created
  - [ ] Installer size ~250-300MB
  - [ ] Installation test on clean Windows 10 machine
  - [ ] Installation test on clean Windows 11 machine

### Quality Assurance

- [ ] **Smoke Tests**
  - [ ] Application launches successfully
  - [ ] Database initializes correctly
  - [ ] First-run wizard completes
  - [ ] License activation works
  - [ ] All menu items accessible

- [ ] **Feature Tests**
  - [ ] Create customer/trip/invoice workflow
  - [ ] Data import from Excel
  - [ ] Backup and restore
  - [ ] Report generation
  - [ ] Network mode (if applicable)

- [ ] **Regression Tests**
  ```bash
  npm run test:run
  ```
  - [ ] All unit tests pass
  - [ ] All integration tests pass
  - [ ] Code coverage > 80%

---

## Build Configuration

### Version Configuration

**package.json:**
```json
{
  "version": "1.0.0",
  "build": {
    "appId": "com.intelligrip.travelerp-lite",
    "productName": "TravelERP Lite",
    "directories": {
      "output": "dist/installers",
      "buildResources": "build"
    }
  }
}
```

**electron-builder.yml:**
```yaml
appId: com.intelligrip.travelerp-lite
productName: TravelERP Lite
publish:
  provider: generic
  url: https://updates.intelligrip.com/travelerp-lite
```

### Environment Configuration

**Production Environment Variables:**
```bash
# .env.production
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://localhost:5433/travelerp
LOG_LEVEL=info
UPDATE_URL=https://updates.intelligrip.com/travelerp-lite
LICENSE_SERVER_URL=https://license.intelligrip.com/api
```

---

## Update Server Setup

### Server Configuration

**Update Server Structure:**
```
updates.intelligrip.com/
└── travelerp-lite/
    ├── windows/
    │   └── TravelERP-Lite-Setup-1.0.0.exe
    └── RELEASES
        └── windows-x64.yml
```

### Release Manifest

**windows-x64.yml:**
```yaml
version: 1.0.0
files:
  - url: TravelERP-Lite-Setup-1.0.0.exe
    sha512: [generated hash]
    size: 284567432
  - url: RELEASES
    sha512: [generated hash]
    size: 1234
path: TravelERP-Lite-Setup-1.0.0.exe
sha512: [generated hash]
releaseDate: 2026-05-01T00:00:00.000Z
```

### Generating Release Files

```bash
# After building installer
cd dist/installers

# Generate SHA512 hash
sha512sum TravelERP-Lite-Setup-1.0.0.exe > hash.txt

# Create release manifest
cat > windows-x64.yml << EOF
version: 1.0.0
files:
  - url: TravelERP-Lite-Setup-1.0.0.exe
    sha512: $(cat hash.txt | cut -d' ' -f1)
    size: $(stat -f%z TravelERP-Lite-Setup-1.0.0.exe)
path: TravelERP-Lite-Setup-1.0.0.exe
sha512: $(cat hash.txt | cut -d' ' -f1)
releaseDate: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
EOF
```

### Deploying to Update Server

```bash
# Upload files to update server
scp dist/installers/TravelERP-Lite-Setup-1.0.0.exe \
  user@updates.intelligrip.com:/var/www/travelerp-lite/windows/

scp dist/installers/windows-x64.yml \
  user@updates.intelligrip.com:/var/www/travelerp-lite/RELEASES/

# Set proper permissions
ssh user@updates.intelligrip.com
chmod 644 /var/www/travelerp-lite/windows/TravelERP-Lite-Setup-1.0.0.exe
chmod 644 /var/www/travelerp-lite/RELEASES/windows-x64.yml
```

---

## Distribution Channels

### Primary Website

**Download Page:** https://travelerp-lite.intelligrip.com/download

**Required Files:**
- Installer: `TravelERP-Lite-Setup-1.0.0.exe`
- Release notes: `RELEASE_NOTES.md`
- Installation guide: `INSTALL.md`
- SHA256 checksums: `checksums.txt`

**checksums.txt:**
```
TravelERP-Lite-Setup-1.0.0.exe
SHA256: abc123def456...
SHA512: 789xyz012abc...
```

### CDN Distribution (Recommended)

**CloudFront Configuration:**
```javascript
{
  "DistributionConfig": {
    "Origins": {
      "Items": [{
        "Id": "S3-Origin",
        "DomainName": "travelerp-lite.s3.amazonaws.com",
        "S3OriginConfig": {}
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-Origin",
      "ViewerProtocolPolicy": "https-only",
      "MinTTL": 86400,
      "ForwardedValues": { "QueryString": false }
    },
    "Aliases": {
      "Items": ["download.travelerp-lite.intelligrip.com"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:...",
      "SSLSupportMethod": "sni-only"
    }
  }
}
```

### Alternative Download Locations

- **GitHub Releases:** https://github.com/intelligrip/travelerp-lite/releases/v1.0.0
- **SourceForge:** https://sourceforge.net/projects/travelerp-lite/files/
- **FossHub:** https://www.fosshub.com/TravelERP-Lite.html

---

## Code Signing

### Windows Code Signing

**Certificate Requirements:**
- Code Signing Certificate (EV preferred)
- Issued by DigiCert, GlobalSign, or similar
- Valid for at least 1 year

**Signing Process:**
```bash
# Sign installer
signtool sign \
  /f certificate.pfx \
  /p password \
  /tr http://timestamp.digicert.com \
  /td sha256 \
  /fd sha256 \
  dist/installers/TravelERP-Lite-Setup-1.0.0.exe

# Verify signature
signtool verify /pa /v dist/installers/TravelERP-Lite-Setup-1.0.0.exe
```

**electron-builder Configuration:**
```json
{
  "build": {
    "win": {
      "certificateFile": "certificate.pfx",
      "certificatePassword": "password",
      "signAndEditExecutable": true,
      "signDlls": true
    }
  }
}
```

---

## Release Automation

### CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm run test:run

      - name: Build application
        run: npm run build:all

      - name: Build installer
        run: npm run electron:build:win

      - name: Generate checksums
        run: |
          cd dist/installers
          sha256sum TravelERP-Lite-*.exe > checksums.txt

      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/installers/TravelERP-Lite-Setup-*.exe
            dist/installers/checksums.txt
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to update server
        run: |
          scp dist/installers/TravelERP-Lite-Setup-*.exe \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/var/www/travelerp-lite/
```

---

## Monitoring & Analytics

### Download Tracking

**Google Analytics 4:**
```html
<!-- On download page -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>

<!-- Track download button -->
<a href="/download/TravelERP-Lite-Setup-1.0.0.exe"
   onclick="gtag('event', 'download', {'event_category': 'installer'});">
  Download
</a>
```

### Update Analytics

**Server-Side Tracking:**
```typescript
// middleware/updateAnalytics.ts
export async function trackUpdate(
  version: string,
  platform: string,
  success: boolean
) {
  await fetch('https://analytics.intelligrip.com/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      application: 'travelerp-lite',
      version,
      platform,
      success,
      timestamp: new Date().toISOString(),
    }),
  });
}
```

---

## Rollback Procedure

### Scenarios Requiring Rollback

1. **Critical Bug:** Data loss, security vulnerability
2. **Installation Failure:** >20% failed installations
3. **Update Failure:** Widespread update issues
4. **Performance:** Severe degradation affecting all users

### Rollback Steps

1. **Stop Distribution:**
   ```bash
   # Remove download links
   mv /var/www/travelerp-lite/windows/TravelERP-Lite-Setup-1.0.0.exe \
      /var/www/travelerp-lite/archive/

   # Update download page to previous version
   ```

2. **Announce Issue:**
   - Post on website
   - Email all users
   - Community forum announcement
   - Social media notification

3. **Restore Previous Version:**
   ```bash
   # Copy previous version back
   cp /var/www/travelerp-lite/archive/TravelERP-Lite-Setup-0.9.0.exe \
      /var/www/travelerp-lite/windows/TravelERP-Lite-Setup-1.0.0.exe

   # Update release manifest
   git checkout tags/v0.9.0
   # Rebuild and deploy
   ```

4. **Release Patch:**
   - Fix critical issue
   - Test thoroughly
   - Release v1.0.1
   - Resume distribution

---

## Post-Deployment

### Immediate Tasks (Day 1)

- [ ] Verify download links work
- [ ] Test fresh installation
- [ ] Test update from beta
- [ ] Monitor support channels
- [ ] Check error logs

### Week 1 Tasks

- [ ] Daily download statistics
- [ ] Track installation success rate
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Address critical issues

### Ongoing Tasks

- [ ] Weekly performance review
- [ ] Monthly dependency updates
- [ ] Quarterly security audit
- [ ] Regular backup verification

---

## Troubleshooting

### Installation Issues

**Problem:** Installer won't run

**Diagnostics:**
```bash
# Verify file integrity
sha256sum TravelERP-Lite-Setup-1.0.0.exe

# Check Windows Event Viewer
eventvwr.msc
```

**Solutions:**
1. Re-download installer
2. Temporarily disable antivirus
3. Run as Administrator
4. Check Windows version compatibility

### Update Issues

**Problem:** Updates fail to download

**Diagnostics:**
```bash
# Check update server
curl -I https://updates.intelligrip.com/travelerp-lite/RELEASES/windows-x64.yml

# Verify manifest format
cat windows-x64.yml
```

**Solutions:**
1. Check server connectivity
2. Verify release manifest
3. Check SSL certificate
4. Manually download and install

### Performance Issues

**Problem:** Slow performance after update

**Diagnostics:**
```typescript
// Check database version
SELECT version();

// Run VACUUM ANALYZE
VACUUM ANALYZE;
```

**Solutions:**
1. Restart application
2. Run database maintenance
3. Check system resources
4. Review performance logs

---

## Support During Release

### Release Team

| Role | Name | Contact | Responsibility |
|------|------|---------|----------------|
| Release Manager | | | Overall coordination |
| Lead Developer | | | Technical issues |
| QA Lead | | | Testing support |
| Support Manager | | | User support |
| DevOps Engineer | | | Infrastructure |

### Emergency Contacts

- **Critical Issues:** +91-XXXXXXXXXX (24/7)
- **Technical Issues:** tech@travelerp-lite.intelligrip.com
- **User Support:** support@travelerp-lite.intelligrip.com

### Communication Channels

- **Internal:** Slack #release
- **Public:** Twitter @TravelERPLite
- **Status:** status.travelerp-lite.intelligrip.com

---

## Checklist Summary

### Pre-Release
- [ ] Clean build successful
- [ ] All tests passing
- [ ] Code signing complete
- [ ] Installer tested
- [ ] Documentation complete
- [ ] Support team trained

### Release
- [ ] Version tagged in git
- [ ] Build artifacts created
- [ ] Update server deployed
- [ ] Download pages live
- [ ] Announcement sent
- [ ] Monitoring active

### Post-Release
- [ ] Downloads verified
- [ ] Error rates monitored
- [ ] User feedback collected
- [ ] Issues triaged
- [ ] Patch release planned (if needed)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-25
**Next Review:** Before v1.1 release

*© 2026 Intelligrip. All Rights Reserved.*
