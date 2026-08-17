import { describe, expect, it, vi } from 'vitest';

/**
 * Portable V1 export/import round-trip size contract (Finding 3 closure).
 *
 * Every SUCCESSFUL V1 export must fit within the shared V1 size bound. The
 * first test proves the oversized path by temporarily replacing
 * `PORTABLE_V1_MAX_BYTES` with a 10-byte bound (the mechanism is identical
 * for the real 100 MB bound — no dataset of that size can exist in tests);
 * the second test proves an ordinary export still succeeds against the real
 * bound. The mocked database returns an empty dataset, which is sufficient:
 * the size decision happens on the serialized envelope.
 */

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock.impl,
}));

const dbStub = {
  execAsync: vi.fn().mockResolvedValue(undefined),
  runAsync: vi.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 0 }),
  getAllAsync: vi.fn().mockResolvedValue([]),
  getFirstAsync: vi.fn().mockResolvedValue(null),
  withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
    await task();
  }),
  closeAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/core/db/client', () => ({
  getDatabase: vi.fn().mockResolvedValue(dbStub),
}));

describe('portable export round-trip size contract', () => {
  it('fails with reason too_large instead of producing a file beyond the V1 bound', async () => {
    vi.resetModules();
    vi.doMock('@/core/portable/portable.types', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/core/portable/portable.types')>();
      return { ...actual, PORTABLE_V1_MAX_BYTES: 10 };
    });
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const result = await exportPortableBackup();
    expect(result.ok).toBe(false);
    if (!result.ok && 'reason' in result) {
      expect(result.reason).toBe('too_large');
      expect(result.maxBytes).toBe(10);
      expect(result.byteLength).toBeGreaterThan(10);
      expect(result.error).toMatch(/larger than Portable Backup V1/);
      expect(result.error).toMatch(/No portable file was created/);
      expect(result.error).toMatch(/Your local data was not changed/);
    }
  });

  it('succeeds within the real V1 bound', async () => {
    vi.resetModules();
    vi.doUnmock('@/core/portable/portable.types');
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const result = await exportPortableBackup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.byteLength).toBeGreaterThan(0);
      expect(result.byteLength).toBeLessThanOrEqual(100 * 1024 * 1024);
    }
  });
});
