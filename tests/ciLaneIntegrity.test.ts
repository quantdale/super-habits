import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CI lane-integrity contract (OpenSpec change `harden-ci-lane-integrity`).
 *
 * The change's claims are claims about WORKFLOW wiring, and prose in a
 * workflow file is exactly the kind of claim that drifts silently: a guard step
 * deleted, an advisory step that grew a `continue-on-error`, a `gates: false`
 * lane re-added as a hard step, a Playwright invocation with no retry-report
 * gate after it. None of those are visible in a diff of the product code, so
 * they are pinned here against the real files.
 *
 * The workflows are read with a small structural reader rather than a YAML
 * dependency: `js-yaml` is not a declared dependency of this repository, and a
 * transitive import inside a quality gate would be its own lane-integrity
 * defect. The reader splits a job block into step blocks on the `- ` marker at
 * the step indentation and pulls the scalar keys each block declares, which is
 * all these requirements need.
 */

interface WorkflowStep {
  /** Step index within its job. */
  index: number;
  name: string;
  id?: string;
  if?: string;
  /** Every line of the step's `run:` block, joined. */
  run: string;
  continueOnError: boolean;
}

interface WorkflowJob {
  name: string;
  steps: WorkflowStep[];
  /** The whole job block, for slice-level assertions. */
  text: string;
}

interface Workflow {
  file: string;
  /** The whole file, for top-level (non-job) assertions. */
  text: string;
  jobs: WorkflowJob[];
}

/** Indentation of a workflow step marker / step key, per these two files. */
const STEP_MARKER_INDENT = 6;
const STEP_KEY_INDENT = 8;

/** Scalar value of `key:` at the given indentation inside a step block. */
function scalar(block: string, key: string, indent: number): string | undefined {
  const pattern = new RegExp(`^ {${indent}}${key}:[ \\t]*(.*)$`, 'm');
  return pattern.exec(block)?.[1]?.trim();
}

/** Body of a `run:` key, honoring both inline scalars and `|`/`>` blocks. */
function runBody(block: string, indent: number): string {
  const header = new RegExp(`^ {${indent}}run:[ \\t]*(.*)$`, 'm').exec(block);
  if (!header) return '';
  const inline = header[1].trim();
  if (inline.length > 0 && !inline.startsWith('|') && !inline.startsWith('>')) return inline;

  const bodyLines: string[] = [];
  const lines = block.split('\n');
  // 1-based line number of the `run:` header.
  const start = block.slice(0, header.index).split('\n').length;
  for (let line = start; line < lines.length; line += 1) {
    const current = lines[line] ?? '';
    if (current.trim().length === 0) {
      bodyLines.push('');
      continue;
    }
    const currentIndent = /^ */.exec(current)?.[0].length ?? 0;
    // The body must be indented deeper than the key it belongs to.
    if (currentIndent <= indent) break;
    bodyLines.push(current.trim());
  }
  return bodyLines.join('\n');
}

function buildJob(name: string, lines: string[]): WorkflowJob {
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (new RegExp(`^ {${STEP_MARKER_INDENT}}- `).test(line)) starts.push(index);
  });

  const steps: WorkflowStep[] = starts.map((start, position) => {
    const block = lines.slice(start, starts[position + 1] ?? lines.length).join('\n');
    const step: WorkflowStep = {
      index: position,
      name: scalar(block, 'name', STEP_KEY_INDENT) ?? '',
      run: runBody(block, STEP_KEY_INDENT),
      continueOnError: new RegExp(
        `^ {${STEP_KEY_INDENT}}continue-on-error:[ \\t]*true\\s*$`,
        'm',
      ).test(block),
    };
    const id = scalar(block, 'id', STEP_KEY_INDENT);
    const condition = scalar(block, 'if', STEP_KEY_INDENT);
    if (id !== undefined) step.id = id;
    if (condition !== undefined) step.if = condition;
    return step;
  });

  return { name, steps, text: lines.join('\n') };
}

