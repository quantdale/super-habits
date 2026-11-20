import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { browserLocalDateKeyOffset } from './helpers/browserDate';

async function seedPlans(page: Page, currentIds: string[] = []) {
  const today = await browserLocalDateKeyOffset(page, 0);
  const yesterday = await browserLocalDateKeyOffset(page, -1);
  await runSql(
    page,
    `
    INSERT INTO todos (id, title, created_at, updated_at) VALUES
      ('todo_carried', 'Carried priority', datetime('now'), datetime('now')),
      ('todo_draft', 'Draft priority', datetime('now'), datetime('now')),
      ('todo_removed', 'Removed priority', datetime('now'), datetime('now')),
      ('todo_kept', 'Kept priority', datetime('now'), datetime('now'));
    INSERT INTO daily_plans (id, date_key, top_todo_ids, status, created_at, updated_at) VALUES
      ('dplan_yesterday', '${yesterday}', '["todo_carried"]', 'committed', datetime('now'), datetime('now')),
      ('dplan_today', '${today}', '${JSON.stringify(currentIds)}', 'committed', datetime('now'), datetime('now'));
  `,
  );
  await returnToApp(page);
  await page.getByRole('button', { name: 'Plan today', exact: true }).click();
  await expect(page.getByText(`Plan for ${today}`, { exact: true })).toBeVisible();
  return today;
}

test.describe('Daily Plan carries into the visible priority draft', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'overview');
    await clearDatabase(page);
  });

  test('keeps an unsaved selection alongside carried priorities through save and reload', async ({
    page,
  }) => {
    const today = await seedPlans(page);
    await page.getByRole('button', { name: 'Add priority', exact: true }).click();
    await page.getByRole('button', { name: '• Draft priority', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Remove Draft priority', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Carry forward unfinished priorities from yesterday' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Carry forward unfinished priorities from yesterday' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Remove Carried priority', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove Draft priority', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save Plan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save Plan', exact: true })).toBeEnabled();
    const rows = await queryRows(
      page,
      `SELECT top_todo_ids FROM daily_plans WHERE date_key = '${today}' AND deleted_at IS NULL`,
    );
    expect(JSON.parse(String(rows[0].top_todo_ids))).toEqual(['todo_draft', 'todo_carried']);
    await returnToApp(page);
    await page.getByRole('button', { name: 'Plan today', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Remove Draft priority', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove Carried priority', exact: true }),
    ).toBeVisible();
  });

  test('uses a slot freed by an unsaved removal without resurrecting that selection', async ({
    page,
  }) => {
    const today = await seedPlans(page, ['todo_removed', 'todo_draft', 'todo_kept']);
    await page.getByRole('button', { name: 'Remove Removed priority', exact: true }).click();
    await page
      .getByRole('button', { name: 'Carry forward unfinished priorities from yesterday' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Carry forward unfinished priorities from yesterday' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Remove Carried priority', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove Removed priority', exact: true }),
    ).toHaveCount(0);
    const rows = await queryRows(
      page,
      `SELECT top_todo_ids FROM daily_plans WHERE date_key = '${today}' AND deleted_at IS NULL`,
    );
    expect(JSON.parse(String(rows[0].top_todo_ids))).toEqual([
      'todo_draft',
      'todo_kept',
      'todo_carried',
    ]);
  });
});
