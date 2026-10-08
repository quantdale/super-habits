import { test, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { seedFixture } from './helpers/seed';
import { resetAll } from './helpers/reset';
import { seedTodoHeavy, scrollTodoListTo, scrollTodoListToTop } from './helpers/todoHeavy';

/**
 * Frontend V3 "Calm Momentum" — current-state visual audit harness.
 *
 * This is the campaign's W1 rendered-truth instrument: it renders the app in
 * controlled states and captures deterministic screenshots into
 * `docs/ui-ux/v3-audit/` for human/model visual inspection and the defect
 * ledger (`docs/ui-ux/13-calm-momentum-design-system.md` companion ledgers).
 *
 * It is NOT part of the default `npm run e2e` battery: the suite only runs
 * when `VISUAL_AUDIT=1` is set, e.g.
 *
 *   VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts
 *
 * The captures are `page.screenshot()` evidence (no `toHaveScreenshot`
 * assertions). Curated regression baselines are a separate, later deliverable
 * (campaign W15) so that early captures are never treated as "approved".
 */

// A convergence wave writes a fresh evidence directory, preserving W1–W6.
const OUT_DIR = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit';

const audit = test.extend({});
test.skip(process.env.VISUAL_AUDIT !== '1', 'Set VISUAL_AUDIT=1 to run the visual audit');
test.describe.configure({ mode: 'serial' });

// Each audit pass seeds fixtures and walks many surfaces; the 60s default
// single-test timeout is far too small for the walk.
test.setTimeout(300_000);

async function shot(page: Page, name: string) {
  await page.waitForTimeout(350); // settle cross-fade/entrance animations
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` });
}

/** Viewport presets used by the audit matrix. */
const PHONE = { width: 390, height: 844 };
const PHONE_NARROW = { width: 360, height: 740 };
const PHONE_WIDE = { width: 412, height: 915 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

async function setViewport(page: Page, vp: { width: number; height: number }) {
  await page.setViewportSize(vp);
  await page.waitForTimeout(250);
}

async function setDark(page: Page, dark: boolean) {
  await page.addInitScript(
    ([mode]) => {
      window.localStorage.setItem('superhabits.theme.mode', mode);
    },
    [dark ? 'dark' : 'light'] as const,
  );
}

/** Open the quick-capture sheet via the FAB and settle. */
async function openQuickCapture(page: Page) {
  await page.getByRole('button', { name: 'Quick capture' }).click();
  await page
    .getByPlaceholder('What do you want to remember?')
    .waitFor({ state: 'visible', timeout: 10_000 });
}

/** Best-effort UI probe: runs `action`, never throws. */
async function probe(action: () => Promise<void>) {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

audit.describe('V3 current-state audit', () => {
  audit('populated phone matrix (light)', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE);
    await goToTab(page, 'overview');
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await page.waitForTimeout(900);

    // Primary destinations.
    await shot(page, '390-overview-populated');
    await goToTab(page, 'todos');
    await shot(page, '390-todos-populated');
    await goToTab(page, 'habits');
    await shot(page, '390-habits-populated');
    await goToTab(page, 'pomodoro');
    await shot(page, '390-pomodoro-idle');
    await goToTab(page, 'workout');
    await shot(page, '390-workout-populated');
    await goToTab(page, 'calories');
    await shot(page, '390-calories-populated');

    // Health parent surface + child routing (V3 five-destination model).
    await goToTab(page, 'health');
    await shot(page, '390-health');
    await goToTab(page, 'workout');
    await shot(page, '390-workout-via-health');

    // Secondary experiences.
    await goToTab(page, 'overview');
    await openQuickCapture(page);
    await shot(page, '390-quick-capture-open');
    await page.keyboard.press('Escape');
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));

    await probe(async () => {
      await page.getByRole('button', { name: 'Open settings' }).click();
      await page.getByText('Appearance', { exact: true }).first().waitFor({ timeout: 8000 });
      await shot(page, '390-settings-top');
      await page
        .getByText('Backup / Sync / Restore', { exact: true })
        .first()
        .scrollIntoViewIfNeeded();
      await shot(page, '390-settings-backup');
      await page
        .getByText('Developer / Internal', { exact: true })
        .first()
        .scrollIntoViewIfNeeded();
      await shot(page, '390-settings-bottom');
    });
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));

    await probe(async () => {
      await page.getByRole('button', { name: 'Plan today' }).click();
      await page.waitForTimeout(700);
      await shot(page, '390-planning-hub-today');
    });
    await probe(async () => {
      // Weekly Review lives in the hub's Progress view.
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Progress', exact: true }).click({ timeout: 8000 });
      await page.waitForTimeout(500);
      await dialog.getByRole('button', { name: 'Open weekly review' }).click({ timeout: 8000 });
      await page.waitForTimeout(700);
      await shot(page, '390-weekly-review');
    });
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));

    await probe(async () => {
      await page
        .getByText(/level|achievements/i)
        .first()
        .click({ timeout: 4000 });
      await page.waitForTimeout(700);
      await shot(page, '390-achievements');
      await page.keyboard.press('Escape');
    });
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));

    // Command Center via quick capture → Describe it.
    await probe(async () => {
      await openQuickCapture(page);
      await page.getByRole('button', { name: 'Describe it' }).click();
      await page.waitForTimeout(800);
      await shot(page, '390-command-center');
      await page.keyboard.press('Escape');
    });
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));
  });

  audit('populated detail surfaces (phone)', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE);
    await goToTab(page, 'todos');
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'todos');

    // Todo edit modal — tap the first pending todo row's title.
    await probe(async () => {
      const row = page
        .locator('[role="button"]')
        .filter({ hasText: /todo|task/i })
        .first();
      await row.click({ timeout: 4000 });
      await page.waitForTimeout(600);
      await shot(page, '390-todo-edit-modal');
      await page.keyboard.press('Escape');
    });
    await probe(() => page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }));

    // Active focus session.
    await goToTab(page, 'pomodoro');
    await probe(async () => {
      await page.getByRole('button', { name: /^start focus$/i }).click({ timeout: 4000 });
      await page.waitForTimeout(1200);
      await shot(page, '390-pomodoro-running');
    });

    // Active workout session (best effort — flow entry varies by fixture).
    await goToTab(page, 'workout');
    await shot(page, '390-workout-detail-routines');
    await probe(async () => {
      await page.getByRole('button', { name: /start/i }).first().click({ timeout: 4000 });
      await page.waitForTimeout(1200);
      await shot(page, '390-workout-active-session');
    });

    // Calorie add flow.
    await goToTab(page, 'calories');
    await probe(async () => {
      await page.getByRole('button', { name: /add/i }).first().click({ timeout: 4000 });
      await page.waitForTimeout(600);
      await shot(page, '390-calories-add');
    });
  });

  audit('empty/first-run states (phone, light)', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE);
    await goToTab(page, 'overview');
    await resetAll(page);
    await goToTab(page, 'overview');
    await page.waitForTimeout(900);
    await shot(page, '390-overview-first-run');

    for (const tab of ['todos', 'habits', 'pomodoro', 'workout', 'calories'] as const) {
      await goToTab(page, tab);
      await shot(page, `390-${tab}-empty`);
    }
  });

  audit('dark theme populated matrix (phone)', async ({ page }) => {
    await setDark(page, true);
    await setViewport(page, PHONE);
    await goToTab(page, 'overview');
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await page.waitForTimeout(900);

    await shot(page, '390-dark-overview');
    await goToTab(page, 'todos');
    await shot(page, '390-dark-todos');
    await goToTab(page, 'habits');
    await shot(page, '390-dark-habits');
    await goToTab(page, 'pomodoro');
    await shot(page, '390-dark-pomodoro');
    await goToTab(page, 'workout');
    await shot(page, '390-dark-workout');
    await goToTab(page, 'calories');
    await shot(page, '390-dark-calories');
  });

  audit('responsive matrix (populated, light)', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE_WIDE);
    await goToTab(page, 'overview');
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await page.waitForTimeout(900);

    await setViewport(page, PHONE_NARROW);
    await shot(page, '360-overview');
    await goToTab(page, 'todos');
    await shot(page, '360-todos');
    await goToTab(page, 'workout');
    await shot(page, '360-workout');

    await setViewport(page, TABLET);
    await goToTab(page, 'overview');
    await shot(page, '768-overview');
    await goToTab(page, 'todos');
    await shot(page, '768-todos');
    await goToTab(page, 'habits');
    await shot(page, '768-habits');
    await goToTab(page, 'workout');
    await shot(page, '768-workout');
    await goToTab(page, 'calories');
    await shot(page, '768-calories');

    // Desktop rail layout.
    await setViewport(page, DESKTOP);
    for (const tab of ['overview', 'todos', 'habits', 'pomodoro', 'workout', 'calories'] as const) {
      await goToTab(page, tab);
      await shot(page, `1280-${tab}`);
    }

    // Rail breakpoint boundary probes (±1/±2 px around 900).
    for (const w of [898, 899, 900, 901]) {
      await setViewport(page, { width: w, height: 800 });
      await shot(page, `breakpoint-${w}-overview`);
    }
  });

  audit('W6 To Do states (long-title, bulk, completed, HEAVY)', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE);
    await goToTab(page, 'todos');
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'todos');
    await page.waitForTimeout(900);

    // Long title + rich metadata must not break row geometry (brief §25).
    const longTitle =
      'Call the insurance company about the renewed policy premium schedule before the end of the quarterly billing window';
    await page.getByPlaceholder('Quick add', { exact: true }).fill(longTitle);
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    await scrollTodoListTo(
      page,
      page.getByRole('button', { name: `Edit task: ${longTitle}`, exact: true }),
    );
    await shot(page, '390-todos-long-title');

    // Bulk mode: distinct chrome, obvious selected count and exit (brief §21).
    await page.getByRole('button', { name: 'Enter multi-select mode' }).click();
    const firstSelect = page.getByRole('checkbox', { name: /^Select / }).first();
    await firstSelect.click();
    await page.waitForTimeout(300);
    await shot(page, '390-todos-bulk-select');
    await page.getByRole('button', { name: 'Exit multi-select mode' }).click();

    // Completed group: quiet, readable, collapsed behind one toggle (brief §22).
    const completeBox = page.getByRole('checkbox', { name: /^Mark complete: / }).first();
    await completeBox.click();
    await page.waitForTimeout(700);
    await page.getByText('Show completed', { exact: true }).click();
    await scrollTodoListTo(page, page.getByRole('checkbox', { name: /^Mark incomplete:/ }).first());
    await shot(page, '390-todos-completed-group');

    // HEAVY state: 200+ seeded todos through the virtualized list (brief §24).
    await seedFixture(page, 'HEAVY');
    await goToTab(page, 'todos');
    await page.waitForTimeout(1200);
    await shot(page, '390-todos-heavy');
    await setViewport(page, DESKTOP);
    await page.waitForTimeout(600);
    await shot(page, '1280-todos-heavy');
  });

  audit('W6.5 HEAVY query/selection/history and planning capture accents', async ({ page }) => {
    await setDark(page, false);
    await setViewport(page, PHONE);
    await goToTab(page, 'todos');
    await seedTodoHeavy(page);
    await page.getByRole('textbox', { name: 'Search tasks' }).fill('Task');
    await shot(page, '390-todos-heavy-search');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'No date', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await shot(page, '390-todos-heavy-filter');
    await page.getByRole('button', { name: 'Enter multi-select mode' }).click();
    await page
      .getByRole('checkbox', { name: /^Select / })
      .first()
      .click();
    await shot(page, '390-todos-heavy-selection');
    await page.getByRole('button', { name: 'Exit multi-select mode' }).click();
    await page.getByRole('button', { name: /Filter and sort, 1 active/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset filters' }).click();
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await scrollTodoListTo(
      page,
      page.getByRole('checkbox', { name: 'Mark incomplete: History task 160', exact: true }),
    );
    await shot(page, '390-todos-heavy-completed');
    await scrollTodoListToTop(page);
    await page.getByRole('button', { name: 'Hide completed tasks' }).click();
    await openQuickCapture(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Project', exact: true }).click();
    await shot(page, '390-quick-capture-project');
    await page.getByRole('dialog').getByRole('button', { name: 'Goal', exact: true }).click();
    await shot(page, '390-quick-capture-goal');
  });
});
