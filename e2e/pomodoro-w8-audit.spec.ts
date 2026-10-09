import * as fs from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { returnToApp } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { ACTIVE_SECTION_SELECTOR } from './helpers/oracles';
import { installClock } from './helpers/clock';

/**
 * W8 rendered-truth instrument (opt-in, like the W7 audit): captures the six
 * Focus timer hierarchies, the end confirmation, cycle text, and the history
 * disclosure so SYS-08 / SYS-09 / SUR-09 can be closed from inspected renders
 * instead of assertions alone.
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w8';
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

test.describe('W8 Focus rendered truth', () => {
  test('idle, history disclosure, and the six timer hierarchies', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Populate history first: the harness reload destroys app React state, so
    // every row-level seed happens before any timer state exists.
    await resetAll(page);
    await returnToApp(page);
    await seedFixture(page, 'TYPICAL');
    await openFocus(page);

    // Idle: compact heading, selected duration, one start action, no dots.
    await shot(page, '390-focus-idle');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByText('Focus history', { exact: true })).toBeVisible();
    await shot(page, '390-focus-history');
    await page.getByRole('button', { name: 'Hide history', exact: true }).click();

    // Fake the clock now (the tick interval is created on Start, so the
    // already-booted app is unaffected) to reach completion deterministically.
    await installClock(page);

    // Running: countdown dominates; pause/end are the only controls; no config.
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await shot(page, '390-focus-running');

    // Paused: frozen clock, explicit label, resume dominant, end secondary.
    await page.getByText('Pause', { exact: true }).click();
    await expect(page.getByText('Resume', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Paused · Focus$/)).toBeVisible();
    await shot(page, '390-focus-paused');

    // The end confirmation: safe action first, destructive action danger.
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await expect(page.getByText('End this focus session?')).toBeVisible();
    await shotDialog(page, '390-focus-end-confirmation');
    // Cancel keeps the paused clock exactly as it was.
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Resume', { exact: true })).toBeVisible();

    // Confirmed end returns to idle without logging.
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();

    // Completion frame: the finished duration is the dominant time; the next
    // session's full duration is never painted as the current countdown.
    await page.getByText('Start focus', { exact: true }).click();
    await page.clock.fastForward(25 * 60 * 1000);
    await expect(page.getByText('Focused 25 min')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Session complete', { exact: true })).toBeVisible();
    await shot(page, '390-focus-completed');

    // Idle again with one meaningful cycle sentence (no dot row repeating it).
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Session 2 of 4 next')).toBeVisible();
    await shot(page, '390-focus-idle-cycle-text');

    // Break hierarchy: phase label distinguishes the break, controls unchanged.
    await page.getByRole('button', { name: 'Start short break' }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible();
    await shot(page, '390-focus-break-running');

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      `${OUT}/README.md`,
      `# W8 Focus rendered audit

Captured with \`VISUAL_AUDIT=1\` against the static web export (390×844 unless
noted). States: idle, history disclosure, running, paused, end confirmation,
completed frame, idle with cycle text, and a running short break.

- \`390-focus-idle\` — compact heading, selected duration, one start action, no dots (SYS-08)
- \`390-focus-history\` — secondary disclosure: recent sessions, garden, heatmap, stats
- \`390-focus-running\` — countdown dominates; Pause/End only (SYS-08)
- \`390-focus-paused\` — frozen clock, explicit paused label, resume dominant
- \`390-focus-end-confirmation\` — safe action first, destructive action danger (SYS-09)
- \`390-focus-completed\` — finished duration dominant; no next-duration digits
- \`390-focus-idle-cycle-text\` — one meaningful cycle sentence (SUR-09)
- \`390-focus-break-running\` — break label distinct without a saturated slab
`,
    );
  });

  test('dark theme, narrow viewport, and large-text running states', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await openFocus(page);

    // Dark idle + running.
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openFocus(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(page, '390-dark-focus-idle');
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await shot(page, '390-dark-focus-running');
    // End the dark session through the confirmation (labels must not clip).
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();

    // 360px: the narrowest supported layout.
    await page.setViewportSize({ width: 360, height: 800 });
    await shot(page, '360-focus-idle');
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();
    await shot(page, '360-focus-running');
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await shotDialog(page, '360-focus-end-confirmation');
    await page.getByRole('dialog').getByRole('button', { name: 'Keep focusing' }).click();

    // Large-text proxy on the running controls: labels stay fully visible.
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
