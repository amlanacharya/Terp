#!/usr/bin/env node

/**
 * Test runner script for TravelERP Lite
 * Runs tests with proper environment setup
 */

const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const script = process.argv[2] || 'test';

  const scripts = {
    test: () => runCommand('npm', ['test', '--', '--run']),
    'test:ui': () => runCommand('npm', ['run', 'test:ui']),
    'test:coverage': () => runCommand('npm', ['run', 'test:coverage']),
    'test:run': () => runCommand('npm', ['run', 'test:run']),
  };

  const scriptFn = scripts[script];

  if (!scriptFn) {
    console.error(`Unknown script: ${script}`);
    console.log('Available scripts:', Object.keys(scripts).join(', '));
    process.exit(1);
  }

  try {
    await scriptFn();
    process.exit(0);
  } catch (error) {
    console.error('Test run failed:', error.message);
    process.exit(1);
  }
}

main();
