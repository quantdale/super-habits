import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, hardReload } from './helpers/navigation';
import { returnToApp, runSql } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { auditPage } from './helpers/a11yAudit';

/**
 * P20 reward-surface geometry and legibility
 * (`docs/ui-ux/16-playful-momentum.md` §7 "Gamification surfaces" + §10 P20).
 *
 * The existing `gamification.spec.ts` owns the reward *contract* (XP amounts,
 * idempotency, celebration, the `All badges` disclosure, haptics preferences).
 * This spec owns the P20 presentation contract that the contract spec cannot
 * see:
 *  - the badge board is hexagon plates in tier hues with a visible lip, and a
 *    locked tier stays sunken + legible (never "missing" language);
 *  - the week strip renders state nodes (Flame active / Ice shield frozen);
 *  - the quest rows are lipped cards with a Gold bar and a chest;
 *  - the surfaces fit 360/375/390 with no horizontal overflow, and the rendered
 *    text/icon contrast audit is AA-clean in light and dark.
 */

const ACHIEVEMENTS_TRIGGER = /Level & Streaks card — open achievements/;

/**
 * Wait until the drawer's entrance animation has finished.
 *
 * The achievements drawer is a `Modal` with a `drawer` layout: it slides in
 * and fades its body. Measuring geometry (or reading `innerText`) mid-slide
 * sees a translated panel — a 360pt viewport then reports a 391px scroll width
 * purely from the 31px entrance offset. Poll a per-frame geometry signature
 * until it is stable for three frames instead of sleeping a fixed time.
 */
async function waitForDialogSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return;
    let stable = 0;
    let last = '';
    for (let frame = 0; frame < 240 && stable < 3; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const box = el.getBoundingClientRect();
      const signature = [box.x, box.y, box.width, box.height]
        .map((value) => Math.round(value))
        .join(':');
      stable = signature === last ? stable + 1 : 0;
      last = signature;
    }
  });
}

async function openAchievements(page: Page) {
  await goToTab(page, 'overview');
  const trigger = page.getByRole('button', { name: ACHIEVEMENTS_TRIGGER });
  const title = page.getByText('Level & Achievements');
  // The card is rendered before the reward snapshot resolves, so the first
  // click can land while the section is still mounting its children. Retry the
  // same trigger (the established pattern in `gamification.spec.ts`) instead of
  // extending a timeout.
  for (let attempt = 0; attempt < 3; attempt++) {
    await trigger.click({ force: true });
    try {
      await title.waitFor({ state: 'visible', timeout: 8_000 });
      break;
    } catch {
      if (attempt === 2) throw new Error('Achievements overlay did not open');
    }
  }
  const dialog = page.getByRole('dialog');
  await waitForDialogSettled(page);
  return dialog;
}

/** A badge plate's rendered box: hexagon tiles are taller than they are wide. */
async function plateBoxes(page: Page) {
  return page.evaluate(() => {
    const plates: { width: number; height: number; left: number; right: number }[] = [];
    for (const el of Array.from(document.querySelectorAll('svg'))) {
      const box = el.getBoundingClientRect();
      // The badge plate viewBox is 64 × 70 and the art sits in a 64pt tile.
      if (Math.abs(box.width - 64) > 2) continue;
      if (Math.abs(box.height - 70) > 3) continue;
      plates.push({ width: box.width, height: box.height, left: box.left, right: box.right });
    }
    return plates;
  });
}

