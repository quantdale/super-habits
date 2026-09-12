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

- Current milestone: WS1 — all flows fixed and verified individually; lane
  verification shows the fixes are functionally green (only a Maestro
  `Connection timed out: connect` transport flake on `launchApp` in pass 2).
  Committing and moving to `qa:native:targeted` from the clean source.
- Completed: ground truth reconciled (clean tree at `5b7b5ce`, no ACTIVE plan,
  Nitro_API_36 booted, APK from `d8b44ca`); runtime-evidence root causes fixed:
  (a) habit add-tile under the emulator taskbar → `centerElement: true`;
  (b) second add in `habit-reminder-isolation` above the fold → scroll UP +
  center; (c) workout tab taps unscoped → `childOf: Section tabs` (proven by a
  flow that operated on inert/inactive nodes and tapped the To Do tab);
  (d) `hideKeyboard` = BACK backgrounds the app → `pressKey: enter`;
  (e) `Add routine` a11y-visible but under the floating tab bar
  (`bounds=[157,2218][383,2275]`) → `centerElement: true` on bottom-edge
  scrolls; (f) stale taps after focus/scroll animations put the description
  text into the name field → enter-blur between adjacent fields and no
  scroll for adjacent fields; (g) `No matching exercises` / `Linear` below the
  fold → explicit scrolls. All 11 persistence flows pass individually; lane
  pass 1 = 10/11 (fixed `workout-persistence`), lane pass 2 = 10/11 (gym-v2
  hit an environment connection timeout at the post-kill `launchApp` after the
  flow had already reached the Week plan). DB inspection (`better-sqlite3` on
  pulled SQLite+WAL) confirmed created rows and persistence.
- In progress: committing WS1; then `npm run qa:native:targeted` from the
  clean committed source.
- Important modified files: `.maestro/flows/habit-*.yaml` (9 files),
  `.maestro/flows/workout-gym-v2-persistence.yaml`,
  `.maestro/flows/workout-persistence.yaml`,
  `.maestro/flows/workout-gym-v2-session-lifecycle.yaml`, `.gitignore`
  (ignore `.cursor/maestro-debug/`, `.cursor/db-inspect/`).
- Last successful validation: V2 ladder (native smoke 2/2 on `eff379b`;
  full Chromium 135/7/1 known-gap-16).
- Current failures: known-gap 17 flows (habit-* ×6, workout-gym-v2) — the WS1
  work item.
- Relevant quarantines: known-gap 15, 16, 17.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: inspect the persistence-lane result; fix any remaining
  flow failures with runtime evidence; then commit WS1 and re-run
  `npm run qa:native:targeted` from the clean committed source; update
  known-gap 17 (and close it if the lane is green).
- Remaining definition of done: WS1 flows pass on-device with unchanged
  assertions; `npm run qa:native:targeted` PASS from clean committed source;
  known-gap 17 updated/closed with evidence; WS2 audit executed and its
  chosen workstreams verified; final matrix + adversarial review + truthful
  report; commits pushed; plan COMPLETED (or BLOCKED with named externals).

## Progress

- [x] W0 — reconciliation, ground truth, failure-mechanism analysis (2026-09-12)
- [x] W1 — Maestro selector pass (known-gap 17) (2026-09-12: 13 flow files)
- [ ] W2 — `qa:native:targeted` from clean committed source + gap-17 closure docs
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
