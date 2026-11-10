import { type Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { planningHubTab, sectionTab, TAB_LABELS } from './helpers/navigation';
import { openCommandScreen } from './helpers/commandObservation';
import { queryRows } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';

/**
 * V2 keyboard-and-focus sweep.
 *
 * Three promises the restyle makes for a keyboard-only user, measured from the
 * live DOM at 390x844 in light and dark:
 *
 *  1. **Visible focus** — every control a Tab pass reaches paints a focus
 *     indicator (a non-`none`, >= 1px outline, or a real paint change against
 *     its unfocused baseline), and Tab never lands on a control the user
 *     cannot see (`aria-hidden`/`inert`/CSS-hidden ancestor, or a box parked
 *     outside the viewport).
 *  2. **Overlay contract** — Settings, the Command Center, quick capture, the
 *     Planning Hub and the Weekly Review trap focus while open, close on
 *     Escape, and return focus to the control that opened them.
 *  3. **Key parity** — Enter and Space do what a click does on the
 *     representative control of each shape: task completion (To Do), habit
 *     check-in (Habits), tab switch (section rail / segmented control) and a
 *     preset chip (Calories quick-kcal).
 *
 * What already existed (and is not duplicated here): `e2e/a11y.spec.ts` audits
 * contrast/names/ids, asserts `focusable-in-aria-hidden === []` by *querying*
 * the DOM, pins the Settings and Command Center focus *containment* and the
 * rail's roving tabindex/arrow keys; `e2e/habits-w7.spec.ts` pins the 2px token
 * ring on the habit row/detail controls. This spec is the *keyboard traversal*
 * instrument the others are not: it drives real Tab/Shift+Tab/Enter/Space
 * passes across the six sections and the five overlays, and it measures the
 * indicator from the focused element's own computed paint.
 *
 * Four measured product defects are quarantined per the repo's standing
 * protocol (`docs/testing/known-gaps.md` CG-13): `test.fixme` with the
 * measurement in the note above the case, and the body kept as the *release
 * assertion*, so un-fixme-ing a case is the fix's own proof. Every other case
 * here is an ordinary active test: a new missing ring, a new hidden tab stop,
 * a new focus leak, or a newly broken Enter/Space path still fails this lane.
 * No threshold is lowered and no control is excluded.
 */

const VIEWPORT = { width: 390, height: 844 } as const;

const SECTIONS = ['overview', 'todos', 'habits', 'pomodoro', 'workout', 'calories'] as const;
type SectionKey = (typeof SECTIONS)[number];

/**
 * Why this must be keyboard modality: `core/ui/useKeyboardFocusRing` paints the
 * token ring only under `:focus-visible` (§5.7 "a pointer click shows no ring"),
 * and Chromium reports `focus-visible = false` for a scripted focus while
 * pointer modality is active. One key that neither moves focus nor activates
 * anything flips the modality back to keyboard, so the next focus is
 * indistinguishable from a real Tab focus. (Same technique, own copy, as
 * `e2e/habits-w7.spec.ts`.)
 */
async function focusAsKeyboardUser(page: Page, target: Locator): Promise<void> {
  await page.keyboard.press('Shift');
  await target.focus();
  await expect
    .poll(() => target.evaluate((element) => element.matches(':focus-visible')))
    .toBe(true);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((mode) => localStorage.setItem('superhabits.theme.mode', mode), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe(theme);
  await expect(sectionTab(page, TAB_LABELS.overview)).toBeVisible({ timeout: 40_000 });
}

/**
 * Populated device (`TYPICAL`), reduced motion installed (the app's own
 * supported mode: entrance springs are skipped so a stop is never measured
 * mid-flight), settled on the shell's normal entry.
 */
async function prepare(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(VIEWPORT);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await seedFixture(page, 'TYPICAL');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(sectionTab(page, TAB_LABELS.overview)).toBeVisible({ timeout: 40_000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.dbReady))
    .toBe('true');
}

async function showSection(page: Page, section: SectionKey): Promise<void> {
  await sectionTab(page, TAB_LABELS[section]).click();
  await expect(sectionTab(page, TAB_LABELS[section])).toHaveAttribute('aria-selected', 'true');
}

/** One Tab stop, resolved from the focused element's live computed paint. */
type TabStop = {
  /** Identity used to detect the walk's wrap-around. */
  key: string;
  tag: string;
  role: string | null;
  name: string;
  outline: string;
  /** Non-`none` outline of >= 1px, or a real paint change vs the unfocused baseline. */
  indicator: boolean;
  /** Focused paint differs from the unfocused baseline (the token ring case). */
  changed: boolean;
  hiddenBy: string | null;
  offscreen: boolean;
  /** Offscreen but parked behind a clipping ancestor (a gesture-only control). */
  clippedAway: boolean;
  box: [number, number, number, number];
};

type StopRead = { kind: 'none' } | { kind: 'body' } | ({ kind: 'control' } & TabStop);

/**
 * Snapshot the *unfocused* paint of every tabbable control, so a stop can be
 * compared with its own resting state instead of a hard-coded expected ring.
 * Run with nothing focused: the baseline is then exactly what the user sees
 * before the key press.
 */
function capturePaintBaseline(): number {
  const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const paintOf = (element: Element): string => {
    const style = getComputedStyle(element);
    return [
      style.outlineStyle,
      style.outlineWidth,
      style.outlineColor,
      style.boxShadow,
      style.borderTopWidth,
      style.borderTopColor,
      style.borderBottomColor,
      style.backgroundColor,
    ].join('|');
  };
  const baseline = new Map<Element, string>();
  for (const element of Array.from(document.querySelectorAll(selector))) {
    baseline.set(element, paintOf(element));
  }
  (
    window as Window & { __v2KeyboardPaintBaseline?: Map<Element, string> }
  ).__v2KeyboardPaintBaseline = baseline;
  return baseline.size;
}

function readActiveStop(): StopRead {
  const element = document.activeElement as HTMLElement | null;
  if (!element) return { kind: 'none' };
  if (element === document.body || element === document.documentElement) return { kind: 'body' };

  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
  const paint = [
    style.outlineStyle,
    style.outlineWidth,
    style.outlineColor,
    style.boxShadow,
    style.borderTopWidth,
    style.borderTopColor,
    style.borderBottomColor,
    style.backgroundColor,
  ].join('|');
  const baseline = (
    window as Window & { __v2KeyboardPaintBaseline?: Map<Element, string> }
  ).__v2KeyboardPaintBaseline?.get(element);
  const changed = baseline !== undefined && baseline !== paint;

  // Anything a user cannot see makes a keyboard stop a trap: hidden through
  // an ancestor (`aria-hidden`, `inert`, CSS)…
  const chain: HTMLElement[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    chain.push(current);
    current = current.parentElement;
  }
  let hiddenBy: string | null = null;
  for (const node of chain) {
    if (hiddenBy === null) {
      if (node.getAttribute('aria-hidden') === 'true') hiddenBy = 'aria-hidden';
      else if (node.hasAttribute('inert')) hiddenBy = 'inert';
      else {
        const nodeStyle = getComputedStyle(node);
        if (nodeStyle.display === 'none') hiddenBy = 'display:none';
        else if (nodeStyle.visibility === 'hidden') hiddenBy = 'visibility:hidden';
        else if (Number(nodeStyle.opacity) < 0.05) hiddenBy = `opacity:${nodeStyle.opacity}`;
      }
    }
  }

  // …or parked outside the viewport. A gesture-only control (To Do's swipe
  // actions) sits at `left: -9790` inside a clipping ancestor: never visible,
  // so `clippedAway` is the diagnostic, not an exemption.
  const offscreen =
    box.left < -1 ||
    box.right > window.innerWidth + 1 ||
    box.top < -1 ||
    box.bottom > window.innerHeight + 1;
  let clip: DOMRect | null = null;
  for (const node of chain) {
    const nodeStyle = getComputedStyle(node);
    if (/hidden|clip/.test(nodeStyle.overflowX) || /hidden|clip/.test(nodeStyle.overflowY)) {
      clip = node.getBoundingClientRect();
      break;
    }
  }
  const clippedAway =
    offscreen &&
    clip !== null &&
    clip.left >= -1 &&
    clip.right <= window.innerWidth + 1 &&
    box.width > 0;

  const name = (
    element.getAttribute('aria-label') ??
    element.getAttribute('placeholder') ??
    (element.textContent ?? '').trim().replace(/\s+/g, ' ')
  ).slice(0, 64);

  return {
    kind: 'control',
    key: `${element.tagName}|${element.getAttribute('role') ?? ''}|${name}|${Math.round(
      box.left,
    )}|${Math.round(box.top)}`,
    tag: element.tagName,
    role: element.getAttribute('role'),
    name,
    outline: `${style.outlineStyle}/${style.outlineWidth}px`,
    indicator: (style.outlineStyle !== 'none' && outlineWidth >= 1) || changed,
    changed,
    hiddenBy,
    offscreen,
    clippedAway,
    box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
  };
}

/**
 * Walk one full Tab cycle from a neutral starting point and collect every stop.
 * A `body` hop is the browser handing focus back to the document between the
 * last and the first stop, not a stop of its own, so it is skipped and the walk
 * continues; the cycle ends when a stop repeats.
 */
async function walkTabStops(page: Page, maxPresses = 90): Promise<TabStop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  // Let React settle the previously focused control's blur before baselining.
  await page.waitForTimeout(150);
  await page.keyboard.press('Shift');
  await page.evaluate(capturePaintBaseline);

  const stops: TabStop[] = [];
  const seen = new Set<string>();
  for (let press = 0; press < maxPresses; press += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(readActiveStop);
    if (stop.kind === 'body') continue;
    if (stop.kind === 'none') break;
    if (seen.has(stop.key)) break;
    seen.add(stop.key);
    stops.push(stop);
  }
  return stops;
}

const describeStops = (stops: TabStop[]): string[] =>
  stops.map((stop) => `"${stop.name}" (${stop.outline}, ${stop.box.join(',')})`);

/** 1a — visible focus indicator on every reachable control, light and dark. */
test('every Tab stop on the six sections paints a visible focus indicator', async ({ page }) => {
  test.setTimeout(420_000);
  await prepare(page);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const section of SECTIONS) {
      await showSection(page, section);
      const stops = await walkTabStops(page);

      expect(stops.length, `${theme} ${section}: a Tab pass reaches real controls`).toBeGreaterThan(
        8,
      );
      expect(
        describeStops(stops.filter((stop) => !stop.indicator)),
        `${theme} ${section}: every Tab stop paints a visible focus indicator`,
      ).toEqual([]);
      // Non-vacuity: some stop paints a *changed* paint (the §5.7 2px token
      // ring), so the sweep is not silently satisfied by the UA outline alone.
      expect(
        stops.filter((stop) => stop.changed).length,
        `${theme} ${section}: at least one control paints the 2px token ring`,
      ).toBeGreaterThan(0);
    }
  }
});

