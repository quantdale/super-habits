/**
 * Remove local build/test artifacts (all regenerable by their build scripts).
 *
 * Deletes dist/, dist-sync/, dist-live/, .expo/, test-results/ and
 * simulation-output/ when present; prints what was removed. Safe to run
 * anytime — every target is a gitignored output directory.
 *
 * Usage:
 *   node scripts/clean.mjs
 *   npm run clean
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TARGETS = ['dist', 'dist-sync', 'dist-live', '.expo', 'test-results', 'simulation-output'];

let removed = 0;
for (const target of TARGETS) {
  const p = join(ROOT, target);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`removed ${target}/`);
    removed += 1;
  }
}

if (removed === 0) {
  console.log('clean — nothing to remove.');
} else {
  console.log(`clean — removed ${removed} artifact director${removed === 1 ? 'y' : 'ies'}.`);
}
