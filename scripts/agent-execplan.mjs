import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildImpactPlan,
  collectGitFiles,
  loadImpactMap,
  validateImpactMap,
} from './qa-impact.mjs';

const PLAN_VERSION = 2;
const LIFECYCLES = new Set(['ACTIVE', 'BLOCKED', 'COMPLETED']);
const PLACEHOLDER_PATTERN = /\b(?:todo|tbd|fill\s+(?:it\s+)?later|placeholder|unknown)\b/i;

const REQUIRED_SECTIONS = [
  'purpose',
  'context',
  'scope',
  'nonGoals',
  'checkpoint',
  'progress',
  'discoveries',
  'decisions',
  'validation',
  'changedFiles',
  'recovery',
  'outcomes',
];

const SECTION_ALIASES = {
  purpose: ['purpose / user outcome', 'purpose', 'user outcome'],
  context: ['context'],
  scope: ['scope'],
  nonGoals: ['non-goals', 'non goals'],
  checkpoint: ['current checkpoint', 'checkpoint'],
  progress: ['progress'],
  discoveries: ['surprises & discoveries', 'surprises and discoveries', 'discoveries'],
  decisions: ['decision log', 'decisions'],
  validation: ['validation ledger', 'validation'],
  changedFiles: ['changed files / areas', 'changed files', 'changed areas'],
  recovery: ['recovery / resume instructions', 'recovery', 'resume instructions'],
  outcomes: ['outcomes & retrospective', 'outcomes and retrospective', 'outcomes', 'retrospective'],
};

const CHECKPOINT_FIELDS = {
  currentMilestone: ['current milestone', 'milestone'],
  completed: ['completed', 'completed work'],
  inProgress: ['in progress', 'working progress', 'work in progress'],
  modifiedFiles: ['important modified files', 'modified files', 'important files'],
  lastValidation: ['last successful validation', 'last validation'],
  failures: ['current failures', 'failures'],
  quarantines: ['relevant quarantines', 'known quarantines', 'quarantines'],
  blockers: ['blockers', 'blocker'],
  unblockCondition: ['condition required to unblock', 'unblock condition'],
  resumeAfterUnblock: ['exact resume action after unblock', 'resume action after unblock'],
  exactNextAction: ['exact next action'],
  remainingDod: ['remaining definition of done', 'remaining definition-of-done', 'remaining dod'],
};

function normalizeText(value) {
  return value
    .replaceAll('\\', '/')
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function canonicalField(label) {
  const normalized = normalizeText(label).replace(/[.:]+$/g, '');
  return Object.entries(CHECKPOINT_FIELDS).find(([, aliases]) => aliases.includes(normalized))?.[0];
}

function parseHeadings(text) {
  return [...text.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: match[2].trim(),
    index: match.index,
    end: match.index + match[0].length,
  }));
}

function parseSections(text) {
  const headings = parseHeadings(text);
  const sections = new Map();
  for (const heading of headings) {
    const title = normalizeText(heading.title);
    const key = Object.entries(SECTION_ALIASES).find(([, aliases]) => aliases.includes(title))?.[0];
    if (!key || sections.has(key)) continue;
    const nextHeading = headings.find(
      (candidate) => candidate.index > heading.index && candidate.level <= heading.level,
    );
    const end = nextHeading?.index ?? text.length;
    sections.set(key, text.slice(heading.end, end).trim());
  }
  return sections;
}

function parseCheckpointFields(checkpoint) {
  const fields = {};
  let activeKey = null;
  for (const rawLine of checkpoint.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(?:[-*+]\s+)?(?:\*\*)?([^:\n]{2,90}?)(?:\*\*)?\s*:\s*(.*)$/);
    const key = match ? canonicalField(match[1]) : null;
    if (key) {
      fields[key] = match[2].trim();
      activeKey = key;
      continue;
    }
    if (activeKey && line.length > 0) {
      fields[activeKey] = `${fields[activeKey]} ${line.replace(/^[-*+]\s+/, '')}`.trim();
    }
  }
  return fields;
}

