import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import {
  seedTodoHeavy,
  scrollTodoListTo,
  scrollTodoListToTop,
  todoOrderSnapshot,
} from './helpers/todoHeavy';

test.describe('W6.5 To Do convergence', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('standard row density, touch targets, and expanding content', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const titles = [
      'Plain task',
      'Task with metadata',
      'Call insurance about the renewed policy premium schedule',
      'Review insurance and confirm the quarterly billing schedule',
    ];
    await seedSql(
      page,
      titles
        .map(
          (title, i) =>
            `INSERT INTO todos (id,title,completed,priority,sort_order,created_at,updated_at) VALUES ('todo_density_${i}','${title}',0,'${i % 2 ? 'urgent' : 'normal'}',${i},'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');`,
        )
        .join('\n'),
    );
    await returnToApp(page);
    await goToTab(page, 'todos');
    const measurements = [];
    for (const title of titles) {
      const row = page.getByRole('button', { name: `Edit task: ${title}`, exact: true });
      await expect(row).toBeVisible();
      const checkbox = row.getByRole('checkbox', { name: `Mark complete: ${title}`, exact: true });
      measurements.push({
        title,
        row: (await row.boundingBox())?.height,
        checkbox: (await checkbox.boundingBox())?.height,
        more: (await row.getByRole('button', { name: `More actions for ${title}` }).boundingBox())
          ?.height,
        titleHeight: (await row.getByText(title, { exact: true }).boundingBox())?.height,
      });
    }
    await testInfo.attach('todo-row-geometry.json', {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
    // eslint-disable-next-line no-console -- measured QA evidence, also attached
    console.log('[W6.5 geometry]', JSON.stringify(measurements));
    for (const measurement of measurements.slice(0, 2)) {
      expect(measurement.row).toBeGreaterThanOrEqual(48);
      expect(measurement.row).toBeLessThanOrEqual(56);
    }
    for (const measurement of measurements) {
      // Chromium's transformed rect subtraction can return 47.9999847 for a
      // computed 48px box. Round only sub-millipixel floating-point noise; a
      // meaningful target shrink (even 0.01px) still fails this contract.
      expect(Number(measurement.checkbox!.toFixed(3))).toBeGreaterThanOrEqual(48);
      expect(Number(measurement.more!.toFixed(3))).toBeGreaterThanOrEqual(44);
    }
    expect(measurements[2].titleHeight).toBeGreaterThan(measurements[0].titleHeight!);
    expect(measurements[3].row).toBeGreaterThan(measurements[0].row!);

    // Browser large-type proxy, not a claim of largest-OS-font native coverage.
    for (const title of titles) {
      const text = page
        .getByRole('button', { name: `Edit task: ${title}`, exact: true })
        .getByText(title, { exact: true });
      await text.evaluate((element) => {
        element.style.fontSize = '30px';
        element.style.lineHeight = '40px';
      });
    }
    const longRow = page.getByRole('button', { name: `Edit task: ${titles[3]}`, exact: true });
    await longRow.scrollIntoViewIfNeeded();
    expect((await longRow.boundingBox())!.height).toBeGreaterThan(56);
    const longText = longRow.getByText(titles[3], { exact: true });
    expect(await longText.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
    await testInfo.attach('todo-large-type.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('HEAVY normal, search, filter, and empty results own bounded scrolling', async ({
    page,
  }, testInfo) => {
    const volume = await seedTodoHeavy(page);
    const orderBefore = await todoOrderSnapshot(page);
    await returnToApp(page);
    await goToTab(page, 'todos');
    const mountedRows = () => page.getByRole('button', { name: /^Edit task:/ }).count();
    expect(await mountedRows()).toBeLessThan(volume.open);
    await scrollTodoListTo(
      page,
      page.getByRole('button', { name: 'Edit task: Task 200', exact: true }),
    );
    await scrollTodoListTo(
      page,
      page.getByRole('button', { name: 'Edit task: Task HEAVY 360', exact: true }),
    );
    expect(await mountedRows()).toBeLessThan(volume.open);

    const search = page.getByRole('textbox', { name: 'Search tasks' });
    const started = Date.now();
    await search.fill('Task');
    await expect(page.getByText(/^Overdue \(\d+\)$/)).toBeVisible();
    const searchMs = Date.now() - started;
    expect(searchMs, 'HEAVY Todo query input response (D14 500ms)').toBeLessThanOrEqual(500);
    await expect(search).toBeFocused();
    expect(await mountedRows()).toBeLessThan(volume.open);
    await scrollTodoListTo(
      page,
      page.getByRole('button', { name: 'Edit task: Task HEAVY 360', exact: true }),
    );
    expect(await mountedRows()).toBeLessThan(volume.open);
    await search.fill('no such task exists');
    await expect(page.getByText('No matching tasks', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();

    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'No date', exact: true }).click();
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    const header = page.getByText(/^No date \(\d+\)$/);
    await expect(header).toBeVisible();
    const filtered = Number((await header.textContent())!.match(/\((\d+)\)/)![1]);
    expect(filtered).toBeGreaterThan(200);
    expect(await mountedRows()).toBeLessThan(filtered);
    await scrollTodoListTo(
      page,
      page.getByRole('button', { name: 'Edit task: Task HEAVY 360', exact: true }),
    );
    await page.getByRole('button', { name: /Filter and sort, 1 active/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.getByRole('button', { name: 'Filter and sort', exact: true })).toBeVisible();
    expect(await todoOrderSnapshot(page)).toEqual(orderBefore);
    await testInfo.attach('heavy-query.json', {
      body: JSON.stringify({ ...volume, filtered, searchMs }),
      contentType: 'application/json',
    });
    // eslint-disable-next-line no-console -- measured QA evidence, also attached
    console.log('[W6.5 HEAVY query]', JSON.stringify({ ...volume, filtered, searchMs }));
  });

  test('HEAVY selection survives off-screen windows and Select all uses visible ids', async ({
    page,
  }, testInfo) => {
    const volume = await seedTodoHeavy(page);
    await page.getByRole('button', { name: 'Enter multi-select mode' }).click();
    const selectionRows = () => page.getByRole('checkbox', { name: /^(Select|Deselect) / });
    expect(await selectionRows().count()).toBeLessThan(volume.open);
    await expect(page.getByRole('checkbox', { name: /^Mark incomplete:/ })).toHaveCount(0);
    const firstTen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const row = page.getByRole('checkbox', { name: /^Select / }).first();
      const title = (await row.getAttribute('aria-label'))!.slice('Select '.length);
      firstTen.push(title);
      await row.click();
      await expect(page.getByText(`${i + 1} selected`, { exact: true })).toBeVisible();
    }
    // SectionList deliberately pins the initial batch. Select a middle row
    // outside that batch, then prove it unmounts and restores its checked id.
    const middle = page.getByRole('checkbox', { name: 'Select Task HEAVY 220', exact: true });
    await scrollTodoListTo(page, middle);
    await middle.click();
    await expect(page.getByText('11 selected', { exact: true })).toBeVisible();
    const deep = page.getByRole('checkbox', { name: 'Select Task HEAVY 360', exact: true });
    await scrollTodoListTo(page, deep);
    await deep.click();
    await expect(page.getByText('12 selected', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Deselect Task HEAVY 220', exact: true }),
    ).toHaveCount(0);
    await scrollTodoListToTop(page);
    const selectedAgain = page.getByRole('checkbox', {
      name: 'Deselect Task HEAVY 220',
      exact: true,
    });
    await scrollTodoListTo(page, selectedAgain);
    await expect(selectedAgain).toHaveAttribute('aria-checked', 'true');
    await selectedAgain.focus();
    // RN Web Pressable's checkbox role activates with Enter (Space is
    // button-role-only in this pinned runtime); assert the supported contract.
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('checkbox', { name: 'Select Task HEAVY 220', exact: true }),
    ).toBeFocused();
    await expect(page.getByText('11 selected', { exact: true })).toBeVisible();
    await scrollTodoListToTop(page);
    await page.getByRole('checkbox', { name: `Deselect ${firstTen[0]}`, exact: true }).click();
    await expect(page.getByText('10 selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Select all tasks', exact: true }).click();
    await expect(page.getByText(`${volume.open} selected`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Deselect all tasks', exact: true }).click();
    await expect(page.getByText('0 selected', { exact: true })).toBeVisible();

    // Equal-sized but different result sets must not be mistaken for all
    // selected simply because both have 10 ids.
    const search = page.getByRole('textbox', { name: 'Search tasks' });
    await search.fill('Task HEAVY 22');
    await page.getByRole('button', { name: 'Select all tasks', exact: true }).click();
    await expect(page.getByText('10 selected', { exact: true })).toBeVisible();
    await search.fill('Task HEAVY 23');
    await expect(page.getByRole('button', { name: 'Select all tasks', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Select all tasks', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Select Task HEAVY 230', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'Deselect Task HEAVY 230', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');

    // Change the visible result set without exiting mode; no completed ids,
    // no invisible pending ids are included by Select all.
    await search.fill('Task HEAVY');
    await page.getByRole('button', { name: 'Select all tasks', exact: true }).click();
    await expect(page.getByText('160 selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter multi-select mode' })).toBeVisible();
    const rows = await queryRows(
      page,
      `SELECT completed,COUNT(*) AS n FROM todos WHERE title LIKE 'Task HEAVY %' GROUP BY completed`,
    );
    expect(rows).toEqual([{ completed: 1, n: 160 }]);
    const otherPending = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND completed=0`,
    );
    expect(otherPending).toEqual([{ n: volume.open - 160 }]);
    await testInfo.attach('heavy-selection.json', {
      body: JSON.stringify({ ...volume, firstTen, completedVisible: 160 }),
      contentType: 'application/json',
    });
  });

  test('HEAVY completed expansion windows history, scrolls deeply, and collapses safely', async ({
    page,
  }, testInfo) => {
    const volume = await seedTodoHeavy(page);
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await expect(page.getByRole('button', { name: 'Hide completed tasks' })).toBeVisible();
    expect(await page.getByRole('checkbox', { name: /^Mark incomplete:/ }).count()).toBeLessThan(
      volume.completed,
    );
    await scrollTodoListTo(
      page,
      page.getByRole('checkbox', { name: 'Mark incomplete: History task 160', exact: true }),
    );
    expect(await page.getByRole('checkbox', { name: /^Mark incomplete:/ }).count()).toBeLessThan(
      volume.completed,
    );
    const completedWindow = await page.getByRole('checkbox', { name: /^Mark incomplete:/ }).count();
    await scrollTodoListToTop(page);
    await page.getByRole('button', { name: 'Hide completed tasks' }).click();
    await expect(page.getByRole('checkbox', { name: /^Mark incomplete:/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show completed tasks' })).toBeVisible();
    await testInfo.attach('heavy-completed.json', {
      body: JSON.stringify({ ...volume, completedWindow }),
      contentType: 'application/json',
    });
    // eslint-disable-next-line no-console -- measured QA evidence, also attached
    console.log('[W6.5 HEAVY completed]', JSON.stringify({ ...volume, completedWindow }));
  });

  test('manual drag writes the full pending order after completed expansion collapses', async ({
    page,
  }) => {
    for (const title of ['Order Alpha', 'Order Beta', 'Order Gamma']) {
      await page.getByPlaceholder('Quick add', { exact: true }).fill(title);
      await page.getByRole('button', { name: 'Add task', exact: true }).click();
      await expect(
        page.getByRole('button', { name: `Edit task: ${title}`, exact: true }),
      ).toBeVisible();
    }
    await page.getByPlaceholder('Quick add', { exact: true }).fill('Order Done');
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Mark complete: Order Done', exact: true }).click();
    await expect(page.getByText('3 open', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Order Done', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Hide completed tasks' }).click();
    const alpha = page
      .getByRole('button', { name: 'Edit task: Order Alpha', exact: true })
      .getByText('Order Alpha', { exact: true });
    const gamma = page
      .getByRole('button', { name: 'Edit task: Order Gamma', exact: true })
      .getByText('Order Gamma', { exact: true });
    const from = (await alpha.boundingBox())!;
    const to = (await gamma.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // Deliberate long-press gesture (> TodoItem.delayLongPress), not readiness.
    await page.waitForTimeout(250);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height, { steps: 15 });
    await page.mouse.up();
    await expect
      .poll(() => page.getByRole('button', { name: /^Edit task: Order/ }).allTextContents())
      .toEqual([
        expect.stringContaining('Order Beta'),
        expect.stringContaining('Order Gamma'),
        expect.stringContaining('Order Alpha'),
      ]);
    const rows = await queryRows(
      page,
      `SELECT title,sort_order FROM todos WHERE deleted_at IS NULL AND completed=0 ORDER BY sort_order`,
    );
    expect(rows).toEqual([
      { title: 'Order Beta', sort_order: 1 },
      { title: 'Order Gamma', sort_order: 2 },
      { title: 'Order Alpha', sort_order: 3 },
    ]);
  });

  test('bulk priority, project assignment, delete confirmation and cancellation preserve semantics', async ({
    page,
  }) => {
    await seedTodoHeavy(page);
    const enter = async () => {
      await page.getByRole('button', { name: 'Enter multi-select mode' }).click();
      await page.getByRole('textbox', { name: 'Search tasks' }).fill('Task HEAVY 201');
      await page.getByRole('checkbox', { name: 'Select Task HEAVY 201', exact: true }).click();
      await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
    };
    await enter();
    await page.getByRole('button', { name: 'urgent', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter multi-select mode' })).toBeVisible();
    await enter();
    await page.getByRole('button', { name: 'HEAVY project', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter multi-select mode' })).toBeVisible();
    await enter();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete 1 selected task?', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter multi-select mode' })).toBeVisible();
    const rows = await queryRows(
      page,
      `SELECT priority,project_id,deleted_at FROM todos WHERE title='Task HEAVY 201'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ priority: 'urgent', project_id: 'proj_heavy' });
    expect(rows[0].deleted_at).not.toBeNull();
    const outbox = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity='todos' AND id='todo_heavy_extra_0'`,
    );
    expect(outbox).toEqual([{ operation: 'delete' }]);
  });
});
