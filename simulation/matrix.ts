/**
 * Lane matrix configuration (`add-user-simulation-platform` task 9.1).
 *
 * The D10 environment matrix, expressed as a single typed configuration that
 * both the runner and CI code/ops consume:
 *
 *  - the RUNNER calls `validateMatrix()` (wired into `sim:validate` and
 *    `sim:run`) so that a forbidden combination in this table fails fast with a
 *    precise message instead of being discovered mid-run;
 *  - CI is written to match this table lane-for-lane (`.github/workflows/ci.yml`
 *    comments cite the `lane.id`s below; the workflow must not drift from this
 *    module without a deliberate change to BOTH).
 *
 * Forbidden combinations enforced here (each maps to a human-readable rule):
 *   - `seeded` variability and the AI (exploratory) lane never appear in the
 *     PR lane — gating lanes are deterministic by design (D4/D10);
 *   - the disposable backend and the dummy-Supabase `dist-sync/` build never
 *     appear in the PR lane, and never in the quality job (parent Q5;
 *     task 6.1a): PR feedback stays fast and fake-backed;
 *   - gating lanes are always fake-backed (`none` backend); the disposable
 *     backend is report-only until explicitly promoted (D8);
 *   - AI exploratory is non-gating by design (D7).
 *
 * Pure module: no I/O, no `process.env`, unit-testable.
 */

import type { RunMode } from './model/types';

/** What a lane talks to for remote/sync behaviour. */
export type LaneBackend = 'none' | 'dummy-supabase' | 'disposable-supabase';

/** Where a lane is allowed to be triggered. */
export type LaneTrigger = 'local' | 'pr' | 'main' | 'nightly' | 'on-demand';

/** Every lane the platform and CI know about. */
export type LaneId =
  | 'journeys'
  | 'scenarios-pr'
  | 'scenarios-main'
  | 'scenarios-seeded'
  | 'dist-sync'
  | 'repro-replay'
  | 'ai-exploratory'
  | 'disposable-backend';

export interface SimulationLane {
  /** Stable id; cited by `.github/workflows/ci.yml` step comments. */
  id: LaneId;
  description: string;
  backend: LaneBackend;
  /** Enforced run mode (D4). `'n/a'` only for replay lanes. */
  mode: RunMode | 'n/a';
  triggers: LaneTrigger[];
  /**
   * Whether a red result blocks a merge/PR. Gating lanes must be deterministic
   * and fake-backed (enforced below).
   */
  gates: boolean;
  /** CI artifact retention in days; matches the existing 7-day `e2e-report` convention. */
  retentionDays?: number;
  /** Runner `--scenario` filter that selects this lane's scenario subset. */
  scenarioFilter?: string;
  /** Dedicated dist export this lane consumes, if any. */
  buildOutput?: string;
  /**
   * Wall-clock budget for PR lanes (ms). A miss is triaged (subset trimmed or
   * budget revisited explicitly) — never silently absorbed (task 9.4).
   */
  budgetMs?: number;
  /** Notes for operators: dist build env, credentials, promotion criteria. */
  notes?: string;
}

/**
 * The lane table (design D10 + dist-sync + the PR/main split of the scenario
 * library). Keep in sync with the table in `simulation/README.md` — the README
 * table is generated/stated from this module.
 */
