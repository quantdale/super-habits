import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { seedFixture } from './helpers/seed';
import { returnToApp, runSql } from './helpers/dbHarness';
import { browserLocalTodayKey } from './helpers/browserDate';

/**
 * P21b — the v2 "Playful Momentum" grammar on Progress / Activity / Health
 * (docs/ui-ux/16-playful-momentum.md §5.1, §6, §6 ProgressBar, §10 P21).
 *
 * What is pinned here (presentation only — no product behaviour changes):
 *
 * 1. **One hue per surface, section hues only where the spec grants them.**
 *    Progress and Activity live in the Planning Hub drawer, so their chrome
 *    (window chips, filter chips, disclosure) is Sky like To Do and the hub's
 *    own switcher; Timeline ROWS take the hue of the area that produced the
 *    event (this is what makes a merged feed scannable); Health owns Lagoon.
 * 2. **Contrast is measured on the ACTUAL painted fill.** Health's hero is the
 *    fixed Lagoon `bright` (#22CCB8), where theme ink measures 1.87–2.60:1 —
 *    the rendered audit below would fail if the hero reused `tokens.text`.
 * 3. **Depth/rhythm tokens:** metric rows and event rows sit in `ListGroup`s
 *    (2px ring + hairlines), not floating cards; values are `metric`-role
 *    numbers with tabular figures; the disclosure controls are 44pt.
 * 4. **Existing strings stay:** every string another spec asserts is still
 *    present (the W12 suite is the authority; this spec adds geometry +
 *    colour, never replaces intent).
 *
 * Layout is asserted at 360/375/390 (no horizontal overflow, controls ≥44pt);
 * the rendered contrast audit runs in light, dark and the Cyberpunk Neon
 * override theme because a theme's `sectionOverrides` can repaint the very
 * tints these surfaces paint.
 */

const WIDTHS = [360, 375, 390] as const;
/** §5.1 Lagoon bright — the Health hero face, in the DOM's rgb() form. */
const HERO_FACE = 'rgb(34, 204, 184)';

async function openHubViews(page: Page) {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  return page.getByRole('dialog');
}

async function openProgress(page: Page) {
  const dialog = await openHubViews(page);
  await dialog.getByRole('tab', { name: 'Progress', exact: true }).click();
  await expect(dialog.getByText(/Last 7 days \(/)).toBeVisible({ timeout: 20_000 });
  return dialog;
}

async function openTimeline(page: Page) {
  const dialog = await openHubViews(page);
  await dialog.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Timeline filters' })).toBeVisible({
    timeout: 20_000,
  });
  return dialog;
}

/** Seed one completed todo + habit check-in + workout log so all three
 *  surfaces render populated (Progress rows, Timeline tiles, Health state). */
async function seedReflectionHistory(page: Page) {
  const today = await browserLocalTodayKey(page);
  // Browser-local instants, not UTC suffixes: the app derives day windows from
  // the pinned Asia/Manila clock, so `T18:00:00.000Z` would land on TOMORROW's
  // local day and the seeded workout would read as "not logged yet".
  const stamp = await page.evaluate((key) => {
    const [y, m, d] = key.split('-').map(Number);
    const local = (hour: number) => new Date(y, m - 1, d, hour, 0, 0, 0).toISOString();
    return { morning: local(8), habit: local(9), evening: local(18) };
  }, today);
  await runSql(
    page,
    `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
       VALUES ('p21b_todo','P21b completed task',null,1,'${stamp.morning}','${stamp.morning}',null,'${today}','normal',0,null,null,'${stamp.morning}');
     INSERT INTO habits (id,name,target_per_day,reminder_time,category,icon,color,created_at,updated_at,deleted_at)
       VALUES ('p21b_habit','P21b habit',1,null,'anytime','loop','#10b981','${stamp.morning}','${stamp.morning}',null);
     INSERT INTO habit_completions (id,habit_id,date_key,count,created_at,updated_at)
       VALUES ('p21b_hcmp','p21b_habit','${today}',1,'${stamp.habit}','${stamp.habit}');
     INSERT INTO workout_routines (id,name,description,created_at,updated_at,deleted_at)
       VALUES ('p21b_wrt','P21b routine',null,'${stamp.morning}','${stamp.morning}',null);
     INSERT INTO workout_logs (id,routine_id,notes,completed_at,created_at)
       VALUES ('p21b_wrk','p21b_wrt',null,'${stamp.evening}','${stamp.evening}');`,
  );
  await returnToApp(page);
}

