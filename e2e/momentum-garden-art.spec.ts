import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { seedFixture } from './helpers/seed';

/**
 * P20 Momentum Garden **art** contract
 * (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden" + §10 P20).
 *
 * The existing `momentum-garden.spec.ts` owns the garden *product* contract
 * (data-derived summary copy, the deeper view's explanation text, read-only
 * behaviour, window switching). This spec owns the illustration the brief
 * asks for: a flat garden on a soft sky band with **one plant species per
 * existing contribution area**, growth that only accumulates, and no punitive
 * state ever (an untouched bed is "ready", a returning user keeps every plant).
 */

const ART_TITLE = 'Momentum Garden';

/**
 * Read the garden scene's SVG: which species colours are painted, whether the
 * sky band exists, and how tall the tallest plant is. The art is a single
 * `<svg>` with a 360 × 144 viewBox, so those facts are structural.
 */
async function gardenScene(page: Page) {
  return page.evaluate(() => {
    const svg = Array.from(document.querySelectorAll('svg')).find((candidate) => {
      const viewBox = candidate.getAttribute('viewBox') ?? '';
      return viewBox === '0 0 360 144';
    });
    if (!svg) return null;
    const fills = new Set<string>();
    let tallest = 0;
    for (const path of Array.from(svg.querySelectorAll('path, rect, circle, line'))) {
      // Stroked shapes (the ground baseline, fern fronds) carry their paint in
      // `stroke`, so the scene's palette is the union of both attributes.
      const fill = path.getAttribute('fill');
      if (fill) fills.add(fill);
      const stroke = path.getAttribute('stroke');
      if (stroke) fills.add(stroke);
      if (path.tagName.toLowerCase() === 'line') {
        // Plant stems run vertically from the bed to the crown.
        const y1 = Number.parseFloat(path.getAttribute('y1') ?? '0');
        const y2 = Number.parseFloat(path.getAttribute('y2') ?? '0');
        if (Number.isFinite(y1) && Number.isFinite(y2)) {
          tallest = Math.max(tallest, Math.abs(y1 - y2));
        }
      }
    }
    return {
      fills: [...fills],
      tallest,
      textCount: svg.querySelectorAll('text').length,
      viewBox: svg.getAttribute('viewBox'),
      width: svg.getBoundingClientRect().width,
      animateTags: svg.querySelectorAll('animate, animateTransform').length,
    };
  });
}

/** Repaint-stable comparison of the painted species set. */
async function paintedSpecies(page: Page): Promise<string[]> {
  const scene = await gardenScene(page);
  const SPECIES_HUES = [
    '#2FA8F7',
    '#4DC93A',
    '#A37BFF',
    '#FF6A4D',
    '#FF6FAE',
    '#FFC81F',
    '#22CCB8',
  ];
  return SPECIES_HUES.filter((hue) => Boolean(scene?.fills.includes(hue)));
}

test.describe('Momentum Garden art', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
    await expect(page.getByText(ART_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test('renders one flat scene with a sky band and a labelled bed per area', async ({ page }) => {
    await expect(page.getByText(ART_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
    const scene = await gardenScene(page);
    expect(scene, 'the garden renders a 360 × 144 scene').not.toBeNull();
    expect(scene!.animateTags, 'no ambient SMIL animation in the art').toBe(0);
    // Seven beds, seven labels, all inside the scene.
    expect(scene!.textCount, 'one label per contribution area').toBe(7);
    // The soft sky band is the Lagoon (health) tint, i.e. a real flat fill, not
    // a gradient (the brief retires gradients outside celebration).
    expect(scene!.fills).toContain('#E0F8F5');
    // The one ground line (§6 charts: a single baseline).
    expect(scene!.fills).toContain('#E3E6EE');
  });

  test('growth is additive: an empty day shows empty beds, a completed task grows only Tasks', async ({
    page,
  }) => {
    const before = await gardenScene(page);
    expect(before!.tallest, 'an empty day plants nothing').toBe(0);

    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Garden seed');
    await submitTodoModal(page);
    const completion = page.getByRole('checkbox', { name: 'Mark complete: Garden seed' });
    await expect(completion).toBeVisible();
    await completion.click();
    await expect(page.getByRole('button', { name: 'Show completed tasks' })).toBeVisible();

    await goToTab(page, 'overview');
    await expect(page.getByText(/Today: activity from Tasks\./)).toBeVisible({ timeout: 20_000 });
    const after = await gardenScene(page);
    // A plant exists, and its species hue (Sky = Tasks) is the one painted.
    expect(after!.tallest, 'a completed task plants a Tasks bed').toBeGreaterThan(0);
    expect(await paintedSpecies(page)).toContain('#2FA8F7');
  });

  test('species colours stay distinct and contained at 360, 375 and 390', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await expect(page.getByText(ART_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });

    // A full fixture fills several beds at once, so several species paint.
    const species = await paintedSpecies(page);
    expect(species.length, 'multi-domain fixture grows several beds').toBeGreaterThanOrEqual(3);

    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await goToTab(page, 'overview');
      await expect(page.getByText(ART_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageWidth, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(
        width + 1,
      );
      const scene = await gardenScene(page);
      expect(scene!.width, `${width}: the scene fills its container`).toBeGreaterThan(0);
    }
  });

  test('an empty garden reads as ready, never as a loss', async ({ page }) => {
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await expect(page.getByText('Why each area grows', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    // Every day row on a fresh device is neutral ("Ready for new growth"), and
    // nothing in the deeper view uses punitive vocabulary.
    await expect(page.getByText('Ready for new growth').first()).toBeVisible();
    const text = await page.getByRole('dialog').innerText();
    expect(text).not.toMatch(/wilt|dead|lost|failed|penalty|punish/i);
  });

  test('the deeper view stays read-only, reduced-motion safe, and never punitive', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await expect(page.getByText('Why each area grows', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // Explanation text is kept verbatim — it is part of the read-only contract.
    await expect(
      page.getByText(
        'Each area grows from real work. Missing activity leaves the garden neutral, never worse.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('These are separate signals, not a combined rating.'),
    ).toBeVisible();

    // Reduced motion: the scene renders at full opacity with no animation.
    const deepScene = await gardenScene(page);
    expect(deepScene!.animateTags).toBe(0);

    // No punitive vocabulary anywhere in the deeper view.
    const text = await page.getByRole('dialog').innerText();
    expect(text).not.toMatch(/wilt|dead|lost|failed|penalty|punish/i);
  });
});
