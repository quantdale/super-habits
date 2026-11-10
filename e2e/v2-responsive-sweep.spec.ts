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
 *     measured instead. That exemption is scoped to parked controls only: a
 *     horizontal SCRUBBER is additionally held to its own clipping ancestor's
 *     bounds, so an oversized scroller inside a clipping panel (a Modal's
 *     `overflow: hidden` body) is still reported even though the panel itself
 *     fits.
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
 *     248px labelled sidebar at >= 1280), the content column honours its cap
 *     (`layout.contentMaxWidth` 640, with the documented Today dashboard
 *     exception `layout.dashboardMaxWidth` 1040,
 *     `docs/ui-ux/16-playful-momentum.md` §5.6) and is horizontally centred in
 *     the remaining content area; <= 899 keeps the floating bottom bar and no
 *     sidebar. The column is located STRUCTURALLY (the centred content wrapper
 *     — `alignSelf: center` or auto side margins), never by looking for a
 *     `max-width` declaration, and the cap it is measured against is
 *     `layout.contentMaxWidth` / `layout.dashboardMaxWidth` from the tokens
 *     themselves. Deleting the `maxWidth` from `core/ui/Screen.tsx` therefore
 *     widens the measured column past the contract and fails, instead of
 *     emptying the candidate list and passing vacuously.
 *  4. **Reduced motion** — with `prefers-reduced-motion: reduce` emulated, no
 *     animation is left *running* and no CSS animation is declared on the
 *     content (§5.8 allows one 120ms opacity cross-fade and forbids
 *     ambient/looping motion).
 *
 * Determinism: nothing is gated on `waitForTimeout`. Layout is awaited by
 * polling a rounded geometry signature until it repeats (so a drawer's entrance
 * spring is never measured mid-slide), and every interaction asserts its
 * resulting state (`aria-selected`, dialog visibility). A MISSING measurement
 * scope is a hard failure everywhere — `waitForSettledGeometry` refuses a
 * `missing` signature and `measure` throws instead of falling back to
 * `document.body` — so an overlay that never opened, or a Health deep link that
 * landed on the loading shell, can never be read as a clean pass. Data comes
 * from the shared `TYPICAL` fixture, so the same populated state is measured in
 * light and dark.
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

      const root = document.querySelector(scope);
      // A missing scope must never silently degrade to `document.body`: measuring
      // the whole page reports a clean surface for a surface that is not there,
      // which is exactly the false-green a Health deep link still on the loading
      // shell (or an overlay that failed to open) produces.
      if (!root) throw new Error(`v2-responsive-sweep: measurement scope not found: ${scope}`);
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

      // A horizontal scroller may scroll its own content, but its own BOX must
      // fit the viewport AND its clipping ancestor's box. The second check is
      // deliberately NOT covered by the parked-control exemption above: a Modal
      // panel clips with `overflow: hidden`, so a scroller wider than the panel
      // is invisible-by-clipping — a genuinely clipped surface — even though the
      // panel itself fits the viewport. Content wider than the scroller's own
      // frame stays legitimate (that is what a scroller is for).
      const unfittedScrollers: string[] = [];
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (!isRendered(element)) continue;
        const style = getComputedStyle(element);
        if (!/auto|scroll/.test(style.overflowX)) continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0) continue;
        const bounds = `${element.tagName}:${Math.round(box.left)}-${Math.round(box.right)}`;
        if (outsideViewport(box)) {
          unfittedScrollers.push(bounds);
          continue;
        }
        const clip = clippingBox(element);
        if (clip && (box.left < clip.left - 1 || box.right > clip.right + 1)) {
          unfittedScrollers.push(
            `${bounds} clipped-by:${Math.round(clip.left)}-${Math.round(clip.right)}`,
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
 *
 * A `missing` scope is rejected twice over: the poll's predicate treats it as
 * NOT settled (so two consecutive `missing` samples can never satisfy the wait)
 * and the poll message names the selector, so an overlay that failed to open or
 * a section that has not mounted fails with the scope named instead of
 * silently measuring `document.body` later.
 */
async function waitForSettledGeometry(
  page: Page,
  scopeSelector: string,
  { requireActive = false }: { requireActive?: boolean } = {},
): Promise<void> {
  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const signature = await page.evaluate(
          ({ scope, active }) => {
            const root = document.querySelector(scope);
            // 'absent' is a distinct, never-settled state: an unwritten
            // selector must not look like a stable geometry.
            if (!root) return 'absent';
            if (active && root.getAttribute('aria-hidden') === 'true') return 'inactive';
            const box = root.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) return `collapsed:${scope}`;
            return [box.x, box.y, box.width, box.height]
              .map((value) => Math.round(value))
              .join(':');
          },
          { scope: scopeSelector, active: requireActive },
        );
        if (signature === 'absent') {
          previous = null;
          return false;
        }
        if (signature === 'inactive' || signature.startsWith('collapsed:')) {
          previous = null;
          return false;
        }
        const stable = signature === previous;
        previous = signature;
        return stable;
      },
      {
        timeout: 20_000,
        intervals: [80, 120, 160],
        message: `"${scopeSelector}" must exist, be active, be laid out, and hold still`,
      },
    )
    .toBe(true);
}

