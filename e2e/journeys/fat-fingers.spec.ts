import { expect, type Locator, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { resetAll } from '../helpers/reset';
import { returnToApp } from '../helpers/dbHarness';
import {
  expectRows,
  expectUnchanged,
  switchSection,
  ACTIVE_SECTION_SELECTOR,
} from '../helpers/oracles';
import { openNewTodoModal, submitTodoModal } from '../helpers/navigation';
import { swipeLeftToRevealRowActions } from '../helpers/gestures';

/**
 * J7 — "Fat fingers" (P4, error-prone-user persona).
 *
 * The user double-taps, submits empty/over-length forms, deletes the wrong
 * item, cancels a delete, edits a card that changed underneath, and reloads
 * mid-save. The invariant everywhere is ONE row or ZERO, never TWO.
 *
 * Each scenario is asserted with a row-level oracle (SELECT COUNT) against the
 * real SQLite database, plus a negative oracle (expectUnchanged) where "nothing
 * must change" is the contract. Data is driven through the real UI at clumsy
 * speed (synchronous double-tap dispatch on the Pressable, i.e. the fastest a
 * human double-tap can physically land).
 *
 * D11 (in-memory session loss is the v1 contract): a reload mid-timer logs NO
 * pomodoro_sessions row, and an abandoned workout session logs NO workout_logs
 * row. The binding guarantee is that no partial session is ever persisted.
 *
 * NOTE: the double-tap helper dispatches two complete pointerdown/pointerup/
 * click sequences synchronously in the same task (mirroring how the existing
 * `clickSwipeDeleteAction` helper drives RN Web Pressables). This is the
 * degenerate "fastest possible double-tap" — the exact case J7 exists to catch.
 *
 * Step 11 preserves the strict one-row contract and now runs as a normal
 * regression after `fix-todo-add-double-submit` added a synchronous re-entry
 * guard around the async modal save path.
 *
 * ORDERING: the steps that SHOULD pass deterministically run first; the
 * double-submit probe (the most likely to expose an R5 duplicate-write defect)
 * runs last so a genuine defect aborts the least amount of the journey.
 */

/** Rapid-fire a full press sequence `times` times synchronously on a Pressable. */
async function rapidPress(locator: Locator, times: number): Promise<void> {
  await locator.evaluate((el, n) => {
    const btn = el as HTMLElement;
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      btn.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: i + 1,
          pointerType: 'mouse',
          isPrimary: true,
          buttons: 1,
        }),
      );
      btn.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: i + 1,
          pointerType: 'mouse',
          isPrimary: true,
          buttons: 0,
        }),
      );
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
      );
    }
  }, times);
}

/** Open the add-habit modal and create a habit through the real UI. */
async function createHabitViaUi(page: Page, name: string): Promise<void> {
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  const addTile = page
    .getByLabel('Habit groups')
    .getByText('Add', { exact: true })
    .first()
    .locator('xpath=preceding-sibling::*[1]');
  await addTile.click({ force: true });
  await nameField.waitFor({ state: 'visible', timeout: 8_000 });
  await nameField.fill(name);
  await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

/**
 * Toggle a todo's completion by firing a REAL pointer press sequence on the
 * semantic checkbox column of its row. This deliberately exercises the same
 * browser interaction path as a user press rather than mutating the DOM.
 */
async function toggleTodoCompletion(page: Page, title: string): Promise<void> {
  const textNode = page.getByText(title, { exact: true }).first();
  await textNode.waitFor({ state: 'visible', timeout: 15_000 });
  await textNode.scrollIntoViewIfNeeded();
  await textNode.evaluate((el) => {
    let n: HTMLElement | null = el as HTMLElement;
    for (let d = 0; d < 12 && n; d++) {
      const row = n.closest?.("[class*='flex-row']");
      if (row && row.children.length >= 2) {
        const box = row.children[1] as HTMLElement;
        const r = box.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        box.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 1,
          }),
        );
        box.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 0,
          }),
        );
        box.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
        return;
      }
      n = n.parentElement;
    }
  });
}

