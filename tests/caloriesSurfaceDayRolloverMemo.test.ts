import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveCalorieSurfaceDay } from '@/features/calories/calories.domain';

/**
 * Codex P2 on PR #254: the surface day must re-anchor when the LOCAL DAY
 * changes, not only when the selection changes.
 *
 * `resolveCalorieSurfaceDay(selection, today)` clamps a future-dated selection
 * onto today, and the existing coverage (`tests/calories.domain.test.ts`,
 * `tests/caloriesBackwardsClockDay.test.ts`,
 * `tests/integration/caloriesSurfaceDayBackwardsClock.test.ts`) all invoke the
 * resolver afresh with a fresh `today`. None of them exercise the screen's
 * MEMOIZATION, which is where the two halves actually diverge.
 *
 * Reproduction (selection held constant, only the local day moves):
 *  1. 2026-11-18: the user explicitly navigates the diary back to 2026-11-10.
 *     An explicit past-day navigation detaches `followsToday` (D9b), so the
 *     rollover effect deliberately leaves `selectedDateKey` at 2026-11-10.
 *  2. The clock/timezone moves BACKWARDS to 2026-11-08. A re-render happens —
 *     `DayRolloverProvider` bumps `dayGeneration` on foregrounding/midnight and
 *     the screen subscribes through `useDayRolloverGeneration()`.
 *  3. A memo keyed on `[selectedDateKey]` alone returns the value it cached in
 *     step 1. The surface keeps showing 2026-11-10, which is now a FUTURE day:
 *     creates and copy-day target it and the data layer refuses them.
 *
 * Harness: this repository has no React renderer, so the memoization half is
 * modelled from the screen's own derivation — the parsed dependency list of the
 * `surfaceDateKey` memo decides whether a re-render recomputes or reuses the
 * cached day (React's `useMemo` contract, keyed on the same values the screen
 * reads). A per-render derivation recomputes every render. The day rule itself
 * is the real `resolveCalorieSurfaceDay`.
 */
type Render = {
  label: string;
  /** Explicit diary selection: an anchored past day, not "today". */
  selectedDateKey: string;
  /** The local day key at this render (`toDateKey()`). */
  todayKey: string;
  /** `useDayRolloverGeneration()` at this render. */
  dayGeneration: number;
};

type Derivation = { kind: 'per-render' } | { kind: 'memo'; deps: string[] };

/**
 * Names the screen may use for a value inside the memo. A dep the harness does
 * not know fails loudly: the pin must be updated rather than silently assuming
 * the dep re-anchors the day.
 */
const DEP_READERS: Record<string, (render: Render) => string> = {
  selectedDateKey: (render) => render.selectedDateKey,
  // Bumped by DayRolloverProvider whenever the local day changes.
  dayGeneration: (render) => String(render.dayGeneration),
  // A separately memoized "today" (allowed alternative to the generation).
  todayKey: (render) => render.todayKey,
  surfaceTodayKey: (render) => render.todayKey,
};

const SOURCE = readFileSync(resolve(__dirname, '../features/calories/CaloriesScreen.tsx'), 'utf8');

