import { performance } from 'node:perf_hooks';
import { test, expect, type Page } from './fixtures';
import { expectRows } from './helpers/oracles';
import { queryRows, runSql, returnToApp } from './helpers/dbHarness';
import { auditPage } from './helpers/a11yAudit';
import {
  seedW7Habits,
  openW7Habits,
  openW7Detail,
  selectW7Detail,
  W7_NAMES,
} from './helpers/habitsW7';

async function closeDetail(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
}

/** Same-turn pointer sequences exercise the real RN Web press listeners. */
async function rapidTwice(page: Page, role: 'button' | 'checkbox', name: RegExp) {
  await page.getByRole(role, { name }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (let i = 0; i < 2; i++) {
      for (const type of ['pointerdown', 'pointerup'])
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            pointerId: 1,
            isPrimary: true,
            clientX: rect.x + rect.width / 2,
            clientY: rect.y + rect.height / 2,
            buttons: type === 'pointerdown' ? 1 : 0,
          }),
        );
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
}

test.describe('W7 Habits reconstruction regressions', () => {
  test('detail check-ins refresh the list, calendar, streak and rate from one snapshot', async ({
    page,
  }) => {
    await seedW7Habits(page);
    await openW7Detail(page, W7_NAMES.water);
    await page.getByRole('button', { name: 'Add one today', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByLabel('Drink water: 3 of 8 today. Add one.', { exact: true }),
    ).toBeVisible();
    await selectW7Detail(page, 'Progress');
    await expect(
      page.getByLabel(
        /Last 7 days scheduled completion rate:.*Actual count 9 against target total 28\./,
      ),
    ).toBeVisible();
    await selectW7Detail(page, 'Today');
    await page.getByRole('button', { name: 'Remove one today', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByLabel('Drink water: 2 of 8 today. Add one.', { exact: true }),
    ).toBeVisible();
    await selectW7Detail(page, 'Progress');
    await expect(
      page.getByLabel(
        /Last 7 days scheduled completion rate:.*Actual count 8 against target total 28\./,
      ),
    ).toBeVisible();
    await closeDetail(page);
    await expect(
      page.getByRole('button', { name: 'Drink water: 2 of 8 today. Add one.', exact: true }),
    ).toBeVisible();

    await openW7Detail(page, W7_NAMES.move);
    await page.getByRole('button', { name: 'Check in today', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Undo check-in today', exact: true }),
    ).toBeVisible();
    await selectW7Detail(page, 'Progress');
    await expect(
      page.getByLabel(/^Current streak: 1 scheduled occurrences\. Longest streak: 1/),
    ).toBeVisible();
    await expect(page.getByLabel(/2026-08-10: Target met.*Actual count 1/)).toBeVisible();
    await selectW7Detail(page, 'Today');
    await page.getByRole('button', { name: 'Undo check-in today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Check in today', exact: true })).toBeVisible();
    await selectW7Detail(page, 'Progress');
    await expect(page.getByLabel(/2026-08-10: Not completed.*Actual count 0/)).toBeVisible();
    await closeDetail(page);
    await expectRows(
      page,
      "SELECT count FROM habit_completions WHERE habit_id = 'habit_w7_water' AND date_key = '2026-08-10'",
      [{ count: 2 }],
    );
    await expectRows(
      page,
      "SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = 'habit_w7_move'",
      [{ n: 0 }],
    );
  });

  test('rest, pre-creation, masked, paused and archived dates disable detail writes but keep management', async ({
    page,
  }) => {
    await seedW7Habits(page, 'lifecycle');
    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    await page.getByRole('tab', { name: 'Filter habits: All', exact: true }).click();
    await closeDetail(page);
    for (const name of [W7_NAMES.rest, W7_NAMES.paused, W7_NAMES.archived]) {
      await openW7Detail(page, name);
      await expect(
        page.getByRole('button', { name: 'Check in today', exact: true }),
      ).toBeDisabled();
      await selectW7Detail(page, 'Settings');
      await expect(page.getByRole('button', { name: 'Edit habit', exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: name === W7_NAMES.archived ? 'Restore' : 'Archive',
          exact: true,
        }),
      ).toBeVisible();
      await closeDetail(page);
    }
    await page.getByRole('button', { name: /^Sunday:.*scheduled habits complete$/ }).click();
    for (const name of [W7_NAMES.new, W7_NAMES.masked]) {
      await openW7Detail(page, name);
      await expect(
        page.getByRole('button', { name: 'Check in on Sun 9', exact: true }),
      ).toBeDisabled();
      await expect(
        page
          .getByRole('dialog')
          .getByText(
            name === W7_NAMES.new
              ? 'Not created yet on Sun 9.'
              : 'Paused or archived on this date. Check-in is unavailable on Sun 9.',
            { exact: true },
          ),
      ).toBeVisible();
      await closeDetail(page);
    }
    await expectRows(
      page,
      "SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id IN ('habit_w7_paused','habit_w7_archived','habit_w7_masked','habit_w7_new')",
      [{ n: 0 }],
    );
  });

  test('past-day target and summary stay date-specific and do not award a today fast-path event', async ({
    page,
  }) => {
    await seedW7Habits(page, 'quantitative');
    await page.getByRole('button', { name: /^Sunday:/ }).click();
    await expect(page.getByText('0 of 1 done on Sun 9', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Drink water: 0 of 8 on Sun 9. Add one.', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Drink water: 1 of 8 on Sun 9. Add one.', exact: true }),
    ).toBeVisible();
    // The real SQLite oracle destroys React state: only run after committed UI.
    await expectRows(
      page,
      "SELECT date_key,count FROM habit_completions WHERE habit_id = 'habit_w7_water'",
      [{ date_key: '2026-08-09', count: 1 }],
    );
    await expectRows(
      page,
      "SELECT COUNT(*) AS n FROM gamification_events WHERE date_key = '2026-08-10' AND source_key LIKE '%habit_w7_water%'",
      [{ n: 0 }],
    );
    await returnToApp(page);
    await openW7Habits(page);
    await expect(page.getByText('0 of 1 done today', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Drink water: 0 of 8 today. Add one.', exact: true }),
    ).toBeVisible();
  });

  test('rapid binary check is guarded; rapid quantitative adds retain both writes in one row', async ({
    page,
  }) => {
    await seedW7Habits(page, 'single');
    await rapidTwice(page, 'checkbox', /^Stretch for five minutes: 0 of 1 today/);
    await expect(
      page.getByRole('checkbox', { name: /^Stretch for five minutes: 1 of 1 today/ }),
    ).toBeChecked();
    await expectRows(
      page,
      "SELECT COUNT(*) AS rows, SUM(count) AS total FROM habit_completions WHERE habit_id = 'habit_w7_move'",
      [{ rows: 1, total: 1 }],
    );
    await seedW7Habits(page, 'quantitative');
    await rapidTwice(page, 'button', /^Drink water: 0 of 8 today/);
    await expect(
      page.getByRole('button', { name: 'Drink water: 2 of 8 today. Add one.', exact: true }),
    ).toBeVisible();
    await expectRows(
      page,
      "SELECT COUNT(*) AS rows, SUM(count) AS total FROM habit_completions WHERE habit_id = 'habit_w7_water'",
      [{ rows: 1, total: 2 }],
    );
  });

  test('Space toggles binary rows without duplicate XP after check and undo', async ({ page }) => {
    await seedW7Habits(page);
    for (let i = 0; i < 2; i++) {
      const unchecked = page.getByRole('checkbox', {
        name: /^Stretch for five minutes: 0 of 1 today/,
      });
      await unchecked.focus();
      await page.keyboard.press('Space');
      const checked = page.getByRole('checkbox', {
        name: /^Stretch for five minutes: 1 of 1 today/,
      });
      await expect(checked).toBeChecked();
      await expect(checked).toBeEnabled();
      await checked.focus();
      await page.keyboard.press('Space');
      await expect(unchecked).not.toBeChecked();
      await expect(unchecked).toBeEnabled();
    }
    await expectRows(
      page,
      "SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = 'habit_w7_move'",
      [{ n: 0 }],
    );
    await expectRows(
      page,
      "SELECT COUNT(*) AS n FROM gamification_events WHERE date_key = '2026-08-10' AND source_key LIKE '%habit_w7_move%'",
      [{ n: 1 }],
    );
  });

  test('a failed real SQLite write leaves completion, outbox and XP unchanged and offers retry', async ({
    page,
  }, testInfo) => {
    await seedW7Habits(page, 'single');
    await runSql(
      page,
      "CREATE TRIGGER w7_fail_check_in BEFORE INSERT ON habit_completions BEGIN SELECT RAISE(ABORT, 'W7 deliberate write failure'); END;",
    );
    await returnToApp(page);
    await openW7Habits(page);
    await page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }).click();
    await expect(page.getByRole('alert')).toHaveText('Check-in did not save. Try again.');
    await expect(
      page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }),
    ).not.toBeChecked();
    await testInfo.attach('w7-failed-write.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await expectRows(
      page,
      'SELECT (SELECT COUNT(*) FROM habit_completions) AS completions, (SELECT COUNT(*) FROM sync_outbox) AS outbox, (SELECT COUNT(*) FROM gamification_events) AS rewards',
      [{ completions: 0, outbox: 0, rewards: 0 }],
    );
    await runSql(page, 'DROP TRIGGER w7_fail_check_in;');
    await returnToApp(page);
    await openW7Habits(page);
    await page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }).click();
    await expect(
      page.getByRole('checkbox', { name: /^Stretch for five minutes: 1 of 1 today/ }),
    ).toBeChecked();
    await expectRows(page, 'SELECT count FROM habit_completions', [{ count: 1 }]);
  });

  test('Cancel restores Settings; a normal confirmation click deletes exactly the selected habit', async ({
    page,
  }) => {
    await seedW7Habits(page);
    await openW7Detail(page, W7_NAMES.move);
    await selectW7Detail(page, 'Settings');
    await page.getByRole('button', { name: `Delete ${W7_NAMES.move}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete habit', exact: true })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeHidden();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: `Delete ${W7_NAMES.move}`, exact: true }).click();
    await page.getByRole('button', { name: 'Delete habit', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      page.getByRole('button', { name: `Open ${W7_NAMES.move} details`, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Open ${W7_NAMES.read} details`, exact: true }),
    ).toBeVisible();
    await expectRows(
      page,
      "SELECT id, deleted_at IS NOT NULL AS deleted FROM habits WHERE id IN ('habit_w7_move', 'habit_w7_read') ORDER BY id",
      [
        { id: 'habit_w7_move', deleted: 1 },
        { id: 'habit_w7_read', deleted: 0 },
      ],
    );
  });

  test('48pt row actions, compact simple rows, large names, keyboard focus and rendered AA', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedW7Habits(page, 'long');
    const measurements = [];
    for (const name of [W7_NAMES.move, W7_NAMES.read, W7_NAMES.water]) {
      const details = page.getByRole('button', { name: `Open ${name} details`, exact: true });
      await details.scrollIntoViewIfNeeded();
      const row = details.locator('..');
      const action =
        name === W7_NAMES.water
          ? row.getByRole('button', { name: /^Drink water: 2 of 8 today/ })
          : row.getByRole('checkbox');
      const height = (await row.boundingBox())!.height;
      measurements.push({
        name,
        row: height,
        action: await action.boundingBox(),
        details: await details.boundingBox(),
      });
      expect(height).toBeGreaterThanOrEqual(48);
      expect(height).toBeLessThanOrEqual(64);
      expect(Number((await action.boundingBox())!.width.toFixed(3))).toBeGreaterThanOrEqual(48);
      expect(Number((await action.boundingBox())!.height.toFixed(3))).toBeGreaterThanOrEqual(48);
      await action.focus();
      await expect(action).toHaveCSS('outline-width', '2px');
      await page.keyboard.press('Tab');
      await expect(details).toBeFocused();
      await expect(details).toHaveCSS('outline-width', '2px');
    }
    await page.getByRole('button', { name: /^Sunday:/ }).focus();
    await expect(page.getByRole('button', { name: /^Sunday:/ })).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Back to today', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Back to today', exact: true })).toHaveCSS(
      'outline-width',
      '2px',
    );
    await page.keyboard.press('Enter');
    const long = page.getByRole('button', { name: `Open ${W7_NAMES.long} details`, exact: true });
    await long.scrollIntoViewIfNeeded();
    await long.getByText(W7_NAMES.long, { exact: true }).evaluate((element) => {
      element.style.fontSize = '30px';
      element.style.lineHeight = '40px';
    });
    expect(await long.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
    expect((await long.boundingBox())!.height).toBeGreaterThan(64);
    const audit = await page.evaluate(auditPage);
    expect(audit.contrast).toEqual([]);
    expect(audit.nameless).toEqual([]);
    expect(audit.hiddenFocusable).toEqual([]);
    await testInfo.attach('w7-row-geometry.json', {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('w7-large-type-proxy.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('editor choices expose state, readable labels, 44pt targets and keyboard focus', async ({
    page,
  }) => {
    await seedW7Habits(page);
    await openW7Detail(page, W7_NAMES.water);
    await selectW7Detail(page, 'Settings');
    await page.getByRole('button', { name: 'Edit habit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
    const monday = dialog.getByRole('checkbox', { name: 'Monday scheduled', exact: true });
    await expect(monday).toBeChecked();
    await monday.focus();
    await expect(monday).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Space');
    await expect(monday).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(monday).toBeChecked();
    for (const label of ['Select menu book icon', 'Select habit color #ef4444']) {
      const choice = dialog.getByRole('button', { name: label, exact: true });
      await choice.scrollIntoViewIfNeeded();
      await choice.focus();
      await expect(choice).toHaveCSS('outline-width', '2px');
      await page.keyboard.press('Enter');
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
      const bounds = (await choice.boundingBox())!;
      expect(Number(bounds.width.toFixed(3))).toBeGreaterThanOrEqual(44);
      expect(Number(bounds.height.toFixed(3))).toBeGreaterThanOrEqual(44);
    }
    const audit = await page.evaluate(auditPage);
    expect(audit.contrast).toEqual([]);
    expect(audit.nameless).toEqual([]);
    expect(audit.hiddenFocusable).toEqual([]);
  });

  test('a failed deletion restores Settings and leaves the tombstone and outbox unchanged', async ({
    page,
  }) => {
    await seedW7Habits(page, 'single');
    await runSql(
      page,
      "CREATE TRIGGER w7_fail_delete BEFORE UPDATE ON habits WHEN NEW.deleted_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'W7 intentional delete failure'); END;",
    );
    await returnToApp(page);
    await openW7Habits(page);
    await openW7Detail(page, W7_NAMES.move);
    await selectW7Detail(page, 'Settings');
    await page.getByRole('button', { name: `Delete ${W7_NAMES.move}`, exact: true }).click();
    await page.getByRole('button', { name: 'Delete habit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(dialog.getByRole('alert')).toHaveText('Could not delete this habit. Try again.');
    await expectRows(
      page,
      "SELECT deleted_at, (SELECT COUNT(*) FROM sync_outbox) AS outbox FROM habits WHERE id = 'habit_w7_move'",
      [{ deleted_at: null, outbox: 0 }],
    );
    await runSql(page, 'DROP TRIGGER w7_fail_delete;');
    await returnToApp(page);
    await openW7Habits(page);
    await openW7Detail(page, W7_NAMES.move);
    await selectW7Detail(page, 'Settings');
    await page.getByRole('button', { name: `Delete ${W7_NAMES.move}`, exact: true }).click();
    await page.getByRole('button', { name: 'Delete habit', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    // Confirmation disappearance alone occurs before the async transaction.
    // Include masked background content so portal suspension cannot satisfy
    // this committed-row oracle early, then leave the app for raw SQL.
    await expect(
      page.getByRole('button', {
        name: `Open ${W7_NAMES.move} details`,
        exact: true,
        includeHidden: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Add a habit to start today's check-in.", { exact: true }),
    ).toBeVisible();
    await expectRows(
      page,
      "SELECT deleted_at IS NOT NULL AS deleted FROM habits WHERE id = 'habit_w7_move'",
      [{ deleted: 1 }],
    );
  });

  test('HEAVY history remains virtualized and bounded on activation and check-in', async ({
    page,
  }, testInfo) => {
    await seedW7Habits(page, 'heavy');
    const mounted = await page
      .getByRole('button', { name: /^Open Daily practice .* details$/ })
      .count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(120);
    await page
      .getByRole('tablist', { name: 'Section tabs' })
      .getByRole('button', { name: 'To Do', exact: true })
      .click();
    const activationStart = performance.now();
    await openW7Habits(page);
    await expect(
      page.getByRole('button', { name: 'Open Daily practice 001 details', exact: true }),
    ).toBeVisible();
    const activationMs = performance.now() - activationStart;
    // D14's established warm section-activation ceiling, not a new allowance.
    expect(activationMs).toBeLessThanOrEqual(800);
    const checkStart = performance.now();
    await page
      .getByRole('button', { name: 'Daily practice 001: 0 of 8 today. Add one.', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Daily practice 001: 1 of 8 today. Add one.', exact: true }),
    ).toBeVisible();
    const checkInMs = performance.now() - checkStart;
    expect(checkInMs).toBeLessThanOrEqual(800);
    await testInfo.attach('w7-heavy-timings.json', {
      body: JSON.stringify(
        { habits: 120, completionRows: 10800, mounted, activationMs, checkInMs },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n, SUM(count) AS total FROM habit_completions WHERE habit_id = 'habit_w7_heavy_0' AND date_key = '2026-08-10'",
    );
    expect(rows).toEqual([{ n: 1, total: 1 }]);
  });
});
