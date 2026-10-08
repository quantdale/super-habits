import { expect, type Locator, type Page } from '@playwright/test';
import { seedFixture, seedSql } from './seed';
import { queryRows, returnToApp } from './dbHarness';
import { goToTab } from './navigation';

/** Reuse HEAVY, adding deterministic history to exercise >200 pending/results
 * and >200 completed rows. No shared fixture volumes or domain rules change.
 * Like seedFixture, these are historical raw-SQL rows, not UI writes/outbox.
 */
export async function seedTodoHeavy(page: Page) {
  await seedFixture(page, 'HEAVY');
  const rows = Array.from({ length: 320 }, (_, index) => {
    const done = index >= 160;
    const title = done ? `History task ${index - 159}` : `Task HEAVY ${index + 201}`;
    return `INSERT INTO todos (id,title,completed,completed_at,priority,sort_order,created_at,updated_at)
      VALUES ('todo_heavy_extra_${index}','${title}',${done ? 1 : 0},${done ? "'2026-01-01T00:00:00Z'" : 'NULL'},'normal',${index + 201},'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');`;
  });
  await seedSql(
    page,
    rows.join('\n') +
      `
    INSERT INTO projects (id,name,color,status,sort_order,created_at,updated_at)
    VALUES ('proj_heavy','HEAVY project','#3b82f6','active',1,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');`,
  );
  await returnToApp(page);
  await goToTab(page, 'todos');
  await expect(page.getByRole('checkbox', { name: /^Mark complete:/ }).first()).toBeVisible();
  const open = Number(((await page.getByText(/^\d+ open$/).textContent()) ?? '').split(' ')[0]);
  const completed = Number(
    ((await page.getByText(/^\d+ completed$/).textContent()) ?? '').split(' ')[0],
  );
  expect(open).toBeGreaterThan(200);
  expect(completed).toBeGreaterThan(200);
  return { open, completed, seeded: 520 };
}

/** Semantic row anchor -> actual scroll owner (no test IDs or private RN API). */
export async function todoScrollBox(page: Page) {
  return page
    .locator(
      '[role="checkbox"][aria-label^="Mark "], [role="checkbox"][aria-label^="Select "], [role="checkbox"][aria-label^="Deselect "]',
    )
    .first()
    .evaluate((row) => {
      let current = row.parentElement;
      while (current) {
        const style = getComputedStyle(current);
        if (/auto|scroll/.test(style.overflowY) && current.scrollHeight > current.clientHeight) {
          const rect = current.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
        current = current.parentElement;
      }
      throw new Error('Todo rows do not have a bounded scrolling owner');
    });
}

/** Real wheel input: scrollIntoView alone cannot discover unmounted rows. The
 * 40ms cadence models scroll event delivery, as in three-months-in's harness.
 */
export async function scrollTodoListTo(page: Page, target: Locator) {
  const box = await todoScrollBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let sweep = 0; sweep < 100; sweep++) {
    if (await target.count()) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeInViewport();
      return;
    }
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(40);
  }
  throw new Error(`Todo virtualized scrolling did not reach ${String(target)}`);
}

export async function scrollTodoListToTop(page: Page) {
  await page
    .locator(
      '[role="checkbox"][aria-label^="Mark "], [role="checkbox"][aria-label^="Select "], [role="checkbox"][aria-label^="Deselect "]',
    )
    .first()
    .evaluate((row) => {
      let current = row.parentElement;
      while (current) {
        if (
          /auto|scroll/.test(getComputedStyle(current).overflowY) &&
          current.scrollHeight > current.clientHeight
        ) {
          current.scrollTop = 0;
          return;
        }
        current = current.parentElement;
      }
      throw new Error('Todo scrolling owner not found');
    });
}

export async function todoOrderSnapshot(page: Page) {
  return queryRows(
    page,
    'SELECT id,sort_order FROM todos WHERE completed=0 AND deleted_at IS NULL ORDER BY id',
  );
}