const panelScope = (section: string) => `#sh-section-panel-${section}`;

/**
 * Frame-by-frame motion of one element, sampled through `requestAnimationFrame`.
 *
 * Why this exists next to `document.getAnimations()`: on the web build React
 * Native's `Animated` timings/springs are driven by react-native-web's own
 * requestAnimationFrame loop, which writes inline `style` values directly. They
 * are therefore invisible BOTH to `document.getAnimations()` (no Web Animation
 * object is ever created) and to the CSS `animationName` scan (no @keyframes is
 * declared). Only sampling the computed style catches them.
 *
 * A section switch runs a 200ms opacity timing and a 240ms translate timing in
 * `SectionContainer` (app/index.tsx), so the sampler has to be armed BEFORE the
 * click that starts the transition; it then records every frame for `windowMs`.
 */
type MotionSample = { t: number; opacity: number; transform: string };

async function sampleMotion(
  page: Page,
  elementId: string,
  action: () => Promise<void>,
  windowMs = 700,
): Promise<MotionSample[]> {
  await page.evaluate((id) => {
    const host = window as unknown as {
      __v2MotionProbe?: { stop: () => void; read: () => MotionSample[] };
    };
    const node = document.getElementById(id);
    if (!node) throw new Error(`v2-responsive-sweep: motion probe target not found: #${id}`);
    const samples: MotionSample[] = [];
    const started = performance.now();
    let running = true;
    const tick = () => {
      if (!running) return;
      const style = getComputedStyle(node);
      samples.push({
        t: Math.round(performance.now() - started),
        opacity: Number.parseFloat(style.opacity),
        transform: style.transform,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    host.__v2MotionProbe = {
      stop: () => {
        running = false;
      },
      read: () => samples,
    };
  }, elementId);

  await action();
  await page.waitForTimeout(windowMs);
  const samples = await page.evaluate(() => {
    const host = window as unknown as {
      __v2MotionProbe?: { stop: () => void; read: () => MotionSample[] };
    };
    host.__v2MotionProbe?.stop();
    return host.__v2MotionProbe?.read() ?? [];
  });
  await page.evaluate(() => {
    delete (window as unknown as { __v2MotionProbe?: unknown }).__v2MotionProbe;
  });
  return samples;
}

/** Summarise a sample series into the facts the reduced-motion contract needs. */
function summariseMotion(samples: MotionSample[]) {
  const opacities = Array.from(new Set(samples.map((sample) => sample.opacity.toFixed(3))));
  const transforms = Array.from(new Set(samples.map((sample) => sample.transform)));
  // Last frame at which opacity still differed from the previous frame.
  let opacitySettledAtMs = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].opacity.toFixed(3) !== samples[index - 1].opacity.toFixed(3)) {
      opacitySettledAtMs = samples[index].t;
    }
  }
  // Translation: any matrix with a non-zero x/y component. `none` and identity
  // matrices are "no translation".
  const translated = transforms.filter((transform) => {
    if (transform === 'none') return false;
    const matched = /matrix\(([^)]+)\)/.exec(transform);
    if (!matched) return true; // an unexpected transform function is motion
    const parts = matched[1].split(',').map((part) => Number.parseFloat(part.trim()));
    const [x = 0, y = 0] = [parts[4] ?? 0, parts[5] ?? 0];
    return Math.abs(x) > 0.01 || Math.abs(y) > 0.01;
  });
  return { opacities, transforms, translated, opacitySettledAtMs };
}

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
/**
 * Scopes are named, not generic: `[role="dialog"]` alone can match whichever
 * modal happens to be mounted (the quick-capture sheet lingers a few hundred ms
 * after closing), so each overlay returns the selector of ITS OWN dialog, which
 * `waitForSettledGeometry` then requires to exist and hold still.
 */
