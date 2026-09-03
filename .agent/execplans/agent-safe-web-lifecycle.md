# ExecPlan: Agent-Safe Web Server Lifecycle (Phase A)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Future autonomous agents must not lose hours awaiting a persistent Metro
server. `npm run web` (`expo start --web`) is intentionally long-lived; a
previous session stayed attached for 3.5h while the actual web bundle
finished in tens of seconds. The repository now distinguishes persistent vs
finite web commands, provides a finite self-cleaning `web:verify` command,
and adds a final server-hygiene gate so no campaign finishes with
campaign-owned servers still running.

## Context

- Root cause: `npm run web` == `cross-env EXPO_UNSTABLE_HEADLESS=1 expo start
--web`, a persistent dev server that exits only when terminated. A shell
  awaiting it never returns; the long runtime was lifecycle waste, not a slow
  build.
- Existing finite path (preserved): `npm run build:web` → Playwright's
  `webServer` owns `scripts/serve-e2e.js` lifecycle. Metro must never replace
  that.
- Baseline: `main` @ 9727abe, clean worktree, no extra worktrees/branches.
  A leftover campaign-owned Metro tree (PIDs 22220/5724/7016) was found
  listening on :8081 and terminated at startup via exact-tree `taskkill /T /F`.
- Predecessor campaign: Warm Momentum 2.1 (`polish-warm-momentum-2-1-visual-
system-v1`) completed at 9727abe.

## Scope

- `scripts/web-lifecycle.mjs` (+ `scripts/web-lifecycle.d.mts`): pickPort,
  isPortAvailable, waitForHttp (bounded poll, child-exit aware),
  spawnOwnedServer (detached group on POSIX), terminateOwnedTree
  (taskkill /T /F on Windows; group SIGTERM → SIGKILL on POSIX),
  waitForPortRelease, runWebVerify (build → owned server → bounded probe →
  guaranteed cleanup → port release).
- `scripts/web-verify.mjs`: CLI (--skip-build, --port, --no-browser,
  --ready-timeout, --help; honors E2E_PORT; refuses occupied explicit ports).
  Browser probe: headless Chromium, app shell "Today" + crossOriginIsolated +
  Add button. Exit codes 0/1/2; always returns by itself.
- `scripts/web-hygiene.mjs`: read-only port-owner report (8081/8082 default);
  `--kill <pid>` terminates only the exact owned tree.
- `package.json`: `web:dev` (persistent alias), `web:verify`, `web:hygiene`.
- `tests/web-lifecycle.test.ts`: 19 tests (readiness success / exit-before-
  ready / timeout; cleanup after success and failure; exit-code propagation;
  port validation; no accidental reuse; unrelated-process safety; real CLI
  smoke against dist/).
- Docs: AGENTS.md (command table + Server Lifecycle Rule), ONBOARDING.md,
  docs/codex-workflow.md, docs/working-rules.md,
  docs/testing/autonomous-qa.md, .cursor/commands/pre-pr.md,
  .cursor/commands/audit-performance.md, .cursor/rules/superhabits-rules.mdc,
  eslint.config.mjs (ignore scripts/**/*.d.mts).

## Non-Goals

- No change to Playwright's server ownership (static dist/ preserved).
- No Metro replacement; `npm run web` stays unchanged for humans.
- No app runtime behavior changes; no feature work (Phase B is a separate
  campaign).

## Current Checkpoint

- Current milestone: Campaign closed — Phase A committed (dc3be75), pushed,
  and independently verified PASS (part of the joint WM2.2 verification).
- Completed: A0 baseline + leftover server cleanup; A1/A2 implementation +
  tests; A3 docs updated; A4 certification; A5 commit + push.
- Important modified files: scripts/web-lifecycle.mjs, scripts/web-verify.mjs,
  scripts/web-hygiene.mjs, scripts/web-lifecycle.d.mts,
  tests/web-lifecycle.test.ts, package.json, eslint.config.mjs, AGENTS.md,
  ONBOARDING.md, docs/codex-workflow.md, docs/working-rules.md,
  docs/testing/autonomous-qa.md, .cursor/commands/pre-pr.md,
  .cursor/commands/audit-performance.md, .cursor/rules/superhabits-rules.mdc,
  .agent/execplans/agent-safe-web-lifecycle.md.
- Last successful validation: typecheck 0 errors; lint 0 errors; web-lifecycle
  unit tests 19/19; build:web exit 0; full `npm test` 1856/1856 PASS
  (2026-09-02; a first run showed 1 flaky calories teardown failure,
  clean on rerun); qa:impact:validate 13 rules PASS.
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- In progress: none — campaign closed; this checkpoint is historical record only.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — Phase A committed (dc3be75),
  pushed, and independently verified PASS; Phase B proceeded as the separate
  Warm Momentum 2.2 campaign (see its COMPLETED ExecPlan).

## Progress

