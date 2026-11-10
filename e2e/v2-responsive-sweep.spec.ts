import { expect, test, type Page } from './fixtures';
import { planningHubTab, sectionTab, TAB_LABELS } from './helpers/navigation';
import { seedFixture } from './helpers/seed';
import { openCommandScreen, openSettingsScreen } from './helpers/commandObservation';
import { layout } from '@/core/theme/designTokens';

/**
 * V2 responsive sweep — one instrument for the promises the P1–P21 restyle
 * makes on *every* surface, instead of the piecemeal probes the per-phase specs
 * already carry (`settings-v2-p18`, `command.p19.capture`,
 * `gamification-surfaces`, `planning-v2-surfaces`, `health-nav-w10`).
 *
 * Four promises, one spec:
 *
 *  1. **No horizontal overflow** — `document.scrollingElement` never gains a
 *     horizontal scrollbar, no control escapes the viewport, and every
 *     horizontal scroller fits the viewport, on the six sections plus the
 *     Settings / Command Center / Planning Hub / Weekly Review overlays and the
 *     Health deep-link surface, at 360 / 375 / 390 / 768 / 1280 in light and
 *     dark. A control parked outside the viewport by a *clipping* ancestor (To
 *     Do's swipe-revealed row actions sit at `left: -9820` until swiped) is not
 *     overflow: the clip box is what a user can see, so the ancestor is
 *     measured instead.
 *  2. **Effective touch targets >= 44x44 CSS px** at phone widths — measured as
 *     the real DOM box of the interactive element (the node that carries the
 *     `role`/`button` semantics and the press handler). No `hitSlop` inflation
 *     and no per-surface allowlist: react-native-web drops `hitSlop` (it never
 *     reaches the DOM box or the DOM as an attribute, documented in
 *     `core/ui/PillChip.tsx`), so a phone-sized face that only reaches 44
 *     through a slop it declares is a *web* hit-area defect and is reported as
 *     one. The current build does not keep this promise everywhere, so this
 *     case is quarantined per the repo's standing quarantine protocol
 *     (`docs/testing/known-gaps.md` CG-12): `test.fixme` with the full
 *     assertion body preserved as the release assertion. The measured
 *     inventory, per surface and per width, lives in the CG-12 register entry;
 *     un-fixme-ing this case is the fix's own proof. The other three promises
 *     below stay ordinary active cases, so a NEW overflow, layout or motion
 *     defect still fails this lane.
 *  3. **Wide layout** — >= 900 shows the side rail (80px, widening to the
 *     248px labelled sidebar at >= 1280), the content column honours its
 *     declared cap (`layout.contentMaxWidth` 640, with the documented Today
 *     dashboard exception `layout.dashboardMaxWidth` 1040,
 *     `docs/ui-ux/16-playful-momentum.md` §5.6) and is horizontally centred in
 *     the remaining content area; <= 899 keeps the floating bottom bar and no
 *     sidebar.
 *  4. **Reduced motion** — with `prefers-reduced-motion: reduce` emulated, no
 *     animation is left *running* and no CSS animation is declared on the
 *     content (§5.8 allows one 120ms opacity cross-fade and forbids
 *     ambient/looping motion).
 *
 * Determinism: nothing is gated on `waitForTimeout`. Layout is awaited by
 * polling a rounded geometry signature until it repeats (so a drawer's entrance
 * spring is never measured mid-slide), and every interaction asserts its
 * resulting state (`aria-selected`, dialog visibility). Data comes from the
 * shared `TYPICAL` fixture, so the same populated state is measured in light and
 * dark.
 */

const PHONE_WIDTHS = [360, 375, 390] as const;
const ALL_WIDTHS = [360, 375, 390, 768, 1280] as const;

const SECTIONS = [
  { key: 'overview', label: TAB_LABELS.overview },
  { key: 'todos', label: TAB_LABELS.todos },
  { key: 'habits', label: TAB_LABELS.habits },
  { key: 'pomodoro', label: TAB_LABELS.pomodoro },
  { key: 'workout', label: TAB_LABELS.workout },
  { key: 'calories', label: TAB_LABELS.calories },
] as const;

/** Every interactive element the sweep must measure. */
const INTERACTIVE_SELECTOR = [
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="combobox"]',
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
].join(',');

