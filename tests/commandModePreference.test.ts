import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLastUsedCommandMode,
  resetLastUsedCommandModeCache,
  setLastUsedCommandMode,
} from '@/features/command/commandModePreference';

const { getItem, setItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem, setItem },
}));

describe('features/command/commandModePreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLastUsedCommandModeCache();
  });

  it('defaults to auto when no value is stored', async () => {
    getItem.mockResolvedValue(null);

    await expect(getLastUsedCommandMode()).resolves.toBe('auto');
    expect(getItem).toHaveBeenCalledWith('superhabits.command.last-used-mode');
  });

  it('defaults to auto when the stored value is unrecognized', async () => {
    getItem.mockResolvedValue('not-a-real-mode');

    await expect(getLastUsedCommandMode()).resolves.toBe('auto');
  });

  it('reads a previously persisted mode', async () => {
    getItem.mockResolvedValue('ask');

    await expect(getLastUsedCommandMode()).resolves.toBe('ask');
  });

  it('round-trips a mode through setLastUsedCommandMode/getLastUsedCommandMode', async () => {
    setItem.mockResolvedValue(undefined);

    await setLastUsedCommandMode('create');

    expect(setItem).toHaveBeenCalledWith('superhabits.command.last-used-mode', 'create');
    await expect(getLastUsedCommandMode()).resolves.toBe('create');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('caches reads so AsyncStorage is only hit once per process', async () => {
    getItem.mockResolvedValue('auto');

    await getLastUsedCommandMode();
    await getLastUsedCommandMode();

    expect(getItem).toHaveBeenCalledTimes(1);
  });
});