function readWorkflow(workflowFile: string): Workflow {
  const path = resolve(__dirname, '..', '.github', 'workflows', workflowFile);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const jobs: WorkflowJob[] = [];
  let current: { name: string; lines: string[] } | null = null;

  for (const line of lines) {
    // Job keys sit at two-space indentation; `steps:` sits at four.
    const jobKey = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (jobKey) {
      if (current) jobs.push(buildJob(current.name, current.lines));
      current = { name: jobKey[1] ?? '', lines: [] };
      continue;
    }
    // Any other line at two-space-or-less indentation ends the current block:
    // a sibling top-level key (`concurrency:`) or a top-level comment.
    if (/^ {2}\S/.test(line) || /^ {0,2}\S/.test(line)) {
      if (current) {
        jobs.push(buildJob(current.name, current.lines));
        current = null;
      }
      continue;
    }
    current?.lines.push(line);
  }
  if (current) jobs.push(buildJob(current.name, current.lines));

  return { file: workflowFile, text, jobs };
}

function job(workflow: Workflow, name: string): WorkflowJob {
  const found = workflow.jobs.find((entry) => entry.name === name);
  if (!found) throw new Error(`${workflow.file} has no job named "${name}"`);
  return found;
}

/** Steps whose `run` body runs the given npm script (exact name, not a prefix). */
function stepsRunningScript(target: WorkflowJob, script: string): WorkflowStep[] {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return target.steps.filter((step) => new RegExp(`npm run ${escaped}(?![\\w:-])`).test(step.run));
}

/** Steps whose `run` body contains the given command text. */
function stepsRunning(target: WorkflowJob, command: string): WorkflowStep[] {
  return target.steps.filter((step) => step.run.includes(command));
}

/**
 * Steps that run a Playwright lane, either directly (`playwright test`) or
 * through an npm script that does. The lane scripts are read from
 * `package.json` rather than hard-coded, so renaming a lane script keeps this
 * contract working instead of silently matching nothing.
 */
function runsPlaywrightLane(step: WorkflowStep): boolean {
  if (/\bplaywright test\b/.test(step.run)) return true;
  return PLAYWRIGHT_LANE_SCRIPTS.some((script) => runsNpmScript(step, script));
}

/** True when the step body invokes `npm run <script>` as a whole command. */
function runsNpmScript(step: WorkflowStep, script: string): boolean {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`npm run ${escaped}(?![\\w:-])`).test(step.run);
}

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const PLAYWRIGHT_LANE_SCRIPTS = Object.entries(packageJson.scripts)
  .filter(([, command]) => /\bplaywright test\b/.test(command))
  .map(([name]) => name);

const ci = readWorkflow('ci.yml');
const iosNative = readWorkflow('ios-native-e2e.yml');

describe('CI lane integrity: the quality job runs every guard qa:fast runs', () => {
  it('runs both lane-protection guards in the quality job, before the test step', () => {
    const quality = job(ci, 'quality');
    const guardStep = quality.steps.find((step) =>
      step.run.includes('scripts/journey-label-parity.mjs'),
    );
    expect(guardStep, 'journey-label parity guard is absent from the quality job').toBeDefined();
    expect(guardStep?.run).toContain('scripts/quarantine-register-parity.mjs');

    const guardIndex = guardStep?.index ?? -1;
    const openspecIndex =
      quality.steps.find((step) => step.run.includes('openspec:validate'))?.index ?? -1;
    const testIndex = quality.steps.find((step) => step.run.includes('npm run test'))?.index ?? -1;

    expect(
      openspecIndex,
      'quality job no longer validates openspec contracts',
    ).toBeGreaterThanOrEqual(0);
    expect(testIndex, 'quality job no longer runs the test step').toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeGreaterThan(openspecIndex);
    expect(guardIndex).toBeLessThan(testIndex);
  });

  it('gates the dependency audit step on a new high/critical advisory', () => {
    const auditSteps = stepsRunning(job(ci, 'quality'), 'scripts/audit-runtime-deps.mjs');
    expect(auditSteps).toHaveLength(1);
    // A documented "must be zero" severity policy cannot sit behind
    // continue-on-error, and the step must not absorb its own failure.
    expect(auditSteps[0]?.continueOnError).toBe(false);
  });
});