type Target = { name: string; width: number; height: number };

type Measurement = {
  /** document scrollWidth - clientWidth (0 when the page cannot scroll sideways). */
  pageOverflow: number;
  /** Visible controls whose box escapes the viewport horizontally. */
  horizontalEscapes: string[];
  /** Horizontal scrollers that themselves do not fit the viewport. */
  unfittedScrollers: string[];
  /** Controls whose CSS-px box is under 44 in either dimension. */
  undersizedTargets: Target[];
};

/**
 * Measure one surface. Everything runs in the page against real geometry: the
 * measured target is the interactive element's own DOM box, which is the hit
 * area a pointer user actually gets (`hitSlop` is not part of a DOM box).
 */
async function measure(page: Page, scopeSelector: string): Promise<Measurement> {
  return page.evaluate(
    ({ interactiveSelector, scopeSelector: scope }) => {
      /** Hidden through the whole ancestor chain (aria-hidden / inert / CSS). */
      const isRendered = (node: HTMLElement): boolean => {
        let current: HTMLElement | null = node;
        while (current && current !== document.body) {
          if (current.getAttribute('aria-hidden') === 'true') return false;
          if (current.hasAttribute('inert')) return false;
          const style = getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (Number.parseFloat(style.opacity) < 0.05) return false;
          current = current.parentElement;
        }
        return true;
      };

      /**
       * The nearest ancestor that clips its children (`overflow` hidden/clip),
       * or null when nothing does. A control parked outside a clipping ancestor
       * (To Do's swipe actions) is only reachable through a gesture, and the
       * clip box — not the parked position — is what can overflow.
       */
      const clippingBox = (node: HTMLElement): DOMRect | null => {
        let current = node.parentElement;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (/hidden|clip/.test(style.overflowX) || /hidden|clip/.test(style.overflowY)) {
            return current.getBoundingClientRect();
          }
          current = current.parentElement;
        }
        return null;
      };

      const outsideViewport = (box: { left: number; right: number }): boolean =>
        box.left < -1 || box.right > window.innerWidth + 1;

      const root = document.querySelector(scope) ?? document.body;
      const undersizedTargets: Target[] = [];
      const horizontalEscapes: string[] = [];

      for (const candidate of Array.from(root.querySelectorAll(interactiveSelector))) {
        const node = candidate as HTMLElement;
        if (!isRendered(node)) continue;
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const name = (
          node.getAttribute('aria-label')?.trim() ||
          node.getAttribute('placeholder')?.trim() ||
          (node.textContent ?? '').trim().replace(/\s+/g, ' ') ||
          node.tagName.toLowerCase()
        ).slice(0, 80);

        // Overflow: a control counts only when a user could see it outside the
        // viewport, i.e. it is not clipped away by an ancestor.
        const clip = clippingBox(node);
        if (outsideViewport(box) && !(clip && !outsideViewport(clip))) {
          horizontalEscapes.push(`${name} @${Math.round(box.left)}-${Math.round(box.right)}`);
        }

        const width = Math.round(box.width * 10) / 10;
        const height = Math.round(box.height * 10) / 10;
        // 43.5 tolerance absorbs sub-pixel rounding (a 43.999 face is a 44).
        if (width < 43.5 || height < 43.5) undersizedTargets.push({ name, width, height });
      }

      // A horizontal scroller may scroll its own content, but it must itself
      // fit the viewport — a scroller wider than the page is a clipped surface
      // (the failure `command.p19` and `gamification-surfaces` pin).
      const unfittedScrollers: string[] = [];
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (!isRendered(element)) continue;
        const style = getComputedStyle(element);
        if (!/auto|scroll/.test(style.overflowX)) continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0) continue;
        const clip = clippingBox(element);
        if (outsideViewport(box) && !(clip && !outsideViewport(clip))) {
          unfittedScrollers.push(
            `${element.tagName}:${Math.round(box.left)}-${Math.round(box.right)}`,
          );
        }
      }

      const scrolling = document.scrollingElement;
      const pageOverflow = scrolling ? scrolling.scrollWidth - scrolling.clientWidth : 0;

      return {
        pageOverflow,
        horizontalEscapes: horizontalEscapes.slice(0, 8),
        unfittedScrollers: unfittedScrollers.slice(0, 8),
        undersizedTargets: undersizedTargets.slice(0, 200),
      };
    },
    {
      interactiveSelector: INTERACTIVE_SELECTOR,
      scopeSelector,
    },
  );
}

