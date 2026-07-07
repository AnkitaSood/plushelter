#!/usr/bin/env node
/**
 * Flips DEMO_MODE in .env.local for local testing (see tasks.md's DEMO_MODE
 * propagation gotcha — this only affects netlify dev after a restart).
 * Usage: node scripts/set-demo-mode.mjs <true|false>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const value = process.argv[2];
if (value !== 'true' && value !== 'false') {
  console.error('Usage: node scripts/set-demo-mode.mjs <true|false>');
  process.exit(1);
}

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const line = `DEMO_MODE=${value}`;

let contents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
if (/^DEMO_MODE=.*$/m.test(contents)) {
  contents = contents.replace(/^DEMO_MODE=.*$/m, line);
} else {
  contents = contents.length > 0 && !contents.endsWith('\n') ? `${contents}\n${line}\n` : `${contents}${line}\n`;
}

writeFileSync(envPath, contents);
console.log(`DEMO_MODE set to ${value} — restart netlify dev (Ctrl+C, then netlify dev) to apply it.`);
