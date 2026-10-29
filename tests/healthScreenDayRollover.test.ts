import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Wiring pin for the Health surface's day-rollover contract.
 *
 * Every section screen whose "today" state must follow the local day reads the
 * rollover generation (`useDayRolloverGeneration`) and passes it to
 * `useActiveForegroundRefresh`, whose effect re-runs the refresh on a
 * generation bump. HealthScreen used to be the one screen missing that wiring,
 * so an app left open across local midnight kept rendering the previous day's
 * `workoutToday` / `kcalState` totals under its "Today" card until the next
 * activation or foreground event (the other section screens are covered by
 * `e2e/todos-day-rollover.spec.ts` and their own generation consumers).
 *
 * The behavioural seam is `lib/foregroundListeners.ts#createActivationRefresh`
 * (activation-only by contract — no renderer needed to reason about it); this
 * pin asserts the screen feeds the day signal into it. Source-level because the
 * repository has no React renderer for component tests.
 */
describe('HealthScreen day-rollover wiring', () => {
  const source = readFileSync(resolve(__dirname, '../features/health/HealthScreen.tsx'), 'utf8');

  it('subscribes to the day-rollover generation', () => {
    expect(source).toContain("from '@/core/providers/dayRolloverContext'");
    expect(source).toMatch(/useDayRolloverGeneration\(\)/);
  });

  it('feeds the generation into the activation/foreground refresh', () => {
    expect(source).toMatch(/useActiveForegroundRefresh\(isActive, refresh, dayGeneration\)/);
  });
});
