# ExecPlan: W15 — Persistent visual regression system

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Replace the campaign's ad-hoc screenshot evidence with a durable, deterministic,
CI-integrated `toHaveScreenshot` suite that protects the W3–W14 visual work: a
curated ~25–45-baseline set, two independently verified clean runs, a reviewed
baseline-update process, and a proven negative-sensitivity check — so visual
drift fails a gate instead of silently shipping.

## Context

- Integrated source: `frontend-v3-w12-w17-integration` at `c6937b5` (W14),
  containing W12 `1d54b70` and W13 `b1569f0`, descending from `1f23da4` =
  `origin/main`.
- Design authority: parent `design.md` D5 (curated baselines, ledger note on
  change, thresholds never loosened). Slice:
  `openspec/changes/frontend-v3-w15-visual-regression/`.
- Existing infrastructure (audited): `e2e/visual-audit.spec.ts` (opt-in
  `VISUAL_AUDIT=1`, `page.screenshot()` evidence — **not** assertions),
  `e2e/a11y.spec.ts`, `e2e/helpers/{reset,seed,dbHarness,clock,browserDate,
navigation,todoHeavy,habitsW7}.ts`, `e2e/fixtures.ts`,
  `playwright.config.ts` (projects `chromium`, `pwa`, `journeys`, `simulation`,
  `journeys-sync`; `workers: 1`; `timezoneId: 'Asia/Manila'`).
- No `e2e/__screenshots__/` directory and no `toHaveScreenshot` call exist yet,
  so W15 introduces the baseline pipeline rather than extending one.
- Inherited residuals: two dependency advisories (hosted audit red only — the
  W15 lane must not bypass or weaken that gate), Windows-CRLF ENVIRONMENT
  failure, `settings-ripple` pre-existing failure, D14 host-load headroom,
  Focus notification timestamp. Android API36 pending W16; iOS owner-deferred.

## Scope

- `e2e/visual-regression.spec.ts`, `e2e/__screenshots__/` baselines.
- `playwright.config.ts` project registration; `package.json` baseline script.
- `.github/workflows/ci.yml` visual lane.
- `docs/ui-ux/v3-audit/w15/*`, `docs/testing/known-gaps.md`.

## Non-Goals

- No product behaviour change; no replacement of functional specs.
- No threshold loosening and no auto-approval of new baselines.
- No `core/*`, schema, migration, dependency or security-policy change.
- No rebuilding of the existing per-wave audit instruments.

## Current Checkpoint

- Current milestone: C6 complete — W15 suite built, baselines curated, two-run
  stability and negative sensitivity proven, CI registered; pending commit.
- Completed: slice; 30 curated baselines; the `visual` Playwright project; the
  `visual` / `visual:update` scripts; CI PR-lane step + retry-report gate +
  diff-artifact upload; two independent clean runs; the negative-sensitivity
  proof; two real determinism/stability defects found and fixed during the proof
  (overlay background scroll; the invalid test-authoring assumptions).
- In progress: final records and the W15 commit.
- Important modified files: `e2e/visual-regression.spec.ts`,
  `e2e/__screenshots__/visual-regression.spec.ts/*.png` (30),
  `playwright.config.ts`, `package.json`, `.github/workflows/ci.yml`,
  `docs/ui-ux/v3-audit/w15/{README.md,golden-manifest.md}`,
  `docs/testing/known-gaps.md`.
- Last successful validation: typecheck 0; eslint 0/0; `npm run visual` 30/30
  twice with an unchanged baseline hash `0676368d…`; perturb→18 failures then
  restore→30/30; `tests/ciLaneIntegrity.test.ts` 10/10; journey-label and
  quarantine parity OK; OpenSpec 84/84; `qa:fast` 2,271 pass / 1 (documented
  Windows-CRLF ENVIRONMENT residual).
- Current failures: the documented Windows-CRLF ENVIRONMENT residual and the
  pre-existing `settings-ripple` step.
- Relevant quarantines: None added; the W15 lane is deliberately not
  `test.skip`-gated and is registered in `docs/testing/known-gaps.md`.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete. Commit W15, then begin W16 — Android API-36 current-source
  native qualification (boot `Nitro_API_36`, build the credential-free
  `e2e-test` equivalent, run the native smoke/persistence/lifecycle lanes).
