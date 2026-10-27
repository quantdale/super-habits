import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ONE streak definition, asserted at the source level (audit C #10).
 *
 * `features/habits/habitStreak.domain.ts` owns the only day-walk that decides
 * what a streak is. A behaviour test can only prove the call sites it knows
 * about; this guard proves the absence of NEW ones, because a fourth walker
 * added tomorrow would pass every existing behavioural assertion while silently
 * re-creating the defect (two numbers labelled "streak" disagreeing about the
 * same data).
 *
 * The detector is deliberately narrow — "a consecutive-key walk over date keys"
 * — so it cannot fire on unrelated heuristics. It is validated against known
 * positives and negatives below, so the guard cannot pass vacuously if the
 * pattern stops matching.
 */

const ROOT = resolve(__dirname, '..');
const STREAK_ENGINE = 'features/habits/habitStreak.domain.ts';

/** The only module allowed to own a streak day-walk. */
const DAY_WALK_OWNER = STREAK_ENGINE;

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

/**
 * True when the source walks consecutive local days to measure a run.
 *
 * Two shapes are what a streak implementation is actually made of:
 * - a "did this key follow that key by exactly one day" comparison —
 *   `addLocalDays(prev, 1) === next`, `diffLocalDays(prev, next) === 1`, or a
 *   hand-rolled `… === 86_400_000` millisecond delta;
 * - a backward/forward cursor loop that increments a run counter while stepping
 *   the day cursor.
 *
 * A bare day-DIFFERENCE (`Math.round((end - start) / 86_400_000)`), which is how
 * ranges, countdowns and "Yesterday" labels are computed, is deliberately NOT a
 * signal: it is not a definition of a streak day.
 */
export function detectsStreakDayWalk(source: string): boolean {
  const consecutiveKeyComparison =
    /(addLocalDays|diffLocalDays)\s*\([^)]*\)\s*[!=]==?\s*(1\b|[(\w])/.test(source) ||
    /[!=]==?\s*86[_,]?400[_,]?000\b/.test(source) ||
    /\b86[_,]?400[_,]?000\s*[!=]==?/.test(source);
  const runCounter =
    /(currentStreak|bestStreak|longestStreak|streakRun|runLength)\s*(\+\+|\+=\s*1|=\s*\w+\s*\+\s*1)/.test(
      source,
    );
  const dayCursorStep = /setDate\s*\(|addLocalDays\s*\(|Date\.parse\s*\(/.test(source);
  return consecutiveKeyComparison || (runCounter && dayCursorStep);
}

describe('streak walk detector', () => {
  it('flags the shapes a streak implementation is made of', () => {
    expect(detectsStreakDayWalk('run = addLocalDays(prev, 1) === next ? run + 1 : 0;')).toBe(true);
    expect(detectsStreakDayWalk('if (diffLocalDays(prev, next) === 1) bestStreak += 1;')).toBe(
      true,
    );
    expect(
      detectsStreakDayWalk(
        'currentStreak = currMs - prevMs === 86_400_000 ? currentStreak + 1 : 1;',
      ),
    ).toBe(true);
    expect(
      detectsStreakDayWalk('for (...) { cursor.setDate(cursor.getDate() + 1); currentStreak++; }'),
    ).toBe(true);
    expect(
      detectsStreakDayWalk('run = addLocalDays(previousKey, 1) !== day.dateKey ? 0 : run;'),
    ).toBe(true);
  });

  it('does not flag day-difference, range or label math', () => {
    expect(detectsStreakDayWalk('const key = toDateKey(new Date());')).toBe(false);
    expect(detectsStreakDayWalk('const range = getUtcIsoRangeForLocalDateKeys(a, b);')).toBe(false);
    expect(detectsStreakDayWalk('const nextKey = addLocalDays(dateKey, 1);')).toBe(false);
    // A day DIFFERENCE is not a streak definition (ranges, countdowns, labels).
    expect(
      detectsStreakDayWalk('const dayCount = Math.round((end - start) / 86_400_000) + 1;'),
    ).toBe(false);
    expect(
      detectsStreakDayWalk(
        'const difference = Math.round((today.getTime() - date.getTime()) / 86_400_000);',
      ),
    ).toBe(false);
  });
});

describe('one streak definition across the app source', () => {
  const files = [
    ...listSourceFiles(resolve(ROOT, 'features')),
    ...listSourceFiles(resolve(ROOT, 'core')),
    ...listSourceFiles(resolve(ROOT, 'lib')),
    ...listSourceFiles(resolve(ROOT, 'app')),
  ];

  it('finds no streak day-walk outside the shared engine', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split('\\').join('/');
      if (rel === DAY_WALK_OWNER) continue;
      if (/(^|\/)__tests__\//.test(rel)) continue;
      if (detectsStreakDayWalk(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
    // A new offender here means a second definition of "streak day" exists.
    // Route it through `computeStreakRun` in `features/habits/habitStreak.domain.ts`
    // instead of widening this list.
    expect(offenders).toEqual([]);
  });

  it('resolves streak surfaces through the one engine rather than local walks', () => {
    // Habits tab, per-habit insights, Ask, the reward ledger and the heatmap
    // caption all import the shared engine (directly or through its adapters).
    const engineConsumers = [
      'features/habits/habits.domain.ts',
      'features/gamification/gamification.domain.ts',
      'features/shared/githubHeatmap.domain.ts',
    ];
    for (const rel of engineConsumers) {
      const source = readFileSync(resolve(ROOT, rel), 'utf8');
      expect(source, `${rel} must import computeStreakRun`).toMatch(/computeStreakRun/);
    }
  });
});
