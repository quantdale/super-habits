import { Page } from "@playwright/test";

/**
 * Clear all SQLite data for a fresh test state.
 * Uses the Origin Private File System (OPFS) — deletes superhabits.db
 * so the next page load starts with a clean bootstrap.
 */
export async function clearDatabase(page: Page) {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry("superhabits.db", { recursive: true });
    } catch {
      // File may not exist yet — that is fine
    }
    try {
      await root.removeEntry("superhabits.db-wal", { recursive: true });
    } catch {}
    try {
      await root.removeEntry("superhabits.db-shm", { recursive: true });
    } catch {}
  });
  await page.reload({ waitUntil: "load", timeout: 60_000 });
}
