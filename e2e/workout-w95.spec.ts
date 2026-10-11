import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';

/**
 * W9.5 workout convergence regressions.
 *
 * P1 — save integrity: a finish whose log write is skipped (its routine was
 * soft-deleted mid-session) must NOT report a saved workout, clear the draft,
 * or earn XP, and it must explain the actual cause while keeping the entered
 * sets. The skipped-write state itself cannot be staged in this browser
 * fixture — entering the DB harness destroys the live session's React state,
 * and the landing's resume path re-validates the routine before it can start
 * — so that behavior is proven deterministically by
 * `tests/workoutSessionSave.test.ts` (the decision contract) and
 * `tests/integration/workoutSaveIntegrity.data.test.ts` (real-SQLite
 * oracles: zero rows on a skipped finish, draft retention, no reward). This
 * file proves the rendered browser behavior that IS stageable: a committed
 * finish keeps exactly one log and one reward attribution; a rapid double
 * Finish stays exactly-once; and the landing has exactly one page-level
 * scroll authority with its desktop cap intact.
 *
 * P2 — scroll structure: the Workout landing renders exactly one page-level
 * scroll container and keeps its desktop content-width cap.
 *
 * SQL oracles stay strict; selectors rely on documented labels.
 */

test.describe('W9.5 Workout convergence', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  async function openRoutineBuilder(page: Page, name: string) {
    await fillRoutineName(page, name);
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByText(name, { exact: true }).first().click();
    return page.getByRole('dialog').filter({ hasText: 'Routine builder' });
  }

  async function buildStartedSession(page: Page, name: string) {
    await openRoutineBuilder(page, name);
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
  }

  test('a resumed session still saves exactly once with one reward attribution', async ({
    page,
  }) => {
    // Leave mid-session (the draft persists), resume from the landing, and
    // finish: the resumed save commits exactly one log and one reward, and
    // the durable draft is cleaned up only by the success path.
    await openRoutineBuilder(page, 'Resume Save Day');
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByText('Start', { exact: true }).first().click();
    await page.getByRole('button', { name: 'End workout' }).click();
    await expect(page.getByText('Leave workout?')).toBeVisible();
    await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Resume workout · Resume Save Day' }),
    ).toBeVisible();
    // Leaving returns to the routine's detail modal; close it to reach the
    // landing, then resume in the same page (no DB-context handoff means the
    // live landing state and its single Resume authority are intact).
    await page.getByLabel('Close').click();
    await page.getByRole('button', { name: 'Resume workout · Resume Save Day' }).click();
    await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('80');

    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Done', { exact: true }).click();

    const logs = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs[0]?.n)).toBe(1);
    const rewards = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM gamification_events WHERE event_kind = 'workout'",
    );
    expect(Number(rewards[0]?.n)).toBe(1);
    // The success path — not the failure path — owns draft cleanup.
    const draft = await queryRows(
      page,
      "SELECT value FROM app_meta WHERE key = 'workout.active_session_draft'",
    );
    expect(draft).toHaveLength(0);
  });

  test('a committed save stays exactly one log with one reward attribution', async ({ page }) => {
    await buildStartedSession(page, 'Good Save Day');

    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    // No bookkeeping-failure note on the clean path.
    await expect(page.getByText(/Some cleanup after saving/)).toHaveCount(0);
    await page.getByText('Done', { exact: true }).click();

    const logs = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs[0]?.n)).toBe(1);

    // Exactly one reward event, attributed to the committed log id.
    const logId = (await queryRows(page, 'SELECT id FROM workout_logs'))[0]?.id as string;
    const rewards = await queryRows(
      page,
      "SELECT source_key FROM gamification_events WHERE event_kind = 'workout'",
    );
    expect(rewards).toEqual([{ source_key: logId }]);

    // The durable draft was cleaned up by the success path.
    const draft = await queryRows(
      page,
      "SELECT value FROM app_meta WHERE key = 'workout.active_session_draft'",
    );
    expect(draft).toHaveLength(0);
  });

  test('a rapid double Finish stays idempotent', async ({ page }) => {
    await buildStartedSession(page, 'Double Finish Day');

    const saveButton = page.getByText('Save and finish', { exact: true });
    await Promise.all([
      saveButton.click({ noWaitAfter: true, force: true }).catch(() => {}),
      saveButton.click({ noWaitAfter: true, force: true }).catch(() => {}),
    ]);

    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Done', { exact: true }).click();

    const logs = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs[0]?.n)).toBe(1);
    const rewards = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM gamification_events WHERE event_kind = 'workout'",
    );
    expect(Number(rewards[0]?.n)).toBe(1);
  });

  /** Page-level scroll authorities on the current landing. */
  async function pageScrollContainers(page: Page) {
    return page.evaluate(() => {
      // The single-page shell's active section container (same style trio as
      // ACTIVE_SECTION_SELECTOR in helpers/oracles).
      const section = document.querySelector<HTMLElement>(
        'div[style*="pointer-events: auto"][style*="z-index: 1"][style*="opacity: 1"]',
      );
      const root: HTMLElement = section ?? document.body;
      const found: { overflowY: string; scrollable: boolean }[] = [];
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const style = getComputedStyle(el);
        if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
        // Only page-sized containers count: inner clipped panes are not page
        // scroll authorities.
        if (el.clientHeight < 200) continue;
        found.push({ overflowY: style.overflowY, scrollable: el.scrollHeight > el.clientHeight });
      }
      return found.filter((s) => s.scrollable);
    });
  }

  for (const width of [360, 390, 412, 768, 1280]) {
    test(`the landing has exactly one page-level scroll container at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await fillRoutineName(page, 'Scroll Day');
      await page.getByText('Add routine', { exact: true }).click();
      await expect(page.getByText('Scroll Day')).toBeVisible();
      // Expand the heavy history stack so the page genuinely overflows.
      await page.getByRole('button', { name: 'History and insights' }).click();

      // Exactly one scroll container owns the page at this width.
      const pageScrollers = await pageScrollContainers(page);
      expect(pageScrollers).toHaveLength(1);

      // The single authority actually owns the page scroll.
      const moved = await page.evaluate(() => {
        const scroller = Array.from(document.querySelectorAll('*')).find((el) => {
          const style = getComputedStyle(el);
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.clientHeight >= 200 &&
            el.scrollHeight > el.clientHeight
          );
        });
        if (!scroller) return false;
        const before = scroller.scrollTop;
        scroller.scrollTop = scroller.scrollHeight;
        const after = scroller.scrollTop;
        scroller.scrollTop = before;
        return after > before;
      });
      expect(moved).toBe(true);
    });
  }

  test('the desktop landing keeps its content-width cap', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await fillRoutineName(page, 'Wide Day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Wide Day')).toBeVisible();

    // The landing's content column is capped and centered at content-max
    // widths: layout.contentMaxWidth = 760.
    const capped = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>(
        'div[style*="pointer-events: auto"][style*="z-index: 1"][style*="opacity: 1"]',
      );
      const root: HTMLElement = section ?? document.body;
      const cappedEl = Array.from(root.querySelectorAll('*')).find((el) => {
        const max = parseFloat(getComputedStyle(el).maxWidth);
        return Number.isFinite(max) && max > 0 && max < 1000;
      });
      if (!cappedEl) return null;
      return {
        width: cappedEl.getBoundingClientRect().width,
        maxWidth: parseFloat(getComputedStyle(cappedEl).maxWidth),
      };
    });
    expect(capped?.maxWidth).toBe(760);
    expect(capped!.width).toBeLessThanOrEqual(760);
  });

  test('keyboard focus in the routine form stays usable inside the scroll page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await fillRoutineName(page, 'Keyboard Day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Keyboard Day')).toBeVisible();
    // Let the section crossfade settle before focusing: a mid-transition
    // re-render can remount the input and drop the focus.
    await page.waitForTimeout(600);

    const nameField = page.getByRole('textbox', { name: 'New routine name' });
    await nameField.focus();
    await expect(nameField).toBeFocused();
    // Keyboard entry reaches the focused field.
    await nameField.pressSequentially('7', { delay: 50 });
    await expect(nameField).toHaveValue(/7/);
    // The page still scrolls while the keyboard field holds focus.
    const moved = await page.evaluate(() => {
      const scroller = Array.from(document.querySelectorAll('*')).find((el) => {
        const style = getComputedStyle(el);
        return (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.clientHeight >= 200 &&
          el.scrollHeight > el.clientHeight
        );
      });
      if (!scroller) return false;
      const before = scroller.scrollTop;
      scroller.scrollTop = scroller.scrollHeight;
      const after = scroller.scrollTop;
      scroller.scrollTop = before;
      return after > before;
    });
    expect(moved).toBe(true);
    // Tab moves focus to another editable element of the same form: the
    // routine form stays keyboard-reachable inside the scroll page.
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName ?? '',
        label: el?.getAttribute('aria-label') ?? '',
        placeholder: (el as HTMLInputElement | null)?.placeholder ?? '',
      };
    });
    expect(focused.tag).toBe('INPUT');
    expect(focused.placeholder).toBe('Bench + accessories');
    // The primary form action stays reachable for activation from the keyboard.
    const addRoutine = page.getByRole('button', { name: 'Add routine' });
    await expect(addRoutine).toBeVisible();
    const reachable = await addRoutine.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight + 1;
    });
    expect(reachable).toBe(true);
  });
});
