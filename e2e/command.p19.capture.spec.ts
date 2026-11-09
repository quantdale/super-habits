import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { auditPage } from './helpers/a11yAudit';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { openCommandScreen } from './helpers/commandObservation';

/**
 * P19 — Command Center + Quick capture presentation
 * (docs/ui-ux/16-playful-momentum.md §7 "Command Center + Quick capture",
 * §10 P19).
 *
 * What this pins (and what it deliberately does NOT):
 * - Quick capture: the title field leads the sheet, the six unchanged type
 *   labels render as tiles below it, and the selected tile takes its
 *   destination's section hue while every other tile stays neutral (one hue at
 *   a time, SUR-10). The primary action is a solid Sprout "Capture" and the
 *   quiet path is the face-less ghost "Describe it" (both labels unchanged).
 * - Command Center: Sprout's `think` speech bubble says "Tell me what to add"
 *   above an input-first field; examples render while the field is empty; the
 *   run button is disabled until there is input, then the one solid CTA.
 * - Fit: both surfaces keep every control inside a 360/375/390 viewport with no
 *   horizontal overflow and targets >= 44pt.
 *
 * Every selector here is a role/label/placeholder that existed before P19.
 * Nothing was added to the app to make this spec pass.
 */

const NARROW_VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
] as const;

const TYPE_LABELS = ['Task', 'Habit', 'Calorie', 'Project', 'Goal', 'Focus'] as const;

async function openQuickCapture(page: Page) {
  await page.getByRole('button', { name: 'Quick capture', exact: true }).click();
  await expect(page.getByPlaceholder('What do you want to remember?')).toBeVisible({
    timeout: 20_000,
  });
  return page.getByRole('dialog', { name: 'Add' });
}

/** CSS rgb() → [r, g, b], or null when the value is not an opaque colour. */
function rgb(value: string): [number, number, number] | null {
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3) return null;
  if (parts.length === 4 && parts[3] === 0) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * The first opaque paint at or above `node` — what a user actually sees behind
 * it.
 *
 * RN-web composes a pressable as transparent interactive node → face wrapper →
 * lip slab, and the modal's `role="dialog"` element is the unpainted container
 * while the sheet panel is a child, so a control's own `backgroundColor` is
 * `rgba(0, 0, 0, 0)` and reading the surface means walking outward.
 */
async function paintedBackground(node: Locator, includeSelf = true): Promise<string> {
  return node.evaluate((element: Element, include: boolean) => {
    let current: HTMLElement | null = include ? (element as HTMLElement) : element.parentElement;
    while (current) {
      const value = getComputedStyle(current).backgroundColor;
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (match) {
        const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
        const opaque = parts.length === 3 || (parts.length === 4 && parts[3] > 0);
        if (opaque) return value;
      }
      current = current.parentElement;
    }
    return '';
  }, includeSelf);
}

/** Perceptual distance: enough to tell "a different hue family" apart. */
function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

type TilePaint = { label: string; face: string; lip: string; checked: boolean };

/**
 * Read the rendered paint of the six tiles.
 *
 * The interactive node of a `Pressable3D`-shaped tile is transparent by design:
 * the face is the animated wrapper and the lip is its own outer slab, so the
 * face/lip colours are read from those ancestors (that is what a user sees).
 */
async function readTiles(dialog: ReturnType<Page['getByRole']>): Promise<TilePaint[]> {
  return dialog.locator('[aria-label="Capture type"]').evaluate((group) =>
    Array.from(group.querySelectorAll<HTMLElement>('[role="button"]')).map((tile) => {
      const faceNode = tile.parentElement ?? tile;
      const lipNode = faceNode.parentElement ?? faceNode;
      return {
        label: tile.getAttribute('aria-label') ?? '',
        face: getComputedStyle(faceNode).backgroundColor,
        lip: getComputedStyle(lipNode).backgroundColor,
        checked: tile.getAttribute('aria-pressed') === 'true',
      };
    }),
  );
}

