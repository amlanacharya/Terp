#!/usr/bin/env tsx

/**
 * Beta License Key Generator
 *
 * Generates product keys for beta testers
 * Usage: npx tsx server/src/license/beta-key-generator.ts [options]
 */

import { generateProductKey, validateProductKey, extractSubscriptionType } from './key-generator';
import { promises as fs } from 'fs';
import path from 'path';

interface GenerationOptions {
  count: number;
  type: 'monthly' | 'quarterly' | 'annual';
  output: string;
}

const DEFAULT_OPTIONS: GenerationOptions = {
  count: 10,
  type: 'monthly',
  output: 'beta-keys.txt',
};

async function generateBetaKeys(options: GenerationOptions): Promise<void> {
  const keys: string[] = [];
  const keyDetails: Array<{ key: string; type: string; valid: boolean }> = [];

  console.log(`\n🔑 Generating ${options.count} ${options.type} beta product keys...\n`);

  // Generate keys
  for (let i = 0; i < options.count; i++) {
    const key = generateProductKey(options.type);
    keys.push(key);
    keyDetails.push({
      key,
      type: options.type,
      valid: validateProductKey(key).valid,
    });
    console.log(`  ${i + 1}. ${key}`);
  }

  // Verify all keys
  console.log('\n✅ Verification:');
  const allValid = keyDetails.every((detail) => detail.valid);
  console.log(`  All keys valid: ${allValid ? '✓' : '✗'}`);

  // Save to file
  const outputPath = path.resolve(process.cwd(), options.output);
  const fileContent = [
    '# TravelERP Lite - Beta Product Keys',
    `# Generated: ${new Date().toISOString()}`,
    `# Type: ${options.type}`,
    `# Count: ${options.count}`,
    '',
    ...keys,
    '',
    '# Key Information:',
    '# - Format: GT01-TTXX-YYYY-ZZZZ-CCCC',
    '# - TT: Subscription type (10=Monthly, 20=Quarterly, 30=Annual)',
    '# - Each key can be activated on one machine only',
    '# - Hardware changes may require reactivation',
    '',
    '# Beta License:',
    '# - Validity: As per subscription type from activation',
    '# - Beta Period: March 25 - April 22, 2026',
    '# - Post-Beta: Migrate to final release with beta discount',
  ].join('\n');

  await fs.writeFile(outputPath, fileContent, 'utf-8');
  console.log(`\n📁 Keys saved to: ${outputPath}`);

  // Statistics
  console.log('\n📊 Statistics:');
  console.log(`  Total keys generated: ${options.count}`);
  console.log(`  Subscription type: ${options.type}`);
  console.log(`  Success rate: ${((keyDetails.filter((d) => d.valid).length / options.count) * 100).toFixed(1)}%`);

  console.log('\n✨ Generation complete!\n');
}

function printUsage() {
  console.log(`
Usage: npx tsx server/src/license/beta-key-generator.ts [options]

Options:
  -c, --count <number>     Number of keys to generate (default: 10)
  -t, --type <type>        Subscription type: monthly, quarterly, annual (default: monthly)
  -o, --output <file>      Output file path (default: beta-keys.txt)
  -h, --help               Show this help message

Examples:
  # Generate 10 monthly keys (default)
  npx tsx server/src/license/beta-key-generator.ts

  # Generate 50 quarterly keys
  npx tsx server/src/license/beta-key-generator.ts --count 50 --type quarterly

  # Generate 100 annual keys with custom output
  npx tsx server/src/license/beta-key-generator.ts -c 100 -t annual -o annual-beta-keys.txt
`);
}

function parseArgs(args: string[]): GenerationOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
        break;

      case '-c':
      case '--count':
        i++;
        const count = parseInt(args[i], 10);
        if (isNaN(count) || count < 1) {
          console.error('Error: Count must be a positive number');
          process.exit(1);
        }
        options.count = count;
        break;

      case '-t':
      case '--type':
        i++;
        const type = args[i]?.toLowerCase();
        if (type !== 'monthly' && type !== 'quarterly' && type !== 'annual') {
          console.error('Error: Type must be monthly, quarterly, or annual');
          process.exit(1);
        }
        options.type = type;
        break;

      case '-o':
      case '--output':
        i++;
        options.output = args[i];
        break;

      default:
        console.error(`Error: Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  return options;
}

async function main() {
  console.log('\n🚀 TravelERP Lite - Beta License Key Generator');
  console.log('==========================================\n');

  try {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    await generateBetaKeys(options);
  } catch (error) {
    console.error('\n❌ Error generating keys:', error);
    process.exit(1);
  }
}

main();
