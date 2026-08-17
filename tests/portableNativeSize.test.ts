import { afterEach, describe, expect, it, vi } from 'vitest';
import { PORTABLE_V1_MAX_BYTES } from '@/core/portable/portable.types';
import {
  pickPortableFileNative,
  readNativePortableAsset,
  readPickedPortableFileWeb,
} from '@/core/portable/portableFileIo';

/**
 * Portable V1 size-safety seams (Finding 2/3 closure).
 *
 * The unit project runs on Platform.OS = 'ios', so these tests exercise the
 * NATIVE pre-read gate plus the shared web gate. The size bound is replaced
 * with a small deterministic 1 KiB value so the post-read byte defense can be
 * proven without allocating a >100 MB string; the REAL
 * `PORTABLE_V1_MAX_BYTES + 1` rejection is covered by the integration
 * corruption suite against the actual constant.
 */
vi.mock('@/core/portable/portable.types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/portable/portable.types')>();
  return { ...actual, PORTABLE_V1_MAX_BYTES: 1024 };
});

const MAX = PORTABLE_V1_MAX_BYTES;

const documentPickerMock = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
}));

const fileSystemMock = vi.hoisted(() => {
  const instances: unknown[] = [];
  class FakeFile {
    uri: string;
    size = 0;
    text = vi.fn(async () => '{}');
    constructor(uri: string) {
      this.uri = uri;
      instances.push(this);
    }
    info(): { size?: number } {
      return { size: this.size };
    }
  }
  return {
    instances,
    File: FakeFile,
    Paths: { cache: '/cache' },
  };
});

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: documentPickerMock.getDocumentAsync,
}));

vi.mock('expo-file-system', () => ({
  File: fileSystemMock.File,
  Paths: fileSystemMock.Paths,
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(true),
  shareAsync: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  documentPickerMock.getDocumentAsync.mockReset();
  fileSystemMock.instances.length = 0;
});

describe('readNativePortableAsset — pre-read size gate', () => {
  it('rejects a file reported at MAX + 1 without ever reading the body', async () => {
    const text = vi.fn(async () => 'must never be read');
    const file = { name: 'big.json', size: 0, info: () => ({ size: undefined }), text };
    const result = await readNativePortableAsset(
      { name: 'big.json', uri: 'file://big', size: MAX + 1 },
      file,
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/can safely import/);
    expect(text).not.toHaveBeenCalled();
  });

  it('allows a read when the file is exactly at the maximum', async () => {
    const text = vi.fn(async () => '{}');
    const file = { name: 'exact.json', size: 0, info: () => ({ size: undefined }), text };
    const result = await readNativePortableAsset(
      { name: 'exact.json', uri: 'file://exact', size: MAX },
      file,
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.byteLength).toBe(2);
      expect(text).toHaveBeenCalledTimes(1);
    }
  });

  it('allows a read when the file is one byte below the maximum', async () => {
    const text = vi.fn(async () => '{}');
    const file = { name: 'small.json', size: 0, info: () => ({ size: undefined }), text };
    const result = await readNativePortableAsset(
      { name: 'small.json', uri: 'file://small', size: MAX - 1 },
      file,
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) expect(text).toHaveBeenCalledTimes(1);
  });

  it('rejects when metadata under-reports but the UTF-8 body exceeds the bound', async () => {
    const text = vi.fn(async () => 'x'.repeat(MAX + 1));
    const file = { name: 'sneaky.json', size: 0, info: () => ({ size: undefined }), text };
    const result = await readNativePortableAsset(
      { name: 'sneaky.json', uri: 'file://sneaky', size: 512 },
      file,
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/can safely import/);
    // Post-read defense: the body WAS read, but the byte count still rejected it.
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('falls back to File metadata when the picker reports no size', async () => {
    const text = vi.fn(async () => '{}');
    const file = { name: 'stat.json', size: 0, info: () => ({ size: 128 }), text };
    const result = await readNativePortableAsset(
      { name: 'stat.json', uri: 'file://stat', size: undefined },
      file,
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) expect(text).toHaveBeenCalledTimes(1);
  });

  it('rejects via File.size when info() is unavailable and the file exceeds the bound', async () => {
    const text = vi.fn(async () => '{}');
    const file = { name: 'stat2.json', size: MAX + 1, info: () => ({ size: undefined }), text };
    const result = await readNativePortableAsset(
      { name: 'stat2.json', uri: 'file://stat2', size: null },
      file,
    );
    expect('error' in result).toBe(true);
    expect(text).not.toHaveBeenCalled();
  });

  it('fails conservatively when no platform reports a measurable size', async () => {
    const text = vi.fn(async () => '{}');
    const file = {
      name: 'unknown.json',
      size: 0,
      info: () => {
        throw new Error('stat failed');
      },
      text,
    };
    const result = await readNativePortableAsset(
      { name: 'unknown.json', uri: 'file://unknown', size: undefined },
      file,
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/could not be measured safely/);
    expect(text).not.toHaveBeenCalled();
  });
});

describe('pickPortableFileNative — real picker pipeline', () => {
  it('rejects an oversized selection without invoking the file body read', async () => {
    documentPickerMock.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'huge.json', uri: 'file://huge', size: MAX + 1 }],
    });
    const result = await pickPortableFileNative();
    expect(result).not.toBeNull();
    if (result !== null && 'error' in result) {
      expect(result.error).toMatch(/can safely import/);
    }
    expect(fileSystemMock.instances).toHaveLength(1);
    const created = fileSystemMock.instances[0] as { text: ReturnType<typeof vi.fn> };
    expect(created.text).not.toHaveBeenCalled();
  });

  it('returns null when the user cancels the picker', async () => {
    documentPickerMock.getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    expect(await pickPortableFileNative()).toBeNull();
  });

  it('reads a normal valid file through the real pipeline', async () => {
    documentPickerMock.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'ok.json', uri: 'file://ok', size: 128 }],
    });
    const result = await pickPortableFileNative();
    expect(result).not.toBeNull();
    if (result !== null && !('error' in result)) {
      expect(result.name).toBe('ok.json');
      expect(result.text).toBe('{}');
      expect(result.byteLength).toBe(2);
    }
  });
});

describe('readPickedPortableFileWeb — web pre-read gate', () => {
  it('rejects an oversized web file before text() is invoked', async () => {
    const text = vi.fn(async () => '{}');
    const result = await readPickedPortableFileWeb({
      name: 'big.json',
      size: MAX + 1,
      text,
    } as unknown as File);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/can safely import/);
    expect(text).not.toHaveBeenCalled();
  });

  it('applies the post-read byte defense on web too', async () => {
    const text = vi.fn(async () => 'y'.repeat(MAX + 1));
    const result = await readPickedPortableFileWeb({
      name: 'sneaky.json',
      size: 256,
      text,
    } as unknown as File);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/can safely import/);
  });
});
