import { expect, type Page } from '@playwright/test';
import {
  ensureAppContext,
  ensureDbContext as ensureDbContextSafe,
  queryRows,
  returnToApp,
} from './dbHarness';
import { TAB_LABELS } from './navigation';

const SECTION_HEADINGS: Record<keyof typeof TAB_LABELS, string> = {
  // The redesigned Overview dashboard renders no "Overview" heading and its
  // hero copy varies (time-of-day greeting), and the customize toggle is an
  // icon button (aria-label only). "Plan today" is the hero's always-rendered
  // text on every load state.
  overview: 'Plan today',
  todos: 'Todos',
  habits: 'Habits',
  // The redesigned Pomodoro hero keeps the product name as its title.
  pomodoro: 'Pomodoro',
  workout: 'Workout',
  // The redesigned Calories hero leads with the kcal-remaining number, so the
  // section's stable identity string is the preserved hero subtitle.
  calories: 'Switch between manual entry and a diary grouped by meal.',
};

/** The single-page shell keeps every section mounted; this matches the
 * section container itself rather than nested Views that inherit pointer
 * interaction styles. `position: absolute; inset: 0` is emitted as RNW atomic
 * classes, so the inline-style probe keys on the animated visibility trio. */
export const ACTIVE_SECTION_SELECTOR =
  'div[style*="pointer-events: auto"][style*="z-index: 1"][style*="opacity: 1"]';

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

/**
 * Polling variant for oracles over ASYNC writes (e.g. fire-and-forget session
 * logging that races the assertion). Polls until `matcher` passes, then runs
 * it once more against the final rows so a genuine failure reports exactly.
 */
export async function expectRowsEventually(
  page: Page,
  sql: string,
  matcher: (rows: Record<string, unknown>[]) => void,
  timeout = 10_000,
): Promise<void> {
  let lastRows: Record<string, unknown>[] = [];
  await expect
    .poll(
      async () => {
        lastRows = await queryRows(page, sql);
        try {
          matcher(lastRows);
          return true;
        } catch {
          return false;
        }
      },
      { timeout, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
  matcher(lastRows);
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
  // Scope to the tab rail landmark: onboarding interest chips on Overview can
  // duplicate a tab label (Habits/Focus/Workout), so an unscoped lookup
  // strict-matches two buttons.
  const tabButton = page
    .getByRole('tablist', { name: 'Section tabs' })
    .getByRole('button', { name: TAB_LABELS[tab], exact: true });
  await tabButton.click();
  // The six screens remain mounted behind the active one. Wait for the
  // navigation state itself before a caller queries a screen-specific control;
  // otherwise a forced click can land on a still-mounted inactive screen.
  const heading = SECTION_HEADINGS[tab];
  const activeSection = page.locator(ACTIVE_SECTION_SELECTOR).filter({ hasText: heading }).first();
  // Sample the identity state during the wait so a timeout records WHEN the
  // content and the animated-container style actually arrived.
  const samples: string[] = [];
  const sampler = setInterval(() => {
    void (async () => {
      try {
        const styled = await page.locator(ACTIVE_SECTION_SELECTOR).count();
        const matched = await activeSection.count();
        const textCount = await page.getByText(heading).count();
        samples.push(
          `t~${samples.length * 400}ms styled=${styled} matched=${matched} text=${textCount}`,
        );
      } catch {
        samples.push('sampler-error');
      }
    })();
  }, 400);
  try {
    // Sanctioned wait (j4b/j7/j10/j3 class): the container styles are
    // static-per-render on the isActive flip, but the click dispatch + render
    // sit behind the day-rollover refresh storm of all six mounted sections
    // over deep history on a chronically CPU-saturated host (79-100% here;
    // JS-driver animation fallback since useNativeDriver is unsupported on
    // web). Measured: identity arrived at ~4.4s at light steps, >15s at step
    // #124, while the same fixed wait passed steps up to ~297 — 30s bounds the
    // worst observed arrival with headroom. Semantics unchanged: same
    // selector, same heading, visibility asserted; diagnostics retained.
    await expect(activeSection).toBeVisible({ timeout: 30_000 });
    clearInterval(sampler);
  } catch (err) {
    clearInterval(sampler);
    console.error(
      `[switchSection] identity wait failed for '${tab}' samples=[${samples.join(' ; ')}]`,
      err,
    );
    throw err;
  }
  await expect(activeSection.getByText(heading, { exact: true }).first()).toBeVisible();
}
