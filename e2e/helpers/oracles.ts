import { expect, type Page } from '@playwright/test';
import {
  ensureAppContext,
  ensureDbContext as ensureDbContextSafe,
  queryRows,
  returnToApp,
} from './dbHarness';
import { TAB_LABELS } from './navigation';

/**
 * Oracles: assertions that go beyond what the UI shows.
 *
 * Row-level oracles run raw SQL through the DB harness, so they read the
 * *actual* persisted rows — a green screen over a corrupt database is a failed
 * journey. NOTE: reading rows destroys the app page (the harness is a separate
 * document the app's worker lock forces); call these at reload boundaries and
 * then `returnToApp(page)` / the next UI step to get back. Helpers that need
 * the app (`expectAcrossSurfaces`) self-heal by reloading.
 */

/**
 * Assert the rows returned by `sql` match. Two assertion styles:
 * - `expected: unknown[]` → deep-equal with the rows (array of objects).
 * - `matcher: (rows) => void` → call `expect(...)` inside the callback.
 * Both throw on mismatch, failing the step.
 */
export async function expectRows(
  page: Page,
  sql: string,
  expected: Record<string, unknown>[] | ((rows: Record<string, unknown>[]) => void),
): Promise<void> {
  const rows = await queryRows(page, sql);
  if (typeof expected === 'function') {
    expected(rows);
  } else {
    expect(rows, `rows for SQL:\n${sql}`).toEqual(expected);
  }
}

/** Shape of a durable `sync_outbox` record. */
export interface OutboxRecord {
  entity: string;
  id: string;
  updatedAt: string;
  operation: 'create' | 'update' | 'delete';
}

/**
 * Assert the sync outbox contents (SQLite `sync_outbox` rows). Accepts either
 * the exact expected array (subset-agnostic deep equality) or a matcher.
 */
export async function expectOutbox(
  page: Page,
  expected: OutboxRecord[] | ((outbox: OutboxRecord[]) => void),
): Promise<void> {
  const rows = await queryRows(
    page,
    `SELECT entity, id, updated_at AS updatedAt, operation
     FROM sync_outbox
     ORDER BY revision ASC`,
  );
  const outbox = rows as unknown as OutboxRecord[];
  if (typeof expected === 'function') {
    expected(outbox);
  } else {
    expect(outbox, 'sync_outbox contents').toEqual(expected);
  }
}

/**
 * Negative oracle: assert the rows for `sql` do NOT change across `action`.
 * Snapshots, returns to the app, runs `action` (the journey's UI steps — it
 * must leave you back on the app or harness page as needed), re-reads, and
 * asserts the rows are identical. Catches unexpected extra rows and silently
 * mutated neighbours — the failure mode the positive oracles never see.
 */
export async function expectUnchanged(
  page: Page,
  sql: string,
  action: (page: Page) => Promise<void>,
): Promise<void> {
  await ensureDbContextSafe(page);
  const before = await queryRows(page, sql);
  await returnToApp(page);
  await action(page);
  await ensureDbContextSafe(page);
  const after = await queryRows(page, sql);
  expect(after, `rows for SQL (must be unchanged):\n${sql}`).toEqual(before);
}

/**
 * Assert the same fact from at least two independent surfaces AND (optionally)
 * after a reload. `text` is the rendered visible fact; `tabs` are the section
 * tab labels to visit (via in-app section switch, no reload). The positive
 * row-level counterpart is `expectRows`.
 */
export async function expectAcrossSurfaces(
  page: Page,
  opts: {
    text: string | RegExp;
    tabs: (keyof typeof TAB_LABELS)[];
    afterReload?: boolean;
  },
): Promise<void> {
  await ensureAppContext(page);
  for (const tab of opts.tabs) {
    await switchSection(page, tab);
    const locator = page.getByText(opts.text).first();
    await expect(locator).toBeVisible();
  }
  if (opts.afterReload) {
    await returnToApp(page);
    const tab = opts.tabs[0];
    await switchSection(page, tab);
    await expect(page.getByText(opts.text).first()).toBeVisible();
  }
}

/**
 * Switch the active section WITHOUT reloading (the app is a single page; the
 * tab rail Pressables change local state). Use this inside journeys where a
 * reload would destroy in-memory state (e.g. a running Pomodoro).
 */
export async function switchSection(page: Page, tab: keyof typeof TAB_LABELS): Promise<void> {
  await page.getByRole('button', { name: TAB_LABELS[tab], exact: true }).click();
}
