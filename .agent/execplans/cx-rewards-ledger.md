# ExecPlan: Reward ledger and streak freeze reliability

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Finish the staged reward corrections, prove each regression on the assigned branch base, and verify the fixes before committing locally.

## Context

The brief is `/workspace/pi-sessions/cx/cx1-rewards.brief`. The assigned worktree is `/workspace/wt-cx-rewards`. The starting commit is `6ed89c6a`, with staged changes in the reward data and domain modules and the SQLite integration suite.

## Scope

Confirm overlapping award, freeze timing, and refund accounting defects. Verify and commit each coherent fix. The conditional backup and restore assessment follows these verified fixes.

## Non-Goals

Hosted calls, publishing, work in other checkouts, and risky recovery schema changes.

## Current Checkpoint

- Current milestone: Complete.
- Completed: Reproduced all eight selected regression cases on `6ed89c6a` and committed writer serialization as `a44302be` and refund accounting as `9645331f`. Corrected the pre-existing workout source regression test in `f8f24cf6`. Verified the freeze timing fix for immediate and housekeeping awards.
- In progress: None.
- Important modified files: `features/gamification/gamification.data.ts`, `features/gamification/gamification.domain.ts`, `tests/integration/gamification.test.ts`.
- Last successful validation: 411 focused tests, 4,529 unit tests, and 986 integration tests passed. Two opt-in hosted integration tests were skipped. All 12 focused Chromium tests passed.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Capture baseline failures.
- [x] Verify and commit serialized reward writers.
- [x] Verify and commit freeze refund accounting.
- [x] Verify and commit freeze spending order and validate the completed plan.

## Surprises & Discoveries

- The reward ledger has an explicit local-only architecture in the knowledge base.
- The full integration run found a stale negative control that expected invalid workout routine IDs to pay XP. It also fails with the source from `6ed89c6a`. The updated test checks that the routine ID leaves no event and only the real log is reconciled.

## Decision Log

- Use the existing staged regression tests and real SQLite harness to reproduce defects.
- For an immediate current-day award with an uncovered prior day, reconcile the existing lookback before entering the reward transaction. Save freezes in the same transaction as the current-day award.

## Validation Ledger

- `TZ=Asia/Manila npx vitest run tests/integration/gamification.test.ts -t 'overlapping|bridges a missed day|bridges yesterday|immediate award|just earned|refunded freeze'` on `6ed89c6a` source — expected FAIL, eight regressions. SQLite recorded XP without a level-up or badge, missed the freeze at both entry points, paid the immediate award with a streak of one before backfill, and held four grants after refund instead of three.
- `TZ=Asia/Manila npx vitest run tests/integration/gamification.test.ts -t 'overlapping'` with serialization — PASS, both race regressions.
- Initial `TZ=Asia/Manila npm run qa:fast` — typecheck PASS, lint found one formatting error. Formatted the line and reran targeted ESLint, which passed.
- `TZ=Asia/Manila npx vitest run gamification rewardReconcileBudget` — 376 passed for serialization.
- `TZ=Asia/Manila npx vitest run gamification rewardReconcileBudget` — 377 passed for refund accounting and 382 passed with freeze timing.
- Initial `TZ=Asia/Manila npm run qa:integration` — 985 passed, 2 skipped, one TEST_BUG in the workout attribution expectation. The copied baseline test reproduced the same failure on `6ed89c6a`. The strengthened assertion also fails against `6ed89c6a^`, which awarded 20 XP for the invalid ID.
- `TZ=Asia/Manila npx vitest run gamification rewardReconcileBudget rewardCelebrationOverlay rewardFeedback questVisualFixture todoMidnightAward todoToggleAward habitBackdateAward commandWorkoutLogId linkedActionWorkoutAward` — 411 passed.
- `TZ=Asia/Manila npm run qa:fast` — PASS, including typecheck, lint, 4,529 unit tests, and repository guards.
- Final `TZ=Asia/Manila npm run qa:integration` — PASS, 986 integration tests passed and 2 skipped.
- `TZ=<zone> npx vitest run tests/integration/gamification.test.ts` — 29 passed per zone in UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati. Asia/Manila passed in the focused suite.
- `env -u EXPO_PUBLIC_SUPABASE_URL -u EXPO_PUBLIC_SUPABASE_ANON_KEY flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:e2e` — PASS, verified hermetic export.
- The exact eight-case baseline command above — PASS with all eight regressions green on the fixed source.
- `npm run typecheck && npm run lint` — PASS on the final code and tests.
- `E2E_PORT=8211 TZ=Asia/Manila flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=chromium e2e/gamification.spec.ts e2e/gamification-surfaces.spec.ts e2e/reward-key-upgrade.spec.ts --reporter=line` — PASS, 12 tests.
- `npm run web:hygiene` and `ss -ltn 'sport = :8211'` — test ports free after the browser run.
- Temporary SQLite probes through portable export/import and the published-generation transport double — both restored all seven writer-created focus sessions. The fresh reward snapshot contained 0 XP, 0 grants, and 0 uses, compared with 166 XP, 1 grant, and 1 use at the source. No hosted backup call was made.
- `npm run qa:affected` — fast/full fallback for reward paths. The brief specifies the focused quality and gamification lanes.

## Changed Files / Areas

- `features/gamification/gamification.data.ts` — transaction ordering and pass snapshot.
- `features/gamification/gamification.domain.ts` — trailing gap selection.
- `tests/integration/gamification.test.ts` — durable reward regression proof.
- `tests/integration/commandWorkoutLogId.test.ts` — align the invalid-source regression with the parent commit.

- `.agent/execplans/cx-rewards-ledger.md` — task checkpoints and verification evidence.

## Recovery / Resume Instructions

Read the brief, AGENTS.md, and .agent/PLANS.md, then run the plan resume command. Inspect the index and working tree separately before following Exact next action.

## Outcomes & Retrospective

- Status: Complete. The ledger preserves level-up and badge crossings during overlap, credits prior activity before spending freezes, and computes current awards from the protected streak. Every staged regression failed on the base and passed with the changes.
- Each commit ran the configured hook with the lint-staged backup stash disabled for this worktree. The conditional backup and restore assessment was verified locally and deferred under the brief’s data-model constraint.
- Preserving those rewards requires a coordinated versioned backup contract and an ownership and restore policy for the four local tables. In particular, valid ledger receipts can outlive the feature rows they reward, and restore eligibility currently excludes reward tables. Task B was deferred under the brief’s risky data-model constraint.
