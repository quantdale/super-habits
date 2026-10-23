import { describe, expect, it, beforeEach } from 'vitest';
import {
  classifyStorageError,
  describeStorageFailure,
  estimateStoragePressure,
  getSaveFailureMessage,
  isStorageFailure,
  requestPersistentStorage,
  resetPersistentStorageRequestForTests,
  StorageWriteError,
  STORAGE_PRESSURE_THRESHOLDS,
  rethrowDurableWriteError,
  type StorageManagerLike,
} from '@/core/storage/storageSafety';

/**
 * CORR-A-02 storage-safety contract. These tests are deliberately
 * discriminating: each negative scenario constructs the platform failure and
 * asserts the EXACT behavior that protects user data (classified, actionable,
 * never a false success, never "clear site data" advice).
 */

function quotaError(): Error {
  // Shape of a real Chromium QuotaExceededError (DOMException).
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  return error;
}

function domError(name: string, code?: number): Error {
  const error = new Error(name);
  error.name = name;
  if (code !== undefined) (error as Error & { code: number }).code = code;
  return error;
}

describe('classifyStorageError', () => {
  it('classifies QuotaExceededError by name (mandatory scenario 1 shape)', () => {
    expect(classifyStorageError(quotaError())).toBe('quota');
    expect(isStorageFailure(quotaError())).toBe(true);
  });

  it('classifies legacy quota code 22 only on DOMException shapes, plus full-disk messages', () => {
    // Legacy DOMException shape: numeric code 22 with the DOM name.
    expect(classifyStorageError(domError('DOMException', 22))).toBe('quota');
    // SQLite's primary code 22 is SQLITE_NOLFS — unrelated to quota. A
    // non-DOMException carrying code 22 must NOT become a storage emergency
    // (final review P2: the old check misclassified it).
    expect(classifyStorageError(domError('SQLiteError', 22))).toBe('unknown');
    // Legacy Firefox quota rejection shape.
    expect(classifyStorageError(domError('NS_ERROR_DOM_QUOTA_REACHED'))).toBe('quota');
    // Full-disk phrasing is quota; bare 'quota' wording (e.g. a REMOTE AI
    // request-quota error) is deliberately NOT.
    expect(classifyStorageError(new Error('database or disk is full'))).toBe('quota');
    expect(classifyStorageError(new Error('SQLITE_FULL: disk I/O error'))).toBe('quota');
    expect(classifyStorageError(new Error('AI request quota exhausted'))).toBe('unknown');
  });

  it('classifies blocked storage access (mandatory scenario 7 shape)', () => {
    expect(classifyStorageError(domError('SecurityError'))).toBe('storage-access');
    expect(classifyStorageError(domError('NotAllowedError'))).toBe('storage-access');
    expect(classifyStorageError(domError('NotSupportedError'))).toBe('unavailable');
  });

  it('keeps ordinary application errors unclassified and untouched', () => {
    const appError = new Error('title is required');
    expect(classifyStorageError(appError)).toBe('unknown');
    expect(isStorageFailure(appError)).toBe(false);
    expect(() => rethrowDurableWriteError(appError, 'todo save')).toThrow(appError);
  });

  it('never advises clearing site data in any failure message', () => {
    for (const kind of ['quota', 'storage-access', 'unavailable', 'unknown'] as const) {
      const message = describeStorageFailure(kind);
      expect(message).not.toMatch(/clear(ing)? (site|browser) data/i);
      expect(message).toMatch(/not saved/i);
    }
  });
});

describe('getSaveFailureMessage', () => {
  it('replaces raw quota errors with actionable copy', () => {
    const message = getSaveFailureMessage(quotaError(), 'fallback');
    expect(message).toMatch(/Storage is full/);
    expect(message).toMatch(/Portable data/);
    expect(message).not.toMatch(/fallback/);
    expect(message).not.toMatch(/quota has been exceeded/i);
  });

  it('keeps ordinary error messages and uses the fallback when absent', () => {
    expect(getSaveFailureMessage(new Error('title is required'), 'fallback')).toBe(
      'title is required',
    );
    expect(getSaveFailureMessage(new Error(''), 'Could not save.')).toBe('Could not save.');
    expect(getSaveFailureMessage('weird', 'Could not save.')).toBe('Could not save.');
  });
});

