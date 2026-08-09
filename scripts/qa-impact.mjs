import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const mapPath = resolve(root, 'qa', 'impact-map.json');
const impactMap = JSON.parse(readFileSync(mapPath, 'utf8'));

function fail(message) {
  console.error(`QA impact map error: ${message}`);
  process.exitCode = 1;
}

function validateMap() {
  if (impactMap.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (!impactMap.default || !Array.isArray(impactMap.default.gates)) {
    fail('default.gates must be an array');
  }
  if (!Array.isArray(impactMap.rules) || impactMap.rules.length === 0) {
    fail('rules must be a non-empty array');
  }
  const ids = new Set();
  for (const [index, rule] of (impactMap.rules ?? []).entries()) {
    if (!rule || typeof rule.id !== 'string' || rule.id.length === 0) {
      fail(`rules[${index}].id must be a non-empty string`);
    }
    if (ids.has(rule.id)) fail(`duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
      fail(`rules[${index}].patterns must be a non-empty array`);
    }
    if (!Array.isArray(rule.gates) || rule.gates.length === 0) {
      fail(`rules[${index}].gates must be a non-empty array`);
    }
  }
  return process.exitCode !== 1;
}

function globToRegExp(glob) {
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

function gitFiles(args) {
  const baseIndex = args.indexOf('--base');
  const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
  const explicitIndex = args.indexOf('--files');
  if (explicitIndex >= 0) return args.slice(explicitIndex + 1).filter(Boolean);

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
      // The explicit --files form remains available outside a Git checkout.
    }
  }
  return [...files].sort();
}

if (!validateMap()) process.exit(1);
if (process.argv.includes('--validate')) {
  console.log(`QA impact map valid: ${impactMap.rules.length} rules`);
  process.exit(0);
}

const files = gitFiles(process.argv.slice(2));
const matchedRules = impactMap.rules.filter((rule) =>
  files.some((file) => rule.patterns.some((pattern) => globToRegExp(pattern).test(file))),
);
const gates = new Set(impactMap.default.gates);
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

const plan = {
  schemaVersion: 1,
  files,
  matchedRules: matchedRules.map((rule) => rule.id),
  gates: [...gates],
  tests: [...tests],
  journeys: [...journeys],
  broadRegression,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log('QA impact plan');
  console.log(`Changed files: ${files.length > 0 ? files.join(', ') : '(none detected)'}`);
  console.log(
    `Matched rules: ${plan.matchedRules.length > 0 ? plan.matchedRules.join(', ') : '(default)'}`,
  );
  console.log(`Required gates: ${plan.gates.join(' → ')}`);
  if (plan.tests.length > 0) console.log(`Focused tests: ${plan.tests.join(', ')}`);
  if (plan.journeys.length > 0) console.log(`Journeys/scenarios: ${plan.journeys.join(', ')}`);
  console.log(
    `Broad regression: ${broadRegression ? 'required' : 'not required by matched rules'}`,
  );
}
