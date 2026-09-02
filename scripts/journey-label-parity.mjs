#!/usr/bin/env node
/**
 * Journey-label parity guard (WM2.4, openspec
 * harden-warm-momentum-2-4-reliability-performance-completion-v1).
 *
 * Root cause it guards against: the P2 heavy journey clicked tab
 * 'Overview' for ~30 days after the WM2.0 rename to 'Today' because the
 * journeys project skips PR lanes and nothing else compared labels.
 *
 * Single source of truth: the NAV_ITEMS literal block in app/index.tsx.
 * Checked consumers: every e2e helper/journey tab-label map plus inline
 * getByRole('button', { name: '<label>' }) tab clicks.
 *
 * Exit 1 with a named diff on any mismatch. Wired into `qa:fast`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

/**
 * Parse the NAV_ITEMS rail block from app/index.tsx source text.
 * Exported for the parser unit test.
 */
export function parseRailLabels(appIndexSource) {
  const navBlock = appIndexSource.match(/const NAV_ITEMS: NavItem\[\] = \[([\s\S]*?)\];/);
  if (!navBlock) return null;
  const railLabels = new Map();
  for (const entry of navBlock[1].matchAll(/\{ name: '([^']+)', label: '([^']+)'/g)) {
    railLabels.set(entry[1], entry[2]);
  }
  return railLabels.size > 0 ? railLabels : null;
}
const failures = [];

// --- Source of truth: NAV_ITEMS in app/index.tsx -----------------------
const appIndex = readFileSync(join(root, 'app', 'index.tsx'), 'utf8');
const railLabels = parseRailLabels(appIndex);
if (!railLabels) {
  console.error('journey-label-parity: cannot parse NAV_ITEMS { name, label } entries in app/index.tsx');
  process.exit(1);
}

// --- Consumers 1: explicit label maps in e2e ---------------------------
const e2eDir = join(root, 'e2e');
const labelMapPatterns = [
  // TAB_LABELS = { overview: 'Today', ... }
  { name: 'TAB_LABELS', regex: /const TAB_LABELS(?::[^=]*)?= \{([\s\S]*?)\} as const/ },
  // TAB_LABELS_NAMES: Record<SectionName, string> = { overview: 'Today', ... }
  { name: 'TAB_LABELS_NAMES', regex: /const TAB_LABELS_NAMES(?::[^=]*)?= \{([\s\S]*?)\};/ },
];
const sectionNameToRailKey = { overview: 'overview', pomodoro: 'pomodoro' };

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

for (const file of collectFiles(e2eDir)) {
  const source = readFileSync(file, 'utf8');
  for (const map of labelMapPatterns) {
    const block = source.match(map.regex);
    if (!block) continue;
    for (const entry of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
      const key = entry[1];
      const label = entry[2];
      const railKey = sectionNameToRailKey[key] ?? key;
      const expected = railLabels.get(railKey);
      // Keys that are not rail sections (e.g. extra metadata maps) are
      // skipped — only tab-label keys are guarded.
      if (!railLabels.has(railKey)) continue;
      if (expected !== label) {
        failures.push(
          `${file}: map "${map.name}" ${key}: '${label}' != app rail '${expected}'`,
        );
      }
    }
  }
}

// --- Consumers 2: inline tab clicks by exact rail label ----------------
// A click on a button whose name is a *stale* label is the rot we saw. We
// cannot know intent, so only flag clicks using labels that look like tab
// names but match no current rail label AND resemble a known-section word.
const knownSectionWords = ['Overview', 'To Do', 'Habits', 'Focus', 'Workout', 'Calories', 'Today'];
const staleSectionWords = new Set(['Overview']); // names a rail section but is not a rail label
for (const file of collectFiles(e2eDir)) {
  if (file.endsWith('journey-label-parity.test.ts')) continue;
  const source = readFileSync(file, 'utf8');
  for (const entry of source.matchAll(/getByRole\('button',\s*\{\s*name:\s*'([^']+)',\s*exact:\s*true\s*\}\)/g)) {
    const name = entry[1];
    if (staleSectionWords.has(name)) {
      failures.push(`${file}: inline tab click on stale label '${name}' (rail has no such label)`);
    } else if (
      knownSectionWords.includes(name) &&
      ![...railLabels.values()].includes(name)
    ) {
      failures.push(`${file}: inline tab click '${name}' is not a current rail label`);
    }
  }
}

// --- Report -------------------------------------------------------------
if (failures.length > 0) {
  console.error(`journey-label-parity: ${failures.length} mismatch(es):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `journey-label-parity: OK — rail [${[...railLabels.entries()]
    .map(([key, label]) => `${key}=${label}`)
    .join(', ')}]; all e2e label maps and inline tab clicks agree`,
);