const DIALOG_SCOPE = {
  settings: '[role="dialog"][aria-label="Settings"]',
  command: '[role="dialog"][aria-label="Command center"]',
  hub: '[role="dialog"][aria-label="Plan"]',
  'weekly-review': '[role="dialog"][aria-label="Weekly Review"]',
} as const;

async function openOverlay(page: Page, overlay: Overlay): Promise<string> {
  switch (overlay) {
    case 'settings': {
      await showSection(page, TAB_LABELS.overview);
      await openSettingsScreen(page);
      await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
      await waitForSettledGeometry(page, DIALOG_SCOPE.settings);
      return DIALOG_SCOPE.settings;
    }
    case 'command': {
      await showSection(page, TAB_LABELS.overview);
      await openCommandScreen(page);
      await expect(page.getByText('Command center', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await waitForSettledGeometry(page, DIALOG_SCOPE.command);
      return DIALOG_SCOPE.command;
    }
    case 'hub': {
      await showSection(page, TAB_LABELS.overview);
      await page.getByRole('button', { name: 'Plan today' }).click();
      await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
      await waitForSettledGeometry(page, DIALOG_SCOPE.hub);
      return DIALOG_SCOPE.hub;
    }
    case 'weekly-review': {
      await showSection(page, TAB_LABELS.overview);
      await page.getByRole('button', { name: 'Plan today' }).click();
      await expect(planningHubTab(page, 'Progress')).toBeVisible({ timeout: 20_000 });
      await planningHubTab(page, 'Progress').click();
      await page
        .getByRole('dialog', { name: 'Plan' })
        .getByRole('button', { name: 'Open weekly review' })
        .click();
      await expect(
        page.getByRole('dialog', { name: 'Weekly Review' }).getByText(/^Step 1 of 5/),
      ).toBeVisible({ timeout: 20_000 });
      await waitForSettledGeometry(page, DIALOG_SCOPE['weekly-review']);
      return DIALOG_SCOPE['weekly-review'];
    }
    case 'health': {
      await page.goto('/#health', { waitUntil: 'domcontentloaded' });
      // The Health section has no rail destination (six-tab model), so its
      // panel is the only oracle: it must EXIST and be active. A missing panel
      // once satisfied a `undefined !== 'true'` poll, let the settle check
      // accept two `missing` samples, and let `measure` fall back to
      // `document.body` — a clean report for the loading shell. Both the poll
      // and the settle helper now require existence plus an active panel.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const panel = document.querySelector('#sh-section-panel-health');
              if (!panel) return 'absent';
              if (panel.getAttribute('aria-hidden') === 'true') return 'inactive';
              const box = panel.getBoundingClientRect();
              if (box.width === 0 || box.height === 0) return 'collapsed';
              return 'active';
            }),
          {
            timeout: 30_000,
            intervals: [150, 250, 400],
            message: 'the Health section panel must exist and be active',
          },
        )
        .toBe('active');
      await waitForSettledGeometry(page, panelScope('health'), { requireActive: true });
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

type PayloadColumn = {
  /** Interactive controls measured (non-vacuity: a section must have some). */
  controls: number;
  /** Text leaves measured (non-vacuity: a section must have some). */
  textLeaves: number;
  /** Widest horizontal span the section's own content occupies, in CSS px. */
  width: number;
  /** Horizontal centre of that span, in CSS px. */
  centre: number;
};

/**
 * Measure the width the surface's own CONTENT occupies, without looking for a
 * `max-width` declaration.
 *
 * Why: the previous version collected only elements that DECLARED a
 * `maxWidth`, so deleting the cap (or a component that stopped setting it) left
 * the candidate list empty and the cap assertion reduced over nothing — a green
 * run for an uncapped page. This measures the payload instead: every
 * interactive control plus every text leaf, minus what is legitimately outside
 * the flow (fixed overlays, controls parked behind a clipping container such
 * as To Do's swipe actions, and children of horizontal scrollers, whose content
 * is *meant* to overflow its frame). What remains is the box the user reads, so
 * a removed cap widens it past the contract and fails.
 */
async function measurePayloadColumn(page: Page, scopeSelector: string): Promise<PayloadColumn> {
  return page.evaluate(
    ({ interactiveSelector, scopeSelector: scope }) => {
      const root = document.querySelector(scope);
      if (!root) throw new Error(`v2-responsive-sweep: payload scope not found: ${scope}`);

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

      /** A horizontal scroller ancestor means the node is scroll content. */
      const insideHorizontalScroller = (node: HTMLElement): boolean => {
        let current = node.parentElement;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (/auto|scroll/.test(style.overflowX)) return true;
          current = current.parentElement;
        }
        return false;
      };

      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let controls = 0;
      let textLeaves = 0;

      const include = (node: HTMLElement): void => {
        if (!isRendered(node)) return;
        if (insideHorizontalScroller(node)) return;
        if (getComputedStyle(node).position === 'fixed') return;
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        const clip = clippingBox(node);
        const parked =
          (box.left < -1 || box.right > window.innerWidth + 1) &&
          clip !== null &&
          clip.left >= -1 &&
          clip.right <= window.innerWidth + 1;
        if (parked) return;
        left = Math.min(left, box.left);
        right = Math.max(right, box.right);
      };

      for (const candidate of Array.from(root.querySelectorAll(interactiveSelector))) {
        controls += 1;
        include(candidate as HTMLElement);
      }
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (element.children.length > 0) continue;
        if (!(element.textContent ?? '').trim()) continue;
        textLeaves += 1;
        include(element);
      }

      return {
        controls,
        textLeaves,
        width: Number.isFinite(left) ? Math.round((right - left) * 10) / 10 : 0,
        centre: Number.isFinite(left) ? Math.round((left + right) * 5) / 10 : 0,
      };
    },
    { interactiveSelector: INTERACTIVE_SELECTOR, scopeSelector },
  );
}

