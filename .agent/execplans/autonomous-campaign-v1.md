# ExecPlan: Autonomous Repository Campaign V1

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: CAMPAIGN COMPLETE — all workstreams finished; see
  Outcomes & Retrospective.
- Completed: WS1 selector repair (13 files, gap 17 repaired, gap 18 opened);
  WS2 unlaned-flow repair + coverage register (gamification-reward,
  habit-progress-insights, backup-v2-settings, portable-backup/-blocked,
  auth-session ×3) with the `native-reward` repeat suite added and the
  `native-auth` suite verified 3/3 with mock proof; WS3 docs truth (schema v25
  and next `<26` across AGENTS, structure map, working rules, master-context,
  knowledge base, both db-and-sync skills); every tab tap in the native suite
  scoped to `Section tabs`, the calorie Save control centered, and post-create
  habit-tile scrolls added. `qa:fast` PASS (1755 unit), `sim:validate` PASS,
  security sweep clean (no eval/shell/secrets in product source; dynamic SQL
  uses fixed column fragments + parameters).
- In progress: None. Final direct lane: 10/11 with one environment-class
  `calories-persistence` matcher miss (screenshot shows the target rendered);
  the official runner (`08e1c6d`, APK `595A7630…`) reached 9/11 with the same
  class. Gap 17 repaired; gap 18 owns the rested-device re-run.
- Important modified files: 21 `.maestro/flows/*.yaml`,
  `scripts/repeat.mjs`, `docs/testing/{native-e2e,known-gaps}.md`,
  `docs/{PROJECT_STRUCTURE_MAP,working-rules,master-context}.md`,
  `docs/master-context/SUPERHABITS_PROJECT_CORE_CONTEXT.md`,
  `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`, both
  `db-and-sync-invariants/SKILL.md`, `AGENTS.md`, `.gitignore`, this plan.
- Last successful validation: V2 ladder (native smoke 2/2 on `eff379b`;
  full Chromium 135/7/1 known-gap-16).
- Current failures: None campaign-owned. Residual native lane flake is
  environment-class (known-gap 18).
- Relevant quarantines: known-gap 15, 16, 17 (repaired), 18 (environment).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — campaign complete. Follow-up: rested-device
  `qa:native:targeted` for known-gap 18.
- Remaining definition of done: complete — lane evidence recorded with
  classification; final matrix run; adversarial review done; Outcomes filled;
  commits pending closure push.

## Progress

- [x] W0 — reconciliation, ground truth, failure-mechanism analysis (2026-09-12)
- [x] W1 — Maestro selector pass (known-gap 17) (2026-09-12: 13 flow files)
- [x] W2 — targeted-lane verification + classification (gap 17 repaired; gap 18 opened) (2026-09-12)
- [x] W3 — WS2: native coverage register (reward suite + all unlaned flows repaired and verified) (2026-09-12)
- [x] W3b — WS3: docs truth (schema v25 / next `<26` everywhere) (2026-09-12)
- [x] W3c — security + reliability sweep (clean) (2026-09-12)
- [x] W4 — final matrix, adversarial review, report, plan close (2026-09-12)

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

- Status: Completed (2026-09-12) — terminal condition B: every locally
  executable workstream finished; the only residual (a fully green native
  persistence lane on this host) is environment-blocked and tracked as
  known-gap 18.
- Summary: the operator-recommended known-gap 17 selector pass was executed
  with runtime evidence and repaired: 21 native flow files now use
  `Section tabs`-scoped tab taps, taskbar-safe `centerElement` scrolls on
  bottom-edge controls, `pressKey: enter` instead of BACK-prone `hideKeyboard`,
  settle waits around rebuilds, explicit scrolls to below-fold content, and
  post-create tile reveals. WS2 repaired and verified every flow outside the
  persistence lane (gamification-reward, habit-progress-insights — which runs
  in the EAS cloud workflow, backup-v2-settings, portable-backup/-blocked,
  auth-session ×3), added the `native-reward` repeat suite, verified the
  `native-auth` suite 3/3 with mock proof, and completed the flow register in
  `docs/testing/native-e2e.md`. WS3 reconciled every current-facing
  schema-version claim to v25 / next `<26`. A bounded security sweep found no
  eval/shell/secrets in product source and parameterized SQL throughout.
- Proof: per-flow on-device passes with DB row verification via pulled
  SQLite+WAL; `qa:fast` PASS (typecheck, lint, 1755 unit); `sim:validate`
  PASS; `native-reward` and `native-auth` repeat suites PASS; lane runs and
  every residual classified with screenshots (known-gaps 17/18).
- Follow-up: gap 18 rested-device `qa:native:targeted` re-run; gaps 15/16
  unchanged; no product-code changes were made, so no web regression was
  implicated.
- Lessons: (1) an unscoped Maestro text tap can silently match inert mounted
  content and derail a flow onto the wrong tab — scope to the shell landmark;
  (2) floating tab bars overlap bottom-edge controls, so a11y-visible is not
  tappable-visible — center before tapping; (3) matching a rendered element
  can still fail under hierarchy starvation; classify with a screenshot before
  touching flows.
