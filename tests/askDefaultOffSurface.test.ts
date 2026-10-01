import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The provider seam, mocked the way tests/askParser.test.ts mocks it, so the
// rollout lock is exercised against a CONFIGURED remote rather than a missing
// one (a missing remote would make the test pass for the wrong reason).
const provider = vi.hoisted(() => ({
  getSupabaseAccessToken: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseFunctionUrl: vi.fn(() => 'https://example.supabase.co/functions/v1/user-ai-ask'),
}));
vi.mock('@/lib/supabase', () => provider);

/**
 * Ask and Auto are default-OFF, asserted at the RENDER BOUNDARY and at the
 * provider boundary (OpenSpec change `harden-native-evidence-and-release-posture`,
 * spec requirement "Ask and Auto are default-off" and "No paid provider call is
 * reachable without the rollout flag").
 *
 * The spec is explicit about what does NOT count: asserting the flag constant
 * alone. A refactor that keeps `AI_ASK_EXPERIMENT_ENABLED === false` while
 * rendering the mode selector unconditionally must fail here, so the assertions
 * are on the surface the render boundary actually builds
 * (`features/command/commandSurface.ts`, consumed by `ModeToggle.tsx` and
 * `CommandScreen.tsx`) plus a source-level check that those consumers still
 * route through it.
 */
const originalValue = process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;

// Load the provider entry point ONCE per env state at COLLECTION time.
//
// Why not inside the tests: `askParser` pulls the whole command-feature import
// graph, and a cold `import()` inside a test body is charged to that test's 5s
// budget (~6s on this host) even though no assertion work is involved. Loading
// at module scope keeps each test's time measuring the LOCK, not the loader —
// the same reason tests/askParser.test.ts imports statically.
async function loadWithRollout(value: string | undefined) {
  if (value === undefined) delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
  else process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = value;
  vi.resetModules();
  return import('@/features/command/askParser');
}

const askDisabled = await loadWithRollout(undefined);
const askEnabled = await loadWithRollout('true');
// Leave the environment as the suite found it before any test body runs.
if (originalValue === undefined) delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
else process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = originalValue;

afterEach(() => {
  if (originalValue === undefined) delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
  else process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = originalValue;
  vi.resetModules();
});

async function surfaceModule() {
  return import('@/features/command/commandSurface');
}

describe('Ask/Auto default-off: the rendered surface', () => {
  it('offers Create only, and renders no Ask or Auto view, without the flag', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
    const { commandSurface, commandModeOptions, canRenderCommandMode } = await surfaceModule();

    const surface = commandSurface(false);
    // The selector a user sees.
    expect(surface.modeOptions.map((option) => option.label)).toEqual(['Create']);
    expect(surface.modeOptions.map((option) => option.value)).toEqual(['create']);
    // The views that may render.
    expect(surface.renderableViews).toEqual(['create']);
    expect(canRenderCommandMode(false, 'ask')).toBe(false);
    expect(canRenderCommandMode(false, 'auto')).toBe(false);
    expect(canRenderCommandMode(false, 'create')).toBe(true);
    expect(commandModeOptions(false)).toHaveLength(1);
    expect(surface.askReachable).toBe(false);
    expect(surface.paidProviderReachable).toBe(false);
  });

  it('adds Ask and Auto in a rollout build with no further configuration', async () => {
    process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = 'true';
    vi.resetModules();
    const { commandSurface, canRenderCommandMode } = await surfaceModule();

    const surface = commandSurface(true);
    expect(surface.modeOptions.map((option) => option.label)).toEqual(['Ask', 'Create', 'Auto']);
    expect(surface.renderableViews.sort()).toEqual(['ask', 'auto', 'create']);
    expect(canRenderCommandMode(true, 'ask')).toBe(true);
    expect(canRenderCommandMode(true, 'auto')).toBe(true);
    expect(surface.paidProviderReachable).toBe(true);
  });

  it('never restores a hidden ask/auto mode into an ordinary build', async () => {
    const { resolveRenderedMode } = await surfaceModule();
    // A persisted mode from a rollout build would leave the user in a view
    // whose selector chips are absent — an inescapable screen.
    expect(resolveRenderedMode(false, 'ask')).toBe('create');
    expect(resolveRenderedMode(false, 'auto')).toBe('create');
    expect(resolveRenderedMode(false, null)).toBe('create');
    expect(resolveRenderedMode(false, 'create')).toBe('create');
    // In a rollout build the persisted mode is honored.
    expect(resolveRenderedMode(true, 'auto')).toBe('auto');
    expect(resolveRenderedMode(true, 'ask')).toBe('ask');
  });

  it('the render boundary actually consumes the surface (guard is not a parallel copy)', () => {
    const commandScreen = readFileSync(
      resolve(__dirname, '..', 'features', 'command', 'CommandScreen.tsx'),
      'utf8',
    );
    const modeToggle = readFileSync(
      resolve(__dirname, '..', 'features', 'command', 'ModeToggle.tsx'),
      'utf8',
    );
    // The chips come from the pure surface, not from a local constant list.
    expect(modeToggle).toContain("from './commandSurface'");
    expect(modeToggle).toContain('commandModeOptions(AI_ASK_EXPERIMENT_ENABLED)');
    // The Ask/Auto branches and the persisted-mode restore consult the same
    // reachability decision.
    expect(commandScreen).toContain("from './commandSurface'");
    expect(commandScreen).toContain('canRenderCommandMode(AI_ASK_EXPERIMENT_ENABLED');
    expect(commandScreen).toContain('resolveRenderedMode(AI_ASK_EXPERIMENT_ENABLED');
    // The early return that hides the whole selector must remain.
    expect(commandScreen).toMatch(/if \(!AI_ASK_EXPERIMENT_ENABLED\) \{\s*return/);
  });
});

