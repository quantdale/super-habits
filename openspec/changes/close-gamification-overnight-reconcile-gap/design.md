## Context

See `proposal.md` for motivation. The engine (`gamification.domain.ts`) is pure and already treats a day as active only when a non-grant ledger row exists. Persistence (`gamification.data.ts`) already idempotently inserts events. The defect is **which days** `loadActivityCandidates` reads and **when** `ensureStreakFreeze` runs relative to reconcile.

## Goals / Non-Goals

**Goals:**

- Award yesterday's unreported feature activity before freeze planning sees a gap.
- Keep awards silent when backfilled.
- Keep the four tables local-only.

**Non-Goals:**

- Instant celebration for reminder/command writes (silent reconcile is intentional).
- Backfilling weeks or months of history (would rewrite streaks; restore still starts from surviving activity).
- Syncing or backing up the ledger.
- Hooking `DailyPlanView` / `WeeklyReviewScreen` to `recordAction` (today+yesterday reconcile is enough).
- Changing XP amounts, quest rotation, or badge families.

## Decisions

1. **Lookback is today + previous local date key, not an unbounded scan.**
   - Rationale: the failure mode is overnight (notification before midnight, open after). Months of backfill would award historical activity the design explicitly left unrestored.
   - Alternative considered: reconcile every date with unrewarded feature rows. Rejected; expensive and would change long-offline semantics.
   - Alternative considered: award inside the notification data layer. Rejected as a layering violation (`*.data.ts` should not import gamification as a required side effect; reconcile is the documented safety net). Optional later `recordAction` from the notification host is allowed but not required if yesterday reconcile exists.

2. **Award first, then freeze, in one housekeeping pass.**
   - Rationale: `planAutoFreeze` already does the right thing once the ledger row exists. Reordering plus yesterday candidates is sufficient.
   - Alternative considered: teach `planAutoFreeze` to read `habit_completions` / todos directly. Rejected; it would duplicate "what is an active day" outside the ledger.

3. **Reuse `awardGamificationAction({ todayKey: dateKey, entityId })` per candidate date.**
   - The current function uses `todayKey` both as "now" and as the award date. Housekeeping should pass the candidate's date key so source keys stay `{dateKey}:{entityId}`.
   - Do not award yesterday's action onto today.

4. **Keep `RECONCILE_AWARD_LIMIT` per day.**
   - Pathological data stays bounded. Two days × 25 is enough for overnight.

## Risks / Trade-offs

- **[Risk] A user who truly missed yesterday but logged a calorie/habit after midnight on the previous clock still gets awarded if the row's date key is yesterday.** → Correct: date keys are the product truth.
- **[Risk] Housekeeping now does twice the candidate reads.** → Cheap indexed queries; still throttled to 60s.
- **[Risk] Existing devices that already burned a freeze overnight cannot un-spend it.** → No historical rewrite. Only future housekeeping is fixed. Document as non-migrated past freezes.

## Migration Plan

- No schema change.
- First housekeeping pass after upgrade awards yesterday if unrewarded feature rows exist and have not yet been paid. If a freeze was already inserted for that date, the unique freeze row remains; do not delete historical freeze spends.

## Open Questions

None.
