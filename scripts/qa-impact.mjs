import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

export function validateImpactMap(impactMap) {
  const errors = [];
  if (impactMap.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!impactMap.default || !Array.isArray(impactMap.default.gates)) {
    errors.push('default.gates must be an array');
  }
  if (!Array.isArray(impactMap.rules) || impactMap.rules.length === 0) {
    errors.push('rules must be a non-empty array');
  }
  const ids = new Set();
  for (const [index, rule] of (impactMap.rules ?? []).entries()) {
    if (!rule || typeof rule.id !== 'string' || rule.id.length === 0) {
      errors.push(`rules[${index}].id must be a non-empty string`);
      continue;
    }
    if (ids.has(rule.id)) errors.push(`duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
      errors.push(`rules[${index}].patterns must be a non-empty array`);
    }
    if (!Array.isArray(rule.gates) || rule.gates.length === 0) {
      errors.push(`rules[${index}].gates must be a non-empty array`);
    }
  }
  return errors;
}

export function globToRegExp(glob) {
  let pattern = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      pattern += '.*';
      i += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function collectGitFiles({ root = process.cwd(), base = null } = {}) {
  const commands = [
    ['diff', '--name-only', ...(base ? [base] : [])],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  const files = new Set();
  for (const command of commands) {
    try {
      const output = execFileSync('git', command, { cwd: root, encoding: 'utf8' });
      output
        .split(/\r?\n/)
        .map((file) => file.trim().replaceAll('\\', '/'))
        .filter(Boolean)
        .forEach((file) => files.add(file));
    } catch {
      // A caller can still use explicit files outside a Git checkout.
    }
  }
  return [...files].sort();
}

export function loadImpactMap(root = process.cwd()) {
  return JSON.parse(readFileSync(resolve(root, 'qa', 'impact-map.json'), 'utf8'));
}

export function buildImpactPlan({ files, impactMap }) {
  const matchedRules = impactMap.rules.filter((rule) =>
    files.some((file) => rule.patterns.some((pattern) => globToRegExp(pattern).test(file))),
  );
  const matchedFiles = new Set(
    files.filter((file) =>
      matchedRules.some((rule) =>
        rule.patterns.some((pattern) => globToRegExp(pattern).test(file)),
      ),
    ),
  );
  const hasUnmatchedFiles = files.some((file) => !matchedFiles.has(file));
  const gates = new Set(files.length === 0 || hasUnmatchedFiles ? impactMap.default.gates : []);
  const tests = new Set();
  const journeys = new Set();
  let broadRegression = false;
  for (const rule of matchedRules) {
    rule.gates.forEach((gate) => gates.add(gate));
    (rule.tests ?? []).forEach((test) => tests.add(test));
    (rule.journeys ?? []).forEach((journey) => journeys.add(journey));
    broadRegression ||= rule.broadRegression === true;
  }
  if (broadRegression) gates.add('qa:full');

  return {
    schemaVersion: 1,
    files,
    matchedRules: matchedRules.map((rule) => rule.id),
    gates: [...gates],
    tests: [...tests],
    journeys: [...journeys],
    broadRegression,
  };
}

export function formatImpactPlan(plan) {
  const lines = [
    'QA impact plan',
    `Changed files: ${plan.files.length > 0 ? plan.files.join(', ') : '(none detected)'}`,
    `Matched rules: ${plan.matchedRules.length > 0 ? plan.matchedRules.join(', ') : '(default)'}`,
    `Required gates: ${plan.gates.join(' → ')}`,
  ];
  if (plan.tests.length > 0) lines.push(`Focused tests: ${plan.tests.join(', ')}`);
  if (plan.journeys.length > 0) lines.push(`Journeys/scenarios: ${plan.journeys.join(', ')}`);
  lines.push(
    `Broad regression: ${plan.broadRegression ? 'required' : 'not required by matched rules'}`,
  );
  return lines.join('\n');
}

export function runQaImpactCli(args = process.argv.slice(2), root = process.cwd()) {
  const impactMap = loadImpactMap(root);
  const errors = validateImpactMap(impactMap);
  if (errors.length > 0) {
    errors.forEach((message) => console.error(`QA impact map error: ${message}`));
    return 1;
  }
  if (args.includes('--validate')) {
    console.log(`QA impact map valid: ${impactMap.rules.length} rules`);
    return 0;
  }
  const baseIndex = args.indexOf('--base');
  const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
  const explicitIndex = args.indexOf('--files');
  const files =
    explicitIndex >= 0
      ? args.slice(explicitIndex + 1).filter((file) => file && !file.startsWith('--'))
      : collectGitFiles({ root, base });
  const normalizedFiles = files.map((file) => file.trim().replaceAll('\\', '/')).filter(Boolean);
  const plan = buildImpactPlan({ files: normalizedFiles, impactMap });
  if (args.includes('--json')) console.log(JSON.stringify(plan, null, 2));
  else console.log(formatImpactPlan(plan));
  return 0;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href ===
    pathToFileURL(resolve(scriptDirectory, 'qa-impact.mjs')).href;
if (isMain) process.exitCode = runQaImpactCli();
