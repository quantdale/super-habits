# ExecPlan: Autonomous Repository Campaign V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Run a long-running autonomous engineering campaign on SuperHabits, starting
with the operator-approved recommendation from the Pop Visual QA V2 close
(the dedicated Maestro selector pass for known-gap 17), then continuing into
repository-wide correctness/completeness work until a legitimate terminal
condition is reached. Observable success: each workstream lands verified,
committed, and pushed with oracle-grade evidence; known gaps either close or
are re-documented with current evidence; the repository is measurably better
and the continuation path is precise.

## Context

- Baseline: `HEAD == origin/main == 5b7b5ce`, tree clean, all ExecPlans and the
  planner prompt COMPLETED — this plan is the campaign driver via native
  continuation (same precedent as Pop Frontend Redesign V1, Pop Visual QA
  V1/V2).
- Native target available: `Nitro_API_36` on `emulator-5556` (API 36,
  x86_64), current APK installed from source `d8b44ca` with the E2E env;
  `emulator-5560` is an unrelated AVD never to be touched.
- Port 8081 is owned by an unrelated `brain-training` Metro; web audits run on
  `E2E_PORT=8083`.
- Repo rules: no test weakening, no `data-testid`, no blind retries, root
  causes over symptoms, migrations append-only, soft-delete invariants,
  finite servers only, `web:hygiene` before finishing.
- Known-gap register (`docs/testing/known-gaps.md`) is the single source of
  truth for reduced coverage: 15 (J8 under load), 16 (habits async-commit
  flake), 17 (native persistence selectors — the WS1 target).

## Scope

1. **WS1 — Known-gap 17 selector pass (operator recommendation).** Update the
   Maestro flows that fail on pre-Pop interaction assumptions (`habit-*` ×6
   in the persistence lane plus the same pattern in the five habit flows
   outside it, and `workout-gym-v2-persistence`), keeping every persistence
   assertion unchanged. Verify on-device iteratively, then re-run
   `npm run qa:native:targeted` from a clean committed source.
2. **WS2 — Post-WS1 audit.** Re-assess the repository for the next
   highest-value executable workstreams (functional depth, weak/vacuous
   tests, reliability/lifecycle, docs truth) and execute them in order.
3. Continue (DISCOVER → PRIORITIZE → IMPLEMENT → TEST → VERIFY → RECORD →
   COMMIT → REASSESS) until CONDITION A/B/C in the operator directive.

## Non-Goals

- No product redesign, navigation change, or new feature without evidence.
- No schema/data changes unless a defect proves one is required.
- No dependency churn, no test weakening, no `data-testid`, no cosmetic churn.
- No touching `emulator-5560` or the unrelated `brain-training` Metro.

## Current Checkpoint

- Current milestone: WS1 CLOSED (flows repaired + individually verified; lane
  residual classified ENVIRONMENT as new known-gap 18). Starting WS2 — native
  coverage register (unlaned flows).
- Completed: ground truth reconciled (clean tree at `5b7b5ce`, no ACTIVE plan,
  Nitro_API_36 booted, APK from `d8b44ca`); all 13 post-redesign flow files
  repaired with runtime-evidence root causes (taskbar centering, Section-tabs
  scoping, enter-blur replacing BACK-prone hideKeyboard, bottom-edge centering,
  below-fold scrolls, settle-after-rebuild); every persistence flow passed
  individually on-device with DB row verification; lane runs produced 10/11,
  10/11, 10/11, 7/11, 7/11 with failures moving between unchanged steps =
  environment hierarchy starvation (host with two AVDs + heavy apps; emulator
  at ~15.7h CPU). Known-gap 17 repaired; residual registered as gap 18.
- In progress: WS2 — repair and wire the unlaned `gamification-reward` flow;
  document spot-run flows in `docs/testing/native-e2e.md`.
- Important modified files (committed): 13 `.maestro/flows/*.yaml`,
  `.gitignore`, `docs/testing/known-gaps.md`, this plan.
- Last successful validation: V2 ladder (native smoke 2/2 on `eff379b`;
  full Chromium 135/7/1 known-gap-16).
- Current failures: known-gap 17 flows (habit-* ×6, workout-gym-v2) — the WS1
  work item.
- Relevant quarantines: known-gap 15, 16, 17.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: repair `gamification-reward.yaml` (Section-tabs scoping,
  add-tile centering, enter-blur, settle) and verify it on-device; then wire it
  into the repeat suites and document the spot-run flows in
  `docs/testing/native-e2e.md`.
- Remaining definition of done: WS2 coverage register landed and verified; then
  audit-driven WS3+ executed until terminal condition; final matrix + truthful
  report; a rested-device `qa:native:targeted` retry for gap 18.

## Progress

- [x] W0 — reconciliation, ground truth, failure-mechanism analysis (2026-09-12)
- [x] W1 — Maestro selector pass (known-gap 17) (2026-09-12: 13 flow files)
- [x] W2 — targeted-lane verification + classification (gap 17 repaired; gap 18 opened) (2026-09-12)
- [ ] W3 — WS2: native coverage register (gamification-reward + docs)
- [ ] W4 — post-WS1 audit and next workstreams (TBD by evidence)

## Surprises & Discoveries

- The `Add anytime habit` accessibility label lives on the group add tile
  (`HabitsScreen.tsx` line ~1107) constructed from the group label, and the
  habit form's fields are `TextField` primitive labels (visible label + input
  a11y label = 2 matches, hence `index: 1`), so the flow contract is sound
  once the tile is reachable.

## Decision Log

- 2026-09-12 — Proceed with the operator recommendation (WS1) before the
  broader audit: it is concrete, high-value, fully executable on available
  hardware, and closes a documented gap.

## Validation Ledger

- 2026-09-12 — `git status`/`git log`/`agent:plans` — clean at `5b7b5ce`, no
  ACTIVE plans.
- 2026-09-12 — `adb devices` — Nitro_API_36 (emulator-5556) + unrelated
  emulator-5560.
- 2026-09-12 — persistence lane pass 1 (all 11 flows, direct maestro) — 10/11
  passed; `workout-persistence` failed (stale tap put description text into the
  name field, plus a centerElement scroll on an already-visible row). Fixed and
  re-verified individually (exit 0).
- 2026-09-12 — DB ground truth via root adb + `better-sqlite3` on the pulled
  SQLite+WAL: confirmed created/deleted rows at each failure investigation
  (`workout_routines`, `habits`).

## Changed Files / Areas

- `.maestro/flows/habit-*.yaml` — taskbar-safe scroll targets (WS1).
- `.maestro/flows/workout-gym-v2-persistence.yaml` — selector/scroll fix (WS1).
- `docs/testing/known-gaps.md` — gap-17 status when verified.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; inspect `.maestro/flows/` diffs.
3. `adb devices`; ensure Nitro_API_36 on emulator-5556 is booted and the app
   is installed (source provenance in `simulation-output/native/native-android-build.json`).
4. Iterate with `maestro test --device emulator-5556 .maestro/flows/<flow>.yaml`
   and inspect `--debug-output` artifacts on failure.
5. Final proof: `npm run qa:native:targeted` from a clean committed source.
6. Continue from `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: pending.
- Follow-up: pending.