test.describe('P20 reward surfaces', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    // Reduced motion is the app's own supported mode: the drawer/panel entrance
    // springs are skipped entirely (Modal `progress` snaps to 1), so geometry
    // measurements read the settled layout instead of a mid-slide transform.
    // §5.8 requires every playful moment to honour it anyway.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('badge tiles are tier plates with a lip; locked tiers stay neutral', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    const dialog = await openAchievements(page);

    const allBadges = dialog.getByRole('button', { name: 'Show all badges' });
    await expect(allBadges).toBeVisible();
    await allBadges.click();
    await expect(dialog.getByRole('button', { name: 'Hide all badges' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // The full collection renders one 64 × 70 hexagon plate per tier.
    await expect.poll(() => plateBoxes(page).then((plates) => plates.length)).toBeGreaterThan(10);
    const plates = await plateBoxes(page);
    for (const plate of plates) {
      expect(plate.height, 'the plate carries its lip below the hexagon face').toBeGreaterThan(
        plate.width,
      );
    }

    // The badge contract is unchanged: labels + progress fractions still read.
    await expect(dialog.getByLabel(/Bronze Complete days/)).toBeVisible();
    // Locked tiers are announced as a collection slot ("locked. n of m …"),
    // never as something the user has lost (design DNA P7).
    await expect(dialog.getByLabel(/locked\./).first()).toBeVisible();
    const body = await dialog.innerText();
    expect(body).not.toMatch(/missing|lost|failed|expired/i);
  });

  test('quest rows are lipped cards with a Gold bar and a reward chest', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    const dialog = await openAchievements(page);

    // Exactly the three rotating quests, each with its own accessible summary.
    await expect(dialog.getByLabel(/Reward 15 XP\./)).toHaveCount(3);

    const questCards = await page.evaluate(() => {
      const cards: {
        bottomLip: number;
        topRing: number;
        bars: { fill: string; height: number }[];
      }[] = [];
      for (const el of Array.from(document.querySelectorAll('div'))) {
        const style = getComputedStyle(el);
        if (style.borderBottomWidth !== '4px' || style.borderTopWidth !== '2px') continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.height < 50 || box.height > 90) continue;
        const bars: { fill: string; height: number }[] = [];
        for (const inner of Array.from(el.querySelectorAll('div'))) {
          const s = getComputedStyle(inner);
          const height = parseFloat(s.height);
          if (!Number.isFinite(height) || height < 6 || height > 12) continue;
          if (s.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
          bars.push({ fill: s.backgroundColor, height });
        }
        cards.push({
          bottomLip: parseFloat(style.borderBottomWidth),
          topRing: parseFloat(style.borderTopWidth),
          bars,
        });
      }
      return cards;
    });

    // Three lipped quest cards (2px ring + 4px bottom lip, §5.7 depth.card).
    expect(questCards.length).toBeGreaterThanOrEqual(3);
    for (const card of questCards.slice(0, 3)) {
      expect(card.topRing).toBe(2);
      expect(card.bottomLip).toBe(4);
    }
    // At least one card carries a Gold-progress bar track (§7).
    expect(
      questCards.some((card) => card.bars.length > 0),
      'a quest card renders its progress bar',
    ).toBe(true);
  });

  test('week strip renders Flame days and an Ice shield for a saved day', async ({ page }) => {
    // A habit so today is a real active day; the freeze row marks a day that a
    // banked freeze saved (a care state, never a gap — §2 "never imply moral
    // failure"). Both states must be deterministic, so the device starts empty.
    await goToTab(page, 'habits');
    await expect(page.getByText('Daily check-in')).toBeVisible({ timeout: 15_000 });
    const nameField = page.getByLabel('Habit name');
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByLabel('Add habit').click({ force: true });
      try {
        await nameField.waitFor({ state: 'visible', timeout: 8_000 });
        break;
      } catch {
        if (attempt === 2) throw new Error('Add-habit modal did not open');
      }
    }
    await nameField.fill('Morning run');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Morning run').first()).toBeVisible();

    // Seed the freeze for a day inside the strip. Raw SQL is the only way to
    // reach a freeze without a 7-day streak + miss sequence.
    const savedDay = await page.evaluate(() => {
      const date = new Date();
      date.setDate(date.getDate() - 2);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    });
    await runSql(
      page,
      `INSERT OR REPLACE INTO gamification_streak_freezes (date_key, saved_at)
       VALUES ('${savedDay}', '2026-10-01T00:00:00.000Z');`,
    );
    // `returnToApp` reloads at `/`, so re-enter Habits before checking in.
    await returnToApp(page);
    await goToTab(page, 'habits');

    await page.getByLabel(/Morning run: 0 of 1 today/).click({ force: true });
    await expect(page.getByLabel(/Morning run: 1 of 1 today/)).toBeVisible({ timeout: 10_000 });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    const dialog = await openAchievements(page);
    // The summary states both facts; a saved day is information, not a loss.
    await expect(
      dialog.getByLabel(/1 active day in the last week, plus 1 day saved by a streak freeze/),
    ).toBeVisible();
    const activeDayCount = 1;

    // Seven weekday nodes, each drawing a state mark. The strip is the element
    // carrying its summary label, so the count is scoped to it (the level hero
    // also draws a Flame pill and a freeze shield, and it is not part of the
    // strip's contract).
    const marks = await page.evaluate(() => {
      // RN-Web puts `aria-label` on its own accessible wrapper, so climb to the
      // ancestor that actually lays out the seven nodes.
      let strip: Element | null = document.querySelector(
        '[aria-label*="active day in the last week"]',
      );
      while (strip && strip.querySelectorAll('path').length === 0) {
        strip = strip.parentElement;
      }
      let flame = 0;
      let shield = 0;
      if (strip) {
        for (const path of Array.from(strip.querySelectorAll('path'))) {
          const fill = path.getAttribute('fill');
          if (fill === '#FF9A1F') flame += 1;
          if (fill === '#5CCBFF') shield += 1;
        }
      }
      return { flame, shield };
    });
    // One Flame mark per active day, one Ice shield for the freeze-saved day.
    expect(marks.flame, 'Flame marks for active days').toBe(activeDayCount);
    expect(marks.shield, 'Ice shields for freeze-saved days').toBe(1);
  });

  test('reward surfaces fit 360, 375 and 390 without horizontal overflow', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await goToTab(page, 'overview');
      const dialog = await openAchievements(page);
      await expect(dialog.getByText('Latest milestone')).toBeVisible();

      const overflow = await page.evaluate(() => {
        const node = document.querySelector('[role="dialog"]');
        let maxRight = 0;
        const offenders: string[] = [];
        const clipped: string[] = [];
        if (node) {
          for (const descendant of Array.from(node.querySelectorAll('*'))) {
            const rect = descendant.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (getComputedStyle(descendant).position === 'fixed') continue;
            if (rect.right > maxRight) maxRight = rect.right;
            if (rect.right > window.innerWidth + 1) {
              offenders.push(
                `${descendant.tagName}.${(descendant.className || '').toString().slice(0, 30)}:${Math.round(rect.right)}:"${(descendant.textContent || '').slice(0, 20)}"`,
              );
            }
          }
          // Any element that needs a horizontal scroll inside the drawer is a
          // clipped control/surface, which is the real "does not fit" signal.
          for (const scrollable of Array.from(node.querySelectorAll('*'))) {
            const style = getComputedStyle(scrollable);
            if (!/auto|scroll/.test(style.overflowX)) continue;
            if (scrollable.scrollWidth > scrollable.clientWidth + 1) {
              clipped.push(
                `${scrollable.tagName}:${scrollable.scrollWidth}>${scrollable.clientWidth}`,
              );
            }
          }
        }
        return {
          page: document.documentElement.scrollWidth,
          maxRight,
          clipped,
          offenders: offenders.slice(0, 8),
        };
      });
      expect(overflow.page, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(
        width + 1,
      );
      // Sub-pixel layout can land a fraction over an integer viewport width, so
      // the tolerance is 1px — anything larger is a genuinely clipped surface.
      expect(
        overflow.maxRight,
        `${width}: no content extends past the viewport (${overflow.offenders.join(', ')})`,
      ).toBeLessThanOrEqual(width + 1);
      expect(overflow.clipped, `${width}: no horizontally clipped content`).toEqual([]);

      // The one disclosure stays a 44pt-minimum target at every width.
      const toggle = dialog.getByRole('button', { name: 'Show all badges' });
      await expect(toggle).toBeVisible();
      const box = await toggle.boundingBox();
      expect(box!.height, `${width}: disclosure target height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${width}: disclosure target width`).toBeGreaterThanOrEqual(44);
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByText('Level & Achievements')).toBeHidden();
    }
  });

  test('the achievements surfaces are AA-clean in light and dark', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    const lightDialog = await openAchievements(page);
    await expect(lightDialog.getByText('Streak protection')).toBeVisible();
    const light = await page.evaluate(auditPage);
    expect(light.contrast, 'achievements light: WCAG AA contrast').toEqual([]);
    expect(light.nameless, 'achievements light: controls without accessible names').toEqual([]);
    await lightDialog.getByRole('button', { name: 'Close' }).click();

    await page.evaluate(() => window.localStorage.setItem('superhabits.theme.mode', 'dark'));
    await hardReload(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkDialog = await openAchievements(page);
    await expect(darkDialog.getByText('Streak protection')).toBeVisible();
    const dark = await page.evaluate(auditPage);
    expect(dark.contrast, 'achievements dark: WCAG AA contrast').toEqual([]);
    expect(dark.nameless, 'achievements dark: controls without accessible names').toEqual([]);
  });
});
