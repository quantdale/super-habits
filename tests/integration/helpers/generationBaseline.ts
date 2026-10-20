import type { TestDatabase } from './db';

/**
 * Integration fixture: a device whose local dataset is proven to derive from an
 * existing remote head. Tests that model an already-synced device must seed this
 * provenance; an observed head alone is deliberately not enough (`AUD-F1`).
 */
export async function seedVerifiedGenerationBaseHead(
  db: TestDatabase,
  ownerUserId: string,
  snapshotId = 'existing',
  sequence = 1,
): Promise<void> {
  const { appMetaKeys, setAppMetaJson } = await import('@/core/db/appMeta');
  await setAppMetaJson(db as never, appMetaKeys.backupVerifiedGenerationBaseHead, {
    ownerUserId,
    snapshotId,
    sequence,
  });
  await setAppMetaJson(db as never, appMetaKeys.backupObservedGenerationHead, {
    snapshotId,
    sequence,
  });
}
