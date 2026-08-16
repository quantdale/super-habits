import { Platform } from 'react-native';
import { getDocumentAsync } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PORTABLE_IMPORT_MAX_BYTES } from '@/core/portable/portable.types';

/**
 * Platform file I/O for portable backups.
 *
 * Web: pure DOM — Blob + object URL + anchor download for export; a hidden
 * `<input type="file">` triggered by an explicit user action for import. No
 * server, no upload, no auto-scan.
 *
 * Native: `expo-file-system` cache `File` + `expo-sharing` share sheet for
 * export (temporary file cleaned up best-effort after the share completes);
 * `expo-document-picker` for import (explicit user selection only).
 */

export const PORTABLE_MIME_TYPE = 'application/json';

export type PortablePickedFile = {
  name: string;
  /** Parsed text content (validated separately by the import pipeline). */
  text: string;
  byteLength: number;
};

/** Web: trigger a browser download of the generated file. */
export function savePortableFileOnWeb(fileName: string, json: string): void {
  const blob = new Blob([json], { type: PORTABLE_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; a delayed
  // revoke keeps the object URL alive long enough while still cleaning up.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Native: write the portable file to the app cache and open the system
 * share/save surface. The cache file is removed when the share completes;
 * deletion is best-effort so a share target that reads asynchronously cannot
 * be broken by a failed cleanup.
 */
export async function savePortableFileNative(fileName: string, json: string): Promise<void> {
  const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
  file.create({ overwrite: true, intermediates: true });
  file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: PORTABLE_MIME_TYPE,
      dialogTitle: 'Export Super Habits backup',
      UTI: 'public.json',
    });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
  try {
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup; a leftover cache file is harmless.
  }
}

/** Web: read an explicitly selected file, bounded by the import size limit. */
export async function readPickedPortableFileWeb(
  file: File,
): Promise<PortablePickedFile | { error: string }> {
  if (file.size > PORTABLE_IMPORT_MAX_BYTES) {
    return {
      error: `This file is ${formatBytes(file.size)}; the import limit is ${formatBytes(
        PORTABLE_IMPORT_MAX_BYTES,
      )}.`,
    };
  }
  const text = await file.text();
  return { name: file.name, text, byteLength: utf8ByteLength(text) };
}

/**
 * Native: open the system document picker for explicit file selection and
 * read the picked file, bounded by the import size limit.
 */
export async function pickPortableFileNative(): Promise<
  PortablePickedFile | { error: string } | null
> {
  const result = await getDocumentAsync({
    type: PORTABLE_MIME_TYPE,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  const file = new FileSystem.File(asset.uri);
  const text = await file.text();
  const byteLength = utf8ByteLength(text);
  if (byteLength > PORTABLE_IMPORT_MAX_BYTES) {
    return {
      error: `This file is ${formatBytes(byteLength)}; the import limit is ${formatBytes(
        PORTABLE_IMPORT_MAX_BYTES,
      )}.`,
    };
  }
  return { name: asset.name ?? file.name, text, byteLength };
}

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when the platform uses the native (non-web) file paths. */
export function isNativePortablePlatform(): boolean {
  return Platform.OS !== 'web';
}