/** 1b — Tab never lands on a control hidden behind aria-hidden/inert/CSS. */
test('Tab never lands on an aria-hidden or inert control on the six sections', async ({ page }) => {
  test.setTimeout(420_000);
  await prepare(page);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const section of SECTIONS) {
      await showSection(page, section);
      const stops = await walkTabStops(page);
      expect(
        stops
          .filter((stop) => stop.hiddenBy !== null)
          .map((stop) => `"${stop.name}" hidden by ${stop.hiddenBy}`),
        `${theme} ${section}: no Tab stop is inside a hidden subtree`,
      ).toEqual([]);
    }
  }
});

// Quarantined defect (CG-13 in `docs/testing/known-gaps.md`). Measured
// 2026-11-10 at 390x844 light and dark, `TYPICAL` fixture:
//
//   To Do     14 stops, every swipe action parked at left -9790/-9706
//             (`Edit item` / `Delete item`, `core/ui/SwipeRightActions.tsx`
//             rendered by `react-native-gesture-handler`'s `Swipeable`) — seven
//             sibling rows × 2 actions, all inside `overflow: hidden` rows.
//   Workout    2 stops, `Edit item` / `Delete item` at left -9792/-9708
//             (the saved routine row's own swipe actions).
//
// Both are clipped away (`clippedAway = true`), so a keyboard user tabs into a
// control that paints no visible ring anywhere on screen. The keyboard path to
// those actions is the row's `More actions for <task>` menu; the fix is to keep
// the swipe actions out of the tab order (`tabIndex={-1}` / `aria-hidden`)
// until the row is revealed. The body below is the release assertion (same
// walk, same thresholds, same fixture): un-fixme-ing it is the fix's own proof.
test.fixme('Tab never lands on an offscreen gesture-only control', async ({ page }) => {
  test.setTimeout(420_000);
  await prepare(page);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const section of SECTIONS) {
      await showSection(page, section);
      const stops = await walkTabStops(page);
      expect(
        stops
          .filter((stop) => stop.offscreen)
          .map(
            (stop) =>
              `"${stop.name}" at ${stop.box.join(',')}${stop.clippedAway ? ' (clipped away)' : ''}`,
          ),
        `${theme} ${section}: no Tab stop sits outside the viewport`,
      ).toEqual([]);
    }
  }
});

