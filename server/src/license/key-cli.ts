#!/usr/bin/env tsx

/**
 * License Key Generation CLI Tool
 *
 * Usage:
 *   npm run generate:keys -- --monthly 100 --quarterly 50 --annual 20
 *   npm run generate:keys -- --all 10
 */

import { generateKeyPool, validateProductKey } from './key-generator.js';
import fs from 'fs';
import path from 'path';

interface CliArgs {
  monthly?: number;
  quarterly?: number;
  annual?: number;
  all?: number;
  output?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--monthly':
        result.monthly = nextArg ? parseInt(nextArg, 10) : 0;
        i++;
        break;
      case '--quarterly':
        result.quarterly = nextArg ? parseInt(nextArg, 10) : 0;
        i++;
        break;
      case '--annual':
        result.annual = nextArg ? parseInt(nextArg, 10) : 0;
        i++;
        break;
      case '--all':
        result.all = nextArg ? parseInt(nextArg, 10) : 0;
        i++;
        break;
      case '--output':
      case '-o':
        result.output = nextArg || '';
        i++;
        break;
    }
  }

  // If --all is specified, distribute evenly
  if (result.all !== undefined) {
    const count = result.all;
    result.monthly = Math.floor(count * 0.6); // 60% monthly
    result.quarterly = Math.floor(count * 0.3); // 30% quarterly
    result.annual = count - result.monthly - result.quarterly; // 10% annual
  }

  return result;
}

function generateOutputFilename(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `keys-${date}.json`;
}

function main() {
  console.log('=================================');
  console.log('  TravelERP Lite Key Generator');
  console.log('=================================\n');

  const args = parseArgs();

  const monthly = args.monthly || 0;
  const quarterly = args.quarterly || 0;
  const annual = args.annual || 0;

  if (monthly === 0 && quarterly === 0 && annual === 0) {
    console.log('Usage: npm run generate:keys -- [options]\n');
    console.log('Options:');
    console.log('  --monthly <n>    Generate N monthly keys');
    console.log('  --quarterly <n>  Generate N quarterly keys');
    console.log('  --annual <n>     Generate N annual keys');
    console.log('  --all <n>        Generate N keys (60% monthly, 30% quarterly, 10% annual)');
    console.log('  --output <file>  Output file path (default: keys-YYYY-MM-DD.json)');
    console.log('\nExample:');
    console.log('  npm run generate:keys -- --monthly 100 --quarterly 50 --annual 20');
    process.exit(1);
  }

  console.log(`Generating keys:`);
  console.log(`  Monthly:   ${monthly}`);
  console.log(`  Quarterly: ${quarterly}`);
  console.log(`  Annual:    ${annual}`);
  console.log(`  Total:     ${monthly + quarterly + annual}\n`);

  // Generate keys
  console.log('Generating keys...');
  const startTime = Date.now();
  const pool = generateKeyPool(monthly, quarterly, annual);
  const elapsed = Date.now() - startTime;

  console.log(`Generated ${pool.total} keys in ${elapsed}ms\n`);

  // Validate all keys
  console.log('Validating keys...');
  let validCount = 0;
  let invalidCount = 0;

  [...pool.monthly, ...pool.quarterly, ...pool.annual].forEach(key => {
    const validation = validateProductKey(key);
    if (validation.valid) {
      validCount++;
    } else {
      invalidCount++;
      console.error(`  Invalid key: ${key} - ${validation.error}`);
    }
  });

  console.log(`  Valid:   ${validCount}`);
  console.log(`  Invalid: ${invalidCount}\n`);

  if (invalidCount > 0) {
    console.log('❌ Some keys are invalid. This should not happen!');
    process.exit(1);
  }

  // Check for duplicates
  console.log('Checking for duplicates...');
  const allKeys = [...pool.monthly, ...pool.quarterly, ...pool.annual];
  const uniqueKeys = new Set(allKeys);

  if (uniqueKeys.size !== allKeys.length) {
    console.log('❌ Duplicate keys found!');
    process.exit(1);
  }

  console.log('✅ No duplicates found\n');

  // Save to file
  const outputFile = args.output || generateOutputFilename();
  const outputPath = path.join(process.cwd(), outputFile);

  console.log(`Saving keys to: ${outputFile}`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(pool, null, 2),
    'utf-8'
  );
  console.log('✅ Keys saved successfully!\n');

  // Summary
  console.log('=================================');
  console.log('  Generation Complete!');
  console.log('=================================');
  console.log(`File: ${outputFile}`);
  console.log(`Total keys: ${pool.total}`);
  console.log(`Generated at: ${pool.generatedAt.toISOString()}`);
  console.log('\n⚠️  IMPORTANT: Keep this file secure and private!');
  console.log('   It contains valid product keys for TravelERP Lite.\n');
}

main();