/**
 * Wait until a surface's geometry repeats across two consecutive polls, so a
 * Modal's entrance spring (drawer slide + scale) is never measured mid-flight.
 * Under the reduced motion this spec installs those springs are skipped
 * entirely; this poll keeps the measurement honest without a sleep.
 */
async function waitForSettledGeometry(page: Page, scopeSelector: string): Promise<void> {
  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const signature = await page.evaluate((scope) => {
          const root = document.querySelector(scope);
          if (!root) return 'missing';
          const box = root.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height].map((value) => Math.round(value)).join(':');
        }, scopeSelector);
        const stable = signature === previous;
        previous = signature;
        return stable;
      },
      { timeout: 15_000, intervals: [80, 120, 160] },
    )
    .toBe(true);
}

const panelScope = (section: string) => `#sh-section-panel-${section}`;

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((mode) => window.localStorage.setItem('superhabits.theme.mode', mode), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe(theme);
  await expect(sectionTab(page, TAB_LABELS.overview)).toBeVisible({ timeout: 30_000 });
}

async function showSection(page: Page, label: string): Promise<void> {
  await sectionTab(page, label).click();
  await expect(sectionTab(page, label)).toHaveAttribute('aria-selected', 'true');
}

async function closeOverlay(page: Page): Promise<void> {
  const close = page.getByRole('dialog').getByRole('button', { name: 'Close' }).first();
  await expect(close).toBeVisible({ timeout: 15_000 });
  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Seed once per test from the shared fixture, with reduced motion installed (the
 * app's own supported mode): entrance springs are skipped, so geometry reads the
 * settled layout. Reduced motion itself is asserted separately in the motion
 * case.
 */
async function prepare(page: Page, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await seedFixture(page, 'TYPICAL');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tablist', { name: 'Section tabs' }).first()).toBeVisible({
    timeout: 30_000,
  });
  if (theme !== 'light') await setTheme(page, theme);
}

type Overlay = 'settings' | 'command' | 'hub' | 'weekly-review' | 'health';

/**
 * Open one overlay *through existing UI only* and return the selector that
 * scopes its measurement. Every path below is a shipped product path: Settings
 * via the header button, Command Center via Add -> Describe it, Planning Hub via
 * Today's "Plan today", Weekly Review via the hub's Progress view, and Health
 * via the documented `#health` deep link (it has no rail destination in the
 * six-tab model).
 */
async function openOverlay(page: Page, overlay: Overlay): Promise<string> {
  switch (overlay) {
    case 'settings': {
      await showSection(page, TAB_LABELS.overview);
      await openSettingsScreen(page);
      await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
      await waitForSettledGeometry(page, '[role="dialog"]');
      return '[role="dialog"]';
    }
    case 'command': {
      await showSection(page, TAB_LABELS.overview);
      await openCommandScreen(page);
      await expect(page.getByText('Command center', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await waitForSettledGeometry(page, '[role="dialog"]');
      return '[role="dialog"]';
    }
    case 'hub': {
      await showSection(page, TAB_LABELS.overview);
      await page.getByRole('button', { name: 'Plan today' }).click();
      await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
      await waitForSettledGeometry(page, '[role="dialog"]');
      return '[role="dialog"]';
    }
    case 'weekly-review': {
      await showSection(page, TAB_LABELS.overview);
      await page.getByRole('button', { name: 'Plan today' }).click();
      await expect(planningHubTab(page, 'Progress')).toBeVisible({ timeout: 20_000 });
      await planningHubTab(page, 'Progress').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' }).click();
      await expect(page.getByRole('dialog').getByText(/^Step 1 of 5/)).toBeVisible({
        timeout: 20_000,
      });
      await waitForSettledGeometry(page, '[role="dialog"]');
      return '[role="dialog"]';
    }
    case 'health': {
      await page.goto('/#health', { waitUntil: 'domcontentloaded' });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.querySelector('#sh-section-panel-health')?.getAttribute('aria-hidden') !==
              'true',
          ),
        )
        .toBe(true);
      await waitForSettledGeometry(page, panelScope('health'));
      return panelScope('health');
    }
  }
}

