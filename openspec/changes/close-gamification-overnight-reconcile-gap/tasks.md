## 1. Reconcile lookback and freeze ordering

- [x] 1.1 Extend `loadActivityCandidates` (or a wrapper) so housekeeping can load unrewarded feature activity for an explicit date key, not only `toDateKey()`. (Already date-keyed; `runGamificationHousekeeping` drives it for yesterday and today.)
- [x] 1.2 Change `reconcileGamificationActivity` to accept a date key (keep today's default) and award candidates against that date's source keys. (`GamificationReadOptions.todayKey` already does; housekeeping passes the candidate date.)
- [x] 1.3 Change `GamificationProvider` housekeeping (and any other caller that currently freeze-then-reconcile) to: reconcile yesterday, reconcile today, then `ensureStreakFreeze`. Preserve the 60s throttle and silent backfill (no overlay).

## 2. Tests

- [x] 2.1 Add an integration test: seed a 7-day ledger run, write a yesterday `habit_completions` row with no ledger event, run housekeeping; expect yesterday awarded, streak alive, `gamification_streak_freezes` empty for yesterday.
- [x] 2.2 Add an integration test: no yesterday feature activity, banked freeze, run housekeeping; expect freeze spent on yesterday (genuine miss still works).
- [x] 2.3 Add an integration test: today todo completed without `awardGamificationAction`, reconcile today; expect one award and a second reconcile of zero. Assert `sync_outbox` count unchanged.
- [x] 2.4 Extend `tests/gamification.domain.test.ts` only if freeze planning behavior changes; prefer covering the ordering in integration tests against real tables. (No domain change required; ordering is covered against real tables.)

## 3. Verification

- [x] 3.1 Run `npx vitest run tests/gamification.domain.test.ts tests/integration/gamification.test.ts`.
- [x] 3.2 Run `npm run typecheck` and `npm run lint`.
- [x] 3.3 Confirm `openspec validate close-gamification-overnight-reconcile-gap --strict` still passes.