- [x] Wave A0 — baseline inspection; leftover Metro tree terminated; ports/procs identified.
- [x] Wave A1 — finite web-verifier architecture (lifecycle lib + CLIs).
- [x] Wave A2 — implementation + 19 unit/integration tests; typecheck/lint green.
- [x] Wave A3 — agent docs and command references updated.
- [x] Wave A4 — failure-path/cleanup certification (verify ×2, failure injection, hygiene, impact map, full suite).
- [x] Wave A5 — commit + push Phase A (dc3be75 on origin/main, verified PASS).

## Surprises & Discoveries

- A leftover Metro server from the predecessor session was still listening on
  :8081 (1.6GB RSS); it had to be terminated as campaign-owned before any
  verification could run.
- ESLint's typescript-eslint preset applies typed rules to `*.mts` but the
  tsconfig program does not include `.d.mts`, so `scripts/web-lifecycle.d.mts`
  had to be added to eslint global ignores (parallel to `scripts/**/*.mjs`).
- `serve-e2e.js` accepts `--port`/`--dist` already, so the verifier reuses it
  unchanged — no server fork needed.

## Decision Log

- Keep `npm run web` unchanged; add `web:dev` alias + `web:verify` +
  `web:hygiene` (workflow clarity, not renaming churn).
- Verifier defaults to always building (`npm run build:web`) unless
  `--skip-build`; explicit ports must be free (never attach to an unknown
  server); default picks the next free port in 8081..8099.
- Windows cleanup uses `taskkill /PID <ownedPid> /T /F`; POSIX uses owned
  process group SIGTERM → SIGKILL. Never `taskkill /IM node.exe` or
  `killall node`.
- Browser smoke probe (headless Chromium) is default-on; `--no-browser`
  escape hatch. Probe asserts app shell "Today" nav, `crossOriginIsolated`,
  and the Add button.
- Hygiene tool is read-only by default; `--kill` requires an exact PID the
  operator has verified as campaign-owned.

## Validation Ledger

- `npm run typecheck` — PASS (0 errors).
- `npm run lint` — PASS (0 errors, 0 warnings).
- `npx vitest run --project unit tests/web-lifecycle.test.ts` — PASS 19/19.
- `npm run build:web` — PASS (exit 0).
- Pending: `npm run web:verify` (browser probe) ×2, failure injection,
  port-release checks, `npm run qa:impact:validate`, full `npm test`,
  `npm run web:hygiene`, `npm run agent:plan:validate -- --plan
.agent/execplans/agent-safe-web-lifecycle.md`.

## Changed Files / Areas

- `scripts/web-lifecycle.mjs` — lifecycle library (new).
- `scripts/web-lifecycle.d.mts` — TS declarations for the library (new).
- `scripts/web-verify.mjs` — finite verifier CLI (new).
- `scripts/web-hygiene.mjs` — port hygiene CLI (new).
- `tests/web-lifecycle.test.ts` — unit + CLI smoke tests (new).
- `package.json` — web:dev / web:verify / web:hygiene scripts.
- `eslint.config.mjs` — ignore scripts/**/*.d.mts.
- Docs: AGENTS.md, ONBOARDING.md, docs/codex-workflow.md,
  docs/working-rules.md, docs/testing/autonomous-qa.md,
  .cursor/commands/pre-pr.md, .cursor/commands/audit-performance.md,
  .cursor/rules/superhabits-rules.mdc.

## Recovery / Resume Instructions

- Reread this plan and `git status --short`; inspect
  `netstat -ano | findstr :8081` / `netstat -ano | findstr :8082` for
  campaign-owned leftovers (provenance via `wmic process where
"ProcessId=<pid>" get CommandLine`).
- Resume from the Exact next action above. If `npm run web:verify` fails,
  read its diagnostics (server log tail is included) and fix the verifier or
  the probe, then rerun. Do not weaken the probe assertions.
- Run `npm run qa:affected` before choosing further QA gates.

## Outcomes & Retrospective

- Measured: full `web:verify` (build + browser probe) 56.6–58.7s; repeat
  with `--skip-build` 1.9s; both exit by themselves with exit 0 and release
  their port. Failure injections: invalid `--port abc` → exit 2; occupied
  explicit port → exit 2 with "refusing to attach"; missing dist with
  `--skip-build` → exit 1 (unit-tested). `web:hygiene` correctly reported
  an occupied 8091 with owner PID + command line and freed it via exact
  `--kill <pid>`.
- The leftover Metro tree from the predecessor session (PIDs
  22220/5724/7016, 1.6GB RSS on :8081) was terminated at campaign start —
  live proof of the hygiene problem this plan fixes.
- Follow-up recorded: predecessor Metro warnings (linked-actions/habits
  require cycles; expo-notifications web capability warning) are
  architectural/platform notes, not lifecycle causes — not addressed here.
- This plan's rules were exercised throughout the WM2.2 campaign (build +
  web:verify + Playwright-owned servers; zero campaign-owned servers left
  running at any checkpoint).