type OverlayName = 'settings' | 'command' | 'quick-capture' | 'hub' | 'weekly-review';

const OVERLAYS: Record<OverlayName, { dialog: string; opener: string }> = {
  settings: { dialog: 'Settings', opener: 'Open settings' },
  command: { dialog: 'Command center', opener: 'Quick capture' },
  'quick-capture': { dialog: 'Add', opener: 'Quick capture' },
  hub: { dialog: 'Plan', opener: 'Plan today' },
  // The only 390px path to the review is the hub's Progress view; see the
  // quarantined focus-return case below.
  'weekly-review': { dialog: 'Weekly Review', opener: 'Open weekly review' },
};

/** Open one overlay through shipped product UI only, and pin its named dialog. */
async function openOverlay(page: Page, name: OverlayName): Promise<void> {
  await showSection(page, 'overview');
  switch (name) {
    case 'settings':
      await page.getByRole('button', { name: 'Open settings' }).click();
      break;
    case 'command':
      await openCommandScreen(page);
      break;
    case 'quick-capture':
      await page.getByRole('button', { name: 'Quick capture', exact: true }).click();
      break;
    case 'hub':
      await page.getByRole('button', { name: 'Plan today' }).click();
      break;
    case 'weekly-review': {
      await page.getByRole('button', { name: 'Plan today' }).click();
      await expect(planningHubTab(page, 'Progress')).toBeVisible({ timeout: 20_000 });
      await planningHubTab(page, 'Progress').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' }).click();
      break;
    }
  }
  const dialog = page.getByRole('dialog', { name: OVERLAYS[name].dialog });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
}

