import { Page } from '@playwright/test';

/**
 * Rail labels (V3 five-destination model). `workout` and `calories` remain
 * AppSections but live behind the Health tab on phone — `goToTab` routes them
 * through Health so every existing spec keeps working unchanged.
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

/** Sections reachable only through the Health parent on the phone rail. */
const HEALTH_CHILDREN: ReadonlySet<string> = new Set(['workout', 'calories']);

/**
 * Click a rail tab — routing through Health for workout/calories — to switch
 * sections in the single-page layout.
 */
export async function goToTab(page: Page, tab: keyof typeof TAB_LABELS): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Scope to the tab rail landmark: the first-run onboarding card on Overview
  // exposes interest chips whose labels can equal a tab label (Habits, Focus,
  // Workout), so an unscoped lookup strict-matches two buttons.
  const rail = page.getByRole('tablist', { name: 'Section tabs' });
  if (HEALTH_CHILDREN.has(tab)) {
    await rail.getByRole('button', { name: 'Health', exact: true }).click();
    await page.getByRole('button', { name: `Open ${TAB_LABELS[tab]}` }).click();
  } else {
    await rail.getByRole('button', { name: TAB_LABELS[tab], exact: true }).click();
  }
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
 * quick-capture input's placeholder ("Quick add a task...") also matches a
 * bare /Add a task/i lookup, so fills must target the modal exactly.
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

/**
 * Hard reload the page, bypassing SW cache.
 * Uses domcontentloaded for the same reason as goToTab.
 */
export async function hardReload(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/**
 * Wait for DB to be ready by checking for the absence of the
 * initializeDatabase error in the page's console output.
 * Call this after navigation if a test is DB-sensitive.
 */
export async function waitForDb(page: Page, timeout = 5_000) {
  await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
    timeout,
  });
}
