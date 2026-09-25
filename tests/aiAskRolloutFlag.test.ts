import { afterEach, describe, expect, it, vi } from 'vitest';

const originalValue = process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;

afterEach(() => {
  if (originalValue === undefined) delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
  else process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = originalValue;
  vi.resetModules();
});

describe('Ask rollout flag', () => {
  it('hides Ask and Auto in ordinary builds', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT;
    vi.resetModules();
    const { AI_ASK_EXPERIMENT_ENABLED } = await import('@/features/command/types');
    expect(AI_ASK_EXPERIMENT_ENABLED).toBe(false);
  });

  it('allows the explicit internal build opt-in only', async () => {
    process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = 'false';
    vi.resetModules();
    const disabled = await import('@/features/command/types');
    expect(disabled.AI_ASK_EXPERIMENT_ENABLED).toBe(false);

    process.env.EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT = 'true';
    vi.resetModules();
    const enabled = await import('@/features/command/types');
    expect(enabled.AI_ASK_EXPERIMENT_ENABLED).toBe(true);
  });
});
