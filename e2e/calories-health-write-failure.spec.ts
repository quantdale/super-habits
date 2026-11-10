import { test, expect, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { fillCaloriesMacros } from './helpers/forms';
import { browserLocalDateKeyOffset } from './helpers/browserDate';

/**
 * Tier-2 silent-write honesty: Calories and Health (part 5 of the campaign).
 *
 * Every user-initiated calorie write was audited on the tree this spec landed
 * on. Only ONE site was genuinely silent (the saved-meal catalog delete in the
 * Browse-saved-meals sheet: a rejected hard DELETE escaped as an unhandled
 * rejection while the sheet showed nothing and the meal stayed). It now
 * announces the failure next to the list (`accessibilityRole="alert"`) and
 * keeps the row. Everything else already surfaced its failure, so the tests
 * below PIN those honest surfaces instead of re-reporting them:
 *
 *   - manual add / edit save  → `ValidationError` inside the form/modal
 *   - delete entry            → `deleteError` beside the day log
 *   - quick-add kcal          → inline "Could not save entry." (labelled status
 *                               text, visible since the path shipped)
 *   - calorie goal save       → error inside the still-open goal modal
 *   - copy previous day       → inline "Copy failed. Nothing was changed."
 *                               (included here as a visibility pin)
 *   - macro targets           → already pinned by `e2e/calories.spec.ts`
 *                               ("failed macro-target write preserves editor")
 *                               and not duplicated here
 *
 * Health owns no user-initiated write at all (it is a read-only router whose
 * summary degrades to "Workout —"/"Nutrition —"), so its case pins the
 * absence of write controls plus the routing rows.
 *
 * Contract per site, at the REAL SQLite boundary:
 *
 *  a. the failure is VISIBLE and announced (`role="alert"`), and the editor
 *     never closes / navigates as if the write landed;
 *  b. the durable state and the rendered state stay at the PRE-TAP value —
 *     no row, no tombstone, no outbox intent, no reward minted;
 *  c. once the injected failure is removed, the SAME action retried from the
 *     UI succeeds exactly once.
 *
 * Failure injection uses the established real-SQLite technique the W7/W10/W11
 * suites proved: a `RAISE(ABORT)` trigger installed through the same-origin DB
 * harness (`e2e/helpers/dbHarness.ts`). `e2e/helpers/failure.ts` injects at the
 * REMOTE boundary only (its routes match `*.supabase.co`, and the hermetic
 * `dist/` export has no Supabase host), so it cannot fail a local OPFS write
 * and is deliberately not used here.
 *
 * Harness rule: entering the DB document destroys the app page's React state.
 * Every test installs its trigger BEFORE the surface is opened and queries
 * only at an interaction boundary (or at the very end of a test).
 */

const GOAL_TRIGGER = 'wfail_calorie_goal_insert';
const COPY_STATUS = 'Copy failed. Nothing was changed.';

/**
 * The inline write-failure surface. Its message is whatever the catch site
 * authored: app copy where the handler writes it ("Could not delete entry.
 * Please try again."), and the engine's own reject sentence where the handler
 * forwards `error.message`. Assertions pin the stable identity (an announced
 * alert with real content), never the engine's wording. A successful write
 * renders no alert at all.
 */
async function expectFailureAlert(scope: Page | Locator, expectedText?: string): Promise<void> {
  const alert = scope.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText(/^\s*$/);
  if (expectedText) await expect(alert).toContainText(expectedText);
}

async function countRows(page: Page, sql: string): Promise<number> {
  const rows = await queryRows(page, sql);
  return Number(rows[0]?.n ?? -1);
}

async function openSavedMeals(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /Browse saved meals/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Saved meals' });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** RN-Web routes a press-and-hold onto `onLongPress` and suppresses the click. */
async function longPress(page: Page, target: Locator, holdMs = 900): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('long press target has no layout box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

test.describe('Calories / Health write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await goToTab(page, 'calories');
  });

  test('a rejected manual add stays in the form with an alert, writes nothing, then adds once on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER wfail_calorie_insert
         BEFORE INSERT ON calorie_entries
         BEGIN SELECT RAISE(ABORT, 'calorie-insert-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');

    await fillCaloriesMacros(page, 'Blocked add', '10', '0', '0', '0');
    await page.getByRole('button', { name: 'Save calorie entry' }).click();

    // (a) Visible + announced failure; the typed draft survives for the retry.
    await expectFailureAlert(page);
    await expect(page.locator('#cal-entry-food')).toHaveValue('Blocked add');
    // (b) Nothing durable: no ledger row, no backup intent, no reward minted.
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM calorie_entries')).toBe(0);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'calorie_entries'`,
      ),
    ).toBe(0);
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM gamification_events')).toBe(0);

    // (c) Retry after the failure is cleared logs exactly one entry.
    await runSql(page, 'DROP TRIGGER wfail_calorie_insert;');
    await returnToApp(page);
    await goToTab(page, 'calories');
    await fillCaloriesMacros(page, 'Blocked add', '10', '0', '0', '0');
    await page.getByRole('button', { name: 'Save calorie entry' }).click();
    await expect(page.getByText('Blocked add', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM calorie_entries')).toBe(1);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'create'`,
      ),
    ).toBe(1);
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM gamification_events')).toBe(1);
    await returnToApp(page);
  });

  test('a rejected edit keeps the modal open with an alert, leaves the row untouched, then saves once on retry', async ({
    page,
  }) => {
    await fillCaloriesMacros(page, 'Editable entry', '10', '0', '0', '0');
    await page.getByRole('button', { name: 'Save calorie entry' }).click();
    await expect(page.getByText('Editable entry', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Reject only the entry's own UPDATE (the soft-delete write is a separate
    // path and must stay out of this test).
    await seedSql(
      page,
      `CREATE TRIGGER wfail_calorie_update
         BEFORE UPDATE ON calorie_entries
         WHEN NEW.deleted_at IS NULL AND OLD.food_name = 'Editable entry'
         BEGIN SELECT RAISE(ABORT, 'calorie-update-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');

    await page.getByLabel('Edit Editable entry').first().click();
    const dialog = page.getByRole('dialog', { name: 'Edit entry' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lunch' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    // (a) Announced inside the modal; (b) the row keeps its pre-edit meal.
    await expectFailureAlert(dialog);
    await expect(dialog).toBeVisible();
    const afterFailure = await queryRows(
      page,
      `SELECT meal_type, deleted_at FROM calorie_entries WHERE food_name = 'Editable entry'`,
    );
    expect(afterFailure).toEqual([{ meal_type: 'breakfast', deleted_at: null }]);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'update'`,
      ),
    ).toBe(0);

    // (c) Retry edits the same row exactly once.
    await runSql(page, 'DROP TRIGGER wfail_calorie_update;');
    await returnToApp(page);
    await goToTab(page, 'calories');
    await page.getByLabel('Edit Editable entry').first().click();
    const retried = page.getByRole('dialog', { name: 'Edit entry' });
    await retried.getByRole('button', { name: 'Lunch' }).click();
    await retried.getByRole('button', { name: 'Save changes' }).click();
    await expect(retried).toBeHidden();

    const afterRetry = await queryRows(
      page,
      `SELECT meal_type FROM calorie_entries WHERE food_name = 'Editable entry'`,
    );
    expect(afterRetry).toEqual([{ meal_type: 'lunch' }]);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'update'`,
      ),
    ).toBe(1);
    await returnToApp(page);
  });

  test('a rejected entry delete keeps the row visible and live with an alert, then tombstones once on retry', async ({
    page,
  }) => {
    await page.getByLabel('Quick add 200 kilocalories').click();
    await expect(page.getByText('1,800 kcal left')).toBeVisible({ timeout: 15_000 });

    await seedSql(
      page,
      `CREATE TRIGGER wfail_calorie_delete
         BEFORE UPDATE ON calorie_entries
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'calorie-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');

    await page.getByLabel('Delete Quick add').first().click();
    const columnDialog = page.getByRole('dialog');
    await columnDialog.getByRole('button', { name: 'Delete entry' }).click();

    // (a) The app-authored delete copy, announced beside the day log.
    await expectFailureAlert(page, 'Could not delete entry');
    // (b) The row is still on screen and still a live row in SQLite.
    await expect(page.getByLabel('Delete Quick add').first()).toBeVisible();
    const stillLive = await queryRows(
      page,
      `SELECT deleted_at FROM calorie_entries WHERE food_name = 'Quick add'`,
    );
    expect(stillLive).toEqual([{ deleted_at: null }]);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'delete'`,
      ),
    ).toBe(0);

    // (c) Retry tombstones exactly that row.
    await runSql(page, 'DROP TRIGGER wfail_calorie_delete;');
    await returnToApp(page);
    await goToTab(page, 'calories');
    await page.getByLabel('Delete Quick add').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
    await expect(page.getByText('No meals logged on this day')).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT deleted_at FROM calorie_entries WHERE food_name = 'Quick add'`,
    );
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.deleted_at).not.toBeNull();
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'delete'`,
      ),
    ).toBe(1);
    await returnToApp(page);
  });

  test('a rejected quick add announces the failure, leaves the day total alone, then logs once on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER wfail_calorie_quick_insert
         BEFORE INSERT ON calorie_entries
         BEGIN SELECT RAISE(ABORT, 'calorie-quick-insert-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');

    await page.getByLabel('Quick add 200 kilocalories').click();

    // (a) The quick-log card's own visible copy. Its error line is a labelled
    // status text (pre-existing contract, `accessibilityLabel="Quick add
    // error"`) rather than a role=alert region, so this pins the string the
    // card already shipped instead of re-shaping the surface.
    await expect(page.getByLabel('Quick add error')).toBeVisible();
    await expect(page.getByLabel('Quick add error')).toHaveText('Could not save entry.');
    // (b) The hero still states the untouched day, and nothing was written.
    await expect(page.getByText('2,000 kcal left')).toBeVisible();
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM calorie_entries')).toBe(0);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'calorie_entries'`,
      ),
    ).toBe(0);

    // (c) Retry logs exactly one kcal-only entry (and no saved-meal row:
    // a one-off kcal log is not a reusable meal).
    await runSql(page, 'DROP TRIGGER wfail_calorie_quick_insert;');
    await returnToApp(page);
    await goToTab(page, 'calories');
    await page.getByLabel('Quick add 200 kilocalories').click();
    await expect(page.getByText('1,800 kcal left')).toBeVisible({ timeout: 15_000 });

    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM calorie_entries')).toBe(1);
    expect(
      await countRows(page, `SELECT COUNT(*) AS n FROM saved_meals WHERE food_name = 'Quick add'`),
    ).toBe(0);
    await returnToApp(page);
  });

  test('a rejected saved-meal catalog delete announces it, keeps the meal, then removes it on retry', async ({
    page,
  }) => {
    // Author the catalog row through the real add path, then delete it from
    // the Browse-saved-meals sheet.
    await fillCaloriesMacros(page, 'Catalog roll', '8', '20', '6', '2');
    await page.getByRole('button', { name: 'Save calorie entry' }).click();
    await expect(page.getByText('Catalog roll', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    await seedSql(
      page,
      `CREATE TRIGGER wfail_saved_meal_delete
         BEFORE DELETE ON saved_meals
         BEGIN SELECT RAISE(ABORT, 'saved-meal-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');
    const sheet = await openSavedMeals(page);

    await longPress(page, sheet.getByText('Catalog roll', { exact: true }).first());
    const confirmDialog = page.getByRole('dialog', { name: 'Remove saved meal' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Remove' }).click();

    // (a) The new failure surface: announced inside the sheet, not swallowed.
    await expectFailureAlert(sheet, 'Could not remove that saved meal');
    // (b) The meal is still listed and still in SQLite.
    await expect(sheet.getByText('Catalog roll', { exact: true }).first()).toBeVisible();
    expect(await countRows(page, `SELECT COUNT(*) AS n FROM saved_meals`)).toBe(1);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'saved_meals' AND operation = 'delete'`,
      ),
    ).toBe(0);

    // (c) Retry removes exactly that catalog row (its remote delete intent is
    // coalesced onto the row's own outbox record).
    await runSql(page, 'DROP TRIGGER wfail_saved_meal_delete;');
    await returnToApp(page);
    await goToTab(page, 'calories');
    const retried = await openSavedMeals(page);
    await longPress(page, retried.getByText('Catalog roll', { exact: true }).first());
    await page
      .getByRole('dialog', { name: 'Remove saved meal' })
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(retried.getByText('Catalog roll', { exact: true })).toHaveCount(0);

    expect(await countRows(page, `SELECT COUNT(*) AS n FROM saved_meals`)).toBe(0);
    expect(
      await countRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox
         WHERE entity = 'saved_meals' AND operation = 'delete'`,
      ),
    ).toBe(1);
    await returnToApp(page);
  });

  test('the saved-meal failure alert fits a 360 px phone sheet without overflowing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await fillCaloriesMacros(page, 'Narrow roll', '8', '20', '6', '2');
    await page.getByRole('button', { name: 'Save calorie entry' }).click();
    await expect(page.getByText('Narrow roll', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    await seedSql(
      page,
      `CREATE TRIGGER wfail_saved_meal_delete_narrow
         BEFORE DELETE ON saved_meals
         BEGIN SELECT RAISE(ABORT, 'saved-meal-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');
    const sheet = await openSavedMeals(page);
    await longPress(page, sheet.getByText('Narrow roll', { exact: true }).first());
    await page
      .getByRole('dialog', { name: 'Remove saved meal' })
      .getByRole('button', { name: 'Remove' })
      .click();

    const alert = sheet.getByRole('alert');
    await expect(alert).toBeVisible();
    const geometry = await alert.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        overflowsX: el.scrollWidth > el.clientWidth + 1,
      };
    });
    expect(geometry.overflowsX).toBe(false);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(360);
    await expect(sheet.getByText('Narrow roll', { exact: true }).first()).toBeVisible();
  });

  test('a rejected calorie-goal save stays in the modal with an alert, keeps the old goal, then saves once on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER ${GOAL_TRIGGER}
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'calorie_goal'
         BEGIN SELECT RAISE(ABORT, 'calorie-goal-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'calories');

    await page.getByRole('button', { name: 'Edit daily calorie goal' }).click();
    const modal = page.getByRole('dialog', { name: 'Daily goals' });
    await expect(modal).toBeVisible();
    await page.getByRole('textbox', { name: 'Calories (kcal)' }).fill('1500');
    await page.getByText('Save goals', { exact: true }).click();

    // (a) The modal does not close as if it saved; (b) the old goal is intact.
    await expectFailureAlert(modal);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('textbox', { name: 'Calories (kcal)' })).toHaveValue('1500');
    await expect(page.getByText('2,000 kcal left')).toBeVisible();
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM app_meta WHERE key = 'calorie_goal'"),
    ).toBe(0);

    // (c) Retry persists the goal once; the hero reads the new value.
    await runSql(page, `DROP TRIGGER ${GOAL_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'calories');
    await page.getByRole('button', { name: 'Edit daily calorie goal' }).click();
    await page.getByRole('textbox', { name: 'Calories (kcal)' }).fill('1500');
    await page.getByText('Save goals', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Daily goals' })).toBeHidden();
    await expect(page.getByText('1,500 kcal left')).toBeVisible({ timeout: 15_000 });

    const stored = await queryRows(page, "SELECT value FROM app_meta WHERE key = 'calorie_goal'");
    expect(stored).toHaveLength(1);
    expect(JSON.parse(String(stored[0]?.value))).toMatchObject({ calories: 1500 });
    await returnToApp(page);
  });

  test('a rejected copy-day states that nothing changed and copies nothing', async ({ page }) => {
    const sourceDay = await browserLocalDateKeyOffset(page, -1);
    const at = new Date().toISOString();
    await seedSql(
      page,
      `INSERT INTO calorie_entries (id,food_name,calories,protein,carbs,fats,fiber,meal_type,consumed_on,created_at,updated_at,deleted_at)
       VALUES ('cal_wfail_copy','Oats',300,10,50,6,8,'breakfast','${sourceDay}','${at}','${at}',NULL);
       CREATE TRIGGER wfail_calorie_copy
         BEFORE INSERT ON calorie_entries
         WHEN NEW.food_name = 'Oats'
         BEGIN SELECT RAISE(ABORT, 'calorie-copy-blocked'); END;`,
    );
    await returnToApp(page);
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');

    await page.getByRole('button', { name: 'Copy a previous day' }).click();
    await page.getByRole('button', { name: /Copy Yesterday into Today/ }).click();

    // The copy is all-or-nothing: the status says so and the batch rolled back.
    await expect(page.getByText(COPY_STATUS, { exact: true })).toBeVisible();
    expect(await countRows(page, `SELECT COUNT(*) AS n FROM calorie_entries`)).toBe(1);
    await returnToApp(page);
  });

  test('Health is a read-only router: no write controls, and its rows switch sections', async ({
    page,
  }) => {
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tablist', { name: 'Section tabs' }).waitFor({ timeout: 20_000 });
    const panel = page.locator('#sh-section-panel-health');
    await expect(panel).not.toHaveAttribute('aria-hidden', 'true');

    // The surface owns exactly two routing rows (plus the Settings icon);
    // there is no add/edit/delete affordance anywhere on it.
    await expect(panel.getByRole('button', { name: 'Open Workout' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Open Calories' })).toBeVisible();
    await expect(panel.getByLabel(/Delete|Edit|Add|Remove|Save/)).toHaveCount(0);

    await panel.getByRole('button', { name: 'Open Calories' }).click();
    await page.getByRole('tablist', { name: 'Section tabs' }).waitFor({ timeout: 20_000 });
    await expect(page.locator('#sh-section-panel-calories')).not.toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(page.getByText('2,000 kcal left')).toBeVisible({ timeout: 15_000 });
  });
});
