## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. The four affected sites are `features/goals/goals.data.ts:332`, `features/daily-plan/dailyPlan.data.ts:294`, and `features/projects/projects.data.ts:342,:389`. Every consumer of the resulting key uses an inclusive lower bound (`hc.date_key >= ?` at `goals.data.ts:347-349`, `projects.data.ts:363-365`, `dailyPlan.data.ts:296-297`), which is what turns a one-day-earlier start into a one-day-longer window. The sanctioned pattern already exists in the repository: `lib/time.ts:64-72` (`buildDateRangeOldestFirst`, which uses `setDate`), `dailyPlan.domain.ts` (`shiftDateKey`), and `features/workout/WorkoutScreen.tsx:217-222`. `openspec/specs/productivity-expansion-hardening/spec.md:67-89` already carries the requirement "Calendar dates are real local calendar dates" with a "Seven-day period around DST" scenario, but its body names only Progress periods. The archived design note `openspec/changes/archive/2026-08-30-harden-productivity-expansion-wave-v1/design.md:197` recorded the explicit rule against blind `24 * 60 * 60 * 1000` arithmetic. Three read paths also call `Date.now()` directly rather than the repository's `nowIso()` seam (`lib/time.ts:1-3`), which is why these windows are not deterministic under the seeded integration fixtures.

## Goals / Non-Goals

**Goals:**

- Make all four window starts local-calendar arithmetic, using an existing sanctioned helper rather than a new one.
- Pin each affected window at both DST boundaries with executing coverage.
- Make the affected read paths clock-injectable so the existing seeded fixtures exercise them deterministically.

**Non-Goals:**

- Rewriting the rollup aggregations themselves, their ordering, or their inclusive/exclusive bound semantics.
- Changing `toDateKey()` or any other `lib/time.ts` helper's contract.
- Adding a new timezone matrix zone; the existing zones already include a DST-observing one.
- Touching the UTC-ISO range helper `getUtcIsoRangeForLocalDateKeys`, which is correct because it queries UTC timestamp columns.

## Decisions

### 1. Reuse `buildDateRangeOldestFirst` (or an equivalent `setDate` walk), not a new helper

Each site computes its own window start via the same calendar walk `lib/time.ts:64-72` already performs, then keeps its existing lower-bound comparison unchanged.

Alternative: introduce a new `startOfInclusiveWindow(days)` utility. Rejected unless the existing helper cannot express a single starting key cleanly; a second helper for one arithmetic operation invites exactly the drift this change repairs. If the existing helper's signature does not fit the daily-plan site, extend it rather than forking it.

### 2. The window start is derived from the local date key, not from the instant

Convert to a local date key first, then walk back N−1 calendar days on the key, then convert back. This keeps the operation independent of the length of the current local day entirely, rather than merely compensating for DST.

Alternative: subtract N days of milliseconds minus the DST offset. Rejected. It requires knowing the offset, which reintroduces the same class of error at a different boundary.

### 3. DST coverage is a unit-level test per site plus one integration assertion

Each of the four sites gets a test that pins its window start at a spring-forward and a fall-back instant in `America/New_York`, using the existing fake-clock fixture (`tests/integration/fixtures/clock.ts`). One integration assertion confirms the inclusive window spans exactly N local days against a real SQLite database.

Alternative: a single shared parameterized test. Rejected. The four sites have different signatures and different consumers, and a shared test would hide which site regressed.

### 4. Clock injection goes through the existing `nowIso()` seam

The three direct `Date.now()` calls are replaced with the repository's injectable `nowIso()` from `lib/time.ts`, which the integration fixtures already mock.

Alternative: add a new DI parameter to each function. Rejected. It changes four public signatures for a seam the repository already has.

## Risks / Trade-offs

- [A window start shifting by one day changes a visible rollup number] → That is the defect being fixed, and it changes only on a DST-boundary morning; ordinary days are unchanged, which the "outside a DST boundary" scenario pins.
- [Extending the existing helper changes its other callers] → The helper's existing callers are covered by the timezone matrix; the extension is additive and the matrix is re-run before commit.
- [Fake-clock tests can drift from the real calendar] → The fixtures already anchor to a fixed seeded date, and the DST tests pin specific instants rather than relative offsets.

## Migration Plan

No data or schema migration. Apply order: (1) confirm or extend the calendar-walk helper; (2) fix the goals window; (3) fix the daily-plan window; (4) fix both project windows; (5) add the per-site DST unit coverage; (6) add the integration window-span assertion; (7) replace the three direct `Date.now()` calls. Validation: the affected unit and integration tests, the existing timezone matrix (`npm run qa:timezones`), `npm run test:unit`, and `npm run qa:fast` on pinned Node `v22.23.2`. Rollback is a revert of the single commit; no persisted format changes.

## Open Questions

None. Every affected site is identified by path and line, and the sanctioned helper already exists.
