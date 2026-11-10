import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * Tier-2 silent-write honesty: Habit pause / resume / archive.
 *
 * Pause and Archive are durable `habits` UPDATEs (`status` + `lifecycle_history`)
 * fired from the habit detail modal. This spec pins the full contract at the
 * REAL SQLite boundary, per direction:
 *
 *  a. a rejected write is announced inside the still-open detail modal
 *     (`accessibilityRole="alert"`), and the modal never closes as if it saved;
 *  b. the durable row keeps its pre-tap status/lifecycle history, no backup
 *     intent is minted, and the visible surface still shows the unchanged state;
 *  c. after the injected failure is removed, retrying from the same modal
 *     persists exactly once (one outbox intent, one lifecycle transition).
 *
 * Failure injection uses the established real-SQLite technique (`RAISE(ABORT)`
 * trigger through `e2e/helpers/dbHarness.ts`, as in `habits-w7*.spec.ts` and
 * `journeys/habit-lifecycle-persistence.spec.ts`). `e2e/helpers/failure.ts`
 * injects at the REMOTE boundary only — its routes match `*.supabase.co`, and
 * the hermetic `dist/` export contains no Supabase host, so it cannot fail a
 * local OPFS write.
 */

const HABIT_NAME = 'Lifecycle probe';
const PAUSE_TRIGGER = 'habits_wfail_pause';
const ARCHIVE_TRIGGER = 'habits_wfail_archive';

/** Seed one active habit through the real (migrated) schema, then land in app. */
async function seedHabit(page: Page): Promise<void> {
  const timestamp = new Date().toISOString();
  await seedSql(
    page,
    `INSERT INTO habits
       (id, name, target_per_day, reminder_time, category, icon, color, status,
        rule_history, lifecycle_history, created_at, updated_at, deleted_at)
     VALUES ('habit_wfail_probe', '${HABIT_NAME}', 1, NULL, 'anytime', 'check-circle',
             '#0ea5e9', 'active',
             '[{"effective_from_date":"2026-01-01","weekdays":[1,2,3,4,5,6,7],"target_per_day":1}]',
             '[]', '${timestamp}', '${timestamp}', NULL);`,
  );
  await returnToApp(page);
  await goToTab(page, 'habits');
  await expect(page.getByText('Daily check-in', { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function openDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: `Open ${HABIT_NAME} details`, exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeVisible();
  await page
    .getByRole('tablist', { name: 'Habit detail sections' })
    .getByRole('tab', { name: 'Settings', exact: true })
    .click();
}

async function habitRow(page: Page) {
  const rows = await queryRows(
    page,
    `SELECT status, lifecycle_history FROM habits WHERE id = 'habit_wfail_probe'`,
  );
  expect(rows).toHaveLength(1);
  return rows[0] as { status: string; lifecycle_history: string | null };
}

async function habitIntents(page: Page): Promise<Record<string, unknown>[]> {
  return queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'habits'`);
}

test.describe('Habits write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await seedHabit(page);
  });

  test('a rejected pause keeps the modal open with an alert, leaves status and history intact, then retries once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER ${PAUSE_TRIGGER}
         BEFORE UPDATE ON habits
         WHEN NEW.status = 'paused'
         BEGIN SELECT RAISE(ABORT, 'pause-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'habits');
    await openDetail(page);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();

    // (a) Visible, accessible, and honest: the modal must not close as saved.
    await expect(page.getByRole('alert')).toHaveText('The pause change did not save. Try again.');
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeVisible();
    // (b) Durable truth: still active, no lifecycle transition, no intent.
    const afterFailure = await habitRow(page);
    expect(afterFailure.status).toBe('active');
    expect(await habitIntents(page)).toEqual([]);

    // (c) Retry once the trigger is gone: exactly one transition + one intent.
    await runSql(page, `DROP TRIGGER ${PAUSE_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'habits');
    await openDetail(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeHidden();

    const afterRetry = await habitRow(page);
    expect(afterRetry.status).toBe('paused');
    const history = JSON.parse(String(afterRetry.lifecycle_history ?? '[]')) as {
      status: string;
      to_date_key: string | null;
    }[];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'paused', to_date_key: null });
    expect(await habitIntents(page)).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('a rejected archive keeps the modal open with its own alert, then retries once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER ${ARCHIVE_TRIGGER}
         BEFORE UPDATE ON habits
         WHEN NEW.status = 'archived'
         BEGIN SELECT RAISE(ABORT, 'archive-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'habits');
    await openDetail(page);

    await page.getByRole('button', { name: 'Archive', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'The lifecycle change did not save. Try again.',
    );
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeVisible();
    const afterFailure = await habitRow(page);
    expect(afterFailure.status).toBe('active');
    expect(await habitIntents(page)).toEqual([]);

    await runSql(page, `DROP TRIGGER ${ARCHIVE_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'habits');
    // An archived habit leaves the Active filter, so open it from All.
    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    await page.getByRole('tab', { name: 'Filter habits: All', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await openDetail(page);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeHidden();

    const afterRetry = await habitRow(page);
    expect(afterRetry.status).toBe('archived');
    expect(await habitIntents(page)).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });
});
