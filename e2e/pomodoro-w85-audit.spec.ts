import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { returnToApp } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { ACTIVE_SECTION_SELECTOR } from './helpers/oracles';
import { installClock } from './helpers/clock';

/**
 * W8.5 rendered-truth instrument (opt-in, like the W7/W8 audits): re-inspects
 * the Focus startup/lifecycle surfaces after the timer-start race fix so the
 * configuration withdrawal, the single startup action, and the phase copy are
 * verified from rendered output instead of assertions alone.
 *
 * Note on the STARTING phase: on web `scheduleTimerEndNotification()`
 * short-circuits before its first await, so a start resolves within one
 * microtask. The visible STARTING state is a native-permission-prompt concern
 * (the prompt itself holds the promise open) and cannot be screenshotted from
 * the static web export without injecting a production-only delay switch,
 * which this pass deliberately does not add. Its rendered surface is pinned
 * exactly — headline copy, the single disabled action label, the withdrawn
 * configuration — by the unit assertions in `tests/pomodoro.startup.test.ts`
 * (`resolvePhaseHeadline`, `resolvePhaseAnnouncement`, `resolveTimerStatus`,
 * `mayOfferConfiguration`), and the deterministic deferred-scheduling
 * behaviour is covered there and in
 * `tests/integration/pomodoroStartupIntent.test.ts`.
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w8.5';
test.skip(process.env.VISUAL_AUDIT !== '1', 'Opt-in rendered audit; run with VISUAL_AUDIT=1');
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

/** The Focus section's always-rendered identity: the accessible timer region. */
async function focusRegion(page: Page) {
  const region = page.locator(ACTIVE_SECTION_SELECTOR).getByLabel('Focus timer', { exact: true });
  await expect(region).toBeVisible({ timeout: 15_000 });
  return region;
}

async function openFocus(page: Page) {
  await goToTab(page, 'pomodoro');
  await focusRegion(page);
}

async function shot(page: Page, name: string) {
  await focusRegion(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

/** Shoot a modal state (end confirmation) over the settled Focus section. */
async function shotDialog(page: Page, name: string) {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

/**
 * The W8.5 surface contract, asserted at every captured state: exactly one
 * primary start action and no configuration surface once a session is claimed.
 */
async function expectSingleActionAndNoConfiguration(page: Page) {
  await expect(page.getByText('Start focus', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Focus timer mode' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage presets' })).toHaveCount(0);
  await expect(page.getByText('Link a todo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'History', exact: true })).toHaveCount(0);
}

/** Idle offers exactly one start action and the compact configuration entry. */
async function expectIdleConfiguration(page: Page) {
  await expect(page.getByText('Start focus', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('tablist', { name: 'Focus timer mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage presets' })).toBeVisible();
}

test.describe('W8.5 Focus startup surfaces', () => {
  test('idle configuration and the withdrawn session surface', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await seedFixture(page, 'TYPICAL');
    await openFocus(page);

    // Idle: exactly one primary action, compact configuration available.
    await expectIdleConfiguration(page);
    await shot(page, '390-focus-idle');

    await installClock(page);

    // The press is accepted: the configuration surface is withdrawn from the
    // first render after the press and exactly one session clock exists.
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await expectSingleActionAndNoConfiguration(page);
    await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveCount(1);
    await shot(page, '390-focus-running');

    // Paused: frozen clock, explicit label, resume dominant.
    await page.getByText('Pause', { exact: true }).click();
    await expect(page.getByText(/^Paused · Focus$/)).toBeVisible();
    await shot(page, '390-focus-paused');

    // The end confirmation: safe action first, destructive action danger.
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await expect(page.getByText('End this focus session?')).toBeVisible();
    await shotDialog(page, '390-focus-end-confirmation');
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Confirmed end returns to idle without logging — configuration is back.
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expectIdleConfiguration(page);
    await shot(page, '390-focus-idle-ended');

    // Completion frame: the finished duration is the dominant time.
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await page.clock.fastForward(25 * 60 * 1000);
    await expect(page.getByText('Focused 25 min')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Session complete', { exact: true })).toBeVisible();
    await shot(page, '390-focus-completed');

    // Idle again with one meaningful cycle sentence.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Session 2 of 4 next')).toBeVisible();
    await shot(page, '390-focus-idle-cycle-text');
  });

  test('dark theme, narrow viewport, and large-text running states', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await openFocus(page);

    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openFocus(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectIdleConfiguration(page);
    await shot(page, '390-dark-focus-idle');

    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await expectSingleActionAndNoConfiguration(page);
    await shot(page, '390-dark-focus-running');
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expectIdleConfiguration(page);

    // 360px: the narrowest supported layout.
    await page.setViewportSize({ width: 360, height: 800 });
    await shot(page, '360-focus-idle');
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    await expectSingleActionAndNoConfiguration(page);
    await shot(page, '360-focus-running');
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await shotDialog(page, '360-focus-end-confirmation');
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).click();

    // Large-text proxy: labels stay fully visible with no duplicate action.
    for (const label of await page.locator('[dir="auto"]').all()) {
      await label.evaluate((element) => {
        const computed = getComputedStyle(element);
        element.style.fontSize = `${parseFloat(computed.fontSize) * 2}px`;
        element.style.lineHeight = `${parseFloat(computed.lineHeight) * 2}px`;
      });
    }
    await shot(page, '360-focus-large-text');
  });
});