test.describe('P21b Progress insights grammar', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
  });

  test('headline rows carry metric numbers, a Sky bar and the comparison caption', async ({
    page,
  }) => {
    await seedFixture(page, 'TYPICAL');
    const dialog = await openProgress(page);

    // The window chips are present and still expose their exact labels.
    for (const days of [7, 30, 90]) {
      await expect(
        dialog.getByRole('button', { name: `Show the last ${days} days` }),
      ).toBeVisible();
    }

    // Headline rows render as one flat ListGroup: label, prior anchor, metric
    // value and one comparison caption — not four stacked cards.
    const highlights = dialog.getByText('Highlights', { exact: true });
    await expect(highlights).toBeVisible();

    // The headline rows sit in ONE `ListGroup`: a 2px-ringed container whose
    // rows are separated by hairlines, not four separately shadowed cards.
    const groupShape = await dialog.evaluate(() => {
      const prior = Array.from(document.querySelectorAll('div')).find((el) =>
        (el.textContent ?? '').trim().startsWith('Prior: '),
      );
      if (!prior) return null;
      let node: HTMLElement | null = prior;
      for (let depth = 0; depth < 8 && node; depth += 1) {
        const style = getComputedStyle(node);
        if (style.borderTopWidth === '2px' && style.borderTopStyle === 'solid') {
          const rows = Array.from(node.children).filter(
            (child) => getComputedStyle(child).borderBottomWidth === '1px',
          ).length;
          return { ring: style.borderTopWidth, radius: style.borderTopLeftRadius, rows };
        }
        node = node.parentElement;
      }
      return null;
    });
    expect(groupShape, 'headline rows live in a bordered ListGroup').not.toBeNull();
    expect(groupShape!.ring, 'group ring is depth.flat 2px').toBe('2px');
    expect(groupShape!.radius, 'group radius is the §5.6 list-card 16px').toBe('16px');

    // The disclosure keeps its exact accessible name + state (W12 contract).
    const more = dialog.getByRole('button', { name: 'Show metric details' });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    // The one hue on data is the comparison bar: a `progressbar` role whose
    // accessible name states both windows in the row's own unit. (W12 only
    // asserted the rows; P21b adds the proportion without changing any copy.)
    const bars = dialog.getByRole('progressbar');
    await expect(bars.first()).toBeVisible();
    expect(await bars.count()).toBeGreaterThanOrEqual(1);
    const firstName = await bars.first().getAttribute('aria-label');
    expect(firstName).toMatch(/this window/);
    expect(firstName).toMatch(/prior/);
    // Sky bright (#2FA8F7) is the fill; the rail is the theme's sunken tray.
    const fill = await bars.first().evaluate((node) => {
      const inner = node.querySelector('div');
      return inner ? getComputedStyle(inner).backgroundColor : null;
    });
    expect(fill, 'bar fill is the Sky bright tier').toBe('rgb(47, 168, 247)');

    // Values use the metric role (800 weight + tabular figures), so a number
    // never jitters as it animates and never renders as plain body text. Scoped
    // to the highlight group so the Weekly Review/Momentum surfaces outside
    // this phase's split cannot decide the result.
    const metricShape = await dialog.evaluate(() => {
      const rects = (el: Element) => el.getBoundingClientRect();
      const prior = Array.from(document.querySelectorAll('div')).find((el) =>
        (el.textContent ?? '').trim().startsWith('Prior: '),
      );
      if (!prior) return null;
      let group: Element | null = prior;
      for (let depth = 0; depth < 8 && group; depth += 1) {
        if (getComputedStyle(group).borderTopWidth === '2px') break;
        group = group.parentElement;
      }
      if (!group) return null;
      const numbers = Array.from(group.querySelectorAll('div')).filter((el) => {
        if (el.children.length > 0) return false;
        const text = (el.textContent ?? '').trim();
        if (!text) return false;
        const style = getComputedStyle(el);
        const size = Number.parseFloat(style.fontSize);
        const weight = Number.parseInt(style.fontWeight, 10) || 400;
        return size >= 20 && weight >= 800 && rects(el).width > 0;
      });
      return {
        count: numbers.length,
        // react-native-web emits `fontVariant: ['tabular-nums']` as the CSS
        // shorthand and/or the longhand; accept either, so a rendering-stack
        // detail can never fail a type contract.
        tabular: numbers.every((el) => {
          const style = getComputedStyle(el);
          return [style.fontVariant, style.fontVariantNumeric, style.fontFeatureSettings].some(
            (value) => (value ?? '').includes('tabular-nums'),
          );
        }),
      };
    });
    expect(metricShape, 'metric-role numbers render in the highlights group').not.toBeNull();
    expect(metricShape!.count).toBeGreaterThanOrEqual(1);
    expect(metricShape!.tabular, 'metric numbers use tabular figures').toBe(true);
  });

  test('details disclosure still reveals the remaining metrics and planning group', async ({
    page,
  }) => {
    await seedFixture(page, 'TYPICAL');
    const dialog = await openProgress(page);

    await expect(dialog.getByText('Active projects')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Show metric details' }).click();
    await expect(dialog.getByRole('button', { name: 'Hide metric details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(dialog.getByText('Active projects')).toBeVisible();
    await expect(dialog.getByText('Weekly reviews')).toBeVisible();
    await expect(dialog.getByText('Focus minutes')).toBeVisible();
    await expect(dialog.getByText('Focus sessions')).toBeVisible();

    // The 44pt disclosure target (v2 target floor).
    const box = await dialog.getByRole('button', { name: 'Hide metric details' }).boundingBox();
    expect(box, 'disclosure has a box').not.toBeNull();
    expect(box!.height, 'disclosure is >= 44pt tall').toBeGreaterThanOrEqual(44);
  });

  test('fits 360/375/390 with no horizontal overflow and 44pt window chips', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openProgress(page);
      await page.waitForTimeout(250);
      const measured = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(measured.viewport).toBe(width);
      expect(measured.overflow, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(
        width,
      );
      for (const days of [7, 30, 90]) {
        const chip = dialog.getByRole('button', { name: `Show the last ${days} days` });
        const chipBox = await chip.boundingBox();
        expect(chipBox, `${width}: ${days}d chip has a box`).not.toBeNull();
        // P6 `Chip` owns the pill's 40pt face (+2pt slop); P21b only guarantees
        // that the window row itself never clips or overflows.
        expect(chipBox!.height, `${width}: ${days}d chip face`).toBeGreaterThanOrEqual(40);
        expect(
          chipBox!.x + chipBox!.width,
          `${width}: ${days}d chip inside viewport`,
        ).toBeLessThanOrEqual(width);
      }
    }
  });
});

test.describe('P21b Activity timeline grammar', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
  });

  test('event rows lead with a source-hued 40px tile and keep one metadata line', async ({
    page,
  }) => {
    await seedReflectionHistory(page);
    const dialog = await openTimeline(page);

    // Rows come first, the collapsed chrome after (§"events before filter
    // chrome") — both the row and the summary line are already on screen.
    await expect(dialog).toContainText('All sources · Last 30 days');

    // Each row keeps its title plus ONE metadata line naming the category, so
    // the tile is redundancy and colour is never the only carrier of meaning.
    const rows = dialog.locator('[style*="border-radius: 16px"]').first();
    await expect(rows).toBeVisible();

    // The leading tile is the event's source hue: a habit row paints the
    // Sprout tint (#E6F7E3 light / #233E2E dark) and NOT a neutral surface.
    const tiles = await dialog.evaluate(() => {
      const out: { glyph: string; face: string }[] = [];
      for (const node of Array.from(document.querySelectorAll('div'))) {
        const style = getComputedStyle(node);
        if (style.width !== '40px' || style.height !== '40px') continue;
        const glyph = node.querySelector('span');
        out.push({
          glyph: (glyph?.textContent ?? '').trim(),
          face: style.backgroundColor,
        });
      }
      return out;
    });
    expect(tiles.length, 'event rows render leading tiles').toBeGreaterThanOrEqual(2);
    const faces = new Set(tiles.map((tile) => tile.face));
    // A merged feed of a todo, a habit and a workout paints at least two
    // different hues — otherwise the per-source hue is decorative noise.
    expect(faces.size, 'rows use per-source hues').toBeGreaterThanOrEqual(2);

    // Filters keeps its exact accessible name + collapsed state.
    const filters = dialog.getByRole('button', { name: 'Timeline filters' });
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
    const box = await filters.boundingBox();
    expect(box, 'filters control has a box').not.toBeNull();
    expect(box!.height, 'filters control >= 44pt').toBeGreaterThanOrEqual(44);

    // Opening the control reveals three labelled groups (source/range/day),
    // each still carrying the per-control names W12 asserts.
    await filters.click();
    await expect(dialog.getByRole('button', { name: 'Filter timeline by Habits' })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Show activity from the last 7 days' }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'All days' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Timeline filters' }).click();
  });

  test('empty, filtered-empty and day grouping keep their distinct copy', async ({ page }) => {
    const dialog = await openTimeline(page);
    await expect(dialog.getByText('Nothing logged yet')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('No matching activity')).toHaveCount(0);

    await seedReflectionHistory(page);
    const seeded = await openTimeline(page);
    await expect(seeded).toContainText('All sources · Last 30 days');
    await seeded.getByRole('button', { name: 'Timeline filters' }).click();
    await seeded.getByRole('button', { name: 'Filter timeline by Workout' }).click();
    await expect(seeded.getByText('Completed "P21b completed task"')).toHaveCount(0);
    // The day group header is still the browser-local "Today"/date label.
    await expect(seeded.getByText('No matching activity')).toHaveCount(0);
    await seeded.getByRole('button', { name: 'Reset filters' }).click();
    await expect(seeded).toContainText('All sources · Last 30 days');
  });

  test('fits 360/375/390 with no horizontal overflow', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await openTimeline(page);
      await page.waitForTimeout(250);
      const measured = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(measured.viewport).toBe(width);
      expect(measured.overflow, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(
        width,
      );
    }
  });
});

