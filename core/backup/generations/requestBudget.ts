/** Conservative transport budgets, measured on the actual JSON request body. */
export const GENERATION_PAYLOAD_BYTES = 128 * 1024;
export const BACKUP_REQUEST_BYTES = 512 * 1024;

/** Synthetic single-record requests share the same conservative transport cap. */
export function boundedBackupRecord<T>(row: T): T {
  boundedBackupRequests([row], 1);
  return row;
}

export function utf8Bytes(value: string): number {
  // TextEncoder is unavailable on some native runtimes. Count Unicode scalar
  // values, treating unpaired surrogates as the UTF-8 replacement character.
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Each output is bounded in rows and encoded bytes, including JSON escaping. */
export function boundedBackupRequests<T>(rows: readonly T[], maxRows: number): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let bytes = 2; // enclosing array
  for (const row of rows) {
    const size = utf8Bytes(JSON.stringify(row));
    if (size + 2 > BACKUP_REQUEST_BYTES)
      throw new Error(
        'Backup publication paused: one record exceeds the encoded request budget. Local recovery data is preserved.',
      );
    if (batch.length && (batch.length >= maxRows || bytes + 1 + size > BACKUP_REQUEST_BYTES)) {
      batches.push(batch);
      batch = [];
      bytes = 2;
    }
    bytes += (batch.length ? 1 : 0) + size;
    batch.push(row);
  }
  if (batch.length) batches.push(batch);
  return batches;
}
