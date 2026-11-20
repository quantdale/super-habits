import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The chip prefill must go through `prefillDraftFromMeal`, not raw `String()`
 * coercions: the macro fields are integer-only, so a fractional stored value
 * prefilled raw is text the form can never submit ("Protein must be a whole
 * number." with a kcal display of 0).
 */
describe('Calories chip prefill wiring', () => {
  const source = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesScreen.tsx'),
    'utf8',
  );

  it('uses the shared prefill for saved-meal and frequent-food chips', () => {
    expect(source).toMatch(/prefillDraftFromMeal\(\{/);
    expect(source).toMatch(/setKcalSource\(draft\.kcalSource\)/);
    expect(source).toMatch(/setProtein\(draft\.protein\)/);
    // The raw coercions that produced unparseable field text are gone.
    expect(source).not.toMatch(/setProtein\(String\(meal\.protein\)\)/);
    expect(source).not.toMatch(/setFiber\(String\(meal\.fiber\)\)/);
  });
});