/** Real keyboard traversal inside the open overlay; returns the visited stops. */
async function expectFocusTrapped(page: Page, dialogName: string): Promise<Set<string>> {
  const focusedInside = () =>
    page.evaluate((name) => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const target = dialogs.find((node) => node.getAttribute('aria-label') === name);
      return target ? target.contains(document.activeElement) : false;
    }, dialogName);
  const focusedIdentity = () =>
    page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return 'none';
      return [
        active.tagName,
        active.getAttribute('role'),
        active.getAttribute('aria-label'),
        (active.textContent ?? '').trim().slice(0, 40),
      ]
        .filter(Boolean)
        .join('|');
    });

  // Focus enters the overlay on open, so the first Tab has somewhere to start.
  await expect.poll(focusedInside, { timeout: 5_000 }).toBe(true);
  const stops = new Set<string>();
  const first = await focusedIdentity();
  if (first) stops.add(first);

  // Comfortably more presses than any of these sheets has controls: a missing
  // trap escapes within a few presses.
  for (let step = 1; step <= 40; step += 1) {
    await page.keyboard.press('Tab');
    expect(await focusedInside(), `Tab ${step} stays inside the ${dialogName} overlay`).toBe(true);
    stops.add(await focusedIdentity());
  }
  for (let step = 1; step <= 12; step += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusedInside(), `Shift+Tab ${step} stays inside the ${dialogName} overlay`).toBe(
      true,
    );
    stops.add(await focusedIdentity());
  }
  // Non-vacuity: a trap pinning one element would satisfy containment while
  // being unusable.
  expect(stops.size, `Tab visits several ${dialogName} controls`).toBeGreaterThan(2);
  return stops;
}