describe('CI lane integrity: credential-gated and report-only lanes match their claims', () => {
  it('conditions the disposable-backend lane on the secrets context and maps the token in', () => {
    const nightly = job(ci, 'nightly');
    const step = stepsRunning(nightly, 'simulation/backend/provision.ts')[0];
    expect(step, 'disposable-backend lane step not found').toBeDefined();
    expect(step?.if).toContain("secrets.SUPABASE_ACCESS_TOKEN != ''");
    // Step-level env is the only way the token reaches the process body; the
    // old `env.SUPABASE_ACCESS_TOKEN` condition was never populated.
    expect(step?.if).not.toContain('env.SUPABASE_ACCESS_TOKEN');
    expect(nightly.text).toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}');
  });

  it('marks every report-only nightly lane as continue-on-error', () => {
    const nightly = job(ci, 'nightly');
    const reportOnly = ['e2e', 'e2e:sync'].flatMap((script) =>
      stepsRunningScript(nightly, script).map((step) => ({ label: `npm run ${script}`, step })),
    );
    const seeded = stepsRunning(nightly, 'sim:run -- --mode seeded').map((step) => ({
      label: 'sim:run -- --mode seeded',
      step,
    }));
    expect(reportOnly.length, 'nightly no longer runs the E2E lane scripts').toBeGreaterThanOrEqual(
      2,
    );
    expect(seeded.length, 'nightly no longer runs the seeded scenario lane').toBeGreaterThanOrEqual(
      1,
    );
    for (const { label, step } of [...reportOnly, ...seeded]) {
      expect(
        step.continueOnError,
        `nightly step "${step.name}" (${label}) hard-fails a job documented as report-only`,
      ).toBe(true);
    }
  });

  it('does not run the dist-sync lane as a hard step in the gating e2e job', () => {
    const e2eJob = job(ci, 'e2e');
    expect(stepsRunningScript(e2eJob, 'e2e:sync')).toEqual([]);
    // The build still runs, so the artifact and the upload stay available.
    expect(stepsRunningScript(e2eJob, 'build:sync')).toHaveLength(1);
  });

  it('cancels superseded runs per ref in both repeatable workflows', () => {
    for (const workflow of [ci, iosNative]) {
      expect(workflow.text, `${workflow.file} declares no concurrency group`).toContain(
        'group: ${{',
      );
      expect(workflow.text, `${workflow.file} does not cancel superseded runs`).toContain(
        'cancel-in-progress: true',
      );
    }
  });
});

describe('CI lane integrity: a retry is evidence, not a clean pass', () => {
  const playwrightSteps = ['e2e', 'nightly'].flatMap((name) => {
    const target = job(ci, name);
    return target.steps
      .filter(runsPlaywrightLane)
      .map((step) => ({ job: name, step, next: target.steps[step.index + 1] }));
  });

  it('resolves the Playwright lane scripts the workflows invoke', () => {
    // Guard against the resolution above quietly matching nothing: these are
    // the scripts that run `playwright test`, direct or via a build chain.
    expect([...PLAYWRIGHT_LANE_SCRIPTS].sort()).toEqual(
      expect.arrayContaining(['e2e', 'e2e:journeys', 'e2e:journeys:p0', 'e2e:sync']),
    );
  });

  it('finds every Playwright invocation in the repeatable workflows', () => {
    // Two PR-lane invocations, one main-lane invocation, and the two nightly
    // ones. A silently removed invocation must fail here, not just shrink a
    // coverage count somebody has to notice.
    expect(playwrightSteps.length).toBeGreaterThanOrEqual(5);
  });

  it('gates each Playwright invocation with its own retry-report step', () => {
    for (const { job: jobName, step, next } of playwrightSteps) {
      const where = `${jobName}/${step.name}`;
      expect(step.id, `${where} has no step id for the gate to reference`).toBeTruthy();
      expect(next?.run.trim(), `${where} is not immediately followed by a retry-report gate`).toBe(
        'node scripts/e2e-retry-report.mjs',
      );
      // "This lane actually ran": a lane that never ran is skipped, a lane that
      // ran and failed still gets its retries reported.
      expect(next?.if, `${where} gate must be conditional`).toContain('always()');
      expect(next?.if, `${where} gate must reference the invocation it follows`).toContain(
        `steps.${step.id}.outcome != 'skipped'`,
      );
    }
  });

  it('blocks the gating lanes and only reports in the report-only nightly job', () => {
    for (const { job: jobName, next } of playwrightSteps) {
      expect(
        next?.continueOnError,
        `${jobName} retry gate continue-on-error does not match the job's gating posture`,
      ).toBe(jobName === 'nightly');
    }
  });
});
