/**
 * Storage-safety effects host — CORR-A-02 wiring.
 *
 * Mounted once inside the bootstrap gate (with the other hosts), after the
 * database is open. Runs the three storage-safety duties exactly once per app
 * start:
 *
 * 1. Cross-store reset detection (`reconcileStorageSentinel`) — a possible
 *    database reset surfaces as a notice pointing at backup restore.
 * 2. Storage-pressure estimate — warn/critical pressure surfaces as a notice
 *    recommending a portable backup export (tap opens Settings).
 * 3. One-shot persistent-storage request — silent durability improvement;
 *    every outcome is tolerated and none is reported as success or failure.
 *
 * Everything here is best-effort and non-blocking: a failure of any duty must
 * never break startup (all callees are non-throwing or guarded here).
 */
import { useEffect } from 'react';
import type * as SQLite from 'expo-sqlite';
import { createLinkedActionsNotice } from '@/core/linked-actions/linkedActionsNotice';
import { useInAppNotices } from '@/core/providers/inAppNoticeContext';
import {
  describeStoragePressure,
  estimateStoragePressure,
  requestPersistentStorage,
} from '@/core/storage/storageSafety';
import { getStorageResetMessage, reconcileStorageSentinel } from '@/core/storage/storageSentinel';
import { nowIso } from '@/lib/time';

export function StorageSafetyHost({
  getDatabase,
}: {
  /**
   * Dependency-injected database accessor (owned by the bootstrap orchestrator
   * in AppProviders). The host stays UI-layer: it never imports the DB client.
   *
   * NOTE: this host renders INSIDE AppProviders but ABOVE NavigationProvider
   * (NavigationProvider wraps AppProviders' children in app/_layout.tsx), so it
   * must not use `useAppNavigation` — the notices' copy names the Settings path
   * instead of navigating there on press.
   */
  getDatabase: () => Promise<SQLite.SQLiteDatabase>;
}) {
  const { showNotice } = useInAppNotices();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const db = await getDatabase();
        const verdict = await reconcileStorageSentinel({ db, nowIso: nowIso() });
        if (cancelled) return;
        if (verdict === 'possible-reset') {
          showNotice(
            createLinkedActionsNotice({
              message: getStorageResetMessage(),
              reason: 'storage_reset_detected',
              source: { feature: 'todos', entityType: 'storage' },
              target: { feature: 'todos', entityType: 'storage' },
            }),
          );
        }

        const pressure = await estimateStoragePressure();
        if (cancelled) return;
        if (pressure.status === 'warn' || pressure.status === 'critical') {
          showNotice(
            createLinkedActionsNotice({
              message: describeStoragePressure(pressure.status),
              reason: `storage_pressure_${pressure.status}`,
              source: { feature: 'todos', entityType: 'storage' },
              target: { feature: 'todos', entityType: 'storage' },
            }),
          );
        }

        // One-shot persistence request: improves durability where the browser
        // supports it; silent on Chromium, at most one native prompt elsewhere.
        // Not a gate and not a guarantee — see storageSafety.ts.
        void requestPersistentStorage();
      } catch (error) {
        // Storage-safety duties are best-effort; never break startup.
        console.warn('[storage] storage-safety duties failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getDatabase, showNotice]);

  return null;
}