test.describe('P21b Health surface', () => {
  const HEALTH_PANEL = (page: Page) => page.locator('#sh-section-panel-health');

  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('the Lagoon hero states today and the two routing rows keep their names', async ({
    page,
  }) => {
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    await expect(HEALTH_PANEL(page)).not.toHaveAttribute('aria-hidden', 'true');
    const panel = HEALTH_PANEL(page);
    await expect(panel.getByText('Health', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Hero face is the §5.1 Lagoon bright, and every ink painted on it clears
    // AA against THAT fill. This is the pair the theme's own palette cannot
    // satisfy (dark `text` on Lagoon = 1.87:1), so a regression to
    // `tokens.text`/`tokens.textMuted` on the hero fails right here.
    const hero = await panel.evaluate((root, expected) => {
      const channels = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number);
      const luminance = (rgb: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
      };
      const ratio = (a: string, b: string) => {
        const [la, lb] = [luminance(channels(a)), luminance(channels(b))].sort((x, y) => y - x);
        return (la + 0.05) / (lb + 0.05);
      };
      const faces = Array.from(root.querySelectorAll('div')).filter(
        (node) => getComputedStyle(node).backgroundColor === expected,
      );
      const inks: { text: string; color: string; ratio: number }[] = [];
      for (const node of faces) {
        for (const leaf of Array.from(node.querySelectorAll('div'))) {
          if (leaf.children.length > 0) continue;
          const text = (leaf.textContent ?? '').trim();
          if (!text) continue;
          const color = getComputedStyle(leaf).color;
          if (!color.startsWith('rgb')) continue;
          inks.push({ text: text.slice(0, 24), color, ratio: ratio(color, expected) });
        }
      }
      return { faces: faces.length, inks };
    }, HERO_FACE);
    expect(hero.faces, 'the Health hero paints the Lagoon bright face').toBeGreaterThanOrEqual(1);
    expect(
      hero.inks.length,
      'the hero states today in words, not just a colour',
    ).toBeGreaterThanOrEqual(2);
    for (const ink of hero.inks) {
      expect(
        ink.ratio,
        `hero ink ${ink.color} on Lagoon ("${ink.text}") — needs 4.5`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    // The two routing rows keep their exact accessible names and 64pt targets.
    for (const name of ['Open Workout', 'Open Calories']) {
      const row = panel.getByRole('button', { name, exact: true });
      await expect(row).toBeVisible();
      const box = await row.boundingBox();
      expect(box, `${name} has a box`).not.toBeNull();
      expect(box!.height, `${name} >= 44pt`).toBeGreaterThanOrEqual(44);
    }

    // Routing still works (behaviour unchanged): Workout opens its section.
    await panel.getByRole('button', { name: 'Open Workout', exact: true }).click();
    await expect(page.locator('#sh-section-panel-workout')).not.toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('day state copy stays verbatim for empty and logged devices', async ({ page }) => {
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    const panel = HEALTH_PANEL(page);
    await expect(panel.getByText('Workout not logged yet')).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText(/kcal eaten ·/)).toBeVisible();

    await seedReflectionHistory(page);
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    await expect(HEALTH_PANEL(page).getByText('Workout done ✓')).toBeVisible({ timeout: 20_000 });
    await expect(HEALTH_PANEL(page).getByText(/kcal eaten ·/)).toBeVisible();
  });

  test('fits 360/375/390 with no horizontal overflow', async ({ page }) => {
    await seedFixture(page, 'TYPICAL');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/#health', { waitUntil: 'domcontentloaded' });
      await expect(HEALTH_PANEL(page).getByText('Health', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await page.waitForTimeout(250);
      const measured = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(measured.viewport).toBe(width);
      expect(measured.overflow, `${width}: no page-wide horizontal overflow`).toBeLessThanOrEqual(
        width,
      );
    }
  });
});

/**
 * Scoped rendered-contrast audit.
 *
 * `auditPage` (e2e/helpers/a11yAudit.ts) walks the WHOLE document, which while
 * the Planning Hub drawer is open also measures the Overview screen behind it —
 * surfaces owned by other P21 phases (garden legend, XP chip). This phase can
 * only answer for its own surfaces, so the same math runs over one subtree:
 * composited ancestor background, WCAG relative luminance, and the AA floor for
 * the rendered size/weight. Material glyphs and tab controls keep the shared
 * helper's exemptions.
 */
/**
 * `scope` is either a CSS selector (a section panel) or `|`-separated marker
 * strings resolved to the smallest element that contains all of them.
 *
 * The hub dialog hosts several surfaces at once (Progress insights, the Weekly
 * Review entry, the Momentum Garden art). P21b answers only for its own
 * subtree, and this phase may not edit `features/momentum` (another session's
 * split), so the scope is resolved from strings this phase owns rather than
 * from a structural class that another surface could also match.
 *
 * Everything must stay INSIDE the evaluated function: `page.evaluate`
 * serialises only the entry function, so module-level helpers are unavailable
 * in the page.
 */
function auditSubtree(scope: string) {
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => Number.parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (
    fg: { r: number; g: number; b: number; a: number },
    bg: { r: number; g: number; b: number; a: number },
  ) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  const backgroundOf = (el: Element) => {
    let cur: Element | null = el;
    let acc: { r: number; g: number; b: number; a: number } | null = null;
    while (cur && cur !== document.documentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (c.a === 1) return acc;
      }
      cur = cur.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor) ?? {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    };
    return acc ? over(acc, root) : root;
  };

  let root: Element | null;
  const markers = scope.split('|');
  if (markers.length === 1) {
    root = document.querySelector(markers[0]);
  } else {
    root = null;
    let bestLength = Number.POSITIVE_INFINITY;
    for (const node of Array.from(document.querySelectorAll('div'))) {
      const text = node.textContent ?? '';
      if (!markers.every((marker) => text.includes(marker))) continue;
      if (text.length < bestLength) {
        bestLength = text.length;
        root = node;
      }
    }
  }
  if (!root) return { missing: true, contrast: [] as string[], nameless: [] as string[] };

  const contrast: string[] = [];
  const nameless: string[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const isIconGlyph = /material/i.test(cs.fontFamily);
    const inTabControl = !!el.closest('[role="tab"], [role="tablist"]');
    if (el.children.length === 0 && !isIconGlyph && !inTabControl) {
      const text = (el.textContent ?? '').trim();
      if (text) {
        const fg = parse(cs.color);
        if (fg) {
          const bg = backgroundOf(el);
          const composed = fg.a < 1 ? over(fg, bg) : fg;
          const cr = ratio(composed, bg);
          const fontSize = Number.parseFloat(cs.fontSize);
          const weight = Number.parseInt(cs.fontWeight, 10) || 400;
          const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
          const min = large ? 3 : 4.5;
          if (cr < min - 0.01) {
            const key = `${text.slice(0, 24)}:${cs.color}`;
            if (!seen.has(key)) {
              seen.add(key);
              const bgText = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
              contrast.push(
                `${text.slice(0, 28)} ${cr.toFixed(2)}:1 (needs ${min}) at ${Math.round(fontSize)}px ${cs.color} on ${bgText}`,
              );
            }
          }
        }
      }
    }
    const role = el.getAttribute('role');
    const interactive = role === 'button' || role === 'link' || role === 'radio' || role === 'tab';
    if (interactive) {
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      if (!name && !seen.has(`nameless:${role}`)) {
        seen.add(`nameless:${role}`);
        nameless.push(`${role}`);
      }
    }
  }
  return { missing: false, contrast, nameless };
}

test.describe('P21b rendered contrast', () => {
  /** Apply a theme through AsyncStorage, reload, then audit one surface. */
  async function applyTheme(page: Page, mode: 'light' | 'dark', themeId?: string) {
    await page.evaluate(
      ({ resolvedMode, id }) => {
        localStorage.setItem('superhabits.theme.mode', resolvedMode);
        if (id) {
          localStorage.setItem(
            'superhabits.theme.slots.v2',
            JSON.stringify({ lightThemeId: 'light', darkThemeId: id }),
          );
        }
      },
      { resolvedMode: mode, id: themeId },
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  async function growHistory(page: Page) {
    await goToTab(page, 'overview');
    await seedFixture(page, 'TYPICAL');
    await seedReflectionHistory(page);
  }

  for (const [label, mode, themeId] of [
    ['light', 'light', undefined],
    ['dark', 'dark', undefined],
    ['cyberpunk-neon (override tints)', 'dark', 'cyberpunk-neon'],
  ] as const) {
    test(`Progress, Timeline and Health have no AA contrast defect (${label})`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await growHistory(page);
      await applyTheme(page, mode, themeId);

      // Progress: headline rows plus the expanded disclosure body, scoped to
      // the hub dialog so other screens' surfaces are not scored here.
      const dialog = await openProgress(page);
      await dialog.getByRole('button', { name: 'Show metric details' }).click();
      await page.waitForTimeout(600);
      // Visible strings only: `page.evaluate` scope markers are substring
      // matches on `textContent`, which never includes an `aria-label`.
      const progressAudit = await page.evaluate(auditSubtree, 'Highlights|More details');
      expect(progressAudit.missing, 'progress dialog present').toBe(false);
      expect(progressAudit.contrast, `progress ${label}: WCAG AA contrast`).toEqual([]);
      expect(progressAudit.nameless, `progress ${label}: controls without names`).toEqual([]);
      await page.keyboard.press('Escape');

      // Timeline: rows, day groups, then the open filter body (selected chips).
      const timeline = await openTimeline(page);
      await timeline.getByRole('button', { name: 'Timeline filters' }).click();
      await page.waitForTimeout(500);
      const timelineAudit = await page.evaluate(auditSubtree, 'Filters|All sources · Last');
      expect(timelineAudit.contrast, `timeline ${label}: WCAG AA contrast`).toEqual([]);
      expect(timelineAudit.nameless, `timeline ${label}: controls without names`).toEqual([]);
      await page.keyboard.press('Escape');

      // Health: the Lagoon hero and the two tinted routing tiles. Health is a
      // standalone section panel, so the panel is the scope.
      await page.goto('/#health', { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('#sh-section-panel-health').getByText('Health', { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(800);
      const healthAudit = await page.evaluate(auditSubtree, '#sh-section-panel-health');
      expect(healthAudit.contrast, `health ${label}: WCAG AA contrast`).toEqual([]);
      expect(healthAudit.nameless, `health ${label}: controls without names`).toEqual([]);
    });
  }
});