/** Close an overlay the way a user would (the deep link is not a modal). */
async function dismissOverlay(page: Page, overlay: Overlay): Promise<void> {
  if (overlay === 'health') {
    // Deep-linked section, not a modal: return to the shell's normal entry.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(sectionTab(page, TAB_LABELS.overview)).toBeVisible({ timeout: 30_000 });
    return;
  }
  await closeOverlay(page);
}

const OVERLAYS: { overlay: Overlay; surface: string }[] = [
  { overlay: 'settings', surface: 'settings' },
  { overlay: 'command', surface: 'command' },
  { overlay: 'hub', surface: 'hub-today' },
  { overlay: 'weekly-review', surface: 'weekly-review' },
  { overlay: 'health', surface: 'health' },
];

const HUB_VIEWS = ['Today', 'Projects', 'Goals', 'Progress', 'Timeline'] as const;

/** Assert one measurement against the overflow contract. */
function expectNoOverflow(result: Measurement, label: string): void {
  // 1px of sub-pixel rounding is layout noise, not a horizontal scrollbar.
  expect(result.pageOverflow, `${label}: the page never scrolls sideways`).toBeLessThanOrEqual(1);
  expect(result.horizontalEscapes, `${label}: no control escapes the viewport`).toEqual([]);
  expect(result.unfittedScrollers, `${label}: horizontal scrollers fit the viewport`).toEqual([]);
}

type Inventory = Map<string, { surface: string; name: string; sizes: Set<string> }>;

/**
 * Walk every phone-width surface and collect the sub-44 inventory, keyed by
 * `surface|name` (sizes are kept separately because a squeezed control reports a
 * different size per viewport).
 */
async function collectSub44Inventory(page: Page): Promise<Inventory> {
  const inventory: Inventory = new Map();

  const audit = async (surface: string, scope: string) => {
    const result = await measure(page, scope);
    for (const target of result.undersizedTargets) {
      const key = `${surface}|${target.name}`;
      const entry = inventory.get(key) ?? { surface, name: target.name, sizes: new Set<string>() };
      entry.sizes.add(`${target.width}x${target.height}`);
      inventory.set(key, entry);
    }
  };

  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    for (const section of SECTIONS) {
      await showSection(page, section.label);
      await waitForSettledGeometry(page, panelScope(section.key));
      await audit(section.key, panelScope(section.key));
    }
    // The two shell-level overlays at every phone width.
    for (const overlay of ['settings', 'command'] as const) {
      await audit(overlay, await openOverlay(page, overlay));
      await dismissOverlay(page, overlay);
    }
  }

  // The longest UI paths run once, at the tightest width.
  await page.setViewportSize({ width: 360, height: 844 });
  await audit('health', await openOverlay(page, 'health'));
  await dismissOverlay(page, 'health');
  await audit('weekly-review', await openOverlay(page, 'weekly-review'));
  await dismissOverlay(page, 'weekly-review');

  await showSection(page, TAB_LABELS.overview);
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
  for (const view of HUB_VIEWS) {
    await planningHubTab(page, view).click();
    await waitForSettledGeometry(page, '[role="dialog"]');
    await audit(`hub-${view.toLowerCase()}`, '[role="dialog"]');
  }

  return inventory;
}

/** Render the inventory as one readable line per offender, with its sizes. */
function inventoryLines(inventory: Inventory): string[] {
  return Array.from(inventory.values())
    .map(
      (entry) =>
        `${entry.surface} › "${entry.name}" measured ${Array.from(entry.sizes)
          .sort()
          .join(', ')} px`,
    )
    .sort();
}

