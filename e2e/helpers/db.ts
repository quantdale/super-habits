import { Page } from '@playwright/test';
import { returnToApp } from './dbHarness';
import { resetAll } from './reset';

/**
 * Clear all app state for a fresh test, leaving the app loaded and ready.
 *
 * The real expo-sqlite/OPFS layout stores the database in an `expo-sqlite/`
 * pool directory (AccessHandlePoolVFS) with random filenames, so removing
 * root-level `superhabits.db*` entries clears nothing. This delegates to the
 * full reset in `./reset.ts` (`resetAll`): navigate to the same-origin DB
 * harness document (freeing the app worker's OPFS lock), remove the OPFS pool
 * directory, the AsyncStorage (`superhabits.*` localStorage) keys and the
 * service-worker caches, then reload the app so the caller's next interaction
 * starts from a clean bootstrap.
 */
export async function clearDatabase(page: Page) {
  await resetAll(page);
  await returnToApp(page);
}
