import { describe, expect, it } from 'vitest';

import { resolveTextFieldA11y } from '@/core/ui/textFieldA11y';

describe('resolveTextFieldA11y', () => {
  it('associates helper text via described-by when no error is present (web)', () => {
    const result = resolveTextFieldA11y('calorie-protein', null, 'Grams per serving', 'web');
    expect(result.helperId).toBe('calorie-protein-helper');
    expect(result.errorId).toBe('calorie-protein-error');
    expect(result.describedBy).toBe('calorie-protein-helper');
    expect(result.invalid).toBe(false);
  });

  it('error takes precedence over helper text (web)', () => {
    const result = resolveTextFieldA11y('calorie-protein', 'Protein is required', 'Grams', 'web');
    expect(result.describedBy).toBe('calorie-protein-error');
    expect(result.invalid).toBe(true);
  });

  it('returns no association without nativeID or texts (web)', () => {
    const result = resolveTextFieldA11y(undefined, null, undefined, 'web');
    expect(result.helperId).toBeUndefined();
    expect(result.errorId).toBeUndefined();
    expect(result.describedBy).toBeUndefined();
    expect(result.invalid).toBe(false);
  });

  it('treats empty-string error as no error (matches render behavior)', () => {
    const result = resolveTextFieldA11y('id', '', undefined, 'web');
    expect(result.invalid).toBe(false);
    expect(result.describedBy).toBeUndefined();
  });

  it('skips described-by association off web (native readers announce adjacent text)', () => {
    const result = resolveTextFieldA11y('id', 'Required', undefined, 'ios');
    expect(result.helperId).toBeUndefined();
    expect(result.errorId).toBeUndefined();
    expect(result.describedBy).toBeUndefined();
    expect(result.invalid).toBe(true);
  });
});
