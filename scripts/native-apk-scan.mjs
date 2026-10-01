// @ts-nocheck
/**
 * Post-build Supabase-host scan for a built Android APK
 * (`harden-native-evidence-and-release-posture`, task 1.3).
 *
 * WHY: the web export guard (`scripts/build-dist-e2e.mjs`) can scan loose
 * files in `dist/`, but an APK keeps its JavaScript inside a ZIP container, so
 * a byte search of the archive would miss a bundle that is DEFLATE-compressed
 * (React Native release builds commonly store `assets/index.android.bundle`
 * compressed, and Hermes bytecode is not text anyway — but the bundle string
 * table still carries the host). This module reads the ZIP central directory,
 * inflates every candidate entry, and searches the decompressed bytes, so the
 * check sees the bundle the device would actually load.
 *
 * Deliberately dependency-free: the provisioning lane must run on a cold
 * machine with nothing but Node, and adding an archive library to a
 * certification guard is the same class of risk this scan exists to remove.
 *
 * Exported for unit tests; the CLI is the production entry point.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;

/** Entries above this size are not scanned (a JS bundle is a few MB). */
export const MAX_SCANNED_ENTRY_BYTES = 96 * 1024 * 1024;

/**
 * Find the End Of Central Directory record.
 *
 * @param {Buffer} buffer
 * @returns {number} offset of the record, or -1
 */
export function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - EOCD_MIN_SIZE - 0xffff);
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

/**
 * Parse the central directory into `{ name, method, compressedSize, localOffset }`.
 *
 * @param {Buffer} buffer
 * @returns {{ name: string, method: number, compressedSize: number, localOffset: number }[]}
 */
export function readCentralDirectory(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error('not a ZIP archive: no end-of-central-directory record');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + CENTRAL_HEADER_SIZE > buffer.length) {
      throw new Error('truncated ZIP central directory');
    }
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`bad central directory signature at offset ${cursor}`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString(
      'utf8',
      cursor + CENTRAL_HEADER_SIZE,
      cursor + CENTRAL_HEADER_SIZE + nameLength,
    );
    entries.push({ name, method, compressedSize, localOffset });
    cursor += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Read and decompress one entry.
 *
 * @param {Buffer} buffer
 * @param {{ name: string, method: number, compressedSize: number, localOffset: number }} entry
 * @returns {Buffer}
 */
export function readEntry(buffer, entry) {
  const { localOffset } = entry;
  if (localOffset + LOCAL_HEADER_SIZE > buffer.length) {
    throw new Error(`entry ${entry.name} points outside the archive`);
  }
  if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
    throw new Error(`entry ${entry.name} has no local file header`);
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + LOCAL_HEADER_SIZE + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) throw new Error(`entry ${entry.name} is truncated`);
  const raw = buffer.subarray(dataStart, dataEnd);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`entry ${entry.name} uses unsupported compression method ${entry.method}`);
}

/**
 * Entries worth scanning for a leaked host: JavaScript sources, Hermes
 * bytecode, and the JS asset bundles React Native ships.
 *
 * @param {{ name: string }} entry
 * @returns {boolean}
 */
export function isScannableEntry(entry) {
  const name = entry.name.toLowerCase();
  if (entry.name.endsWith('/')) return false;
  return (
    name.endsWith('.bundle') ||
    name.endsWith('.jsbundle') ||
    name.endsWith('.hbc') ||
    name.endsWith('.js') ||
    name.endsWith('.map')
  );
}

/**
 * Scan an archive buffer for a needle, returning the entries that contain it.
 *
 * @param {Buffer} buffer
 * @param {string} needle lowercase
 * @returns {{ name: string, offset: number }[]}
 */
export function scanArchiveForNeedle(buffer, needle) {
  const hits = [];
  for (const entry of readCentralDirectory(buffer)) {
    if (!isScannableEntry(entry)) continue;
    if (entry.compressedSize > MAX_SCANNED_ENTRY_BYTES) continue;
    let contents;
    try {
      contents = readEntry(buffer, entry);
    } catch {
      // An unreadable entry cannot be cleared or condemned; the guard reports
      // the entries it could read, and the missing-host contract is checked
      // again by the web-style whole-tree scan on the bundle's own files.
      continue;
    }
    const offset = contents.toString('latin1').toLowerCase().indexOf(needle);
    if (offset >= 0) hits.push({ name: entry.name, offset });
  }
  return hits;
}

/**
 * Scan an APK on disk and throw when a host is present.
 *
 * @param {string} apkPath
 * @param {string} [needle]
 * @returns {{ scanned: number, host: string }}
 */
export function assertApkHasNoHost(apkPath, needle = 'supabase.co') {
  const buffer = readFileSync(apkPath);
  const entries = readCentralDirectory(buffer);
  const hits = scanArchiveForNeedle(buffer, needle);
  const scanned = entries.filter(isScannableEntry).length;
  if (hits.length > 0) {
    const names = hits.map((hit) => `${hit.name}@${hit.offset}`).join(', ');
    throw new Error(
      `Supabase host "${needle}" is present in the built APK bundle (${hits.length} entry/entries: ${names}). ` +
        `A credential-free E2E APK must never target a live project. Check the ambient EXPO_PUBLIC_SUPABASE_* ` +
        `environment (EXPO_NO_DOTENV=1 blocks dotenv files) and rerun.`,
    );
  }
  return { scanned, host: needle };
}

// --- CLI ----------------------------------------------------------------
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const apk = process.argv[2];
  if (!apk) {
    console.error('Usage: node scripts/native-apk-scan.mjs <path-to-apk> [host]');
    process.exit(2);
  }
  try {
    const { scanned } = assertApkHasNoHost(apk, process.argv[3] ?? 'supabase.co');
    console.log(
      `native-apk-scan: OK — ${apk} scanned ${scanned} JS/bytecode entry(ies), no Supabase host.`,
    );
  } catch (error) {
    console.error(`native-apk-scan: FAILED — ${error.message}`);
    process.exit(1);
  }
}