/** Enter habit edit mode and click the Delete button for the named habit. */
async function enterHabitEditAndDelete(page: Page, habitName: string): Promise<void> {
  await page.getByLabel('Enter habit edit mode').click({ force: true });
  await expect(page.getByLabel('Exit habit edit mode')).toBeVisible();
  // Scope to the ACTIVE section container: the mounted-but-inactive Overview
  // dashboard also renders the habit name in its preview card, which made the
  // unscoped ancestor walk resolve two Delete buttons (strict violation).
  const card = page
    .locator(ACTIVE_SECTION_SELECTOR)
    .getByText(habitName, { exact: true })
    .locator('xpath=ancestor::*[.//div[normalize-space(text())="Delete"]][1]');
  await card.getByText('Delete', { exact: true }).click({ force: true });
}

/** Click the confirmation dialog's Cancel button (habits/workout). */
async function cancelConfirmationDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByText('Cancel', { exact: true }).click({ force: true });
}

/** Click the confirmation dialog's confirm button (label e.g. 'Delete habit'). */
async function confirmConfirmationDialog(page: Page, label: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByText(label, { exact: true }).click({ force: true });
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
}

/** Reveal a todo row's swipe actions and click the Edit action for that row. */
async function openTodoEditModal(page: Page, title: string): Promise<void> {
  await swipeLeftToRevealRowActions(page, title);
  const row = page
    .getByText(title, { exact: true })
    .first()
    .locator(
      'xpath=ancestor::*[.//div[normalize-space(text())="Edit"] and .//div[normalize-space(text())="Delete"]][1]',
    );
  // The swipe-revealed actions sit at the bottom of a virtualized list; Playwright's
  // actionability-checked click fails with "outside of the viewport". Dispatch pointer
  // events directly, exactly like the proven `clickSwipeDeleteAction` helper.
  await row.getByLabel('Edit item').evaluate((el) => {
    const btn = el as HTMLElement;
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: 1,
      }),
    );
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: 0,
      }),
    );
    btn.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  });
  await expect(page.getByPlaceholder(/Add a task/i)).toBeVisible();
}

