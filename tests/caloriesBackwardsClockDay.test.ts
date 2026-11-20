import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * RESOLVED LEAD: a clock/timezone move BACKWARDS past an explicitly selected
 * historical day.
 *
 * `resolveCalorieLogDateKey` deliberately clamps a future selection onto today
 * for the WRITE side ("a form that only fails on submit is a dead end"). The
 * `CaloriesScreen` applied that clamp to writes only: reads, the hero, the
 * saved-meal day log and the copy-day target kept the raw `selectedDateKey`.
 *
 * Reproduction (state machine, no renderer needed):
 *  1. 2026-11-18: the user navigates the diary to 2026-11-10 (explicit past
 *     day, `followsToday = false`) and logs an entry there.
 *  2. The clock/timezone moves backwards to 2026-11-08 (e.g. a device TZ
 *     change from Asia/Manila to America/Los_Angeles, or a manual clock fix).
 *     `selectedDateKey` originally stayed 2026-11-10 (D9b: an explicit
 *     selection never follows midnight), and it is now a FUTURE day.
 *  3. Before the fix the surface still SHOWED 2026-11-10 (hero context line,
 *     day log, navigator ring) while every write resolved to 2026-11-08 — so a
 *     meal typed while the diary visibly showed Nov 10 silently landed on
 *     Nov 8, and the day log below did not contain it. (`Copy a previous day`
 *     targeted Nov 10 and was refused as a future day.)
 *
 * Fixed behaviour: the surface collapses onto today AND releases the pin, so
 * the day it shows is the day every write uses.
 *
 * Contract this pins: the Calories surface has ONE day. The day it displays and
 * the day it writes to are the same value (`resolveCalorieSurfaceDay`), so a
 * backwards clock move can never produce a wrong-day write.
 *
 * The repository has no React renderer, so the wiring half is asserted at the
 * source seam (same precedent as `healthScreenDayRollover.test.ts`); the day
 * rule itself and the resulting write are asserted through the real SQLite
 * data layer.
 */
describe('Calories surface day is stable under a backwards clock move', () => {
  const source = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesScreen.tsx'),
    'utf8',
  );

  it('derives ONE surface day that re-anchors on the day-rollover generation', () => {
    // The single derivation, with the rollover generation as an intentional
    // extra dep so "today" is re-read at local midnight (and on the provider's
    // foreground check) instead of being frozen at mount.
    expect(source).toMatch(/const todayKey = useMemo\(\(\) => toDateKey\(\), \[dayGeneration\]\)/);
    expect(source).toMatch(/resolveCalorieSurfaceDay\(selectedDateKey, todayKey\)/);
  });

  it('releases an explicitly pinned selection once it is no longer a past day', () => {
    // A backwards day change makes the pin impossible: keeping it would show
    // a day the writes can never reach.
    expect(source).toMatch(/if \(selectedDateKey > todayKey\)/);
    expect(source).toMatch(/setSelectedDateKey\(todayKey\)/);
    expect(source).toMatch(/setFollowsToday\(true\)/);
  });

  it('feeds every read, display and write with that one surface day', () => {
    // The day-scoped READ follows the surface day (not the raw selection, which
    // can have drifted into the future).
    expect(source).toMatch(/listCalorieEntries\(surfaceDateKey\)/);
    expect(source).not.toMatch(/listCalorieEntries\(selectedDateKey\)/);

    // The hero context line/dots and the navigator both display it.
    expect(source).toMatch(/dateKey=\{surfaceDateKey\}/);
    expect(source).toMatch(/selectedDateKey=\{surfaceDateKey\}/);

    // Copy-day targets it (never the raw, possibly-future selection).
    expect(source).toMatch(/copyCalorieEntriesFromDay\(sourceDateKey, surfaceDateKey\)/);

    // Creates write to it.
    expect(source).toMatch(/consumedOn: surfaceDateKey/);
    expect(source).not.toMatch(/consumedOn: logDateKey/);
  });
});