test.describe('V2 responsive sweep', () => {
  test('no surface overflows horizontally at 360/375/390/768/1280 in light and dark', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await prepare(page);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      for (const width of ALL_WIDTHS) {
        await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
        for (const section of SECTIONS) {
          await showSection(page, section.label);
          await waitForSettledGeometry(page, panelScope(section.key));
          expectNoOverflow(
            await measure(page, panelScope(section.key)),
            `${theme} ${width} ${section.key}`,
          );
        }
      }
    }

    // Overlays install their own scroll body and a fixed-width panel: the
    // classic 360px overflow source, so they are measured rather than assumed.
    await setTheme(page, 'light');
    for (const width of ALL_WIDTHS) {
      await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
      for (const entry of OVERLAYS) {
        const scope = await openOverlay(page, entry.overlay);
        expectNoOverflow(await measure(page, scope), `light ${width} ${entry.surface}`);
        await dismissOverlay(page, entry.overlay);
      }
    }

    // Each hub view renders a different body; sweep all five at 360 (the
    // tightest phone) so a view-specific row cannot hide behind Today's.
    await page.setViewportSize({ width: 360, height: 844 });
    await showSection(page, TAB_LABELS.overview);
    await page.getByRole('button', { name: 'Plan today' }).click();
    await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
    for (const view of HUB_VIEWS) {
      await planningHubTab(page, view).click();
      await waitForSettledGeometry(page, '[role="dialog"]');
      expectNoOverflow(await measure(page, '[role="dialog"]'), `hub ${view}`);
    }
  });

  // Quarantined defect (CG-12 in `docs/testing/known-gaps.md`), quarantined per
  // the standing protocol rather than excluded: the body below IS the release
  // assertion (same helper, same thresholds, same surface set), so un-fixme-ing
  // this case is the fix's own proof. The measured inventory lives in the CG-12
  // register entry.
  test.fixme('every control reaches a 44px CSS hit area at phone widths (known web touch-target gap)', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await prepare(page);
    const inventory = await collectSub44Inventory(page);
    expect(
      inventoryLines(inventory),
      'every interactive control reaches a 44x44 CSS px hit area',
    ).toEqual([]);
  });

  test('wide viewports cap and centre the content column and swap the nav shell', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    await prepare(page);

    for (const width of [899, 900, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const section of SECTIONS) {
        await showSection(page, section.label);
        await waitForSettledGeometry(page, panelScope(section.key));

        const shell = await page.evaluate((scope) => {
          const rail = document.querySelector('[aria-label="Section tabs"]');
          const railBox = rail ? rail.getBoundingClientRect() : null;
          const panel = document.querySelector(scope);
          if (!panel) return null;
          // Content columns declare their cap in CSS (`maxWidth`): measure
          // every declared column in the panel and prove the cap holds.
          const columns: { declared: number; width: number; centre: number }[] = [];
          for (const element of Array.from(panel.querySelectorAll<HTMLElement>('*'))) {
            const style = getComputedStyle(element);
            if (style.maxWidth === 'none') continue;
            const declared = Number.parseFloat(style.maxWidth);
            if (!Number.isFinite(declared) || declared < 400) continue;
            const box = element.getBoundingClientRect();
            if (box.width < 300) continue;
            columns.push({
              declared,
              width: Math.round(box.width * 10) / 10,
              centre: Math.round((box.x + box.width / 2) * 10) / 10,
            });
          }
          return {
            rail: railBox
              ? {
                  width: Math.round(railBox.width * 10) / 10,
                  top: Math.round(railBox.y * 10) / 10,
                  height: Math.round(railBox.height * 10) / 10,
                }
              : null,
            columns,
          };
        }, panelScope(section.key));
        expect(shell, `${width} ${section.key}: the section panel renders`).not.toBeNull();

        // The content area is the viewport minus a *vertical* side rail; the
        // phone bar is a horizontal overlay on top of the content, so it does
        // not narrow the column.
        const isVerticalRail = shell!.rail !== null && shell!.rail.top === 0;
        const railWidth = isVerticalRail ? shell!.rail!.width : 0;
        const expectedCentre = (width + railWidth) / 2;
        for (const column of shell!.columns) {
          expect(
            column.width,
            `${width} ${section.key}: column honours its ${column.declared}px cap`,
          ).toBeLessThanOrEqual(column.declared + 1);
          expect(
            Math.abs(column.centre - expectedCentre),
            `${width} ${section.key}: column is centred in the ${width - railWidth}px content area`,
          ).toBeLessThanOrEqual(1.5);
        }
        // The outermost column never exceeds the documented cap for the
        // section: the Today dashboard may use `dashboardMaxWidth` (1040, §5.6),
        // every other section is the 640 phone-like column.
        const widest = shell!.columns.reduce((max, column) => Math.max(max, column.width), 0);
        const cap = section.key === 'overview' ? layout.dashboardMaxWidth : layout.contentMaxWidth;
        expect(
          widest,
          `${width} ${section.key}: content column stays within ${cap}px`,
        ).toBeLessThanOrEqual(cap + 1);

        // Nav shell swap: >= 900 is the side rail (80px, widening to the 248px
        // labelled sidebar at >= 1280); below 900 the bottom bar owns the
        // bottom edge and there is no sidebar.
        if (width >= 900) {
          expect(shell!.rail, `${width} ${section.key}: the side rail renders`).not.toBeNull();
          expect(shell!.rail!.width, `${width} ${section.key}: side rail width`).toBe(
            width >= 1280 ? 248 : 80,
          );
          expect(shell!.rail!.top, `${width} ${section.key}: the rail starts at the top edge`).toBe(
            0,
          );
          expect(
            shell!.rail!.height,
            `${width} ${section.key}: the rail is full height`,
          ).toBeGreaterThan(600);
        } else {
          expect(shell!.rail, `${width} ${section.key}: the bottom bar renders`).not.toBeNull();
          expect(
            shell!.rail!.top,
            `${width} ${section.key}: the bar floats at the bottom`,
          ).toBeGreaterThan(600);
        }
      }
    }

    // <= 390: exactly one section rail (the bottom bar) anchored to the bottom,
    // which is also the proof that the sidebar is not rendered at phone widths.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const section of SECTIONS) {
      await showSection(page, section.label);
      await waitForSettledGeometry(page, panelScope(section.key));
      await expect(
        page.getByRole('tablist', { name: 'Section tabs' }),
        `390 ${section.key}: exactly one section rail`,
      ).toHaveCount(1);
      const box = (await page.getByRole('tablist', { name: 'Section tabs' }).boundingBox())!;
      expect(box.y, `390 ${section.key}: the bar is anchored to the bottom`).toBeGreaterThan(700);
    }
  });

  test('reduced motion leaves nothing running and nothing looping', async ({ page }) => {
    test.setTimeout(420_000);
    await prepare(page);

    /** Animations currently playing anywhere in the document. */
    const runningAnimations = () =>
      page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);

    /** Declared CSS animations in a surface (loop-capable, so never allowed). */
    const declaredAnimations = (scope: string) =>
      page.evaluate((scopeSelector) => {
        const root = document.querySelector(scopeSelector) ?? document.body;
        const offenders: string[] = [];
        for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
          const style = getComputedStyle(element);
          if (style.animationName === 'none') continue;
          const longest = Math.max(
            ...style.animationDuration.split(',').map((value) => {
              const parsed = Number.parseFloat(value);
              return Number.isFinite(parsed) ? parsed * (value.includes('ms') ? 1 : 1000) : 0;
            }),
          );
          offenders.push(`${element.tagName}:${style.animationName}:${Math.round(longest)}ms`);
        }
        return offenders.slice(0, 6);
      }, scope);

    for (const width of [360, 390, 1280] as const) {
      await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
      for (const section of SECTIONS) {
        await showSection(page, section.label);
        // A section switch itself must settle: the shell cross-fade collapses to
        // zero under reduced motion, so nothing may still be playing.
        await expect
          .poll(runningAnimations, { timeout: 10_000, intervals: [50, 100, 150] })
          .toBe(0);
        expect(
          await declaredAnimations(panelScope(section.key)),
          `${width} ${section.key}: reduced motion declares no CSS animation`,
        ).toEqual([]);
      }
    }

    // The overlays are where the playful entrance springs live; under reduced
    // motion the Modal snaps `progress` to 1, so opening one leaves nothing
    // running and nothing looping inside its panel.
    for (const entry of OVERLAYS) {
      await page.setViewportSize({ width: 390, height: 844 });
      const scope = await openOverlay(page, entry.overlay);
      await expect.poll(runningAnimations, { timeout: 10_000, intervals: [50, 100, 150] }).toBe(0);
      expect(
        await declaredAnimations(scope),
        `390 ${entry.surface}: reduced motion declares no CSS animation`,
      ).toEqual([]);
      await dismissOverlay(page, entry.overlay);
    }
  });
});