defineJourney({
  persona: 'P4 — Sam, the Error-Prone User',
  goal: 'fat-fingers: double-submit, double-increment, empty/over-length input, delete-cancel/wrong-item, stale edit, reload mid-save — one row or zero, never two',
  risks: ['R5', 'R8'],
  tags: ['@p4'],
  steps: [
    {
      name: 'reset to a clean device and confirm the empty baseline across all synced + local tables',
      run: async ({ page }) => {
        await resetAll(page);
        await returnToApp(page);
        await expectRows(
          page,
          'SELECT (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL) AS todos, (SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL) AS habits, (SELECT COUNT(*) FROM habit_completions) AS completions, (SELECT COUNT(*) FROM calorie_entries WHERE deleted_at IS NULL) AS calories, (SELECT COUNT(*) FROM pomodoro_sessions) AS pomodoros, (SELECT COUNT(*) FROM workout_logs) AS logs',
          (rows) => {
            expect(Number(rows[0]?.todos ?? 0)).toBe(0);
            expect(Number(rows[0]?.habits ?? 0)).toBe(0);
            expect(Number(rows[0]?.completions ?? 0)).toBe(0);
            expect(Number(rows[0]?.calories ?? 0)).toBe(0);
            expect(Number(rows[0]?.pomodoros ?? 0)).toBe(0);
            expect(Number(rows[0]?.logs ?? 0)).toBe(0);
          },
        );
      },
    },
    {
      name: 'empty title is rejected with a message and writes NO row',
      run: async ({ page }) => {
        await expectUnchanged(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          async (p) => {
            await switchSection(p, 'todos');
            await openNewTodoModal(p);
            await submitTodoModal(p);
            await expect(p.getByText('Task title is required.')).toBeVisible();
            await p.getByText('Cancel', { exact: true }).click({ force: true });
          },
        );
      },
    },
    {
      name: 'over-length title is rejected with a message and writes NO row',
      run: async ({ page }) => {
        await expectUnchanged(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          async (p) => {
            await switchSection(p, 'todos');
            await openNewTodoModal(p);
            await p.getByPlaceholder(/Add a task/i).fill('A'.repeat(201));
            await submitTodoModal(p);
            await expect(p.getByText('Title must be 200 characters or less.')).toBeVisible();
            await p.getByText('Cancel', { exact: true }).click({ force: true });
          },
        );
      },
    },
    {
      name: 'double-increment a habit: ONE completion row, count incremented twice (never two rows)',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'habits');
        await createHabitViaUi(page, 'Double-tap habit');
        // The ring is the Pressable that carries the habit's accessibility label.
        const ring = page.getByLabel(/Double-tap habit: \d+ of \d+ today/);
        await ring.waitFor({ state: 'visible' });
        await rapidPress(ring, 2);
        // The taps' async mutation chains outlive the dispatched events; the
        // SQL oracle below navigates the page away, which would abort an
        // in-flight transaction on slower runners. Wait for the ring to show
        // the committed count (2 of 2) before the oracle.
        await expect(ring).toHaveAttribute('aria-label', /Double-tap habit: 2 of \d+ today/, {
          timeout: 10_000,
        });
        // Row oracle: exactly one habit_completions row for this habit, count == 2.
        // (Fresh device: only these two increments can exist for the habit, so no
        // date-key filter is needed and no browser/SQLite TZ mismatch can flake.)
        await expectRows(
          page,
          "SELECT COUNT(*) AS n, COALESCE(SUM(count), 0) AS total FROM habit_completions WHERE habit_id = (SELECT id FROM habits WHERE name = 'Double-tap habit' AND deleted_at IS NULL)",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
            expect(Number(rows[0]?.total ?? 0)).toBe(2);
          },
        );
      },
    },
    {
      name: 'cancelling a habit delete leaves the row unchanged (negative oracle)',
      run: async ({ page }) => {
        await expectUnchanged(
          page,
          "SELECT id, name, deleted_at FROM habits WHERE name = 'Double-tap habit'",
          async (p) => {
            await switchSection(p, 'habits');
            await enterHabitEditAndDelete(p, 'Double-tap habit');
            await cancelConfirmationDialog(p);
            await expect(p.getByText('Double-tap habit', { exact: true }).first()).toBeVisible();
          },
        );
      },
    },
    {
      name: 'delete-the-wrong-item: confirming one delete leaves the neighbour untouched and soft-deletes the target',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'habits');
        await createHabitViaUi(page, 'Neighbour habit');
        await enterHabitEditAndDelete(page, 'Double-tap habit');
        await confirmConfirmationDialog(page, 'Delete habit');
        // Scope to the ACTIVE habits section: the mounted-but-inactive
        // Overview preview card keeps rendering the (now soft-deleted) habit
        // name until its next activation refresh — by-design staleness.
        await expect(
          page.locator(ACTIVE_SECTION_SELECTOR).getByText('Double-tap habit', { exact: true }),
        ).not.toBeVisible({ timeout: 15_000 });

        // Target is soft-deleted (still one row, deleted_at set — never hard-deleted).
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM habits WHERE name = 'Double-tap habit' AND deleted_at IS NOT NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );
        // The neighbour is untouched (still one live row).
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM habits WHERE name = 'Neighbour habit' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );
      },
    },
    {
      name: 'stale edit: editing a todo that another write-path changed updates in place, exactly one row (no duplicate)',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'todos');
        await openNewTodoModal(page);
        await page.getByPlaceholder(/Add a task/i).fill('Stale edit target');
        await submitTodoModal(page, { waitForClose: true });
        await expect(page.getByText('Stale edit target', { exact: true }).first()).toBeVisible();

        // Change the row through a DIFFERENT write path (the list toggle completes
        // it), then reveal the completed row and edit it. The save must update in
        // place, never duplicate.
        await toggleTodoCompletion(page, 'Stale edit target');
        await expect(page.getByText(/Show completed/).first()).toBeVisible();
        await page
          .getByText(/Show completed/)
          .first()
          .click();
        await expect(page.getByText('Stale edit target', { exact: true }).first()).toBeVisible();

        await openTodoEditModal(page, 'Stale edit target');
        await page.getByPlaceholder(/Add a task/i).fill('Stale edit saved');
        await page.getByText('Save changes', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('Stale edit saved', { exact: true }).first()).toBeVisible({
          timeout: 15_000,
        });

        // Exactly one row with the new title, zero with the old title — the edit
        // updated in place and never created a second row. The completion flag
        // from the other write path survives the edit.
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Stale edit saved' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Stale edit target' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(0);
          },
        );
        await expectRows(
          page,
          "SELECT completed FROM todos WHERE title = 'Stale edit saved' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.completed ?? 0)).toBe(1);
          },
        );
      },
    },
    {
      name: 'reload mid-save: exactly one row or zero, never two; app still usable after reload',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'todos');
        await openNewTodoModal(page);
        await page.getByPlaceholder(/Add a task/i).fill('Mid-save todo');
        // Click submit and reload without waiting for the modal to close.
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await returnToApp(page);
        // App still usable after the mid-save reload.
        await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
        // One-or-zero, never two.
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Mid-save todo' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBeLessThanOrEqual(1);
          },
        );
      },
    },
    {
      name: 'D11: reload mid-timer logs NO pomodoro_sessions row',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'pomodoro');
        await page.getByText('Start focus', { exact: true }).click();
        await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 5_000 });
        // Let the timer run a moment, then reload mid-session.
        await page.waitForTimeout(2_000);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await returnToApp(page);
        // No partial session was ever logged.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(0);
        });
      },
    },
    {
      name: 'D11: an abandoned workout session logs NO workout_logs row',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'workout');
        // Create a routine with an exercise via the real UI.
        await page.getByLabel('Routine name').fill('Abandoned routine');
        await page.getByText('Add routine', { exact: true }).click({ force: true });
        await expect(page.getByText('Abandoned routine', { exact: true }).first()).toBeVisible();

        // Open the routine detail and add an exercise so a session can start.
        await page.getByText('Abandoned routine', { exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Squats');
        await dialog.getByText('Add', { exact: true }).click({ force: true });
        await expect(dialog.getByText('Start workout', { exact: true })).toBeVisible();
        await dialog.getByText('Start workout', { exact: true }).click({ force: true });

        // Session screen is up; click Start so it is a genuinely running,
        // in-memory session, let it tick a moment, then abandon by reloading.
        await expect(page.getByText('Squats', { exact: true }).first()).toBeVisible();
        await page
          .getByText('Start', { exact: true })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(1_500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await returnToApp(page);

        // No workout_log row and no session-exercise rows were persisted.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM workout_logs', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(0);
        });
        await expectRows(page, 'SELECT COUNT(*) AS n FROM workout_session_exercises', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(0);
        });
      },
    },
    {
      name: 'double-submit add-todo lands exactly ONE row (never two)',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'todos');
        await openNewTodoModal(page);
        await page.getByPlaceholder(/Add a task/i).fill('Double-submit todo');
        // Two complete presses in the same tick — the fastest a double-tap can land.
        const submit = page.getByText('Add task', { exact: true }).locator('..');
        await rapidPress(submit, 2);
        await expect(page.getByText('Double-submit todo', { exact: true }).first()).toBeVisible();
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Double-submit todo' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );
      },
    },
  ],
});
