#!/usr/bin/env node

/**
 * Production Build Script
 *
 * Ensures clean, optimized production build of TravelERP Lite
 * Usage: node scripts/production-build.js [version]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERSION = process.argv[2] || '1.0.0';
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, description) {
  log(`\n▶ ${description}...`, 'cyan');
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
    log(`✓ ${description} complete`, 'green');
    return output;
  } catch (error) {
    log(`✗ ${description} failed`, 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

async function main() {
  log('\n========================================', 'magenta');
  log(`TravelERP Lite v${VERSION} - Production Build`, 'magenta');
  log('========================================\n', 'magenta');

  // Step 1: Pre-build checks
  log('Step 1: Pre-build Checks', 'yellow');
  log('─'.repeat(50), 'yellow');

  // Check Node.js version
  const nodeVersion = process.version;
  log(`Node.js version: ${nodeVersion}`, 'blue');
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 20) {
    log('✗ Node.js 20+ required', 'red');
    process.exit(1);
  }

  // Check if package.json exists
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('✗ package.json not found', 'red');
    process.exit(1);
  }

  // Update version in package.json
  log(`Updating version to ${VERSION} in package.json...`, 'blue');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  packageJson.version = VERSION;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // Step 2: Clean previous builds
  log('\nStep 2: Clean Previous Builds', 'yellow');
  log('─'.repeat(50), 'yellow');

  const dirsToClean = [
    'dist',
    'server/dist',
    'electron/dist',
    '.vite',
  ];

  dirsToClean.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      log(`Removed ${dir}`, 'blue');
    }
  });

  // Step 3: Install dependencies
  log('\nStep 3: Install Dependencies', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm install', 'Installing root dependencies');

  // Install server dependencies
  exec('cd server && npm install && cd ..', 'Installing server dependencies');

  // Step 4: Run tests
  log('\nStep 4: Run Tests', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run test:run', 'Running test suite');

  // Step 5: Type checking
  log('\nStep 5: Type Checking', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run typecheck', 'TypeScript type check (frontend)');
  exec('npm run typecheck:electron', 'TypeScript type check (electron)');

  // Step 6: Linting
  log('\nStep 6: Linting', 'yellow');
  log('─'.repeat(50), 'yellow');

  try {
    exec('npm run lint', 'ESLint check');
  } catch (error) {
    log('⚠ Linting failed - continuing build', 'yellow');
  }

  // Step 7: Build frontend
  log('\nStep 7: Build Frontend', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run build:frontend', 'Building React frontend with Vite');

  // Verify frontend build
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    log('✗ Frontend build failed - dist/ not created', 'red');
    process.exit(1);
  }

  const indexHtmlPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    log('✗ Frontend build failed - index.html not found', 'red');
    process.exit(1);
  }

  log(`Frontend build size: ${getDirectorySize(distPath) / 1024 / 1024} MB`, 'blue');

  // Step 8: Build backend
  log('\nStep 8: Build Backend', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run build:backend', 'Building Express backend');

  // Verify backend build
  const serverDistPath = path.join(process.cwd(), 'server', 'dist');
  if (!fs.existsSync(serverDistPath)) {
    log('✗ Backend build failed - server/dist/ not created', 'red');
    process.exit(1);
  }

  log(`Backend build size: ${getDirectorySize(serverDistPath) / 1024} KB`, 'blue');

  // Step 9: Build Electron
  log('\nStep 9: Build Electron', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run build:electron', 'Building Electron main process');

  // Verify Electron build
  const electronDistPath = path.join(process.cwd(), 'electron', 'dist');
  if (!fs.existsSync(electronDistPath)) {
    log('✗ Electron build failed - electron/dist/ not created', 'red');
    process.exit(1);
  }

  log(`Electron build size: ${getDirectorySize(electronDistPath) / 1024} KB`, 'blue');

  // Step 10: Build all (verification)
  log('\nStep 10: Final Build Verification', 'yellow');
  log('─'.repeat(50), 'yellow');

  const requiredFiles = [
    'dist/index.html',
    'dist/assets/index.js',
    'server/dist/index.js',
    'electron/dist/main.js',
  ];

  let allFilesExist = true;
  requiredFiles.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      log(`✓ ${file} exists`, 'green');
    } else {
      log(`✗ ${file} missing`, 'red');
      allFilesExist = false;
    }
  });

  if (!allFilesExist) {
    log('\n✗ Build verification failed - required files missing', 'red');
    process.exit(1);
  }

  // Step 11: Build installer
  log('\nStep 11: Build Windows Installer', 'yellow');
  log('─'.repeat(50), 'yellow');

  exec('npm run electron:build:win', 'Building Windows installer with electron-builder');

  // Verify installer
  const installersPath = path.join(process.cwd(), 'dist', 'installers');
  if (!fs.existsSync(installersPath)) {
    log('✗ Installer build failed - dist/installers/ not created', 'red');
    process.exit(1);
  }

  const installerFiles = fs.readdirSync(installersPath).filter((f) => f.endsWith('.exe'));
  if (installerFiles.length === 0) {
    log('✗ No installer file found', 'red');
    process.exit(1);
  }

  const installerPath = path.join(installersPath, installerFiles[0]);
  const installerSize = fs.statSync(installerPath).size / 1024 / 1024;
  log(`Installer created: ${installerFiles[0]}`, 'green');
  log(`Installer size: ${installerSize.toFixed(2)} MB`, 'blue');

  // Step 12: Generate checksums
  log('\nStep 12: Generate Checksums', 'yellow');
  log('─'.repeat(50), 'yellow');

  const crypto = require('crypto');

  function generateChecksum(filePath, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  const sha256 = generateChecksum(installerPath, 'sha256');
  const sha512 = generateChecksum(installerPath, 'sha512');

  const checksumPath = path.join(installersPath, 'checksums.txt');
  const checksumContent = `
TravelERP Lite v${VERSION} Checksums
Generated: ${new Date().toISOString()}

File: ${installerFiles[0]}
SHA256: ${sha256}
SHA512: ${sha512}

Verification:
Windows: certutil -hashfile ${installerFiles[0]} SHA256
Linux/Mac: sha256sum ${installerFiles[0]}
`;

  fs.writeFileSync(checksumPath, checksumContent.trim());
  log(`✓ Checksums saved to checksums.txt`, 'green');

  // Step 13: Create release notes
  log('\nStep 13: Create Release Notes', 'yellow');
  log('─'.repeat(50), 'yellow');

  const releaseNotesPath = path.join(installersPath, 'RELEASE_NOTES.txt');
  const releaseNotes = `
TravelERP Lite v${VERSION} Release Notes
========================================

Release Date: ${new Date().toLocaleDateString()}
Version: ${VERSION}

What's New:
- Complete desktop ERP for travel agencies
- Offline capability - no internet required
- Multi-user network mode
- Automatic backups
- Data import/export (Excel, CSV, JSON)
- GST-compliant invoicing
- Driver & owner settlements
- Comprehensive reports

System Requirements:
- Windows 10/11 (64-bit)
- 4GB RAM minimum (8GB recommended)
- 500MB disk space for application

Installation:
1. Double-click ${installerFiles[0]}
2. Follow the installation wizard
3. Complete first-run setup
4. Start using TravelERP Lite!

Documentation:
- Installation Guide: See INSTALL.md
- User Manual: See docs/
- Support: support@travelerp-lite.intelligrip.com

Checksums:
SHA256: ${sha256}
SHA512: ${sha512}

Thank you for using TravelERP Lite!
© 2026 Intelligrip. All Rights Reserved.
`;

  fs.writeFileSync(releaseNotesPath, releaseNotes.trim());
  log(`✓ Release notes saved`, 'green');

  // Step 14: Generate build report
  log('\nStep 14: Build Report', 'yellow');
  log('─'.repeat(50), 'yellow');

  const reportPath = path.join(installersPath, 'build-report.json');
  const buildReport = {
    version: VERSION,
    buildDate: new Date().toISOString(),
    buildNumber: process.env.BUILD_NUMBER || 'manual',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,

    artifacts: {
      installer: {
        file: installerFiles[0],
        size: installerSize,
        checksums: { sha256, sha512 },
      },
      frontend: {
        path: 'dist/',
        size: getDirectorySize(distPath) / 1024 / 1024,
      },
      backend: {
        path: 'server/dist/',
        size: getDirectorySize(serverDistPath) / 1024,
      },
      electron: {
        path: 'electron/dist/',
        size: getDirectorySize(electronDistPath) / 1024,
      },
    },

    tests: {
      status: 'passed',
      command: 'npm run test:run',
    },

    verification: {
      requiredFiles: requiredFiles,
      allPresent: true,
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(buildReport, null, 2));
  log(`✓ Build report saved to build-report.json`, 'green');

  // Final summary
  log('\n========================================', 'magenta');
  log('Build Complete!', 'green');
  log('========================================', 'magenta');
  log(`\nVersion: ${VERSION}`, 'blue');
  log(`Installer: dist/installers/${installerFiles[0]}`, 'blue');
  log(`Size: ${installerSize.toFixed(2)} MB`, 'blue');
  log(`\nSHA256: ${sha256}`, 'blue');
  log(`\nNext Steps:`, 'yellow');
  log(`1. Test installation on clean machine`, 'yellow');
  log(`2. Upload to update server`, 'yellow');
  log(`3. Create release announcement`, 'yellow');
  log(`4. Deploy to production`, 'yellow');
  log('\n', 'magenta');
}

function getDirectorySize(dirPath) {
  let size = 0;

  function calculateSize(path) {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(path);
      files.forEach((file) => calculateSize(`${path}/${file}`));
    } else {
      size += stats.size;
    }
  }

  calculateSize(dirPath);
  return size;
}

main().catch((error) => {
  log(`\n✗ Build failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