/** 2a — trap + Escape for all five overlays, light and dark. */
test('the five overlays trap focus while open and close on Escape', async ({ page }) => {
  test.setTimeout(420_000);
  await prepare(page);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const name of Object.keys(OVERLAYS) as OverlayName[]) {
      await openOverlay(page, name);
      await expectFocusTrapped(page, OVERLAYS[name].dialog);

      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog'),
        `${theme} ${name}: Escape closes the overlay`,
      ).toHaveCount(0);
    }
  }
});

/** 2b — dismissal returns focus to the control that opened the overlay. */
test('Settings, Command Center, quick capture and the Planning Hub return focus to their opener', async ({
  page,
}) => {
  test.setTimeout(420_000);
  await prepare(page);

  // The Weekly Review is covered by its own case below: at 390px it opens from
  // the hub, which the review dismisses (see the CG-13 entry).
  const returning: OverlayName[] = ['settings', 'command', 'quick-capture', 'hub'];
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const name of returning) {
      const opener = page.getByRole('button', { name: OVERLAYS[name].opener }).first();
      await expect(opener).toBeVisible({ timeout: 20_000 });
      await openOverlay(page, name);
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog'),
        `${theme} ${name}: Escape closes the overlay`,
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: OVERLAYS[name].opener }).first(),
        `${theme} ${name}: dismissal returns focus to "${OVERLAYS[name].opener}"`,
      ).toBeFocused({ timeout: 10_000 });
    }
  }
});

// Quarantined defect (CG-13 in `docs/testing/known-gaps.md`). Measured
// 2026-11-10 at 390x844 light and dark: the hub's Progress view is the only
// shipped path to the Weekly Review at phone width. `openWeeklyReview`
// (`core/providers/NavigationProvider.tsx`) deliberately dismisses the hub
// before opening the review, so the invoking `Open weekly review` control is
// unmounted by the time the review closes. After Escape the review's own
// React-Native-Web focus restore cannot find its opener and focus lands on
// `document.body`: `document.activeElement === BODY`, no visible ring anywhere.
// (The wide-layout path — Overview's own `Open weekly review` card, only
// rendered at >= 1280 — does return focus correctly, which scopes the defect
// to the hub-opened variant.) The body below is the release assertion: focus
// must land somewhere a keyboard user can continue from, i.e. the `Plan today`
// control that opened the chain.
test.fixme('the Weekly Review returns focus to a control when it is dismissed', async ({
  page,
}) => {
  test.setTimeout(420_000);
  await prepare(page);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await openOverlay(page, 'weekly-review');
    await expectFocusTrapped(page, OVERLAYS['weekly-review'].dialog);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Plan today' }),
      `${theme}: dismissal returns focus to the control that opened the chain`,
    ).toBeFocused({ timeout: 10_000 });
  }
});