export const SIMULATION_LANES: readonly SimulationLane[] = [
  {
    id: 'journeys',
    description:
      "Parent's deterministic journey suite (J1–J10, e2e/journeys/). Fixed hand-written scripts; the PR gate.",
    backend: 'none',
    mode: 'deterministic',
    triggers: ['pr', 'main', 'nightly'],
    gates: true,
    retentionDays: 7,
    notes: 'PR runs the @p0 subset only (npm run e2e:journeys:p0); main/nightly run the full set.',
  },
  {
    id: 'scenarios-pr',
    description:
      'Deterministic scenario subset on pull requests — the platform gating lane (≤ 10 min budget).',
    backend: 'none',
    mode: 'deterministic',
    triggers: ['pr'],
    gates: true,
    retentionDays: 7,
    scenarioFilter: '@p0',
    budgetMs: 600_000,
    notes:
      'Invoked as `npm run sim:run -- --mode deterministic --scenario @p0` against the served dist/.',
  },
  {
    id: 'scenarios-main',
    description:
      'Full deterministic scenario library on main. Report-only until the PR subset proves the library stable.',
    backend: 'none',
    mode: 'deterministic',
    triggers: ['main'],
    gates: false,
    retentionDays: 7,
    notes:
      '`npm run sim:run -- --mode deterministic` (no filter) once the library lands; today it is the smoke self-test.',
  },
  {
    id: 'scenarios-seeded',
    description:
      'Seeded variability lane: realistic think-time/mistake injection driven by a recorded seed; a failure replays exactly via --seed.',
    backend: 'none',
    mode: 'seeded',
    triggers: ['nightly', 'local'],
    gates: false,
    retentionDays: 7,
    notes:
      'Seed is recorded in run-report.json; replay with `npm run sim:run -- --mode seeded --seed <s>`.',
  },
  {
    id: 'dist-sync',
    description:
      'Parent Q5 / task 6.1a: dist-sync/ export built with DUMMY Supabase env (EXPO_NO_DOTENV=1, non-routable host). Consumes nothing on PRs.',
    backend: 'dummy-supabase',
    mode: 'deterministic',
    triggers: ['main', 'nightly'],
    gates: false,
    retentionDays: 7,
    buildOutput: 'dist-sync/',
    notes:
      'EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://dummy.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key npx expo export -p web --output-dir dist-sync. Never real credentials; never PRs; never the quality job. Sync journeys that need the baked-in env run against this export (dedicated Playwright project deferred until the harness can serve two dists — see README isolation rules).',
  },
  {
    id: 'repro-replay',
    description:
      'Bug-repro bundle replay: restore db+storage into a fresh context and re-execute actions.jsonl; reports divergence.',
    backend: 'none',
    mode: 'n/a',
    triggers: ['on-demand', 'local'],
    gates: false,
    retentionDays: 7,
    notes: 'sim:repro:capture / sim:repro:replay (task 5; scripts land with task 5.2/5.3).',
  },
  {
    id: 'ai-exploratory',
    description:
      'AI exploratory lane: external agent runtime runs missions (simulation/ai/missions/), reports anomaly-report.json. Non-gating by design (D7).',
    backend: 'none',
    mode: 'exploratory',
    triggers: ['on-demand', 'nightly'],
    gates: false,
    retentionDays: 7,
    notes:
      'Never gates; never PRs. CI runtime + credentials are an open question (simulation/ai/RUNBOOK.md, task 7.5) — v1 runs locally/on-demand.',
  },
  {
    id: 'disposable-backend',
    description:
      'Disposable Supabase lane: real round-trip validation of sync/restore/edge-function contracts against a throwaway project, guarded against production (D8).',
    backend: 'disposable-supabase',
    mode: 'deterministic',
    triggers: ['main', 'nightly'],
    gates: false,
    retentionDays: 7,
    buildOutput: 'dist-live/',
    notes:
      'provision.ts (run/check) + build-dist-live.sh + roundTripScenarios.ts. Initialized only when SUPABASE_ACCESS_TOKEN is configured; a hard guard (guard.ts) aborts on production host / ambient real credentials / missing disposable marker. Promotion to gating after 14 consecutive flake-free nightly runs (design Open Questions).',
  },
];

/** Rule metadata for documentation/CI comments. */
export const FORBIDDEN_COMBINATIONS: readonly { rule: string; message: string }[] = [
  {
    rule: 'seeded-not-on-pr',
    message:
      'PR lanes are gating and must run deterministic (D4/D10); seeded variability is nightly/local only.',
  },
  {
    rule: 'exploratory-not-on-pr',
    message:
      'The AI exploratory lane never gates and never runs on PRs (D7); it is on-demand/nightly.',
  },
  {
    rule: 'disposable-not-on-pr',
    message:
      'The disposable backend is main/nightly only and report-only (D8); it is forbidden on PRs and in the quality job.',
  },
  {
    rule: 'dist-sync-not-on-pr',
    message:
      'Parent Q5 / task 6.1a: the dist-sync/ dummy-env build runs on main/nightly only — never PRs, never quality.',
  },
  {
    rule: 'gating-lane-deterministic',
    message: 'A gating lane must be deterministic and fake-backed; anything else is report-only.',
  },
  {
    rule: 'remote-lane-never-gates',
    message:
      'A lane with a remote backend (dummy or disposable Supabase) is report-only until explicitly promoted.',
  },
];

export type MatrixIssue = { path: string; message: string };

function lanePath(id: LaneId, field?: string): string {
  return `matrix.lanes[${id}]${field ? `.${field}` : ''}`;
}

/**
 * Validate the lane table. Pure; returns every issue found (empty = valid).
 * Each issue names the lane and rule so the failure is actionable without
 * reading this module.
 */