function cleanMarkdown(value) {
  return value
    .replace(/<!--.*?-->/gs, '')
    .replace(/[`*]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(value, limit = 500) {
  const clean = cleanMarkdown(value || 'None');
  return clean.length > limit ? `${clean.slice(0, limit - 1).trim()}…` : clean;
}

function extractVersion(text) {
  const firstHeading =
    parseHeadings(text).find((heading) => heading.level >= 2)?.index ?? text.length;
  const match = [...text.matchAll(/^(?:Plan-Version|ExecPlan-Version)\s*:\s*(\d+)\s*$/gim)].find(
    (candidate) => candidate.index < firstHeading,
  );
  return match ? Number(match[1]) : null;
}

function inferLifecycle(text, sections) {
  const firstHeading =
    parseHeadings(text).find((heading) => heading.level >= 2)?.index ?? text.length;
  const explicit = [...text.matchAll(/^Status\s*:\s*(ACTIVE|BLOCKED|COMPLETED)\s*$/gim)].find(
    (candidate) => candidate.index < firstHeading,
  );
  if (explicit) return { status: explicit[1], explicit: true };
  const legacyComplete = sections
    .get('outcomes')
    ?.match(/^\s*[-*]?\s*Status\s*:\s*Complete(?:d)?\b/im);
  return { status: legacyComplete ? 'COMPLETED' : 'ACTIVE', explicit: false };
}

function normalizeRepoPath(value, root) {
  let candidate = value
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/[),.;]+$/g, '');
  if (!candidate || candidate.startsWith('http://') || candidate.startsWith('https://'))
    return null;
  const absolute = isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate);
  const resolved = absolute ? resolve(candidate) : resolve(root, candidate);
  const relativePath = absolute ? relative(root, resolved) : candidate;
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${'/'}`) ||
    relativePath.startsWith(`..${'\\'}`)
  ) {
    return null;
  }
  return relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function extractPlanPaths(changedFilesSection, root) {
  const claims = new Set();
  for (const match of changedFilesSection.matchAll(/`([^`]+)`/g)) {
    const path = normalizeRepoPath(match[1], root);
    if (path) claims.add(path);
  }
  return [...claims];
}

function claimMatchesFile(claim, file) {
  if (claim.endsWith('/')) return file.startsWith(claim);
  if (claim.includes('*') || claim.includes('?')) return globLike(claim, file);
  return claim === file;
}

function globLike(pattern, value) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`^${source}$`).test(value);
}

function isNoAction(value) {
  return /^(?:none|no (?:further )?(?:implementation )?(?:action|work)|task complete|complete|n\/a)\b/i.test(
    cleanMarkdown(value),
  );
}

function isNoRemainingWork(value) {
  return /^(?:none|no remaining work|complete|completed|done|all .* (?:complete|satisfied|validated))\b/i.test(
    cleanMarkdown(value),
  );
}

function hasFinalValidationEvidence(value) {
  return /`[^`]+`/.test(value) && /\bpass\b/i.test(cleanMarkdown(value));
}

function hasMeaningful(value) {
  const clean = cleanMarkdown(value);
  return clean.length > 0 && !PLACEHOLDER_PATTERN.test(clean);
}

function validatePlanRecord(record) {
  const errors = [];
  const warnings = [];
  const { text, sections, fields, lifecycle, version } = record;
  for (const section of REQUIRED_SECTIONS) {
    if (!sections.has(section) || !sections.get(section).trim()) {
      errors.push(`missing required section: ${section}`);
    }
  }
  if (version !== PLAN_VERSION) {
    warnings.push(
      'legacy plan: add Plan-Version: 2 and an explicit Status to opt into lifecycle enforcement',
    );
    return { errors, warnings };
  }
  if (!LIFECYCLES.has(lifecycle.status)) {
    errors.push('Status must be ACTIVE, BLOCKED, or COMPLETED');
    return { errors, warnings };
  }
  if (!lifecycle.explicit) errors.push('versioned plan requires an explicit top-level Status');

  const requiredCheckpointFields = [
    'currentMilestone',
    'completed',
    'inProgress',
    'modifiedFiles',
    'lastValidation',
    'failures',
    'quarantines',
    'blockers',
    'exactNextAction',
    'remainingDod',
  ];
  for (const field of requiredCheckpointFields) {
    if (!fields[field]) errors.push(`Current Checkpoint missing field: ${field}`);
    else if (PLACEHOLDER_PATTERN.test(fields[field])) {
      errors.push(`Current Checkpoint contains unresolved placeholder in: ${field}`);
    }
  }
  if (lifecycle.status === 'ACTIVE') {
    if (isNoAction(fields.exactNextAction || '')) {
      errors.push('ACTIVE plan requires a non-empty implementation Exact next action');
    }
  }
  if (lifecycle.status === 'BLOCKED') {
    for (const field of ['unblockCondition', 'resumeAfterUnblock']) {
      if (!fields[field]) errors.push(`BLOCKED plan missing field: ${field}`);
      else if (
        PLACEHOLDER_PATTERN.test(fields[field]) ||
        /^none\b/i.test(cleanMarkdown(fields[field]))
      ) {
        errors.push(`BLOCKED plan requires a meaningful ${field}`);
      }
    }
    if (!fields.blockers || /^none\b/i.test(cleanMarkdown(fields.blockers))) {
      errors.push('BLOCKED plan requires an explicit blocker');
    }
    if (!fields.completed || /^none\b/i.test(cleanMarkdown(fields.completed))) {
      errors.push('BLOCKED plan requires completed work before the blocker');
    }
  }
  if (lifecycle.status === 'COMPLETED') {
    const progress = sections.get('progress') || '';
    const outcomes = sections.get('outcomes') || '';
    if (!/\[x\]/i.test(progress) || /\[ \]/.test(progress)) {
      errors.push('COMPLETED plan requires fully checked Progress');
    }
    if (!hasFinalValidationEvidence(sections.get('validation') || '')) {
      errors.push('COMPLETED plan requires meaningful final Validation Ledger evidence');
    }
    if (!hasMeaningful(outcomes) || PLACEHOLDER_PATTERN.test(outcomes)) {
      errors.push('COMPLETED plan requires a meaningful Outcomes & Retrospective');
    }
    if (!isNoAction(fields.exactNextAction || '')) {
      errors.push('COMPLETED plan must not retain an implementation Exact next action');
    }
    if (!isNoRemainingWork(fields.remainingDod || '')) {
      errors.push('COMPLETED plan requires a completed remaining definition of done');
    }
  }
  return { errors, warnings };
}

function readPlan(planPath, root) {
  const absolutePath = isAbsolute(planPath) ? resolve(planPath) : resolve(root, planPath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error(`plan not found: ${planPath}`);
  }
  const text = readFileSync(absolutePath, 'utf8');
  const sections = parseSections(text);
  const fields = parseCheckpointFields(sections.get('checkpoint') || '');
  const lifecycle = inferLifecycle(text, sections);
  const record = {
    absolutePath,
    text,
    sections,
    fields,
    lifecycle,
    version: extractVersion(text),
  };
  const validation = validatePlanRecord(record);
  return { ...record, validation };
}

export function discoverPlans(root = process.cwd()) {
  const paths = [];
  const changeRoot = resolve(root, 'openspec', 'changes');
  if (existsSync(changeRoot)) {
    for (const entry of readdirSync(changeRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = resolve(changeRoot, entry.name, 'execplan.md');
      if (existsSync(candidate)) paths.push(candidate);
    }
  }
  const agentRoot = resolve(root, '.agent', 'execplans');
  if (existsSync(agentRoot)) {
    for (const entry of readdirSync(agentRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) paths.push(resolve(agentRoot, entry.name));
    }
  }
  return paths.sort().map((absolutePath) => readPlan(absolutePath, root));
}

function displayPath(absolutePath, root) {
  const relativePath = relative(root, absolutePath);
  if (
    !relativePath ||
    relativePath.startsWith(`..${'/'}`) ||
    relativePath.startsWith(`..${'\\'}`)
  ) {
    return absolutePath.replaceAll('\\', '/');
  }
  return relativePath.replaceAll('\\', '/');
}

function gitStatus(root) {
  try {
    return execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function reconciliation(record, root, changedFiles) {
  const planPath = displayPath(record.absolutePath, root);
  const claims = extractPlanPaths(record.sections.get('changedFiles') || '', root).filter(
    (claim) => claim !== planPath,
  );
  const warnings = [];
  for (const claim of claims) {
    if (!changedFiles.some((file) => claimMatchesFile(claim, file))) {
      warnings.push(`ExecPlan lists ${claim}, but Git reports no current modification.`);
    }
  }
  for (const file of changedFiles) {
    if (file === planPath || file === '.git') continue;
    if (!claims.some((claim) => claimMatchesFile(claim, file))) {
      warnings.push(`Git reports working-tree change not represented in this ExecPlan: ${file}`);
    }
  }
  return { claims, warnings };
}

function impactFor(root, changedFiles) {
  try {
    const impactMap = loadImpactMap(root);
    const errors = validateImpactMap(impactMap);
    if (errors.length > 0) return { errors };
    return { plan: buildImpactPlan({ files: changedFiles, impactMap }) };
  } catch (error) {
    return { errors: [`QA impact unavailable: ${error.message}`] };
  }
}

function parseOptions(args) {
  const [command = 'help', ...rest] = args;
  const options = { command, json: false, all: false, plan: null, root: process.cwd() };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--plan') options.plan = rest[++index];
    else if (arg === '--root') options.root = resolve(rest[++index]);
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

function serializeRecord(record, root) {
  return {
    path: displayPath(record.absolutePath, root),
    version: record.version,
    status: record.lifecycle.status,
    legacy: record.version !== PLAN_VERSION,
    objective: summarize(record.sections.get('purpose')),
    milestone: summarize(record.fields.currentMilestone),
    nextAction: summarize(record.fields.exactNextAction),
    validation: record.validation,
  };
}

function printList(root, json) {
  const records = discoverPlans(root);
  if (json) {
    console.log(
      JSON.stringify(
        records.map((record) => serializeRecord(record, root)),
        null,
        2,
      ),
    );
    return 0;
  }
  if (records.length === 0) {
    console.log('No ExecPlans discovered.');
    return 0;
  }
  const lines = [];
  for (const record of records) {
    lines.push(record.lifecycle.status);
    lines.push(displayPath(record.absolutePath, root));
    lines.push(`Milestone: ${summarize(record.fields.currentMilestone)}`);
    lines.push(`Next: ${summarize(record.fields.exactNextAction)}`);
    if (record.version !== PLAN_VERSION) lines.push('Schema: legacy (not CI-enforced)');
    lines.push('');
  }
  console.log(lines.join('\n').trimEnd());
  return 0;
}

function printValidation(record, root, json) {
  const result = {
    path: displayPath(record.absolutePath, root),
    version: record.version,
    status: record.lifecycle.status,
    errors: record.validation.errors,
    warnings: record.validation.warnings,
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`ExecPlan ${result.errors.length === 0 ? 'valid' : 'invalid'}: ${result.path}`);
    console.log(`Status: ${result.status}`);
    for (const warning of result.warnings) console.log(`Warning: ${warning}`);
    for (const error of result.errors) console.log(`Error: ${error}`);
  }
  return result.errors.length === 0 ? 0 : 1;
}

function printAllValidation(root, json) {
  const records = discoverPlans(root).filter((record) => record.version === PLAN_VERSION);
  const results = records.map((record) => ({
    record,
    result: {
      path: displayPath(record.absolutePath, root),
      status: record.lifecycle.status,
      errors: record.validation.errors,
      warnings: record.validation.warnings,
    },
  }));
  if (json) {
    console.log(
      JSON.stringify(
        results.map(({ result }) => result),
        null,
        2,
      ),
    );
  } else if (results.length === 0) {
    console.log('No versioned ExecPlans to validate.');
  } else {
    for (const { result } of results) {
      console.log(
        `${result.errors.length === 0 ? 'PASS' : 'FAIL'} ${result.path} [${result.status}]`,
      );
      for (const error of result.errors) console.log(`  Error: ${error}`);
    }
  }
  return results.some(({ result }) => result.errors.length > 0) ? 1 : 0;
}

function printResume(record, root, json) {
  const changedFiles = collectGitFiles({ root });
  const statusLines = gitStatus(root);
  const reconciliationResult = reconciliation(record, root, changedFiles);
  const impact = impactFor(root, changedFiles);
  const data = {
    plan: displayPath(record.absolutePath, root),
    status: record.lifecycle.status,
    objective: summarize(record.sections.get('purpose')),
    currentMilestone: summarize(record.fields.currentMilestone),
    completed: summarize(record.fields.completed),
    inProgress: summarize(record.fields.inProgress),
    workingTree: statusLines,
    changedFiles,
    lastValidation: summarize(record.fields.lastValidation),
    failures: summarize(record.fields.failures),
    quarantines: summarize(record.fields.quarantines),
    blockers: summarize(record.fields.blockers),
    qaImpact: impact.plan ?? null,
    qaErrors: impact.errors ?? [],
    warnings: reconciliationResult.warnings,
    exactNextAction: summarize(record.fields.exactNextAction),
    remainingDefinitionOfDone: summarize(record.fields.remainingDod),
    validation: record.validation,
  };
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return data.validation.errors.length === 0 ? 0 : 1;
  }
  console.log('SUPER HABITS TASK RESUME');
  console.log('');
  console.log(`Plan: ${data.plan}`);
  console.log(`Status: ${data.status}`);
  console.log(`Objective: ${data.objective}`);
  console.log(`Current milestone: ${data.currentMilestone}`);
  console.log(`Completed: ${data.completed}`);
  console.log(`In progress: ${data.inProgress}`);
  console.log('Working tree:');
  console.log(data.workingTree.length > 0 ? data.workingTree.join('\n') : '(clean)');
  console.log(
    `Changed files: ${data.changedFiles.length > 0 ? data.changedFiles.join(', ') : '(none)'}`,
  );
  console.log(`Last validation: ${data.lastValidation}`);
  console.log(`Failures: ${data.failures}`);
  console.log(`Relevant quarantines: ${data.quarantines}`);
  console.log(`Blockers: ${data.blockers}`);
  console.log('QA impact:');
  if (data.qaImpact) {
    console.log(`Matched rules: ${data.qaImpact.matchedRules.join(', ') || '(default)'}`);
    console.log(`Required gates: ${data.qaImpact.gates.join(' → ')}`);
    console.log(`Focused tests: ${data.qaImpact.tests.join(', ') || '(none)'}`);
    console.log(`Journeys/scenarios: ${data.qaImpact.journeys.join(', ') || '(none)'}`);
    console.log(
      `Broad regression: ${data.qaImpact.broadRegression ? 'required' : 'not required by matched rules'}`,
    );
  } else {
    for (const error of data.qaErrors) console.log(`Unavailable: ${error}`);
  }
  if (data.warnings.length > 0) {
    console.log('Warnings:');
    data.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  console.log(`Exact next action: ${data.exactNextAction}`);
  console.log(`Remaining definition of done: ${data.remainingDefinitionOfDone}`);
  console.log(`Plan validation: ${data.validation.errors.length === 0 ? 'PASS' : 'FAIL'}`);
  data.validation.errors.forEach((error) => console.log(`- Validation error: ${error}`));
  data.validation.warnings.forEach((warning) => console.log(`- Validation warning: ${warning}`));
  return data.validation.errors.length === 0 ? 0 : 1;
}

function printHelp() {
  console.log('Usage: node scripts/agent-execplan.mjs <validate|list|resume> [options]');
  console.log('  validate --plan <path>       Validate one ExecPlan');
  console.log('  validate --all                Validate all Plan-Version: 2 plans');
  console.log('  list                          Discover supported ExecPlans');
  console.log('  resume --plan <path>          Read-only task orientation');
  console.log('  --json                        Emit machine-readable JSON');
  console.log('  --root <path>                 Repository root override (tests/tools)');
}

export function runAgentExecPlanCli(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const root = resolve(options.root);
  if (options.help || options.command === 'help') {
    printHelp();
    return 0;
  }
  try {
    if (options.command === 'list') return printList(root, options.json);
    if (options.command === 'validate') {
      if (options.all) return printAllValidation(root, options.json);
      if (!options.plan) throw new Error('validate requires --plan <path> or --all');
      return printValidation(readPlan(options.plan, root), root, options.json);
    }
    if (options.command === 'resume') {
      if (!options.plan) throw new Error('resume requires --plan <path>');
      return printResume(readPlan(options.plan, root), root, options.json);
    }
    throw new Error(`unknown command: ${options.command}`);
  } catch (error) {
    console.error(`ExecPlan tool error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = runAgentExecPlanCli();
}
