import { Page } from '@playwright/test';

export const TAB_LABELS = {
  overview: 'Today',
  todos: 'To Do',
  habits: 'Habits',
  pomodoro: 'Focus',
  workout: 'Workout',
  calories: 'Calories',
} as const;

/**
 * Click a top-tab button to switch sections in the single-page layout.
 */
/**
 * FAB opens new todo — no visible "Make a Task" copy; use accessible name.
 * The quick-capture submit shares the "Add task" label but is disabled while
 * its input is empty, and react-native-web does not expose aria-disabled for
 * it, so select by position: the FAB renders after all Screen content.
 */
export async function openNewTodoModal(page: Page) {
  await page.getByRole('button', { name: 'Add task' }).last().click();
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

export async function goToTab(page: Page, tab: keyof typeof TAB_LABELS) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Scope to the tab rail landmark: the first-run onboarding card on Overview
  // exposes interest chips whose labels can equal a tab label (Habits, Focus,
  // Workout), so an unscoped lookup strict-matches two buttons.
  await page
    .getByRole('tablist', { name: 'Section tabs' })
    .getByRole('button', { name: TAB_LABELS[tab], exact: true })
    .click();
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