async function sheetSurface(page: Page): Promise<[number, number, number]> {
  // The dialog element itself is the unpainted container; the sheet panel is
  // the next painted ancestor inside it.
  const value = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return '';
    let current: HTMLElement | null = dialog;
    while (current) {
      const paint = getComputedStyle(current).backgroundColor;
      const match = paint.match(/^rgba?\(([^)]+)\)$/);
      if (match) {
        const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
        if (parts.length === 3 || (parts.length === 4 && parts[3] > 0)) return paint;
      }
      current = current.parentElement;
    }
    return '';
  });
  const parsed = rgb(value);
  expect(parsed, `dialog surface ${value}`).not.toBeNull();
  return parsed as [number, number, number];
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    if (!scrolling) return { document: 0, escaping: [] as string[] };
    const documentOverflow = Math.max(0, scrolling.scrollWidth - scrolling.clientWidth);
    const escaping: string[] = [];
    for (const node of Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] *'))) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > window.innerWidth + 1 || rect.left < -1) {
        const name =
          node.getAttribute('aria-label') ??
          node.getAttribute('placeholder') ??
          (node.textContent ?? '').trim().slice(0, 24);
        if (name) escaping.push(`${name} @${Math.round(rect.left)}–${Math.round(rect.right)}`);
      }
    }
    return { document: documentOverflow, escaping };
  });
  expect(overflow.document, `${label}: page has no horizontal scroll`).toBeLessThanOrEqual(0);
  expect(overflow.escaping, `${label}: no dialog control leaves the viewport`).toEqual([]);
}