describe('rethrowDurableWriteError', () => {
  it('throws a classified StorageWriteError with kind + cause for storage failures', () => {
    const cause = quotaError();
    let thrown: unknown;
    try {
      rethrowDurableWriteError(cause, 'workout save');
      expect.unreachable('must throw');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StorageWriteError);
    const storageError = thrown as StorageWriteError;
    expect(storageError.kind).toBe('quota');
    expect(storageError.action).toBe('workout save');
    expect(storageError.cause).toBe(cause);
    expect(storageError.message).toMatch(/Storage is full/);
  });

  it('rethrows non-storage errors UNWRAPPED (the exact original)', () => {
    const appError = new Error('title is required');
    expect(() => rethrowDurableWriteError(appError, 'x')).toThrow(appError);
    try {
      rethrowDurableWriteError(appError, 'x');
    } catch (error) {
      expect(error).toBe(appError);
    }
  });

  it('is idempotent: nested transactional layers never double-wrap', () => {
    let once: StorageWriteError | undefined;
    try {
      rethrowDurableWriteError(quotaError(), 'inner');
    } catch (error) {
      once = error as StorageWriteError;
    }
    expect(once).toBeInstanceOf(StorageWriteError);
    try {
      rethrowDurableWriteError(once, 'outer');
      expect.unreachable('must throw');
    } catch (error) {
      expect(error).toBe(once);
    }
  });
});

describe('estimateStoragePressure (mandatory scenario 5)', () => {
  it('returns unknown/unavailable when the estimate API is missing', async () => {
    expect(await estimateStoragePressure({})).toEqual({
      status: 'unknown',
      reason: 'unavailable',
    });
    expect(await estimateStoragePressure(null)).toEqual({
      status: 'unknown',
      reason: 'unavailable',
    });
  });

  it('returns unknown/error when the estimate call rejects instead of throwing', async () => {
    const manager: StorageManagerLike = {
      estimate: () => Promise.reject(new Error('probe blocked')),
    };
    expect(await estimateStoragePressure(manager)).toEqual({
      status: 'unknown',
      reason: 'error',
    });
  });

  it('returns unknown/incomplete when the estimate carries no numbers', async () => {
    const manager: StorageManagerLike = { estimate: async () => ({}) };
    expect(await estimateStoragePressure(manager)).toEqual({
      status: 'unknown',
      reason: 'incomplete',
    });
  });

  it('warns at the documented thresholds and reports free space', async () => {
    const t = STORAGE_PRESSURE_THRESHOLDS;
    const ok = await estimateStoragePressure({
      estimate: async () => ({ usage: 1_000, quota: 1_000_000_000 }),
    });
    expect(ok.status).toBe('ok');

    const warnRatio = await estimateStoragePressure({
      estimate: async () => ({ usage: t.warnUsageRatio * 1_000_000_000, quota: 1_000_000_000 }),
    });
    expect(warnRatio.status).toBe('warn');

    const criticalRatio = await estimateStoragePressure({
      estimate: async () => ({
        usage: t.criticalUsageRatio * 1_000_000_000,
        quota: 1_000_000_000,
      }),
    });
    expect(criticalRatio.status).toBe('critical');

    const warnFree = await estimateStoragePressure({
      estimate: async () => ({ usage: 0, quota: t.warnFreeBytes - 1 }),
    });
    expect(warnFree.status).toBe('warn');

    const criticalFree = await estimateStoragePressure({
      estimate: async () => ({ usage: 0, quota: t.criticalFreeBytes - 1 }),
    });
    expect(criticalFree.status).toBe('critical');
    expect(criticalFree.freeBytes).toBe(t.criticalFreeBytes - 1);
  });
});

describe('requestPersistentStorage (mandatory scenario 6)', () => {
  beforeEach(() => {
    resetPersistentStorageRequestForTests();
  });

  it('reports unavailable when the persistence API is missing', async () => {
    await expect(requestPersistentStorage({})).resolves.toBe('unavailable');
  });

  it('reports denied without throwing when the request is rejected', async () => {
    const manager: StorageManagerLike = {
      persist: async () => false,
      persisted: async () => false,
    };
    await expect(requestPersistentStorage(manager)).resolves.toBe('denied');
  });

  it('reports error without throwing when the request throws', async () => {
    const manager: StorageManagerLike = {
      persist: () => Promise.reject(new Error('prompt failed')),
      persisted: () => Promise.reject(new Error('probe failed')),
    };
    await expect(requestPersistentStorage(manager)).resolves.toBe('error');
  });

  it('skips the prompt entirely when persistence is already granted', async () => {
    let persistCalls = 0;
    const manager: StorageManagerLike = {
      persist: async () => {
        persistCalls += 1;
        return true;
      },
      persisted: async () => true,
    };
    await expect(requestPersistentStorage(manager)).resolves.toBe('already-granted');
    expect(persistCalls).toBe(0);
  });

  it('memoizes the request across calls (one prompt per app run)', async () => {
    let persistCalls = 0;
    const manager: StorageManagerLike = {
      persist: async () => {
        persistCalls += 1;
        return true;
      },
    };
    await expect(requestPersistentStorage(manager)).resolves.toBe('granted');
    await expect(requestPersistentStorage(manager)).resolves.toBe('granted');
    expect(persistCalls).toBe(1);
  });
});