/** 3a — the two shapes that already honour both keys. */
test('a habit check-in and a quick-kcal preset chip activate on Enter and Space', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await prepare(page);

  // Habits: the quantitative check-in is a `checkbox` with the Space binding
  // `features/habits/useHabitCheckboxKeyboard.ts` supplies (RN-Web maps Space
  // only to button-shaped roles).
  await showSection(page, 'habits');
  const habit = page.getByRole('checkbox', { name: /^Habit 4 — ☕/ }).first();
  await expect(habit).toBeVisible({ timeout: 20_000 });
  await expect(habit).toHaveAttribute('aria-checked', 'false');
  await focusAsKeyboardUser(page, habit);
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('checkbox', { name: /^Habit 4 — ☕/ }).first(),
    'Space checks the habit in like a click',
  ).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('checkbox', { name: /^Habit 4 — ☕/ }).first(),
    'Enter toggles it back like a click',
  ).toHaveAttribute('aria-checked', 'false');

  // Calories: the quick-kcal preset chips are `button`-shaped `Pressable3D`s,
  // so both keys go through RN-Web's own press path. Space goes first: RN-Web's
  // key path resolves `onPress` on keyup, and a save's re-render must have
  // settled before the next key (the second press is otherwise swallowed by the
  // in-flight refresh), so each key asserts its own rendered row before the
  // next one runs.
  await showSection(page, 'calories');
  const quickAddRows = page.getByRole('button', { name: 'Delete Quick add' });
  await expect(quickAddRows, 'the seeded day starts with no quick-add rows').toHaveCount(0);

  await focusAsKeyboardUser(
    page,
    page.getByRole('button', { name: 'Quick add 200 kilocalories', exact: true }),
  );
  await page.keyboard.press('Space');
  await expect(quickAddRows, 'Space logs the 200 kcal entry like a click').toHaveCount(1, {
    timeout: 15_000,
  });

  await focusAsKeyboardUser(
    page,
    page.getByRole('button', { name: 'Quick add 300 kilocalories', exact: true }),
  );
  await page.keyboard.press('Enter');
  await expect(quickAddRows, 'Enter logs the 300 kcal entry like a click').toHaveCount(2, {
    timeout: 15_000,
  });

  const rows = await queryRows(
    page,
    `SELECT calories FROM calorie_entries WHERE deleted_at IS NULL AND food_name = 'Quick add' ORDER BY calories ASC`,
  );
  expect(rows, 'Space and Enter each persisted the entry a click would write').toEqual([
    { calories: 200 },
    { calories: 300 },
  ]);
});

/** 3b — tab-shaped controls already activate on Enter. */
test('a section-rail tab and a segmented tab activate on Enter', async ({ page }) => {
  test.setTimeout(300_000);
  await prepare(page);

  const habitsTab = sectionTab(page, TAB_LABELS.habits);
  await focusAsKeyboardUser(page, habitsTab);
  await page.keyboard.press('Enter');
  await expect(habitsTab, 'Enter activates the rail tab like a click').toHaveAttribute(
    'aria-selected',
    'true',
  );

  await showSection(page, 'calories');
  const diaryTab = page.getByRole('tab', { name: 'Diary view', exact: true });
  await expect(diaryTab).toBeVisible({ timeout: 20_000 });
  await focusAsKeyboardUser(page, diaryTab);
  await page.keyboard.press('Enter');
  await expect(diaryTab, 'Enter activates the segmented tab like a click').toHaveAttribute(
    'aria-selected',
    'true',
  );
});