/** The nav shell's own geometry (rail or bottom bar) plus the content field. */
type ShellGeometry = {
  rail: { width: number; top: number; height: number } | null;
  /** Viewport width minus a vertical side rail: the space content may use. */
  fieldWidth: number;
  /** Horizontal centre of that space. */
  fieldCentre: number;
};

/** Measure the shell (rail / bottom bar) without touching the content. */
async function measureShell(page: Page): Promise<ShellGeometry> {
  return page.evaluate(() => {
    const rail = document.querySelector('[aria-label="Section tabs"]');
    const railBox = rail ? rail.getBoundingClientRect() : null;
    const railWidth = railBox ? Math.round(railBox.width * 10) / 10 : 0;
    const isSideRail = Boolean(railBox && Math.round(railBox.y * 10) / 10 === 0);
    const fieldWidth = window.innerWidth - (isSideRail ? railWidth : 0);
    return {
      rail: railBox
        ? {
            width: railWidth,
            top: Math.round(railBox.y * 10) / 10,
            height: Math.round(railBox.height * 10) / 10,
          }
        : null,
      fieldWidth,
      fieldCentre: Math.round((window.innerWidth - fieldWidth / 2) * 10) / 10,
    };
  });
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
    await waitForSettledGeometry(page, DIALOG_SCOPE.hub);
    await audit(`hub-${view.toLowerCase()}`, DIALOG_SCOPE.hub);
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
      await waitForSettledGeometry(page, DIALOG_SCOPE.hub);
      expectNoOverflow(await measure(page, DIALOG_SCOPE.hub), `hub ${view}`);
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

  // CG-12 slice 2, Command Center: the same predicate, thresholds and helpers
  // as the gated case above, auditing ONLY the command overlay scope. The
  // overlay is opened through the shipped Add -> Describe it path, the example
  // chips are `features/command/CommandInputCard.tsx`'s feature-local
  // `ChipButton` (a plain `Pressable`, so its own DOM box is the hit area), and
  // the history chips reuse the same control: one history entry is seeded so
  // both accessible names ("Use example:" and "Reuse recent command:") are
  // measured. Zero sub-44 entries at 360/375/390 in light and dark.
  test('the Command Center overlay reaches a 44px CSS hit area at phone widths', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await prepare(page);
    // AsyncStorage is localStorage on the web build, so seeding one recent
    // command exercises the shared `ChipButton` under both of its accessible
    // names instead of only the empty-history example chips.
    await page.evaluate(() =>
      window.localStorage.setItem(
        'superhabits.command.history',
        JSON.stringify([{ rawText: 'complete Buy groceries', at: '2026-10-13T11:30:00.000Z' }]),
      ),
    );

    const undersized: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        const scope = await openOverlay(page, 'command');
        const result = await measure(page, scope);
        // Non-vacuity: the sub-44 controls the sweep reported here are the
        // chips, so both chip rows must really be rendered and measured — a
        // scope that landed on the shell would report zero offenders for
        // nothing.
        await expect(
          page.getByRole('button', { name: /^Use example: / }),
          `${theme} ${width}: the example chips are rendered and measured`,
        ).not.toHaveCount(0);
        await expect(
          page.getByRole('button', { name: /^Reuse recent command: / }),
          `${theme} ${width}: the history chips are rendered and measured`,
        ).not.toHaveCount(0);
        for (const target of result.undersizedTargets) {
          undersized.push(
            `${theme} ${width} › "${target.name}" measured ${target.width}x${target.height} px`,
          );
        }
        await dismissOverlay(page, 'command');
      }
    }

    expect(undersized, 'every Command Center control reaches a 44x44 CSS px hit area').toEqual([]);
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

        const shell = await measureShell(page);
        // The section's own CONTENT box, located structurally: every interactive
        // control and every text leaf the user can actually reach. It is
        // measured WITHOUT looking for a `maxWidth` declaration, so a removed
        // cap widens it past the contract instead of emptying a candidate list.
        const payload = await measurePayloadColumn(page, panelScope(section.key));
        // Non-vacuity: a real section always renders controls and text. A zero
        // here means the measurement scope is wrong (wrong panel, unmounted
        // section, or a hidden subtree), not a passing section.
        expect(
          payload.controls,
          `${width} ${section.key}: the section renders interactive controls to measure`,
        ).toBeGreaterThan(1);
        expect(
          payload.textLeaves,
          `${width} ${section.key}: the section renders text to measure`,
        ).toBeGreaterThan(1);
        // The content area is the viewport minus a *vertical* side rail; the
        // phone bar is a horizontal overlay on top of the content, so it does
        // not narrow the column.
        expect(
          shell.fieldWidth,
          `${width} ${section.key}: the content area is the viewport minus the side rail`,
        ).toBe(width - (shell.rail && shell.rail.top === 0 ? shell.rail.width : 0));

        // The whole promise: the content the user reads stays inside the
        // documented cap (640 phone-like column, 1040 for the composed Today
        // dashboard — docs/ui-ux/16-playful-momentum.md §5.6) and is centred in
        // the content area. Both numbers come from the design tokens, never from
        // what the DOM happens to declare, so dropping the cap fails here.
        const cap = section.key === 'overview' ? layout.dashboardMaxWidth : layout.contentMaxWidth;
        expect(
          payload.width,
          `${width} ${section.key}: content is no wider than ${cap}px`,
        ).toBeLessThanOrEqual(cap + 1);
        expect(
          Math.abs(payload.centre - shell.fieldCentre),
          `${width} ${section.key}: content is centred in the ${shell.fieldWidth}px content area`,
        ).toBeLessThanOrEqual(1.5);

        // Nav shell swap: >= 900 is the side rail (80px, widening to the 248px
        // labelled sidebar at >= 1280); below 900 the bottom bar owns the
        // bottom edge and there is no sidebar.
        if (width >= 900) {
          expect(shell.rail, `${width} ${section.key}: the side rail renders`).not.toBeNull();
          expect(shell.rail!.width, `${width} ${section.key}: side rail width`).toBe(
            width >= 1280 ? 248 : 80,
          );
          expect(shell.rail!.top, `${width} ${section.key}: the rail starts at the top edge`).toBe(
            0,
          );
          expect(
            shell.rail!.height,
            `${width} ${section.key}: the rail is full height`,
          ).toBeGreaterThan(600);
        } else {
          expect(shell.rail, `${width} ${section.key}: the bottom bar renders`).not.toBeNull();
          expect(
            shell.rail!.top,
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
        const root = document.querySelector(scopeSelector);
        // Same rule as `measure`: a missing scope is a hard failure, never a
        // silent fall-back to `document.body` (which would report a clean,
        // animation-free page for a surface that is not rendered).
        if (!root) throw new Error(`v2-responsive-sweep: motion scope not found: ${scopeSelector}`);
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

  // Quarantined defect (CG-14 in `docs/testing/known-gaps.md`), quarantined per
  // the standing protocol rather than excluded: the body below IS the release
  // assertion (same sampler, same thresholds, same surface set), so un-fixme-ing
  // this case is the fix's own proof.
  //
  // The case above proves no CSS/Web-Animation motion runs under reduced motion.
  // That is NOT the whole contract: React Native's `Animated` timings on web are
  // driven by react-native-web's requestAnimationFrame loop writing inline
  // styles, so they produce neither a Web Animation object nor an @keyframes
  // rule. `SectionContainer` (app/index.tsx) runs a 200ms opacity timing and a
  // 240ms translate timing unconditionally, which §5.8 forbids ("no translate,
  // scale or confetti; opacity cross-fade of 120ms only"). Measured 2026-11-10
  // at 390px: opacity ramps 0.000 -> 1.000 over 12-16 frames and is still
  // changing at 300-326ms, while translateY travels 12px -> 0 across 15-18
  // distinct transform values — with `document.getAnimations()` reporting 0.
  test.fixme('reduced motion forbids JS-driven translation and long opacity ramps (known SectionContainer gap)', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    await prepare(page);

    // The sampler must be armed BEFORE the click that starts the transition,
    // so the shortlisted cases below each watch the INCOMING panel.
    const cases = ['todos', 'habits', 'pomodoro', 'calories'] as const;
    for (const width of [390, 1280] as const) {
      await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
      for (const key of cases) {
        // Settle on Today first, so the switch below is a real transition.
        await showSection(page, TAB_LABELS.overview);
        await waitForSettledGeometry(page, panelScope('overview'));

        const samples = await sampleMotion(page, `sh-section-panel-${key}`, async () => {
          await sectionTab(page, TAB_LABELS[key]).click();
        });
        await expect(sectionTab(page, TAB_LABELS[key])).toHaveAttribute('aria-selected', 'true');

        // Non-vacuity: the sampler really observed the transition.
        expect(
          samples.length,
          `${width} ${key}: the frame sampler captured the transition`,
        ).toBeGreaterThan(4);

        const motion = summariseMotion(samples);
        const evidence = `${width} ${key}: opacity ${motion.opacities.join(
          ' -> ',
        )} over ${motion.opacitySettledAtMs}ms; transforms ${JSON.stringify(
          motion.transforms.slice(0, 6),
        )}`;

        // §5.8: "no translate, scale or confetti".
        expect(motion.translated, `reduced motion must not translate — ${evidence}`).toEqual([]);

        // §5.8: "Opacity cross-fade of 120ms only". One frame of slack
        // absorbs the sampling granularity (a 16ms frame quantum).
        expect(
          motion.opacitySettledAtMs,
          `reduced-motion opacity may not ramp beyond 120ms — ${evidence}`,
        ).toBeLessThanOrEqual(120 + 16);
      }
    }
  });
});