describe('Ask/Auto default-off: no paid provider request is reachable', () => {
  it('refuses the request at the provider choke point without the flag', async () => {
    // The module was loaded with the flag ABSENT (see the collection-time load
    // above), which is the ordinary-build case.
    const fetchSpy = vi.fn(() => {
      throw new Error('fetch must not be called in a build without the rollout flag');
    });
    vi.stubGlobal('fetch', fetchSpy);
    provider.getSupabaseFunctionUrl.mockClear();

    const { callAskFunction } = askDisabled;
    const outcome = await callAskFunction({ question: 'how am I doing?', stage: 'classify' });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.result.outcome).toBe('unavailable');
    expect(outcome.result.reasonCode).toBe('rollout_disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
    // The lock runs BEFORE configuration is even consulted, so a configured
    // remote cannot be what makes the request disappear.
    expect(provider.getSupabaseFunctionUrl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does attempt the request in a rollout build (the lock is the flag, not a stub)', async () => {
    // The module was loaded with the flag SET (collection-time load above).
    // A configured remote plus a fetch stub: the rollout build must get PAST
    // the lock and actually call the provider. That is what makes the previous
    // test a real lock rather than a permanently-refusing stub.
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ answer: 'ok', intent: { kind: 'summary' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    provider.getSupabaseAnonKey.mockReturnValue('anon-key');
    provider.getSupabaseAccessToken.mockResolvedValue('access-token');

    const { callAskFunction } = askEnabled;
    const outcome = await callAskFunction({ question: 'how am I doing?', stage: 'classify' });

    expect(fetchSpy, 'the rollout build never reached the provider').toHaveBeenCalled();
    if (!outcome.ok) {
      // Any non-rollout outcome proves the lock was passed; the response body is
      // a fixture, not the subject of this test.
      expect(outcome.result.reasonCode).not.toBe('rollout_disabled');
    }
    vi.unstubAllGlobals();
  });

  it('every Ask/Auto request path goes through the locked entry point', () => {
    // If a future screen called the provider directly, the lock would be
    // bypassed. No view or router may fetch; the parser is the only fetcher,
    // and its fetch sits downstream of the lock.
    for (const parts of [
      ['features', 'command', 'AutoModeView.tsx'],
      ['features', 'command', 'AskConversationView.tsx'],
      ['features', 'command', 'autoModeRouter.ts'],
    ] as const) {
      const source = readFileSync(resolve(__dirname, '..', ...parts), 'utf8');
      expect(/await\s+fetch\s*\(/.test(source), `${parts.join('/')} calls fetch directly`).toBe(
        false,
      );
    }
    const askParser = readFileSync(
      resolve(__dirname, '..', 'features', 'command', 'askParser.ts'),
      'utf8',
    );
    // The lock is inside callAskFunction, ahead of the request itself.
    const lockIndex = askParser.indexOf('if (!AI_ASK_EXPERIMENT_ENABLED)');
    const fetchIndex = askParser.indexOf('await fetchWithTimeout(');
    expect(lockIndex).toBeGreaterThan(askParser.indexOf('export async function callAskFunction'));
    expect(fetchIndex).toBeGreaterThan(lockIndex);
    expect(askParser).toContain("'rollout_disabled'");
  });
});
