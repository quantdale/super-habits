import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Quick Capture's calorie destination wiring.
 *
 * The behavioural oracle lives in
 * `tests/integration/quickCaptureCalorieSavedMeal.test.ts` (real SQLite: an
 * existing "Oatmeal" saved meal keeps its macros and use_count). That test
 * drives `submitQuickCaptureCalorie`, so this guard pins the SHELL to it:
 * re-inlining `addCalorieEntry` here would restore the default catalog
 * maintenance and silently reintroduce the bug while the integration test
 * kept passing.
 */
describe('Quick Capture calorie wiring', () => {
  const overlay = readFileSync(
    resolve(__dirname, '../features/quick-capture/QuickCaptureOverlay.tsx'),
    'utf8',
  );
  const submit = readFileSync(
    resolve(__dirname, '../features/quick-capture/quickCaptureCalorie.submit.ts'),
    'utf8',
  );

  it('logs calorie captures through the one-off-log submit helper', () => {
    expect(overlay).toMatch(
      /import \{ submitQuickCaptureCalorie \} from '@\/features\/quick-capture\/quickCaptureCalorie\.submit';/,
    );
    expect(overlay).toMatch(/await submitQuickCaptureCalorie\(\{/);
    // The overlay must not reach the data layer's defaulting add path at all:
    // its calorie capture is a one-off log, never a saved-meal "use".
    expect(overlay).not.toMatch(/addCalorieEntry\(/);
    expect(overlay).not.toMatch(/import \{[^}]*addCalorieEntry[^}]*\} from/);
  });

  it('the helper opts out of saved-meal catalog maintenance', () => {
    expect(submit).toMatch(/maintainSavedMeal: false/);
  });
});
