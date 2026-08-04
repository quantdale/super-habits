/**
 * Unit tests for the disposable-backend hard-isolation guard
 * (`simulation/backend/guard.ts`, task 8.3). All three abort rules must fire
 * on their conditions and the guard must pass only when every rule is happy.
 * The guard is pure (no env access, no I/O), so these tests run anywhere.
 */
import { describe, expect, it } from 'vitest';
import {
  assertDisposableBackend,
  checkDisposableBackend,
  DEFAULT_CREDENTIAL_ENV_KEYS,
  isDisposableBackendAllowed,
  normalizeHost,
  type DisposableBackendGuardInput,
  type GuardRule,
} from '../simulation/backend/guard';

const PRODUCTION_HOST = 'https://production-project.supabase.co';

function cleanInput(
  overrides: Partial<DisposableBackendGuardInput> = {},
): DisposableBackendGuardInput {
  return {
    targetHost: 'https://abcdefghijklmnopqrst.supabase.co',
    productionHosts: [PRODUCTION_HOST],
    ambientEnv: {},
    disposableMarkerPrefix: 'superhabits-disposable',
    targetProjectName: 'superhabits-disposable-20260804-a1b2',
    ...overrides,
  };
}

/** Assert exactly one rule fired and it is `rule`. */
function expectSingleRule(
  result: { ok: boolean; rules: GuardRule[]; message: string },
  rule: GuardRule,
): void {
  expect(result.ok).toBe(false);
  expect(result.rules).toEqual([rule]);
  expect(result.message).toContain(rule);
}

describe('normalizeHost', () => {
  it('treats scheme-qualified URLs and bare hosts as equal', () => {
    expect(normalizeHost('https://abc.supabase.co')).toBe(normalizeHost('abc.supabase.co'));
  });

  it('is case-insensitive', () => {
    expect(normalizeHost('HTTPS://ABC.SUPABASE.CO')).toBe(normalizeHost('abc.supabase.co'));
  });

  it('strips default ports and trailing slashes/dots', () => {
    expect(normalizeHost('https://abc.supabase.co:443/')).toBe('abc.supabase.co');
    expect(normalizeHost('https://abc.supabase.co:80')).toBe('abc.supabase.co');
    expect(normalizeHost('abc.supabase.co.')).toBe('abc.supabase.co');
  });

  it('keeps non-default ports distinct', () => {
    expect(normalizeHost('http://abc.supabase.co:3000/path')).toBe('abc.supabase.co:3000');
    expect(normalizeHost('abc.supabase.co:3000')).not.toBe(normalizeHost('abc.supabase.co'));
  });
});

describe('guard rule (a): production-host', () => {
  it('fires when the target host matches the production URL exactly', () => {
    const result = checkDisposableBackend(
      cleanInput({ targetHost: 'https://production-project.supabase.co' }),
    );
    expectSingleRule(result, 'production-host');
  });

  it('fires on scheme/port/case-equivalent forms of the production URL', () => {
    for (const equivalent of [
      'production-project.supabase.co',
      'HTTPS://production-project.supabase.co:443/',
      'https://PRODUCTION-PROJECT.supabase.co.',
    ]) {
      expectSingleRule(
        checkDisposableBackend(cleanInput({ targetHost: equivalent })),
        'production-host',
      );
    }
  });

  it('does not fire for an unrelated host', () => {
    const result = checkDisposableBackend(cleanInput());
    expect(result.ok).toBe(true);
  });

  it('is vacuous (never fires) when no production hosts are configured', () => {
    const result = checkDisposableBackend(cleanInput({ productionHosts: [] }));
    expect(result.rules).not.toContain('production-host');
  });
});

describe('guard rule (b): production-credentials', () => {
  it('fires when EXPO_PUBLIC_SUPABASE_URL is present in the ambient shell', () => {
    const result = checkDisposableBackend(
      cleanInput({ ambientEnv: { EXPO_PUBLIC_SUPABASE_URL: 'https://anything.supabase.co' } }),
    );
    expectSingleRule(result, 'production-credentials');
  });

  it('fires when only EXPO_PUBLIC_SUPABASE_ANON_KEY is present', () => {
    const result = checkDisposableBackend(
      cleanInput({ ambientEnv: { EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOi...' } }),
    );
    expectSingleRule(result, 'production-credentials');
  });

  it('fires for extra configured credential keys', () => {
    const result = checkDisposableBackend(
      cleanInput({
        ambientEnv: { SUPABASE_SERVICE_ROLE_KEY: 'super-secret' },
        credentialEnvKeys: [...DEFAULT_CREDENTIAL_ENV_KEYS, 'SUPABASE_SERVICE_ROLE_KEY'],
      }),
    );
    expectSingleRule(result, 'production-credentials');
  });

  it('does not fire for empty-string or whitespace-only values', () => {
    const result = checkDisposableBackend(
      cleanInput({
        ambientEnv: { EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('does not fire in a clean shell', () => {
    const result = checkDisposableBackend(cleanInput());
    expect(result.ok).toBe(true);
  });
});

describe('guard rule (c): disposable-marker', () => {
  it('fires when no project is targeted (targetProjectName null)', () => {
    const result = checkDisposableBackend(cleanInput({ targetProjectName: null }));
    expectSingleRule(result, 'disposable-marker');
  });

  it('fires when the project name lacks the disposable marker prefix', () => {
    const result = checkDisposableBackend(
      cleanInput({ targetProjectName: 'superhabits-production-foo' }),
    );
    expectSingleRule(result, 'disposable-marker');
  });

  it('fires when the marker prefix is not configured', () => {
    const result = checkDisposableBackend(cleanInput({ disposableMarkerPrefix: '' }));
    expectSingleRule(result, 'disposable-marker');
  });

  it('passes when the project name carries the marker prefix', () => {
    const result = checkDisposableBackend(cleanInput());
    expect(result.rules).not.toContain('disposable-marker');
    expect(result.ok).toBe(true);
  });
});

describe('guard composition', () => {
  it('reports every firing rule, not just the first', () => {
    const result = checkDisposableBackend(
      cleanInput({
        targetHost: 'https://production-project.supabase.co',
        ambientEnv: { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' },
        targetProjectName: 'prod-project',
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.rules).toEqual([
      'production-host',
      'production-credentials',
      'disposable-marker',
    ]);
  });

  it('passes only when all three rules are satisfied', () => {
    expect(isDisposableBackendAllowed(cleanInput())).toBe(true);
  });
});

describe('assertDisposableBackend', () => {
  it('throws an Error naming the fired rule', () => {
    let caught: unknown;
    try {
      assertDisposableBackend(cleanInput({ targetProjectName: 'prod-project' }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('disposable-marker');
  });

  it('aborts before returning when the target host matches production', () => {
    let caught: unknown;
    try {
      assertDisposableBackend(cleanInput({ targetHost: PRODUCTION_HOST }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('production-host');
  });

  it('does not throw for a clean disposable input', () => {
    expect(() => assertDisposableBackend(cleanInput())).not.toThrow();
  });
});