test.describe('P19 Quick capture type picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearDatabase(page);
  });

  // The sheet's own rendered AA audit. `e2e/a11y.spec.ts` audits the Command
  // Center and Settings overlays but never the quick-capture sheet, so the new
  // tinted type tiles (and their icon chips, which sit on FIXED section hues)
  // need their own rendered-contrast pass in each appearance AND in the one
  // theme that replaces the whole section accent set.
  for (const appearance of ['light', 'dark', 'cyberpunk-neon'] as const) {
    test(`the sheet is AA-clean with the type tiles in ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      // Theme preferences live in storage, and `clearDatabase()` wipes every
      // `superhabits.*` key, so the mode is set AFTER the reset (the same
      // ordering `visual-regression.spec.ts` uses for its themed captures).
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await clearDatabase(page);
      await page.evaluate((target) => {
        window.localStorage.setItem(
          'superhabits.theme.mode',
          target === 'light' ? 'light' : 'dark',
        );
        if (target === 'cyberpunk-neon') {
          window.localStorage.setItem(
            'superhabits.theme.slots.v2',
            JSON.stringify({ lightThemeId: 'light', darkThemeId: 'cyberpunk-neon' }),
          );
        }
      }, appearance);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
        .toBe(appearance === 'light' ? 'light' : 'dark');
      if (appearance === 'cyberpunk-neon') {
        await expect
          .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
          .toBe('cyberpunk-neon');
      }

      const dialog = await openQuickCapture(page);
      // Audit the default (Task) selection, then a section hue with a light
      // bright tier and one with a dark one, so both tint directions render.
      for (const label of ['Task', 'Calorie', 'Project', 'Habit'] as const) {
        await dialog.getByRole('button', { name: label, exact: true }).click();
        await page.waitForTimeout(400);
        const result = await page.evaluate(auditPage);
        expect(result.contrast, `${appearance} ${label}: WCAG AA contrast`).toEqual([]);
        expect(result.nameless, `${appearance} ${label}: controls without names`).toEqual([]);
        expect(result.duplicateIds, `${appearance} ${label}: duplicate ids`).toEqual([]);
        expect(
          result.hiddenFocusable,
          `${appearance} ${label}: focusable inside aria-hidden`,
        ).toEqual([]);
      }
    });
  }

  test('keeps the title field first and the six unchanged type tiles', async ({ page }) => {
    const dialog = await openQuickCapture(page);

    // Title field first: it is focused on open, so a capture starts with typing.
    const titleField = dialog.getByRole('textbox', { name: 'Title', exact: true });
    await expect(titleField).toBeVisible();
    await expect(titleField).toBeFocused();

    // The six product labels are unchanged, one tile each, still `button`.
    for (const label of TYPE_LABELS) {
      await expect(dialog.getByRole('button', { name: label, exact: true }), label).toHaveCount(1);
    }

    // Each tile carries a decorative hero icon; the icons add no accessible
    // images (SVGs stay aria-hidden), so no name changed.
    expect(await dialog.locator('svg').count()).toBeGreaterThanOrEqual(TYPE_LABELS.length);
    await expect(dialog.getByRole('img')).toHaveCount(0);
  });

  test('the selected tile takes its destination hue while the others stay neutral', async ({
    page,
  }) => {
    const dialog = await openQuickCapture(page);
    const surface = await sheetSurface(page);

    const before = await readTiles(dialog);
    expect(before.map((tile) => tile.label)).toEqual([...TYPE_LABELS]);
    // Task is the restored default destination: exactly ONE tile is tinted.
    const tintedBefore = before.filter((tile) => {
      const parsed = rgb(tile.face);
      return parsed !== null && distance(parsed, surface) > 8;
    });
    expect(
      tintedBefore.map((tile) => tile.label),
      'one hue visible',
    ).toEqual(['Task']);
    expect(tintedBefore[0].checked, 'selection is also marked by a toggle state').toBe(true);
    expect(before.filter((tile) => tile.checked)).toHaveLength(1);

    // Calorie: its Berry tint takes over and Task returns to the neutral face.
    await dialog.getByRole('button', { name: 'Calorie', exact: true }).click();
    const afterCalorie = await readTiles(dialog);
    await expect(dialog.getByRole('textbox', { name: 'Food name', exact: true })).toBeVisible();
    const calorieFace = rgb(afterCalorie.find((tile) => tile.label === 'Calorie')?.face ?? '');
    const taskFace = rgb(afterCalorie.find((tile) => tile.label === 'Task')?.face ?? '');
    expect(calorieFace, 'Calorie face is a solid fill').not.toBeNull();
    expect(taskFace, 'Task face is a solid fill').not.toBeNull();
    expect(distance(calorieFace as [number, number, number], surface)).toBeGreaterThan(8);
    expect(distance(taskFace as [number, number, number], surface)).toBeLessThanOrEqual(8);

    // Focus: a DIFFERENT hue again, so the hue is the destination's identity.
    await dialog.getByRole('button', { name: 'Focus', exact: true }).click();
    const afterFocus = await readTiles(dialog);
    const focusFace = rgb(afterFocus.find((tile) => tile.label === 'Focus')?.face ?? '');
    expect(focusFace).not.toBeNull();
    expect(
      distance(focusFace as [number, number, number], calorieFace as [number, number, number]),
      'Focus and Calorie are visibly different hues',
    ).toBeGreaterThan(20);

    // Back to Task: the picker is a toggle group, not a one-way trip.
    await dialog.getByRole('button', { name: 'Task', exact: true }).click();
    const afterTask = await readTiles(dialog);
    expect(afterTask.find((tile) => tile.label === 'Task')?.face).toBe(before[0].face);
    expect(afterTask.filter((tile) => tile.checked).map((tile) => tile.label)).toEqual(['Task']);
    await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  });

  test('keeps one solid Sprout Capture and the face-less Describe it', async ({ page }) => {
    const dialog = await openQuickCapture(page);

    const capture = dialog.getByRole('button', { name: 'Capture', exact: true });
    await expect(capture).toBeVisible();
    // The visible face of the primary action is a solid fill (never transparent).
    const captureFace = await paintedBackground(capture);
    expect(rgb(captureFace), `Capture face ${captureFace}`).not.toBeNull();

    const describe = dialog.getByRole('button', { name: 'Describe it', exact: true });
    await expect(describe).toBeVisible();
    // Ghost: no face of its own, so the sheet shows through.
    expect(await describe.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  for (const viewport of NARROW_VIEWPORTS) {
    test(`fits the type tiles at ${viewport.width}px without overflow`, async ({ page }) => {
      await page.setViewportSize({ ...viewport });
      const dialog = await openQuickCapture(page);

      const tiles = await dialog.evaluate((root) => {
        const group = root.querySelector('[aria-label="Capture type"]');
        if (!group) return [];
        return Array.from(group.querySelectorAll<HTMLElement>('[role="button"]')).map((tile) => {
          const rect = tile.getBoundingClientRect();
          return {
            label: tile.getAttribute('aria-label'),
            top: rect.top,
            height: rect.height,
            width: rect.width,
            truncated: (tile.textContent ?? '').includes('…'),
          };
        });
      });
      expect(tiles).toHaveLength(TYPE_LABELS.length);
      for (const tile of tiles) {
        expect(tile.height, `${tile.label} height at ${viewport.width}`).toBeGreaterThanOrEqual(44);
        expect(tile.width, `${tile.label} width at ${viewport.width}`).toBeGreaterThanOrEqual(44);
        expect(tile.truncated, `${tile.label} label is not truncated`).toBe(false);
      }
      // Three columns on a phone: two rows, never a single-file column.
      expect(new Set(tiles.map((tile) => Math.round(tile.top))).size).toBeLessThanOrEqual(2);

      await expectNoHorizontalOverflow(page, `quick capture @${viewport.width}`);
    });
  }
});

test.describe('P19 Command Center prompt and input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearDatabase(page);
  });

  test('shows the speech bubble above an input-first field', async ({ page }) => {
    await openCommandScreen(page);
    const dialog = page.getByRole('dialog', { name: 'Command center' });
    await expect(dialog).toBeVisible();

    const prompt = dialog.getByText('Tell me what to add', { exact: true });
    await expect(prompt).toBeVisible();

    const field = dialog.locator('#command-input');
    await expect(field).toBeVisible();
    const promptBox = await prompt.boundingBox();
    const fieldBox = await field.boundingBox();
    expect(promptBox).not.toBeNull();
    expect(fieldBox).not.toBeNull();
    // The bubble sits ABOVE the field: the input leads the surface (§7).
    expect(promptBox!.y + promptBox!.height).toBeLessThanOrEqual(fieldBox!.y + 2);

    // Nothing interactive between the bubble and the field.
    const interactiveBetween = await page.evaluate(() => {
      const promptNode = Array.from(document.querySelectorAll<HTMLElement>('*')).find(
        (node) =>
          node.children.length === 0 && (node.textContent ?? '').trim() === 'Tell me what to add',
      );
      const field = document.querySelector<HTMLElement>('#command-input');
      if (!promptNode || !field) return null;
      const between: string[] = [];
      for (const probe of Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"] input, [role="dialog"] button'),
      )) {
        const afterPrompt = (promptNode.compareDocumentPosition(probe) & 4) !== 0;
        const beforeField = (field.compareDocumentPosition(probe) & 2) !== 0;
        if (afterPrompt && beforeField) {
          between.push(probe.getAttribute('aria-label') ?? probe.tagName);
        }
      }
      return between;
    });
    expect(interactiveBetween, 'no control between the prompt and the field').toEqual([]);

    // The mascot stays decorative and the prompt is not a control.
    await expect(dialog.getByRole('img')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Tell me what to add' })).toHaveCount(0);
  });

  test('examples show only while empty and the run button enables with input', async ({ page }) => {
    await openCommandScreen(page);
    const dialog = page.getByRole('dialog', { name: 'Command center' });
    const field = dialog.locator('#command-input');
    const run = dialog.getByRole('button', { name: 'Parse command', exact: true });

    // Empty: discovery aids are visible and the action is not.
    await expect(dialog.getByRole('button', { name: /Use example:/ }).first()).toBeVisible();
    await expect(run).toBeDisabled();

    // Run is the screen's one solid CTA (Sprout in light mode, ink in dark).
    const runFace = await paintedBackground(run);
    expect(rgb(runFace), `run face ${runFace}`).not.toBeNull();

    // Typing demotes the examples and enables the run button.
    await field.fill('Add a todo to call mom tomorrow');
    await expect(dialog.getByRole('button', { name: /Use example:/ })).toHaveCount(0);
    await expect(run).toBeEnabled();

    // Clearing restores the aids and disables the action again.
    await field.fill('');
    await expect(dialog.getByRole('button', { name: /Use example:/ }).first()).toBeVisible();
    await expect(run).toBeDisabled();
  });

  test('renders the prompt and field in the dark theme', async ({ page }) => {
    await page.evaluate(() => window.localStorage.setItem('superhabits.theme.mode', 'dark'));
    await goToTab(page, 'overview');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');

    await openCommandScreen(page);
    const dialog = page.getByRole('dialog', { name: 'Command center' });
    await expect(dialog.getByText('Tell me what to add', { exact: true })).toBeVisible();
    await expect(dialog.locator('#command-input')).toBeVisible();
    // The run button keeps a solid face in dark mode too (bright Sprout + ink).
    const runFace = await paintedBackground(
      dialog.getByRole('button', { name: 'Parse command', exact: true }),
    );
    expect(rgb(runFace), `dark run face ${runFace}`).not.toBeNull();
  });

  for (const viewport of NARROW_VIEWPORTS) {
    test(`fits the prompt and field at ${viewport.width}px without overflow`, async ({ page }) => {
      await page.setViewportSize({ ...viewport });
      await openCommandScreen(page);
      const dialog = page.getByRole('dialog', { name: 'Command center' });
      await expect(dialog.getByText('Tell me what to add', { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page, `command center @${viewport.width}`);

      // Targets: the run button >= 44, the input well >= 44.
      const runHeight = await dialog
        .getByRole('button', { name: 'Parse command', exact: true })
        .evaluate((node) => node.getBoundingClientRect().height);
      expect(runHeight).toBeGreaterThanOrEqual(44);
      const fieldHeight = await dialog
        .locator('#command-input')
        .evaluate((node) => node.getBoundingClientRect().height);
      expect(fieldHeight).toBeGreaterThanOrEqual(44);
    });
  }
});