- Remaining definition of done: Complete — the suite is built, CI-integrated, two-run stable and sensitivity-verified.

## Progress

- [x] 1.1/1.2 Infrastructure audited
- [x] 1.3 Slice authored (proposal, design, spec, tasks, this plan)
- [x] 2.x Curated coverage + manifest
- [x] 3.x Deterministic capture engineering
- [x] 4.x Spec + baselines + developer command
- [x] 5.x Two-run stability + sensitivity proof
- [x] 6.x CI integration
- [x] 7.x Evidence, review, closure

## Surprises & Discoveries

- 2026-10-14 — The repository has **no** `toHaveScreenshot` usage and no
  `e2e/__screenshots__/` directory, so W15 is a greenfield pipeline rather than
  an extension; the W1–W14 audits stay `page.screenshot()` evidence by design
  and are not converted into assertions.
- 2026-10-14 — `playwright.config.ts` sets `workers: 1` globally because OPFS
  holds one lock per origin, so "different worker order" stability must be
  proven by re-running a representative snapshot in an isolated invocation
  rather than by increasing parallelism.

## Decision Log

- 2026-10-14 — Curated anatomy-class coverage (~25–45) rather than a Cartesian
  product, per design D5 and the campaign brief's explicit warning against 400
  fragile screenshots.
- 2026-10-14 — Mask only the clock-derived greeting/date header, with a
  manifest reason; never a title, count, action or section.
- 2026-10-14 — Keep the W15 lane as its own Playwright project so it can be
  run independently and, once registered, cannot silently skip.

## Validation Ledger

- 2026-10-14 — `npx tsc --noEmit` — PASS — 0 errors.
- 2026-10-14 — `npx eslint e2e/visual-regression.spec.ts playwright.config.ts` — PASS — 0/0.
- 2026-10-14 — `npx playwright test --project=visual --update-snapshots` — PASS — 30/30, 30 baselines written.
- 2026-10-14 — Run 1 `E2E_PORT=8089 … --project=visual` — PASS — 30/30.
- 2026-10-14 — Run 2 `E2E_PORT=8090 … --project=visual` — PASS — 30/30; baseline hash `0676368d…` unchanged.
- 2026-10-14 — negative sensitivity (perturbed `OverviewScreen` style) — FAIL as expected — 18/30 failed with diffs; restored → 30/30.
- 2026-10-14 — `npx vitest run tests/ciLaneIntegrity.test.ts` — PASS — 10/10.
- 2026-10-14 — `node scripts/journey-label-parity.mjs` / `quarantine-register-parity.mjs` — PASS.
- 2026-10-14 — `npm run openspec:validate` — PASS — 84/84.
- 2026-10-14 — `npm run qa:fast` — FAIL — 2,271 passed / 1 failed (documented Windows-CRLF `agentDocConsistency` ENVIRONMENT residual).

## Changed Files / Areas

- `e2e/visual-regression.spec.ts` — the curated suite.
- `e2e/__screenshots__/` — goldens.
- `playwright.config.ts`, `package.json`, `.github/workflows/ci.yml` — wiring.
- `docs/ui-ux/v3-audit/w15/{README.md,golden-manifest.md}` — evidence.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the master plan, then this file.
2. `git status --short`, `git diff --stat`, `git diff --name-only`.
3. `npm run agent:resume -- --plan openspec/changes/frontend-v3-w15-visual-regression/execplan.md`.
4. `npm run qa:affected`.
5. Reconcile with Git and the rendered state, update the checkpoint, resume from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: W15 built the durable visual regression system: 30 curated deterministic `toHaveScreenshot` goldens across the shell, six destinations and the W12/W13 surfaces, a dedicated `visual` Playwright project, two independent clean runs with an unchanged baseline hash, a proven negative-sensitivity check, and CI registration that cannot silently skip. It also found and fixed a real overlay-scroll nondeterminism at its source.
- Follow-up: None. Manifest in docs/ui-ux/v3-audit/w15/golden-manifest.md.
