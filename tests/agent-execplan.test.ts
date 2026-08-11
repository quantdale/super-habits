import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolPath = resolve(repositoryRoot, 'scripts', 'agent-execplan.mjs');
const temporaryRoots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'super habits execplan '));
  temporaryRoots.push(root);
  return root;
}

function writePlan(root: string, relativePath: string, body: string): string {
  const planPath = join(root, relativePath);
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, body, 'utf8');
  return planPath;
}

function runTool(root: string, args: string[]) {
  const result = spawnSync(process.execPath, [toolPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function planBody({
  status = 'ACTIVE',
  exactNextAction = 'Implement the next coherent change.',
  progress = '- [ ] Implement milestone',
  validationLedger = '- 2026-08-09 — `npm test` — NOT RUN — pending',
  outcomes = '- Status: Active.\n- Summary: Work is in progress.',
  blocker = 'None.',
  unblockCondition = 'None.',
  resumeAfterUnblock = 'None.',
  changedFiles = '`lib/time.ts`',
}: {
  status?: string;
  exactNextAction?: string;
  progress?: string;
  validationLedger?: string;
  outcomes?: string;
  blocker?: string;
  unblockCondition?: string;
  resumeAfterUnblock?: string;
  changedFiles?: string;
} = {}): string {
  return `# ExecPlan: Fixture

Plan-Version: 2
Status: ${status}

## Purpose / User Outcome

Make the fixture task resumable.

## Context

The fixture uses the repository protocol.

## Scope

- Validate the plan lifecycle.

## Non-Goals

- Build a task-management system.

## Current Checkpoint

- Current milestone: M1 — parser contract
- Completed: Parsed the repository plan shape.
- In progress: None.
- Important modified files: ${changedFiles}
- Last successful validation: Structural fixture review PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: ${blocker}
- Condition required to unblock: ${unblockCondition}
- Exact resume action after unblock: ${resumeAfterUnblock}
- Exact next action: ${exactNextAction}
- Remaining definition of done: ${status === 'COMPLETED' ? 'None — all conditions validated.' : 'Add lifecycle fixture coverage.'}

## Progress

${progress}

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-08-09 — Keep the fixture structural — semantics belong to the agent.

## Validation Ledger

${validationLedger}

## Changed Files / Areas

- ${changedFiles}

## Recovery / Resume Instructions

1. Read the repository protocol.
2. Resume from Exact next action.

## Outcomes & Retrospective

${outcomes}
`;
}

afterAll(() => {
  for (const root of temporaryRoots) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe('agent ExecPlan tooling', () => {
  it('accepts a valid ACTIVE plan with wrapped fields and Windows paths with spaces', () => {
    const root = createRoot();
    const planPath = writePlan(
      root,
      'plans with spaces/active-plan.md',
      planBody({
        changedFiles: '`features\\habits\\Habit Screen.tsx`',
      }).replace(
        '- Current milestone: M1 — parser contract',
        '- Current milestone:\n  M1 — parser contract',
      ),
    );

    const result = runTool(root, ['validate', '--plan', planPath]);

    expect(result.status).toBe(0);
    expect(result.output).toContain('ExecPlan valid');
    expect(result.output).toContain('Status: ACTIVE');
  });

  it('rejects a plan with no Current Checkpoint', () => {
    const root = createRoot();
    const planPath = writePlan(
      root,
      'plan.md',
      planBody().replace(/## Current Checkpoint[\s\S]*?## Progress/, '## Progress'),
    );

    const result = runTool(root, ['validate', '--plan', planPath]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('missing required section: checkpoint');
  });

  it('rejects unresolved placeholders in an ACTIVE checkpoint', () => {
    const root = createRoot();
    const planPath = writePlan(
      root,
      'plan.md',
      planBody({ exactNextAction: 'TODO — fill later.' }),
    );

    const result = runTool(root, ['validate', '--plan', planPath]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('unresolved placeholder');
  });

  it('accepts a BLOCKED plan only when its unblock path is explicit', () => {
    const root = createRoot();
    const planPath = writePlan(
      root,
      'blocked.md',
      planBody({
        status: 'BLOCKED',
        exactNextAction: 'Wait for the Android test device.',
        blocker: 'No booted Android target is available.',
        unblockCondition: 'A booted e2e-test target is installed.',
        resumeAfterUnblock: 'Run npm run qa:native:android and record the report.',
      }),
    );

    const result = runTool(root, ['validate', '--plan', planPath]);

    expect(result.status).toBe(0);
    expect(result.output).toContain('Status: BLOCKED');
  });

  it('requires proof and a no-op next action for COMPLETED plans', () => {
    const root = createRoot();
    const validPath = writePlan(
      root,
      'completed.md',
      planBody({
        status: 'COMPLETED',
        exactNextAction: 'None — task complete.',
        progress: '- [x] Implement milestone',
        validationLedger: '- 2026-08-09 — `npm test` — PASS — fixture suite passed.',
        outcomes: '- Status: Complete.\n- Summary: The lifecycle was proven.',
      }),
    );
    const invalidPath = writePlan(
      root,
      'invalid-completed.md',
      planBody({ status: 'COMPLETED', exactNextAction: 'Implement one more thing.' }),
    );

    expect(runTool(root, ['validate', '--plan', validPath]).status).toBe(0);
    const invalid = runTool(root, ['validate', '--plan', invalidPath]);
    expect(invalid.status).toBe(1);
    expect(invalid.output).toContain('fully checked Progress');
    expect(invalid.output).toContain('meaningful final Validation Ledger');
  });

  it('discovers parallel OpenSpec and non-OpenSpec plans independently', () => {
    const root = createRoot();
    writePlan(root, 'openspec/changes/task-a/execplan.md', planBody());
    writePlan(
      root,
      '.agent/execplans/task-b.md',
      planBody({
        status: 'BLOCKED',
        blocker: 'Waiting for review.',
        unblockCondition: 'Review is complete.',
        resumeAfterUnblock: 'Apply the approved patch.',
      }),
    );

    const result = runTool(root, ['list']);

    expect(result.status).toBe(0);
    expect(result.output).toContain('openspec/changes/task-a/execplan.md');
    expect(result.output).toContain('.agent/execplans/task-b.md');
    expect(result.output).toContain('ACTIVE');
    expect(result.output).toContain('BLOCKED');
  });

  it('reconciles Git paths and reuses date/time QA impact in resume', () => {
    const root = createRoot();
    mkdirSync(join(root, 'qa'), { recursive: true });
    writeFileSync(
      join(root, 'qa', 'impact-map.json'),
      JSON.stringify({
        schemaVersion: 1,
        default: { gates: ['qa:fast'] },
        rules: [
          {
            id: 'date-and-time',
            patterns: ['lib/time.ts'],
            gates: ['qa:timezones'],
            tests: ['tests/time.test.ts'],
            journeys: ['past-midnight'],
            broadRegression: true,
          },
        ],
      }),
      'utf8',
    );
    const planPath = writePlan(
      root,
      '.agent/execplans/reconcile.md',
      planBody({ changedFiles: '`features/stale.ts`' }),
    );
    mkdirSync(join(root, 'lib'), { recursive: true });
    writeFileSync(join(root, 'lib', 'time.ts'), 'baseline\n', 'utf8');
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'agent@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Agent Fixture'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'fixture baseline'], { cwd: root });
    writeFileSync(join(root, 'lib', 'time.ts'), 'changed\n', 'utf8');

    const result = runTool(root, ['resume', '--plan', planPath]);

    expect(result.status).toBe(0);
    expect(result.output).toContain('ExecPlan lists features/stale.ts');
    expect(result.output).toContain(
      'working-tree change not represented in this ExecPlan: lib/time.ts',
    );
    expect(result.output).toContain('date-and-time');
    expect(result.output).toContain('qa:timezones');
    expect(result.output).toContain('tests/time.test.ts');
    expect(result.output).toContain('Broad regression: required');
  });

  it('validates all versioned plans without requiring legacy plans to opt in', () => {
    const root = createRoot();
    writePlan(root, '.agent/execplans/versioned.md', planBody());
    writePlan(
      root,
      '.agent/execplans/legacy.md',
      planBody().replace('Plan-Version: 2\nStatus: ACTIVE\n', ''),
    );

    const result = runTool(root, ['validate', '--all']);

    expect(result.status).toBe(0);
    expect(result.output).toContain('.agent/execplans/versioned.md');
    expect(result.output).not.toContain('.agent/execplans/legacy.md');
  });

  it('does not escalate documentation-only impact to every E2E lane', () => {
    const impactTool = resolve(repositoryRoot, 'scripts', 'qa-impact.mjs');
    const result = spawnSync(
      process.execPath,
      [impactTool, '--files', 'docs/example.md', '--json'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('agent-workflow-and-documentation');
    expect(result.stdout).toContain('qa:fast');
    expect(result.stdout).not.toContain('qa:full');
  });
});