/** Comments carry prose (and semicolons); the pin reads code only. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function parseDerivation(source: string): Derivation {
  const head = 'const surfaceDateKey =';
  const start = source.indexOf(head);
  if (start === -1) {
    throw new Error(
      'tests/caloriesSurfaceDayRolloverMemo: features/calories/CaloriesScreen.tsx no longer ' +
        'declares `const surfaceDateKey = …`. Update this pin.',
    );
  }

  // Read the declaration up to its terminating `;` — after dropping comments,
  // which hold prose semicolons — so the pin survives any Prettier reflow.
  const code = stripComments(source.slice(start, start + 2000));
  const end = code.indexOf(';');
  const statement = end === -1 ? null : code.slice(0, end + 1);

  if (statement && !statement.includes('useMemo')) return { kind: 'per-render' };

  const memo = statement?.match(/\[([^\[\]]*)\]\s*,\s*\)\s*;$/);
  if (statement && memo) {
    return {
      kind: 'memo',
      deps: memo[1]
        .split(',')
        .map((dep) => dep.trim())
        .filter(Boolean),
    };
  }

  throw new Error(
    'tests/caloriesSurfaceDayRolloverMemo: cannot read the `surfaceDateKey` derivation ' +
      'from features/calories/CaloriesScreen.tsx (it must be either a per-render ' +
      '`resolveCalorieSurfaceDay(selectedDateKey, <today>)` or a `useMemo` whose deps ' +
      're-anchor on the local day). Update this pin.',
  );
}

/** Replay the memo contract across renders that share one selection. */
function surfaceDayAcrossRenders(derivation: Derivation, renders: Render[]): string[] {
  let cached: { key: string; value: string } | null = null;

  return renders.map((render) => {
    if (derivation.kind === 'per-render') {
      return resolveCalorieSurfaceDay(render.selectedDateKey, render.todayKey);
    }

    const key = derivation.deps
      .map((dep) => {
        const read = DEP_READERS[dep];
        if (!read) {
          throw new Error(
            `tests/caloriesSurfaceDayRolloverMemo: unknown memo dependency "${dep}" on ` +
              '`surfaceDateKey`; teach the harness how that dep changes across renders ' +
              '(and prove it re-anchors on the local day) before relying on it.',
          );
        }
        return `${dep}=${read(render)}`;
      })
      .join('|');

    if (cached && cached.key === key) return cached.value;

    const value = resolveCalorieSurfaceDay(render.selectedDateKey, render.todayKey);
    cached = { key, value };
    return value;
  });
}

describe('Calories surface day re-anchors when the local day changes', () => {
  const derivation = parseDerivation(SOURCE);

  it('clamps an anchored selection that a backwards clock move made future', () => {
    // The selection is HELD CONSTANT; only the local day (and the rollover
    // generation the screen subscribes to) moves.
    const renders: Render[] = [
      {
        label: '2026-11-18: user explicitly opens 2026-11-10',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-18',
        dayGeneration: 0,
      },
      {
        label: 'clock moves back to 2026-11-08; foreground bumps the generation',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-08',
        dayGeneration: 1,
      },
    ];

    // Pre-fix the memo was keyed on `[selectedDateKey]` only, so the second
    // render REUSED the day cached on 2026-11-10: the surface kept showing a
    // future day it can no longer write to.
    expect(surfaceDayAcrossRenders(derivation, renders)).toEqual(['2026-11-10', '2026-11-08']);
  });

  it('keeps the collapse for later re-renders in the same local day', () => {
    const renders: Render[] = [
      {
        label: 'before the jump',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-18',
        dayGeneration: 0,
      },
      {
        label: 'clock jumps back',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-08',
        dayGeneration: 1,
      },
      {
        label: 'second foreground, same local day',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-10',
        dayGeneration: 2,
      },
    ];

    expect(surfaceDayAcrossRenders(derivation, renders)).toEqual([
      '2026-11-10',
      '2026-11-08',
      // 2026-11-10 is today again at this point, so the anchored selection is
      // reachable and the surface may show it.
      '2026-11-10',
    ]);
  });

  it('still leaves an anchored PAST day alone when the day rolls forward (D9b)', () => {
    // The re-anchor must never yank the user off the day they deliberately
    // opened: a forward day change leaves a reachable past selection untouched.
    const renders: Render[] = [
      {
        label: 'opens 2026-11-10',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-18',
        dayGeneration: 0,
      },
      {
        label: 'local midnight',
        selectedDateKey: '2026-11-10',
        todayKey: '2026-11-19',
        dayGeneration: 1,
      },
    ];

    expect(surfaceDayAcrossRenders(derivation, renders)).toEqual(['2026-11-10', '2026-11-10']);
  });
});
