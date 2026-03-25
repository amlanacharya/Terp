#!/usr/bin/env node

/**
 * Download PostgreSQL Portable Binaries
 *
 * This script downloads PostgreSQL 15.3 portable binaries for Windows
 * and extracts them to build/postgres/ for bundling with TravelERP Lite.
 *
 * Usage: node scripts/download-postgres.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PG_VERSION = '15.3-1';
const PG_URL = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`;
const OUTPUT_DIR = path.join(process.cwd(), 'build', 'postgres');
const ZIP_FILE = path.join(OUTPUT_DIR, 'postgresql-binaries.zip');

function log(message) {
  console.log(`[Download PostgreSQL] ${message}`);
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    log(`Downloading from ${url}...`);

    const file = createWriteStream(destination);

    https.get(url, (response) => {
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.pipe(file);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
      });

      file.on('finish', () => {
        file.close();
        console.log('\n');
        log('Download complete!');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destination);
      reject(err);
    });
  });
}

function extractZip(zipFile, targetDir) {
  log('Extracting ZIP file...');

  try {
    // Try using unzip (available on Git Bash / WSL)
    execSync(`unzip -q "${zipFile}" -d "${targetDir}"`, { stdio: 'inherit' });
    log('Extraction complete!');
  } catch (error) {
    log('Error: unzip command not found.');
    log('Please extract the ZIP manually or install unzip:');
    log('  - Windows (Git Bash): Already installed');
    log('  - Windows (PowerShell): Use Expand-Archive cmdlet');
    throw error;
  }
}

function organizeFiles() {
  log('Organizing PostgreSQL files...');

  // Move files from pgsql/ to parent directory
  const pgsqlDir = path.join(OUTPUT_DIR, 'pgsql');
  if (fs.existsSync(pgsqlDir)) {
    const files = fs.readdirSync(pgsqlDir);
    files.forEach(file => {
      const srcPath = path.join(pgsqlDir, file);
      const destPath = path.join(OUTPUT_DIR, file);
      fs.renameSync(srcPath, destPath);
    });
    fs.rmdirSync(pgsqlDir);
  }

  // Remove unnecessary directories to save space
  const dirsToRemove = [
    path.join(OUTPUT_DIR, 'pgAdmin 4'),
    path.join(OUTPUT_DIR, 'StackBuilder'),
    path.join(OUTPUT_DIR, 'doc'),
    path.join(OUTPUT_DIR, 'include'),
    path.join(OUTPUT_DIR, 'symbols'),
  ];

  dirsToRemove.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log(`Removed: ${dir}`);
    }
  });

  log('Files organized successfully!');
}

function verifyInstallation() {
  log('Verifying PostgreSQL installation...');

  const requiredFiles = [
    path.join(OUTPUT_DIR, 'bin', 'initdb.exe'),
    path.join(OUTPUT_DIR, 'bin', 'postgres.exe'),
    path.join(OUTPUT_DIR, 'bin', 'psql.exe'),
    path.join(OUTPUT_DIR, 'bin', 'pg_ctl.exe'),
  ];

  const allExist = requiredFiles.every(file => fs.existsSync(file));

  if (allExist) {
    log('✅ PostgreSQL installation verified!');
    return true;
  } else {
    log('❌ PostgreSQL installation incomplete!');
    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file);
      log(`  ${exists ? '✅' : '❌'} ${path.relative(OUTPUT_DIR, file)}`);
    });
    return false;
  }
}

async function main() {
  try {
    log('Starting PostgreSQL download...');
    log(`Version: ${PG_VERSION}`);
    log(`Target: ${OUTPUT_DIR}`);

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Check if already downloaded
    if (fs.existsSync(ZIP_FILE) && verifyInstallation()) {
      log('PostgreSQL already downloaded and verified!');
      return;
    }

    // Download
    await downloadFile(PG_URL, ZIP_FILE);

    // Extract
    extractZip(ZIP_FILE, OUTPUT_DIR);

    // Organize files
    organizeFiles();

    // Verify
    const verified = verifyInstallation();

    if (verified) {
      // Clean up ZIP file
      fs.unlinkSync(ZIP_FILE);
      log('ZIP file removed.');
      log('\n✅ PostgreSQL portable is ready!');
      log(`Location: ${OUTPUT_DIR}`);
      log('Size: ~' + (getDirectorySize(OUTPUT_DIR) / 1024 / 1024).toFixed(0) + ' MB');
    } else {
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function getDirectorySize(dirPath) {
  let size = 0;
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stats.size;
    }
  });

  return size;
}

main();