export function validateMatrix(): MatrixIssue[] {
  const issues: MatrixIssue[] = [];

  // Duplicate ids.
  const seen = new Set<string>();
  for (const lane of SIMULATION_LANES) {
    if (seen.has(lane.id)) {
      issues.push({ path: lanePath(lane.id), message: `duplicate lane id '${lane.id}'` });
    }
    seen.add(lane.id);
  }

  for (const lane of SIMULATION_LANES) {
    // 1. Gating lanes must be deterministic and fake-backed.
    if (lane.gates && lane.mode !== 'deterministic') {
      issues.push({
        path: lanePath(lane.id, 'gates'),
        message: `gating lane '${lane.id}' must run 'deterministic' (has '${lane.mode}') — ${FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'gating-lane-deterministic')?.message}`,
      });
    }
    if (lane.gates && lane.backend !== 'none') {
      issues.push({
        path: lanePath(lane.id, 'backend'),
        message: `gating lane '${lane.id}' must be fake-backed (backend '${lane.backend}') — ${FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'remote-lane-never-gates')?.message}`,
      });
    }

    // 2. PR lanes: never seeded, never exploratory, never a remote backend.
    if (lane.triggers.includes('pr')) {
      if (lane.mode === 'seeded') {
        issues.push({
          path: lanePath(lane.id, 'mode'),
          message:
            FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'seeded-not-on-pr')?.message ??
            `seeded mode is forbidden on PRs`,
        });
      }
      if (lane.mode === 'exploratory') {
        issues.push({
          path: lanePath(lane.id, 'mode'),
          message:
            FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'exploratory-not-on-pr')?.message ??
            `exploratory mode is forbidden on PRs`,
        });
      }
      if (lane.backend === 'disposable-supabase') {
        issues.push({
          path: lanePath(lane.id, 'backend'),
          message:
            FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'disposable-not-on-pr')?.message ??
            `disposable backend is forbidden on PRs`,
        });
      }
      if (lane.backend === 'dummy-supabase') {
        issues.push({
          path: lanePath(lane.id, 'backend'),
          message:
            FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'dist-sync-not-on-pr')?.message ??
            `dist-sync (dummy Supabase) is forbidden on PRs`,
        });
      }
    }

    // 3. Remote-backed lanes are report-only and need a non-PR trigger.
    if (lane.backend !== 'none' && lane.gates) {
      issues.push({
        path: lanePath(lane.id, 'gates'),
        message:
          FORBIDDEN_COMBINATIONS.find((c) => c.rule === 'remote-lane-never-gates')?.message ??
          `remote-backed lane '${lane.id}' must not gate`,
      });
    }
    if (lane.backend !== 'none' && !lane.triggers.some((t) => t !== 'pr')) {
      issues.push({
        path: lanePath(lane.id, 'triggers'),
        message: `remote-backed lane '${lane.id}' must have a non-PR trigger (main/nightly/on-demand)`,
      });
    }

    // 4. Retention must respect the 7-day convention.
    if (
      lane.retentionDays !== undefined &&
      (!Number.isInteger(lane.retentionDays) || lane.retentionDays < 1)
    ) {
      issues.push({
        path: lanePath(lane.id, 'retentionDays'),
        message: `retentionDays must be a positive integer (got ${String(lane.retentionDays)})`,
      });
    }

    // 5. PR budgets, when present, must be positive.
    if (lane.budgetMs !== undefined && lane.budgetMs <= 0) {
      issues.push({
        path: lanePath(lane.id, 'budgetMs'),
        message: `budgetMs must be positive (got ${String(lane.budgetMs)})`,
      });
    }
  }

  return issues;
}

/** Fail-fast entry point for the runner/CI: throw on the first issue set. */
export function assertMatrixValid(): void {
  const issues = validateMatrix();
  if (issues.length > 0) {
    const detail = issues.map((i) => `  ✗ ${i.path}: ${i.message}`).join('\n');
    throw new Error(`simulation lane matrix invalid (${issues.length} issue(s)):\n${detail}`);
  }
}

/** Look a lane up by id (undefined if not configured). */
export function laneById(id: LaneId): SimulationLane | undefined {
  return SIMULATION_LANES.find((lane) => lane.id === id);
}

/** Lanes allowed to run when the trigger fires (CI mirror helper). */
export function lanesForTrigger(trigger: LaneTrigger): readonly SimulationLane[] {
  return SIMULATION_LANES.filter((lane) => lane.triggers.includes(trigger));
}
