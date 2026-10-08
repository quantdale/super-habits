import * as fs from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { resetAll } from './helpers/reset';
import { returnToApp, runSql } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { ACTIVE_SECTION_SELECTOR } from './helpers/oracles';
import {
  seedW7Habits,
  openW7Habits,
  openW7Detail,
  selectW7Detail,
  W7_NAMES,
} from './helpers/habitsW7';

/** Explicit rendered-evidence instrument, not an approved pixel baseline. */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w7';
test.skip(process.env.VISUAL_AUDIT !== '1', 'Opt-in rendered audit; run with VISUAL_AUDIT=1');
test.describe.configure({ mode: 'serial' });
// One test deliberately walks the full ten-width matrix, not one interaction.
test.setTimeout(180_000);

async function shot(page: Page, name: string) {
  await expect(
    page.locator(ACTIVE_SECTION_SELECTOR).getByText('Daily check-in', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByLabel('Loading activity heatmap', { exact: true })).toHaveCount(0);
  // screenshot(animations:disabled) cannot fast-forward RN's JS spring.
  // Observe the selected pill at its destination with stable geometry instead
  // of sleeping; this also catches a mismatched selected/painted state.
  await page.evaluate(() => {
    (
      window as unknown as { __w7PillSettle: { signature: string; frames: number } }
    ).__w7PillSettle = { signature: '', frames: 0 };
  });
  await page.waitForFunction(() => {
    const state = (
      window as unknown as {
        __w7PillSettle: { signature: string; frames: number };
      }
    ).__w7PillSettle;
    const positions: string[] = [];
    let atDestination = true;
    for (const control of Array.from(document.querySelectorAll('[role="tablist"]'))) {
      if (control.closest('[inert], [aria-hidden="true"]')) continue;
      const selected = control.querySelector('[role="tab"][aria-selected="true"]');
      const pill = Array.from(control.children).find(
        (child) => getComputedStyle(child).position === 'absolute',
      );
      if (!selected || !pill || control.getBoundingClientRect().width === 0) continue;
      const painted = pill.getBoundingClientRect();
      const target = selected.getBoundingClientRect();
      // onLayout includes the tray's 1px borders, while flex layout excludes
      // them: accumulated final offset is <2px even in a four-option tray.
      atDestination &&= Math.abs(painted.left - target.left) <= 2;
      positions.push(
        `${target.left.toFixed(2)}:${painted.left.toFixed(2)}:${painted.width.toFixed(2)}`,
      );
    }
    const signature = positions.join('|');
    state.frames = atDestination && signature === state.signature ? state.frames + 1 : 0;
    state.signature = signature;
    return atDestination && state.frames >= 3;
  });
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}
async function close(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
}
async function readyModal(page: Page) {
  await expect(page.getByRole('dialog').locator('[style*="max-height"]').first()).toHaveCSS(
    'opacity',
    '1',
  );
}

test.describe('W7 rendered truth', () => {
  test('populated width matrix and neutral large target', async ({ page }) => {
    await seedW7Habits(page);
    for (const width of [360, 390, 412, 768, 899, 900, 901, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 1024 });
      await expect(
        page.getByRole('button', { name: `Open ${W7_NAMES.move} details`, exact: true }),
      ).toBeVisible();
      const today = page.getByRole('button', { name: /^Monday, today:/ });
      await expect(today).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(
          async () => {
            const day = (await today.boundingBox())!;
            const strip = (await page
              .getByLabel('Check-in day picker', { exact: true })
              .boundingBox())!;
            return day.x >= strip.x - 0.5 && day.x + day.width <= strip.x + strip.width + 0.5;
          },
          { message: `${width}: Today remains fully visible after viewport resize` },
        )
        .toBe(true);
      const actualWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(actualWidth, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(width);
      await shot(page, `${width}-habits-populated`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const count = page.getByLabel('Read 99 pages progress 0 of 99', { exact: true });
    await count.scrollIntoViewIfNeeded();
    await expect(count).not.toHaveCSS('color', 'rgb(239, 68, 68)');
    await shot(page, '390-habits-0-of-99');
  });

  test('empty and dark phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await openW7Habits(page);
    await expect(
      page.getByText("Add a habit to start today's check-in.", { exact: true }),
    ).toBeVisible();
    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((value) => localStorage.setItem('superhabits.theme.mode', value), mode);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await openW7Habits(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await expect(page.getByRole('button', { name: 'Trends', exact: true })).toBeVisible();
      await shot(page, mode === 'light' ? '390-habits-empty' : '390-dark-habits-empty');
      await page.getByRole('button', { name: 'Trends', exact: true }).click();
      await readyModal(page);
      await expect(page.getByRole('dialog')).toContainText('0%');
      await shot(
        page,
        mode === 'light' ? '390-habits-empty-trends' : '390-dark-habits-empty-trends',
      );
      await close(page);
    }
    await seedW7Habits(page);
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openW7Habits(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.getByRole('button', { name: `Open ${W7_NAMES.move} details`, exact: true }),
    ).toBeVisible();
    await shot(page, '390-dark-habits-populated');
    await openW7Detail(page, W7_NAMES.water);
    await readyModal(page);
    await shot(page, '390-dark-habit-today');
  });

  test('quantitative, all complete, rest, lifecycle and long metadata', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedW7Habits(page, 'quantitative');
    await shot(page, '390-habits-quantitative-zero');
    await page
      .getByRole('button', { name: 'Drink water: 0 of 8 today. Add one.', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Drink water: 1 of 8 today. Add one.', exact: true }),
    ).toBeVisible();
    await shot(page, '390-habits-quantitative-partial');
    await seedW7Habits(page, 'complete');
    await expect(page.getByText('4 of 4 done today', { exact: true })).toBeVisible();
    await shot(page, '390-habits-all-complete');
    await seedW7Habits(page, 'rest');
    await expect(page.getByText('Nothing scheduled today', { exact: true })).toBeVisible();
    await shot(page, '390-habits-rest-day');
    await openW7Detail(page, W7_NAMES.rest);
    await readyModal(page);
    await shot(page, '390-habit-rest-disabled');
    await seedW7Habits(page, 'lifecycle');
    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    await page.getByRole('tab', { name: 'Filter habits: All', exact: true }).click();
    await close(page);
    await shot(page, '390-habits-lifecycle');
    await openW7Detail(page, W7_NAMES.paused);
    await readyModal(page);
    await shot(page, '390-habit-paused-disabled');
    await selectW7Detail(page, 'Settings');
    await shot(page, '390-habit-paused-settings');
    await seedW7Habits(page, 'long');
    await page
      .getByRole('button', { name: `Open ${W7_NAMES.long} details`, exact: true })
      .scrollIntoViewIfNeeded();
    await shot(page, '390-habits-long-name');
  });

  test('detail sections, editor, filters and historical target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedW7Habits(page);
    await openW7Detail(page, W7_NAMES.water);
    await readyModal(page);
    await shot(page, '390-habit-today');
    await selectW7Detail(page, 'Progress');
    await shot(page, '390-habit-progress');
    await page.getByText('Recent target vs actual', { exact: true }).scrollIntoViewIfNeeded();
    await shot(page, '390-habit-progress-history');
    await selectW7Detail(page, 'Settings');
    await shot(page, '390-habit-settings');
    await page.getByRole('button', { name: 'Edit habit', exact: true }).click();
    await expect(page.getByLabel('Habit name', { exact: true })).toBeVisible();
    await readyModal(page);
    await shot(page, '390-habit-editor');
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Monday scheduled', exact: true }),
    ).toBeChecked();
    await shot(page, '390-habit-editor-custom-schedule');
    await page.getByRole('button', { name: 'Save changes', exact: true }).scrollIntoViewIfNeeded();
    await shot(page, '390-habit-editor-footer');
    await close(page);
    await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
    await readyModal(page);
    await shot(page, '390-habits-filter-sort');
    await close(page);
    await page.getByRole('button', { name: /^Sunday:/ }).click();
    await expect(
      page.getByRole('button', { name: 'Drink water: 5 of 8 on Sun 9. Add one.', exact: true }),
    ).toBeVisible();
    await shot(page, '390-habits-historical');
    await openW7Detail(page, W7_NAMES.water);
    await readyModal(page);
    await shot(page, '390-habit-historical-today');
    await close(page);
    await page.getByRole('button', { name: /^Thursday:/ }).click();
    await expect(
      page.getByRole('checkbox', { name: /^Drink water: 0 of 1 on Thu 6/ }),
    ).toBeVisible();
    await shot(page, '390-habits-historical-old-target');
    await page.getByRole('button', { name: 'Trends', exact: true }).click();
    await readyModal(page);
    await expect(page.getByText('Highest current streak', { exact: true })).toBeVisible();
    await shot(page, '390-habits-trends');
    await page.setViewportSize({ width: 1280, height: 1024 });
    await shot(page, '1280-habits-trends');
  });

  test('keyboard, reduced motion and large-text browser proxy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedW7Habits(page, 'long');
    await page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }).focus();
    await shot(page, '390-habits-keyboard-focus');
    await openW7Detail(page, W7_NAMES.move);
    await shot(page, '390-habit-reduced-motion');
    await close(page);
    const details = page.getByRole('button', {
      name: `Open ${W7_NAMES.long} details`,
      exact: true,
    });
    await details.scrollIntoViewIfNeeded();
    for (const text of await details.locator('[dir="auto"]').all())
      await text.evaluate((element) => {
        const computed = getComputedStyle(element);
        element.style.fontSize = `${parseFloat(computed.fontSize) * 2}px`;
        element.style.lineHeight = `${parseFloat(computed.lineHeight) * 2}px`;
      });
    expect(await details.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
    await details.scrollIntoViewIfNeeded();
    await shot(page, '390-habits-large-type-proxy');
  });

  test('canonical HEAVY and 120-habit history stress', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedFixture(page, 'HEAVY');
    await returnToApp(page);
    await openW7Habits(page);
    await expect(
      page.getByRole('button', { name: /^Open Habit .* details$/ }).first(),
    ).toBeVisible();
    await shot(page, '390-habits-heavy');
    await seedW7Habits(page, 'heavy');
    await shot(page, '390-habits-history-stress');
    const mounted = await page
      .getByRole('button', { name: /^Open Daily practice .* details$/ })
      .count();
    expect(mounted).toBeLessThan(120);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      `${OUT}/heavy-volume.json`,
      JSON.stringify(
        { canonicalFixture: 'HEAVY', stressHabits: 120, stressCompletions: 10800, mounted },
        null,
        2,
      ) + '\n',
    );
  });

  test('slow completion loading and failed-write recovery', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedW7Habits(page, 'single');
    // Delay only SELECT messages at the actual worker boundary; no app hooks
    // or mocked DB. The test explicitly releases every held request.
    await page.addInitScript(() => {
      const original = Worker.prototype.postMessage;
      const held: (() => void)[] = [];
      let holding = true;
      (window as unknown as { __w7Release(): void }).__w7Release = () => {
        holding = false;
        for (const send of held.splice(0)) send();
      };
      Worker.prototype.postMessage = function (
        message: unknown,
        transferOrOptions?: Transferable[] | StructuredSerializeOptions,
      ) {
        const options = Array.isArray(transferOrOptions)
          ? { transfer: transferOrOptions }
          : transferOrOptions;
        const send = () => original.call(this, message, options);
        if (holding && /SELECT.*habit_completions/is.test(JSON.stringify(message))) held.push(send);
        else send();
      };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openW7Habits(page);
    await expect(page.getByLabel('Loading habits', { exact: true })).toBeVisible();
    await shot(page, '390-habits-loading');
    await page.evaluate(() => (window as unknown as { __w7Release(): void }).__w7Release());
    await expect(
      page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }),
    ).toBeVisible();
    await runSql(
      page,
      "CREATE TRIGGER w7_audit_failed_write BEFORE INSERT ON habit_completions BEGIN SELECT RAISE(ABORT, 'W7 intentional failure'); END;",
    );
    await returnToApp(page);
    await page.evaluate(() => (window as unknown as { __w7Release(): void }).__w7Release());
    await openW7Habits(page);
    await page.getByRole('checkbox', { name: /^Stretch for five minutes: 0 of 1 today/ }).click();
    await expect(page.getByRole('alert')).toHaveText('Check-in did not save. Try again.');
    await shot(page, '390-habits-write-error');
    await runSql(page, 'DROP TRIGGER w7_audit_failed_write;');
  });
});
