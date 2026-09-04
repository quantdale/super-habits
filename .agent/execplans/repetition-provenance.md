# ExecPlan: Waves 5/6 — Repetition Framework + Provenance Standardization

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Give the campaign (and the repo) a checked-in, finite, sequential
repetition runner for deterministic lanes — extending existing QA
infrastructure, never a generic orchestrator — and close the
predecessor's artifact-provenance gaps structurally.

## Context

- Existing lanes stay authoritative: `qa:fast`, Vitest projects,
  `e2e:journeys:p0`, `qa:simulation`, `qa-native.mjs` (multi-AVD +
  auth-mock), Playwright/sim/native artifact outputs.
- Spawn precedent: `runNpm` via ComSpec on win32 (`web-verify.mjs`);
  node scripts via `process.execPath`; Playwright owns its own
  server per run; OPFS holds one lock per origin → strictly
  sequential repetition, never parallel.
- Native provenance already emits per-target records + collated
  multiavd JSON + per-lane debug dirs + mock logs (Waves 1–2);
  Wave 6 verifies the field contract and extends it to repeated
  web lanes (suite/repo SHA/attempts/timings/artifacts/replay).
- Timeout policy: suites are finite by design; generous per-suite
  backstops only (a TIMEOUT warns + prints `adb devices` for
  native suites, never broad-kills). All N attempts always run;
  no early abort, no retry-as-fix.

## Scope

- `scripts/repeat.mjs` (pure: suite table, arg parsing, record
  building, collation) + unit tests.
- `scripts/qa-repeat.mjs` (thin CLI: prebuild-once, sequential
  spawn with backstops, collated JSON, summary, exit code) +
  `qa:repeat` npm script.
- Suites: unit, integration, p0, sim, native-smoke, native-auth,
  native-lifecycle (native requires explicit `--avd`; cap 10
  attempts per invocation).
- Live proof: unit ×2 + p0 ×2 through the runner; native repeats
  ride Wave 8 (battery) on this machinery.
- Wave 6: verify native record fields against the prompt §15
  contract; repeat collated files carry the same contract.

## Non-Goals

Parallel repetition; chromium-repeat (covered by full e2e);
timeout-based process-tree killing; new report UIs; touching
lane implementations; weakening any assertion or timeout.

## Current Checkpoint

- Current milestone: Waves 5/6 complete pending commit/push.
- Completed: repeat.mjs + qa-repeat.mjs + tests + qa:repeat +
  impact-map rule; repeat 5/5; typecheck 0; lint 0; impact 13
  valid; live unit×2 PASS; live p0×2 PASS (25/25 each, fresh
  dist/ once); native+repeat §15 contract verified; hygiene
  PASS + adb empty.
- Current milestone: COMPLETE (Wave 5/6 landed in this commit).
- Completed: all Wave 5/6 scope — runner, tests, live unit×2 +
  p0×2, contract verification, hygiene, commit/push.
- In progress: none.
- Important modified files: scripts/repeat.mjs, scripts/qa-repeat.mjs,
  tests/repeat.test.ts, package.json, qa/impact-map.json, this plan.
- Last successful validation: 2026-09-04 p0×2 collated PASS +
  provenance-contract check PASS + hygiene PASS + plan:validate PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: none (all met).

## Progress

- [x] Workstream plan opened; precedent audit complete.
- [x] repeat.mjs + qa-repeat.mjs + tests implemented (5/5 green).
- [x] Live proof: unit ×2 + p0 ×2 through the runner.
- [x] Native §15 field contract verified.
- [x] Plan validated; committed/pushed; COMPLETED.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-04 — Extend, don't orchestrate: fixed named suites
  only (no `--cmd` escape hatch); sequential always; all N
  attempts run; timeouts are backstops with warnings, never
  cleanup-by-kill.
- 2026-09-04 — stdio inherit (live logs, no buffer risk);
  per-attempt evidence stays in lane-native artifacts, records
  carry codes/timings/paths.

## Validation Ledger

- 2026-09-04 — `npx vitest run tests/repeat.test.ts` — PASS 5/5.
- 2026-09-04 — `npx tsc --noEmit` — PASS 0 errors.
- 2026-09-04 — `npm run lint` — PASS 0 errors (scripts/*.mjs are eslint-ignored by design).
- 2026-09-04 — `node scripts/qa-impact.mjs --validate` — PASS 13 rules.
- 2026-09-04 — `node scripts/qa-repeat.mjs --suite unit --times 2` — PASS 2/2 collated (`simulation-output/repeat/unit-2x-2026-09-04T060851394Z.json`, repo 3f9046a).
- 2026-09-04 — `node scripts/qa-repeat.mjs --suite p0 --times 2` — PASS 2/2 collated (`simulation-output/repeat/p0-2x-2026-09-04T080508359Z.json`, fresh dist/ once, 25/25 each, repo 3f9046a).
- 2026-09-04 — provenance contract check (native `buildTargetRunRecord` 21 fields + repeat record 14 fields + both collated files 2/2 PASS) — PASS.
- 2026-09-04 — `npm run web:hygiene` — PASS (8081/8082 free); `adb devices` empty.

## Changed Files / Areas

- `scripts/repeat.mjs` — pure suite table/args/record/collation (new).
- `scripts/qa-repeat.mjs` — thin sequential CLI + collated JSON (new).
- `tests/repeat.test.ts` — 5 unit tests for parse/resolve/record/collate.
- `package.json` — `qa:repeat` script.
- `qa/impact-map.json` — e2e-and-simulation-infrastructure covers repeat files.
- `simulation-output/repeat/*.json` — gitignored live collated evidence (unit×2, p0×2).

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 5–6, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/repetition-provenance.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. `npm run web:hygiene`; no emulator needed until Wave 8.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Complete.
- Summary: Checked-in sequential repetition runner (`qa:repeat`) with unit-tested pure helpers, impact-map coverage, live unit×2 + p0×2 collated PASS at 3f9046a, and structural Wave 6 provenance (native 21-field + repeat 14-field contracts verified). No product-source changes.
- Follow-up: Wave 7 CI/nightly evaluation; Wave 8 battery rides this runner (native repeats + seeded iterations).