// Quarantined defect (CG-13 in `docs/testing/known-gaps.md`). Measured
// 2026-11-10 at 390x844 light and dark: Space does nothing on every
// `role="tab"`/`role="radio"` Pressable. RN-Web's `PressResponder`
// (`isValidKeyPress`) accepts Enter for any role but Space only for
// button-shaped roles (`button` tag or `role="button"`/`role="menuitem"`), and
// none of these components binds Space itself — unlike
// `features/habits/useHabitCheckboxKeyboard.ts` and `core/ui/Switch.tsx`, which
// exist precisely to close this gap.
//
//   Section rail  `Habits` tab      Space → `aria-selected` stays `false`
//   Segmented     `Diary view`      Space → `aria-selected` stays `false`
//   Picker row    `Presets` radio   Space → the sheet stays open (dialogs=1)
//
// Owning lane: `app/index.tsx` (TabButton), `core/ui/SegmentedControl.tsx`
// (SegmentOptionButton) and `core/ui/OptionRow.tsx` — the fix is the same
// "bind Space for non-button roles" contract those two files already implement.
// The body below is the release assertion; un-fixme-ing it is the fix's own
// proof.
test.fixme('Space activates tab-shaped and picker controls like a click', async ({ page }) => {
  test.setTimeout(300_000);
  await prepare(page);

  const habitsTab = sectionTab(page, TAB_LABELS.habits);
  await focusAsKeyboardUser(page, habitsTab);
  await page.keyboard.press('Space');
  await expect(habitsTab, 'Space activates the rail tab like a click').toHaveAttribute(
    'aria-selected',
    'true',
  );

  await showSection(page, 'pomodoro');
  const shortBreak = page.getByRole('tab', { name: 'Short Break', exact: true });
  await focusAsKeyboardUser(page, shortBreak);
  await page.keyboard.press('Space');
  await expect(shortBreak, 'Space activates the segmented tab like a click').toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('button', { name: 'Choose preset' }).click();
  const presets = page.getByRole('dialog', { name: 'Presets' });
  await expect(presets).toBeVisible({ timeout: 20_000 });
  const presetRow = presets.getByRole('radio').nth(1);
  await focusAsKeyboardUser(page, presetRow);
  await page.keyboard.press('Space');
  await expect(presets, 'Space selects the preset row and closes the sheet').toHaveCount(0);
});

// Quarantined defect (CG-13 in `docs/testing/known-gaps.md`). Measured
// 2026-11-10 at 390x844 light and dark: the To Do row's completion checkbox is
// nested inside the row's own `Pressable` (`features/todos/TodoItem.tsx`:
// `accessibilityLabel="Edit task: …"`, `accessibilityRole="button"`), and RN-Web
// resolves key presses through the row instead of the nested `checkbox`:
//
//   Enter on `Mark complete: Task 4` → `<dialog aria-label="Edit task">` opens
//                                      and `todos.completed` stays `0`
//   Space on `Mark complete: Task 5` → the same `Edit task` dialog opens,
//                                      `todos.completed` stays `0`
//
// A pointer click on the same control completes the task, so this is a
// keyboard-only loss of the primary To Do action (and an unexpected modal).
// The keyboard path for the *row* is Enter on the row; the checkbox itself must
// own Enter/Space. The body below is the release assertion.
test.fixme('Enter and Space complete a To Do task from its completion checkbox', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await prepare(page);
  await showSection(page, 'todos');

  for (const key of ['Enter', 'Space'] as const) {
    const checkbox = page.getByRole('checkbox', { name: /^Mark complete: Task 4$/ });
    await expect(checkbox).toBeVisible({ timeout: 20_000 });
    await focusAsKeyboardUser(page, checkbox);
    await page.keyboard.press(key);
    await expect(
      page.getByRole('dialog'),
      `${key} on the completion checkbox never opens another surface`,
    ).toHaveCount(0);
    const rows = await queryRows(
      page,
      `SELECT completed FROM todos WHERE deleted_at IS NULL AND title = 'Task 4'`,
    );
    expect(rows, `${key} completes the task like a click`).toEqual([{ completed: 1 }]);
  }
});
