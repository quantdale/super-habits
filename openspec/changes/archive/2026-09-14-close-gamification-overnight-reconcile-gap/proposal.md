## Why

The local reward ledger is a shipped, tested feature, but housekeeping can treat a real prior-day action as a missed streak day. Habit and todo reminder completions (and command-center writes) do not call `recordAction`. `reconcileGamificationActivity` backfills **today only**. `GamificationProvider` runs `ensureStreakFreeze` **before** that reconcile. A Mark complete tap at 23:00 that is not awarded until the user opens the app after local midnight therefore has a `habit_completions` row, no `gamification_events` row, looks like a gap, and burns a banked freeze — and yesterday's XP is never awarded.

That is a correctness hole in an otherwise complete local-only loop, not a request to invent gamification.

## What Changes

- Housekeeping MUST reconcile unrewarded actions for the previous local calendar day (bounded lookback, not months of history) **before** spending a streak freeze.
- A day that has real feature activity (habit check-in, todo completion, focus session, workout log, meal, committed plan, completed review) MUST be awarded against that day's date key so it cannot be classified as a miss.
- Freeze spend remains only for a genuine absence of activity. XP already awarded stays idempotent (`UNIQUE(event_kind, source_key)`).
- Keep the ledger local-only: no outbox, no backup, no account-ownership of reward rows.
- Silent reconcile (no celebration overlay for backfilled awards) stays in force.

## Capabilities

### New Capabilities

- `local-reward-ledger`: local-only XP/streak/freeze/quest/badge loop, including prior-day reconcile-before-freeze so notification and command writes cannot burn a freeze or drop XP overnight.

### Modified Capabilities

- None. No existing OpenSpec capability describes this layer.

## Impact

- **Data:** `features/gamification/gamification.data.ts` (`reconcileGamificationActivity`, `loadActivityCandidates`, `ensureStreakFreeze` call order).
- **UI orchestration:** `features/gamification/GamificationProvider.tsx` housekeeping order.
- **Domain:** `features/gamification/gamification.domain.ts` only if freeze planning must treat a newly awarded prior day as active (prefer awarding first so existing `planAutoFreeze` sees the ledger row).
- **Tests:** `tests/integration/gamification.test.ts` and `tests/gamification.domain.test.ts` — add a prior-day notification-style write that must award XP and must not spend a freeze.
- **No schema migration.** Tables stay local-only and out of `BACKUP_ENTITIES`.
- **Independent of** `fix-backup-push-hard-delete-and-owner-stamping`. May be applied in either order.
