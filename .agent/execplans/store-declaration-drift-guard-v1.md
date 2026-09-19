# ExecPlan: Store-Declaration Drift Guard V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Pin the two store-declaration inputs that can silently rot when product code
changes — the Android permission set in `app.json` and the 5-channel
notification inventory in `lib/notifications.ts` /
`lib/notificationConstants.ts` — against the filed declarations in
`docs/release/app-store-readiness.md` and
`docs/release/store-data-declarations.md`, so a future permission or channel
addition/removal fails locally instead of invalidating the Play Data safety
answers unnoticed.

## Context

- Repo `/home/box/Desktop/super-habits`, branch `main`, clean tree at
  `7dbe998` (J8 Run 1 evidence-only close). Do NOT push/tag/submit; local
  commits only; no PII; no PNG fabrication.
- Store-readiness area is otherwise complete: age-rating/DSA, icon/splash
  audit, play-listing copy, privacy hosting, release notes, store-assets
  checklist, and version/build consistency each ship a doc + guard test +
  readiness wiring (commit `2778a1b`). Remaining items there are explicit
  `[OWNER ACTION]`s (screenshots, credentials, tag) or external blockers.
- J8 (`j8-section-switch-headroom-v1.md`, COMPLETED) must NOT be reopened:
  no new hotspot evidence; re-measuring is out of scope.
- Current truth verified 2026-09-19: `app.json`
  `expo.android.permissions` = exactly `android.permission.POST_NOTIFICATIONS`,
  `VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`; runtime channels =
  `default`/`General` + `habit-reminders`/`Habit reminders` +
  `todo-reminders`/`Todo reminders` +
  `daily-plan-reminders`/`Daily plan reminders` +
  `weekly-review-reminders`/`Weekly review reminders` (see
  `lib/notifications.ts` `setNotificationChannelAsync` call sites and
  `lib/notificationConstants.ts` IDs).
- Existing tests pin individual channels (`tests/notifications.test.ts`) but
  nothing pins the full inventory or the permission set: `grep` over
  `tests/*.test.ts` finds no `POST_NOTIFICATIONS` / `permissions` reference.
- Conventions: guard tests read real repo files (cf.
  `tests/play-listing-copy.test.ts`, `tests/version-build-consistency.test.ts`);
  unit project auto-picks `tests/**/*.test.ts`, so the new file runs inside
  `npm run qa:fast` with no extra wiring.

## Scope

- New `tests/store-declaration-drift.test.ts` asserting:
  1. `app.json` android permissions deep-equal the documented 4-permission
     set (exact set equality — additions and removals both fail).
  2. Readiness + declarations docs name all four permissions (short names).
  3. Channel-ID constants from `@/lib/notificationConstants` equal the
     documented four reminder IDs; `lib/notifications.ts` contains exactly
     five `setNotificationChannelAsync(` call sites with the five expected
     ids and five expected user-visible names.
  4. Sensitivity: the same comparators reject a tampered permission set and
     a tampered channel inventory (`toThrow`), proving the guard is not
     vacuous.
- One-line pointer in `docs/release/app-store-readiness.md` notifications
  bullet naming the new guard test (matches prior-pass readiness wiring).
- Validate: focused vitest run, `npm run qa:fast`, plan validation; commit
  locally, no push.

## Non-Goals

- No J8/perf re-measurement or product optimization.
- No screenshot/PNG capture, no owner PII, no store filing, no tag, no push,
  no EAS submit, no CI/billing action.
- No permission or channel product changes; no listing-copy or declaration
  wording changes beyond the guard pointer.
- No new qa scripts or impact-map rules (vitest auto-discovery covers it).

## Current Checkpoint

- Current milestone: COMPLETE — guard shipped, gates green, committed
  locally (no push).
- Completed: startup survey; plan validated; guard test created (permission
  set, channel-ID values, 5-site inventory, doc cross-mentions, 4
  sensitivity cases); readiness pointer added; focused 8/8 green; `qa:fast`
  fully green (1799 unit); focused `agent-execplan` 9/9 green; `qa:affected`
  resolved (broad regression not required); integration ENVIRONMENT failure
  proven pre-existing on pristine tree; plan validated; committed locally.
  Discovery: reminder call sites pass constant identifiers, not literals —
  inventory asserts the exact first-argument expressions.
