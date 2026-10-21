# E2E Stabilization, Visual Fidelity & Release-Gate Hardening

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Recover PR #82's newly exposed hosted E2E failures to a defensible root cause,
correct confirmed defects without weakening any gate, establish trustworthy
cross-environment visual regression evidence, and prepare (not apply) an
owner-actionable branch-protection / release-governance configuration. Workout
recovery durability and honest security-gate behavior are preserved throughout.

## Context

- Branch: `e2e-stabilization-visual-fidelity` (successor to
  `ci/independent-e2e-qualification` = PR #82 head `a70026ec`, base `e6cf0d34`
  = `origin/main`). PR #82 scope (CI decoupling) is verified correct and is
  left untouched; this branch carries the bounded engineering fixes.
- Hosted evidence preserved under `.agent/evidence/e2e-stab-2026/hosted/`
  (artifact zips for runs 39541914477 [workout failure] and 39545583888
  [visual failures]; zip SHA-256 recorded in report).
- Run A (39541914477, head 64dc72df): functional Chromium 257 passed / 1
  failed / 47 skipped; `e2e/workout-gym-v2.spec.ts:265` "resumes an
  interrupted guided session with entered measurements" failed 3/3 attempts.
- Run B (39545583888, head a70026ec): functional Chromium green (255/47/0);
  visual lane `31 failed / 3 passed` at `maxDiffPixels: 0`. The 3 passes are
  the non-screenshot readiness self-checks; every screenshot comparison failed.

## Findings so far (evidence-backed)

### Track A — Workout reload/resume (ROOT CAUSE ESTABLISHED, fix pending)

Trace timeline (attempt 0, `test.trace`):

- `fill(Weight, 70)` @1208259 → `fill(Reps, 8)` @1208279 → click `Start`
  @1208293 → `expect(Skip set)` resolves @1208328 → `page.reload()`
  @1208334 (**~41 ms after Start**).
- `handleStart()` calls `persistDraft()` which fires
  `void saveWorkoutSessionDraft(...)` — fire-and-forget across the async
  expo-sqlite/OPFS bridge. The page teardown at +41 ms kills the in-flight
  transaction; the draft never commits.
- Failure snapshot shows the Workout landing fully hydrated (dashboard, quick
  start, weekly plan all rendered) with hero "Today · Rest scheduled / Rest
  day" — i.e. `getWorkoutSessionDraft()` returned **null**, not a slow-read
  race. The session record genuinely did not exist.
- Classification: **CONFIRMED_PRODUCT_DEFECT** (narrow durability race: the
  running UI is presented before the resume draft is durable) **+
  CONFIRMED_TEST_DEFECT** (test interrupts without observing any persistence
  signal). Failures 3/3 in Run A but green in Run B = runner-speed-sensitive
  race, NOT a harmless flake.

### Track B — Visual regression (ROOT CAUSE PATTERN ESTABLISHED)

- All 31 failures are `toHaveScreenshot` mismatches with pixel ratios
  0.01–0.04; per-image row profiling shows differing pixels confined to text
  bands (e.g. rows 15–56 date heading, 85–101 greeting) across every surface,
  theme and viewport. Layout/bboxes identical; glyph rasterization differs
  (crop comparison: same letterforms, different stroke weight/antialiasing).
- The 3 passing visual tests are the readiness negative controls (no goldens).
  The strict-comparison control failed at its FIRST assertion (unperturbed
  capture must match golden) — consistent with baseline-environment mismatch.
- Baseline provenance: goldens authored on the Windows dev host
  (`42d1c20d` 2026-10-14, refreshed `2ea6bd33`, `2eafa777`); hosted lane runs
  Ubuntu Chromium. `snapshotPathTemplate` is deliberately platform-NEUTRAL
  (`{testDir}/__screenshots__/{testFilePath}/{arg}{ext}`), forcing
  Windows-rendered goldens to be compared against Linux rendering. Fonts are
  bundled (`@expo-google-fonts/nunito` via `expo-font`) so this is
  rasterization drift (DirectWrite vs FreeType), not font fallback.
- Classification (pending final proof): **CONFIRMED_ENVIRONMENT_DRIFT** with a
  baseline-provenance defect (platform-neutral names bind one OS's rendering to
  another OS's gate). NOT to be "fixed" by thresholds or masks.

## Implementation plan

1. Track A fix: make `handleStart` await the draft write before presenting the
   running state (observable readiness contract: running UI ⇒ resume draft
   durable). Failure path keeps best-effort semantics (session still starts;
   a conflicting durable draft owns the slot).
2. Track A regression evidence: pre-reload durable-row assertion via DB
   harness; no-premature-log assertion; single-log-after-save; duplicate
   session guards (negative tests per campaign §2.5). Demonstrate the new test
   detects the original defect via deterministic fault injection (delayed
   draft write) BEFORE the fix.
3. Track B correction: platform-scoped snapshot names (Playwright `{platform}`
   token) + Linux goldens derived from the hosted Run B actuals (every
   candidate compared against the Windows golden and classified before
   commit), `maxDiffPixels: 0` retained, no masks. Windows goldens kept for
   local dev. Manifest updated with change-log rows + environment contract.
4. Track C: verify CI lane integrity (security gate untouched, independent E2E
   execution, no bypass introduced); minimal workflow improvement only if it
   materially improves evidence capture.
5. Track D: read-only governance investigation (rulesets, branch protection,
   deployment triggers); produce owner-actionable target config; DO NOT apply.
6. Validation: typecheck, lint, focused + full workout E2E, visual lane,
   ciLaneIntegrity tests, security audit preserved red.
7. Independent adversarial review of final diff (Track E), then push branch +
   open non-merged PR.

## Current Checkpoint

- Status: ACTIVE. Root causes for A and B established from hosted artifacts.
- Exact next action: build `dist/` (`npm run build:e2e`), then reproduce the
  workout failure locally with deterministic fault injection (injected delay in
  the draft-write path in a scratch reproduction), before applying the fix.
- Decisions: successor branch created (PR #82 branch left clean); evidence
  archived as zips (extracted trees removed — lint flagged vendored Playwright
  Trace Viewer code inside them; archives verified entry-complete before
  removal). Visual fix direction: platform-scoped goldens, strict comparison
  retained.
- Blockers: none local. WSL/Docker unavailable (cross-env proof relies on
  hosted artifacts + hosted re-run).
- Remaining: items 2–7 above.

## Validation Log

- (pending) npm run typecheck / lint / test
- (pending) focused workout E2E pre/post fix with fault injection
- (pending) full visual lane hosted
