import { type Page } from '@playwright/test';
import { DB_HARNESS_URL, installDbHarness, unregisterServiceWorker } from './dbHarness';

/**
 * Full persistence reset for a journey: clears the OPFS SQLite database (the
 * real `expo-sqlite/` AccessHandlePoolVFS layout) AND the AsyncStorage keys.
 *
 * The legacy `clearDatabase()` in `e2e/helpers/db.ts` only removes
 * `superhabits.db*` from the OPFS root — files that do not exist in the real
 * layout (the app stores its DB under `expo-sqlite/` with random filenames).
 * It therefore clears nothing today; tests only pass because each Playwright
 * context gets a fresh OPFS partition. Journeys share one page across steps so
 * they need a reset that actually wipes state, including AsyncStorage.
 *
 * This navigates to the DB harness document (same origin) so the app page's
 * worker is gone and the OPFS lock is free, then removes everything.
 */

/** AsyncStorage keys that survive `clearDatabase()` and must be wiped. */
export const ASYNC_STORAGE_KEYS = [
  'superhabits.theme.mode',
  'superhabits.theme.slots.v2',
  'superhabits.calories.viewMode',
  'superhabits.command.last-used-mode',
  'superhabits.command.internal-rollout.remote-enabled',
] as const;

/** Names of OPFS entries the app may have created (belt-and-braces). */
const OPFS_ROOT_DB_FILES = ['superhabits.db', 'superhabits.db-wal', 'superhabits.db-shm'];
const OPFS_POOL_DIR = 'expo-sqlite';

/**
 * Remove the OPFS SQLite files and the service-worker caches. Runs on the
 * harness page's main thread (the worker has not opened the DB yet, so the
 * lock is free). Retries because the just-navigated-away app page's worker may
 * still be releasing its sync access handles.
 */
async function clearOpfs(page: Page): Promise<void> {
  await page.evaluate(
    async (targets) => {
      const { poolDir, rootFiles } = targets;
      const root = await navigator.storage.getDirectory();
      const attempts = 30;
      let lastError: unknown = null;
      for (let i = 0; i < attempts; i++) {
        try {
          for (const name of rootFiles) {
            try {
              await root.removeEntry(name, { recursive: true });
            } catch {
              // entry may not exist
            }
          }
          try {
            await root.removeEntry(poolDir, { recursive: true });
          } catch {
            // pool dir may not exist
          }
          // Also clear the service-worker cache (a third potential store).
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          return;
        } catch (err) {
          lastError = err;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      throw new Error('could not clear OPFS storage: ' + String(lastError));
    },
    { poolDir: OPFS_POOL_DIR, rootFiles: OPFS_ROOT_DB_FILES },
  );
}

/** Remove the AsyncStorage keys (AsyncStorage on web maps to localStorage). */
async function clearAsyncStorage(page: Page): Promise<void> {
  await page.evaluate(
    (keys) => {
      for (const key of keys) {
        window.localStorage.removeItem(key);
      }
      // Belt-and-braces: the app may write other superhabits.* keys in the future.
      const toRemove = Object.keys(window.localStorage).filter((k) => k.startsWith('superhabits.'));
      for (const key of toRemove) {
        window.localStorage.removeItem(key);
      }
    },
    [...ASYNC_STORAGE_KEYS],
  );
}

/**
 * Full reset. Leaves the page on the DB harness document (DB context). Call
 * `returnToApp(page)` or `seedFixture(...)`/`ensureAppContext(...)` afterwards.
 */
export async function resetAll(page: Page): Promise<void> {
  await installDbHarness(page);
  await unregisterServiceWorker(page);
  await page.goto(DB_HARNESS_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => (window as unknown as { __sh?: unknown }).__sh, null, {
    timeout: 20_000,
  });
  await clearOpfs(page);
  await clearAsyncStorage(page);
}