- In progress: None — task complete.
- Important modified files: `.agent/execplans/store-declaration-drift-guard-v1.md`
  (this plan); `tests/store-declaration-drift.test.ts` (to create);
  `docs/release/app-store-readiness.md` (one-line guard pointer, to edit).
- Last successful validation: `npm run qa:affected` — clean tree, no changes
  (2026-09-19).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every condition is complete
  (guard test 8/8, readiness pointer, `qa:fast` green, plan validated,
  committed locally).

## Progress

- [x] Startup: AGENTS.md rules, PLANS.md, `agent:plans`, git HEAD/status,
      known-gaps, release-docs survey.
- [x] Gap selected: store-declaration drift guard (highest-leverage
      executable repo-side piece; J8 explicitly not reopened).
- [x] ExecPlan created (this file).
- [x] Guard test implemented + focused run green.
- [x] Readiness pointer added.
- [x] `qa:fast` green + plan validated + local commit.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose permission+channel drift guard over a release-table
  re-verification or localization groundwork: the verification table is a
  dated snapshot (full-battery refresh is disproportionate for one gap), and
  English-only is a deliberate 1.0.0 posture, not a defect. The drift guard
  is code+test, verifiable locally, and closes the only unguarded seam in an
  otherwise guarded store area.
- 2026-09-19 — Integration suite (`test:integration`) fails with
  `ERR_IPC_CHANNEL_CLOSED` at worker-pool spawn, identically on the
  pristine stashed tree: classified ENVIRONMENT (pre-existing host issue),
  not a gate for this docs+unit-test change. No E2E battery: zero
  product/UI/DB surface touched and the impact map requires no broad
  regression.

## Validation Ledger

- 2026-09-19 — `npm run qa:affected` (clean tree) — PASS (default gates
  qa:fast → qa:full, broad regression not required).
- 2026-09-19 — `npx vitest run --project unit
  tests/store-declaration-drift.test.ts` — PASS 8/8.
- 2026-09-19 — `npm run qa:fast` (final tree) — PASS (typecheck 0 errors,
  lint 0 errors/0 warnings, 1799 unit passed / 141 files, label parity OK).
- 2026-09-19 — `npx vitest run --project unit
  tests/agent-execplan.test.ts` — PASS 9/9 (impact-map focused test).
- 2026-09-19 — `npm run qa:affected` (final tree) — PASS (rule
  `agent-workflow-and-documentation`, gates qa:fast → qa:full, broad
  regression not required).
- 2026-09-19 — `npm run test:integration` — ENVIRONMENT FAIL
  (`ERR_IPC_CHANNEL_CLOSED` at pool spawn, zero tests executed; identical
  on pristine stashed tree) — pre-existing host issue, not a gate.

## Changed Files / Areas

- `.agent/execplans/store-declaration-drift-guard-v1.md` — this plan.
- `tests/store-declaration-drift.test.ts` — new drift guard (to create).
- `docs/release/app-store-readiness.md` — guard pointer (to edit).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short` and `git log --oneline -5`; reconcile with the
   Current Checkpoint (Git wins over narrative).
3. Continue from `Exact next action`; run `npm run agent:resume -- --plan
   .agent/execplans/store-declaration-drift-guard-v1.md` for orientation.
4. Validate with focused vitest → `npm run qa:fast` →
   `npm run agent:plan:validate -- --plan <path>`; commit locally, no push.

## Outcomes & Retrospective

- Status: Complete.
- Summary: `tests/store-declaration-drift.test.ts` (8 tests) pins the
  `app.json` Android permission set and the 5-channel notification
  inventory (constant values + exact call-site expressions + user-visible
  names) to `docs/release/app-store-readiness.md`, with 4 tamper
  sensitivity cases proving the guard is not vacuous; readiness doc carries
  the guard pointer. All applicable gates green; local commit only, no push.
- Follow-up: if the integration worker-pool ENVIRONMENT issue persists on
  this host, a future pass should root-cause `ERR_IPC_CHANNEL_CLOSED`
  (tinypool spawn) independently of this change; store submission still
  needs the documented `[OWNER ACTION]`s (screenshots, credentials, tag).
- Lessons: reminder channel call sites pass constant identifiers rather
  than literals, so source-scan guards must assert the exact argument
  expressions and pair them with value assertions on the imported
  constants.
