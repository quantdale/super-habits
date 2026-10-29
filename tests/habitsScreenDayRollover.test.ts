import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Wiring pin for the Habits day-strip's day-rollover contract.
 *
 * `stripDays` anchors its 7-day window (and the trailing "today" pill) on
 * `today: new Date()` at compute time. If the memo's dependency list omits the
 * day signal already available in the component (`todayKey` /
 * `dayGeneration` from `useDayRolloverGeneration`), a re-render after local
 * midnight with unchanged data identities leaves the stale window and a wrong
 * today pill — a superseded/bailing refresh or a load error makes that state
 * persistent. Source-level because the repository has no React renderer for
 * component tests; the pure window math is covered by
 * `tests/habitsScreenDerivations.test.ts`.
 */
describe('HabitsScreen day-strip day-rollover wiring', () => {
  const source = readFileSync(resolve(__dirname, '../features/habits/HabitsScreen.tsx'), 'utf8');

  it('keys the stripDays memo on the day signal', () => {
    const memo = source.match(/const stripDays = useMemo<HabitDayStripDay\[\]>[\s\S]*?\n  \);/);
    expect(memo).toBeTruthy();
    const deps = memo![0].match(/\[([^\]]*)\]\s*,\s*\n  \);/);
    expect(deps).toBeTruthy();
    const depNames = deps![1].split(',').map((name) => name.trim());
    expect(depNames).toContain('todayKey');
    expect(depNames).toContain('dayGeneration');
  });

  it('computes the strip from an injectable current day', () => {
    expect(source).toMatch(/buildHabitDayStrip\(\{[^}]*today: new Date\(\)[^}]*\}\)/);
  });
});
