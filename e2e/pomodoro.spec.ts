import { test, expect } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { installClock } from './helpers/clock';

test.describe('Pomodoro', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'pomodoro');
    await clearDatabase(page);
    await goToTab(page, 'pomodoro');
  });

  test('shows idle state on first load', async ({ page }) => {
    await expect(page.getByText('25:00')).toBeVisible();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();
    // Idle shows no placeholder session dots and no documentation subtitle.
    await expect(page.getByText('Classic sequence: focus → short breaks → long break')).toHaveCount(
      0,
    );
  });

  test('shows empty session history behind the History entry', async ({ page }) => {
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByText('Complete a session to start your garden')).toBeVisible();
    await expect(page.locator('text=/ min$/')).toHaveCount(0);
  });

  test('starts timer and shows running state', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    const timer = page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/);
    await expect(timer).not.toHaveText('25:00', { timeout: 5_000 });
    // Running hides the idle configuration surfaces (presets, duration entry,
    // link-a-todo, and the history disclosure).
    await expect(page.getByRole('button', { name: 'Manage presets' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'History', exact: true })).toHaveCount(0);
    await expect(page.getByText('Link a todo')).toHaveCount(0);
  });

  test('ends a running session only after confirmation', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });

    await page.getByRole('button', { name: 'End', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('End this focus session?')).toBeVisible();
    await expect(dialog.getByText("This unfinished session won't be logged.")).toBeVisible();

    // Cancelling preserves the running session and its deadline.
    await dialog.getByRole('button', { name: 'Keep focusing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).not.toHaveText('25:00', {
      timeout: 5_000,
    });

    // Confirming ends the session without logging it and returns to idle.
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('25:00')).toBeVisible();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();

    // The abandoned session was never logged.
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  test('authoring a custom preset persists through app_meta', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const manager = page.getByRole('dialog');
    await manager.getByRole('button', { name: 'New preset' }).click();
    await manager.getByRole('textbox', { name: 'Preset name' }).fill('Laptop focus');
    await manager.getByRole('textbox', { name: 'Preset focus minutes' }).fill('45');
    await manager.getByRole('button', { name: 'Create preset' }).click();
    await expect(manager.getByRole('button', { name: 'Delete preset Laptop focus' })).toBeVisible();
    await manager.getByLabel('Close').click();
    // The new preset is immediately selectable on the main card; its chip
    // label carries the focus/break summary, unlike the manager's buttons.
    await expect(page.getByRole('button', { name: /^Laptop focus · / })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`);
    expect(String(rows[0]?.value)).toContain('Laptop focus');
    await returnToApp(page);
    await goToTab(page, 'pomodoro');

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Manage presets' }).click();
    await expect(page.getByRole('dialog').getByText('Laptop focus')).toBeVisible();
  });

  test('logged session gets a post-hoc note and todo link from history', async ({ page }) => {
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Write report');
    await submitTodoModal(page, { waitForClose: true });

    await queryRows(
      page,
      `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES ('pom_e2e_corr', datetime('now'), datetime('now', '+25 minutes'), 1500, 'focus', datetime('now'))`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');

    // Recent sessions live behind the secondary History entry.
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: /Edit focus session from/ })
      .first()
      .click();
    const editor = page.getByRole('dialog');
    await expect(editor.getByText('Edit focus session')).toBeVisible();
    await editor.getByRole('textbox', { name: 'Session note' }).fill('Finished the report draft');
    await editor.getByRole('button', { name: 'Link todo Write report' }).click();
    await editor.getByRole('button', { name: 'Save session changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 });

    // The history row now shows the linked title and the corrected note.
    const row = page.getByRole('button', { name: /Edit focus session from/ }).first();
    await expect(row.getByText('Write report')).toBeVisible();
    await expect(row.getByText('“Finished the report draft”')).toBeVisible();

    const rows = await queryRows(
      page,
      `SELECT note, linked_todo_title FROM pomodoro_sessions WHERE id = 'pom_e2e_corr'`,
    );
    expect(rows[0]?.note).toBe('Finished the report draft');
    expect(rows[0]?.linked_todo_title).toBe('Write report');
    const intents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_e2e_corr'`,
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);
    await returnToApp(page);
  });

  test('the completion frame shows the finished duration until dismissed', async ({ page }) => {
    // Fake the clock before the countdown interval exists so the session can
    // finish deterministically; the tick timer is created on Start.
    await installClock(page);
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.clock.fastForward(25 * 60 * 1000);

    // The dominant time is the duration just completed — the next session's
    // full duration is never painted as the current countdown.
    await expect(page.getByText('Session complete', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Focused 25 min')).toBeVisible();
    await expect(page.locator('.text-5xl')).toHaveCount(0);
    // The just-logged session offers its optional note entry.
    await expect(page.getByText('What did you focus on?')).toBeVisible();

    // One clear next action starts the advanced mode; Done dismisses to idle.
    await expect(page.getByRole('button', { name: 'Start short break' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Focused 25 min')).toHaveCount(0);
    // Dismissing reveals the idle timer at the next mode's selected duration
    // with the in-cycle position stated once — and no dot row repeating it.
    await expect(page.getByText('05:00')).toBeVisible();
    await expect(page.getByText('Session 2 of 4 next')).toBeVisible();

    // Exactly one focus session was logged, with active-time duration.
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE session_type = 'focus'",
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
  });

  test('automatic progression starts the next session once', async ({ page }) => {
    await installClock(page);
    // Sprint auto-starts the following break and the next focus.
    await page.getByRole('button', { name: /^Sprint · / }).click();
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.clock.fastForward(15 * 60 * 1000);

    // One break session starts after the completion beat; the countdown
    // belongs to the break, not a second focus session.
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await expect(page.getByText('Start focus', { exact: true })).toHaveCount(0);

    // The break finishing auto-starts focus once; still a single clock.
    await page.clock.fastForward(3 * 60 * 1000);
    await expect(page.getByLabel(/^Focus running, \d{2}:\d{2} remaining$/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();

    // Only the completed focus was logged — breaks never write rows, and the
    // completion itself never logs twice.
    const rows = await queryRows(
      page,
      'SELECT COUNT(*) AS n, SUM(duration_seconds) AS total FROM pomodoro_sessions',
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
    expect(Number(rows[0]?.total ?? 0)).toBe(15 * 60);
  });

  test('a paused session reconciles as interrupted after reload', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.getByText('Pause', { exact: true }).click();
    await expect(page.getByText('Resume', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'pomodoro');

    // Interrupted, not completed: distinct truthful copy and no row written.
    await expect(page.getByText('Previous session interrupted')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Interrupted sessions are never logged.')).toBeVisible();
    await expect(page.getByText('Focused 25 min')).toHaveCount(0);
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  test('cancelling the end confirmation keeps a paused clock frozen', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.getByText('Pause', { exact: true }).click();
    await expect(page.getByText('Resume', { exact: true })).toBeVisible();
    const frozen = await page
      .locator('.text-5xl')
      .getByText(/^\d{2}:\d{2}$/)
      .textContent();

    await page.getByRole('button', { name: 'End', exact: true }).click();
    // Break-shaped confirmation for a focus session.
    await expect(page.getByRole('dialog').getByText('End this focus session?')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Resume', { exact: true })).toBeVisible();
    await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText(String(frozen));
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  test('end labels do not clip at 360px under large text', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible({ timeout: 3_000 });

    // Large-text proxy: double every rendered text node's font size, then
    // prove the Pause/End labels still render fully (no ellipsis clipping)
    // and stay inside the viewport with a 44pt hit target.
    for (const label of await page.locator('[dir="auto"]').all()) {
      await label.evaluate((element) => {
        const computed = getComputedStyle(element);
        element.style.fontSize = `${parseFloat(computed.fontSize) * 2}px`;
        element.style.lineHeight = `${parseFloat(computed.lineHeight) * 2}px`;
      });
    }
    for (const name of ['Pause', 'End']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const notClipped = await control.evaluate((element) => {
        const text = element.querySelector('[dir="auto"]');
        if (!text) return true;
        return text.scrollWidth <= text.clientWidth + 1;
      });
      expect(notClipped, `${name} label is fully visible`).toBe(true);
    }
  });

  test('the end confirmation is keyboard reachable on web', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible({ timeout: 3_000 });

    const endControl = page.getByRole('button', { name: 'End', exact: true });
    await endControl.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Focus moves into the confirmation and Tab cycles inside it.
    const insideAfterOpen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(insideAfterOpen).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(document.activeElement) ?? false;
      });
      expect(inside, `focus stays inside the confirmation after Tab ${i + 1}`).toBe(true);
    }

    // Cancelling with the keyboard dismisses and returns focus to End.
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const restored = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? '',
    );
    expect(restored).toBe('End');
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
  });

  test('confirming end after natural completion keeps the logged session', async ({ page }) => {
    await installClock(page);
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('End this focus session?')).toBeVisible();

    await page.clock.fastForward(25 * 60 * 1000);
    await expect(page.getByText('Focused 25 min')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Focused 25 min')).toBeVisible();
    await expect(page.getByText('Session ended — nothing logged')).toHaveCount(0);
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE session_type = 'focus'",
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
  });

  test('a repeated start press starts only one session', async ({ page }) => {
    const start = page.getByText('Start focus', { exact: true });
    // Two presses landing in one interaction. Whichever one wins, exactly one
    // session may exist and the configuration may never come back.
    await Promise.all([start.click({ force: true }), start.click({ force: true })]);
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });

    await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveCount(1);
    await expect(page.getByText('Start focus', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manage presets' })).toHaveCount(0);
    await expect(page.getByRole('tablist', { name: 'Focus timer mode' })).toHaveCount(0);
    await expect(page.getByText('Link a todo')).toHaveCount(0);

    await page.getByRole('button', { name: 'End', exact: true }).click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  test('selecting a mode before a start still starts the selected mode', async ({ page }) => {
    // Guard regression: the synchronous mode-selector guard must not swallow an
    // ordinary idle selection. A mode chosen while nothing is claimed still
    // governs the next start.
    await page.getByRole('tab', { name: 'Short Break', exact: true }).click();
    await expect(page.getByText('05:00')).toBeVisible();

    await page.getByText('Start short break', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible();

    await page.getByRole('button', { name: 'End', exact: true }).click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: 'End break' }).click();
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions');
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  test('a stale end confirmation does not discard the auto-started next session', async ({
    page,
  }) => {
    await installClock(page);
    await page.getByRole('button', { name: /^Sprint · / }).click();
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('End this focus session?')).toBeVisible();

    await page.clock.fastForward(15 * 60 * 1000);
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await expect(page.getByText('Session ended — nothing logged')).toHaveCount(0);
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE session_type = 'focus'",
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(1);
  });
});
