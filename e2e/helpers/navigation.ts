import { Page } from '@playwright/test';

/**
 * Rail labels (V3 six-destination model after the W10 D3 validation gate —
 * measured evidence in `docs/ui-ux/v3-audit/w10/`). Every section owns a
 * destination, so `goToTab` clicks the rail directly. `health` remains a
 * valid AppSection for deep links, linked actions, and command routing, but
 * it has no bar destination.
 */
export const TAB_LABELS = {
  overview: 'Today',
  todos: 'To Do',
  habits: 'Habits',
  pomodoro: 'Focus',
  workout: 'Workout',
  calories: 'Calories',
  health: 'Health',
} as const;

/**
 * The app's primary section rail (bottom bar on narrow viewports, side rail on
 * wide ones). Every rail destination is an ARIA `tab` of this `tablist`.
 *
 * Always resolve rail destinations through this helper rather than an
 * unscoped `getByRole('tab', { name })`: the Planning Hub, the Habit detail
 * modal, the Pomodoro presets and the Calories day navigator all render their
 * own tablists, and several reuse a section label (`Today`, `Timeline`,
 * `Settings`). An unscoped lookup then strict-matches two tabs and fails.
 */
export function sectionRail(page: Page) {
  return page.getByRole('tablist', { name: 'Section tabs' });
}

/** One rail destination inside the primary section rail. */
export function sectionTab(page: Page, label: string) {
  return sectionRail(page).getByRole('tab', { name: label, exact: true });
}

/**
 * The Planning Hub's own view switcher (Today / Projects / Goals / Progress /
 * Timeline). Hub views are `tab`s of the "Planning hub views" `tablist`, and
 * `Today` also names a rail destination — an unscoped lookup is ambiguous
 * whenever the hub drawer is open.
 */
export function planningHubTab(page: Page, label: string) {
  return page
    .getByRole('tablist', { name: 'Planning hub views' })
    .getByRole('tab', { name: label, exact: true });
}

/**
 * Click a rail tab — the six-destination bar resolves every section label
 * directly (the W4–W9 Health-parent indirection was removed by the W10 D3
 * gate; `health` has no destination of its own).
 */
export async function goToTab(page: Page, tab: keyof typeof TAB_LABELS): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Scope to the tab rail landmark: the first-run onboarding card on Overview
  // exposes interest chips whose labels can equal a tab label (Habits, Focus,
  // Workout), so an unscoped lookup strict-matches two controls. Rail
  // destinations are ARIA `tab` (audit C §11), not `button`.
  const rail = sectionRail(page);
  if (tab === 'health') {
    // Health is not a bar destination in the six-tab model; it is reached via
    // the command center or a deep link. Specs that need it drive those paths.
    throw new Error("goToTab('health'): Health has no rail destination in the six-tab model");
  }
  await rail.getByRole('tab', { name: TAB_LABELS[tab], exact: true }).click();
  // Wait until React has hydrated all inputs — React attaches __reactFiber$xxx
  // properties to DOM nodes during hydration. Filling SSR-rendered inputs before
  // hydration sets DOM values that React immediately overrides with controlled state.
  // The habits tests avoid this because they first click a button (which retries
  // until onPress fires, implicitly waiting for hydration). Form-first tests like
  // calories must wait explicitly.
  await page
    .waitForFunction(
      () => {
        const inputs = Array.from(document.querySelectorAll('input'));
        if (inputs.length === 0) return true; // no inputs on this tab
        return inputs.some((el) => Object.keys(el).some((k) => k.startsWith('__reactFiber')));
      },
      { timeout: 10_000 },
    )
    .catch(() => {
      // If we time out waiting for React fibers (e.g. no inputs), proceed anyway
    });
}

/**
 * The page-header composer button ("Add task with details") opens the full
 * task editor. The inline quick-add row owns the exact "Add task" label for
 * its circular submit button, so the opener is selected by its own distinct
 * accessible name.
 */
export async function openNewTodoModal(page: Page) {
  await page.getByRole('button', { name: 'Add task with details', exact: true }).click();
}

/**
 * Primary action in the new-todo modal. Scope to the open dialog: the
 * quick-capture input's placeholder ("Quick add a task...") also matches
 * a bare /Add a task/i lookup, so fills must target the modal exactly.
 */
export async function submitTodoModal(page: Page, options?: { waitForClose?: boolean }) {
  const dialog = page.getByRole('dialog');
  const titleInput = dialog.getByPlaceholder('Add a task...', { exact: true });
  // Click the Pressable wrapper, not the inner Text node, so RN Web reliably fires onPress.
  await dialog.getByText('Add task', { exact: true }).locator('..').click({ force: true });
  if (options?.waitForClose) {
    await titleInput.waitFor({ state: 'hidden', timeout: 15_000 });
  }
}

/** The open new/edit-todo dialog, for specs that fill modal fields directly. */
export async function openTodoDialog(page: Page) {
  return page.getByRole('dialog');
}

/** Hard reload the page, bypassing SW cache. */
export async function hardReload(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/**
 * Wait for DB to be ready by checking for the absence of the
 * initializeDatabase error in the page's console output.
 * Call this after navigation if the test is DB-sensitive.
 */
export async function waitForDb(page: Page, timeout = 5_000) {
  await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
    timeout,
  });
}
