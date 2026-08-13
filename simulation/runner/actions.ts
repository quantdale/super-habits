/**
 * Runner-owned step interactions (`add-user-simulation-platform` task 3.1).
 *
 * Each function resolves ONE semantic step kind to a real browser interaction.
 * Where the parent harness has a dedicated helper (catalog `parentHelper`), the
 * function delegates to it; where the parent harness has no helper (catalog
 * `parentHelper: null`), the runner owns the selectors here — exactly the
 * contract the catalog's `note` fields promise ("selector lives in the runner,
 * never in scenario files").
 *
 * Every function returns a short, deterministic action-log label describing
 * what it did (used for the run's reproducibility fingerprint, task 3.5).
 * Selectors are quoted from the passing journey specs / feature source.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { openNewTodoModal, submitTodoModal, TAB_LABELS } from '../../e2e/helpers/navigation';
import { fillCaloriesMacros, fillRoutineName } from '../../e2e/helpers/forms';
import { ACTIVE_SECTION_SELECTOR, switchSection } from '../../e2e/helpers/oracles';
import { advanceToNextDay } from '../../e2e/helpers/clock';
import {
  setOffline,
  injectServerError,
  injectTimeout,
  injectMalformed,
  injectPartialFailure,
  clearInjectedFailures,
} from '../../e2e/helpers/failure';
import { returnToApp } from '../../e2e/helpers/dbHarness';
import type { SectionName, SemanticStep } from '../model/types';

/** Escape a literal string for use inside a RegExp. */
function escRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ensure the page is on the app (reloads from DB context if needed). */
export async function ensureApp(page: Page): Promise<void> {
  await returnToAppSafe(page);
}

async function returnToAppSafe(page: Page): Promise<void> {
  // If we're on the app already, returnToApp is a full reload; avoid it when
  // the page is already on the app (cheap check: only reload when in DB ctx).
  if (page.url().includes('/__sh__/db/')) {
    await returnToApp(page);
  }
}

/**
 * Text lookup scoped to the ACTIVE section container. The single-page shell
 * keeps every section mounted; inactive sections are `opacity: 0`,
 * `pointer-events: none`, `z-index: 0`, while the active one is
 * `pointer-events: auto; z-index: 1`. A plain `getByText(...).first()` can hit
 * a hidden copy (e.g. the Overview preview) that comes earlier in DOM order,
 * and Playwright's `visible` filter does NOT treat opacity:0 as hidden. Scope
 * by the active container's inline style instead.
 */
export function activeScopedText(page: Page, text: string): ReturnType<Page['getByText']> {
  return page.locator(ACTIVE_SECTION_SELECTOR).getByText(text, { exact: true }).first();
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export async function actionSwitchSection(page: Page, tab: SectionName): Promise<string> {
  await ensureApp(page);
  await switchSection(page, tab);
  return `switchSection ${tab}`;
}

export async function actionOpenSettings(page: Page): Promise<string> {
  await ensureApp(page);
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await expect(page.getByText('Theme and display', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Close the shared drawer modal via its "Close" control.
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Theme and display', { exact: true })).toHaveCount(0);
  return 'openSettings';
}

export async function actionOpenCommand(page: Page): Promise<string> {
  await ensureApp(page);
  // Tolerate 0..N launcher instances (COMMAND_EXPERIMENT_ENABLED gates it).
  for (let attempt = 0; attempt < 3; attempt++) {
    const launcher = page.getByRole('button', { name: 'Open command center', exact: true });
    const count = await launcher.count();
    if (count > 0) {
      await launcher.first().click({ force: true });
      try {
        // The command center remembers the last-used mode and defaults to
        // Auto on a fresh origin (AI_ASK_EXPERIMENT_ENABLED). The runner's
        // openCommand contract is the Create parser input, so pin the Create
        // mode before waiting on #command-input.
        const createMode = page.getByRole('button', { name: 'Create', exact: true });
        await createMode.waitFor({ state: 'visible', timeout: 8_000 });
        await createMode.click({ force: true });
        await page.locator('#command-input').waitFor({ state: 'visible', timeout: 8_000 });
        break;
      } catch {
        // launcher may not have been visible yet; retry
      }
    } else {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.locator('#command-input')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#command-input')).toHaveCount(0);
  return 'openCommand';
}

/* ------------------------------------------------------------------ */
/* Entity actions                                                      */
/* ------------------------------------------------------------------ */

export async function actionCreateTodo(
  page: Page,
  step: Extract<SemanticStep, { kind: 'createTodo' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'todos');
  await openNewTodoModal(page);
  await page.getByPlaceholder(/Add a task/i).fill(step.title);
  if (step.priority && step.priority !== 'normal') {
    // The modal's priority PillChips expose role=button with the priority name.
    await page
      .getByRole('button', { name: step.priority, exact: true })
      .first()
      .click({ force: true });
  }
  await submitTodoModal(page, { waitForClose: true });
  return `createTodo title=${JSON.stringify(step.title)} priority=${step.priority ?? 'normal'}`;
}

export async function actionToggleTodo(
  page: Page,
  step: Extract<SemanticStep, { kind: 'toggleTodo' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'todos');
  await toggleTodoCheckboxForTitle(page, step.title);
  return `toggleTodo title=${JSON.stringify(step.title)}`;
}

/**
 * Runner-owned toggle: fire a REAL pointer press sequence on the checkbox
 * column of the todo row. The parent's `gestures.clickTodoCheckboxForTitle`
 * dispatches a bare DOM `.click()`, which does not fire RNGH `RectButton`'s
 * onPress on web (row stays unchecked — documented in the parent's
 * `fat-fingers.spec.ts`). The text lookup is scoped to VISIBLE nodes: the
 * Overview section stays mounted behind the active tab and can render the same
 * title earlier in DOM order, so a plain `.first()` can hit the hidden copy.
 */
async function toggleTodoCheckboxForTitle(page: Page, title: string): Promise<void> {
  const textNode = activeScopedText(page, title);
  await textNode.waitFor({ state: 'visible', timeout: 15_000 });
  await textNode.scrollIntoViewIfNeeded();
  await textNode.evaluate((el) => {
    let n: HTMLElement | null = el as HTMLElement;
    for (let d = 0; d < 12 && n; d++) {
      const row = n.closest?.("[class*='flex-row']");
      if (row && row.children.length >= 2) {
        const box = row.children[1] as HTMLElement;
        const r = box.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        box.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 1,
          }),
        );
        box.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 0,
          }),
        );
        box.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
        return;
      }
      n = n.parentElement;
    }
  });
  await page.waitForTimeout(400);
}

/**
 * Runner-owned across-surfaces check. The parent's `oracles.expectAcrossSurfaces`
 * uses `getByText(text).first()` without a visibility filter; because Overview
 * stays mounted behind the active tab, its (hidden) copy can be first in DOM
 * order and the assertion wrongly targets it. This version scopes every text
 * lookup to visible nodes, on each tab and optionally after a reload.
 */
export async function runnerExpectAcrossSurfaces(
  page: Page,
  opts: {
    text: string;
    tabs: SectionName[];
    afterReload?: boolean;
  },
): Promise<void> {
  await ensureApp(page);
  const checkVisible = async (): Promise<void> => {
    for (const tab of opts.tabs) {
      await switchSection(page, tab);
      await activeScopedText(page, opts.text).waitFor({ state: 'visible', timeout: 15_000 });
    }
  };
  await checkVisible();
  if (opts.afterReload) {
    await returnToApp(page);
    await switchSection(page, opts.tabs[0]);
    await activeScopedText(page, opts.text).waitFor({ state: 'visible', timeout: 15_000 });
  }
}

export async function actionCreateHabit(
  page: Page,
  step: Extract<SemanticStep, { kind: 'createHabit' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'habits');
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  for (let attempt = 0; attempt < 3; attempt++) {
    const tile = page
      .getByLabel('Habit groups')
      .getByText('Add', { exact: true })
      .first()
      .locator('xpath=preceding-sibling::*[1]');
    await tile.click({ force: true });
    try {
      await nameField.waitFor({ state: 'visible', timeout: 8_000 });
      break;
    } catch {
      // retry
    }
  }
  await nameField.fill(step.name);
  if (step.targetPerDay !== undefined && step.targetPerDay !== 1) {
    const input = page
      .getByText('Target per day', { exact: true })
      .locator("xpath=ancestor::*[contains(@class,'mb-3')][1]//input")
      .first();
    await input.click();
    await input.fill('');
    await input.type(String(step.targetPerDay), { delay: 15 });
  }
  await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
  await expect(activeScopedText(page, step.name)).toBeVisible({ timeout: 15_000 });
  return `createHabit name=${JSON.stringify(step.name)} target=${step.targetPerDay ?? 1}`;
}

export async function actionTickHabit(
  page: Page,
  step: Extract<SemanticStep, { kind: 'tickHabit' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'habits');
  const ring = page
    .locator(ACTIVE_SECTION_SELECTOR)
    .getByRole('button', {
      name: new RegExp(`^${escRegExp(step.name)}: \\d+ of \\d+ today`),
    })
    .first();
  await expect(ring).toBeVisible({ timeout: 15_000 });
  const times = step.times ?? 1;
  for (let i = 0; i < times; i++) {
    const before = await ring.getAttribute('aria-label');
    await ring.click({ force: true });
    await expect.poll(() => ring.getAttribute('aria-label'), { timeout: 15_000 }).not.toBe(before);
  }
  return `tickHabit name=${JSON.stringify(step.name)} x${times}`;
}

export async function actionLogCalories(
  page: Page,
  step: Extract<SemanticStep, { kind: 'logCalories' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'calories');
  // The Calories form has no calories field — kcal is derived from macros
  // (kcalFromMacros). Use a carbs-only split so the stored kcal equals the
  // declared `calories` exactly (4 kcal/g of carbs); scenario authors should
  // declare a multiple of 4 for exact row-oracles.
  const cal = Math.max(0, Math.round(Number(step.calories) || 0));
  const carbs = Math.round(cal / 4);
  await page.locator('#cal-entry-food').waitFor({ state: 'visible', timeout: 15_000 });
  await fillCaloriesMacros(page, step.food, String(0), String(carbs), String(0), String(0));
  await expect
    .poll(() => page.locator('#cal-entry-food').inputValue(), { timeout: 5_000 })
    .toBe(step.food);
  if (step.mealType) {
    const label = step.mealType[0].toUpperCase() + step.mealType.slice(1);
    await page
      .locator('div[style*="pointer-events: auto"]')
      .getByRole('button', { name: label, exact: true })
      .click({ force: true });
  }
  await page
    .locator('div[style*="pointer-events: auto"]')
    .getByRole('button', { name: 'Add entry', exact: true })
    .click({ force: true });
  await expect(activeScopedText(page, `${step.food} - ${cal} kcal`)).toBeVisible({
    timeout: 15_000,
  });
  return `logCalories food=${JSON.stringify(step.food)} kcal=${cal}`;
}

export async function actionBuildRoutine(
  page: Page,
  step: Extract<SemanticStep, { kind: 'buildRoutine' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'workout');
  await fillRoutineName(page, step.name);
  await page.getByText('Add routine', { exact: true }).click();
  await expect(activeScopedText(page, step.name)).toBeVisible({ timeout: 15_000 });
  return `buildRoutine name=${JSON.stringify(step.name)}`;
}

export async function actionStartPomodoro(
  page: Page,
  step: Extract<SemanticStep, { kind: 'startPomodoro' }>,
): Promise<string> {
  await ensureApp(page);
  await switchSection(page, 'pomodoro');
  const mode = step.mode ?? 'focus';
  await page.getByText('Start focus', { exact: true }).click();
  await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 5_000 });
  return `startPomodoro mode=${mode}`;
}

/* ------------------------------------------------------------------ */
/* Realism (behavior engine drives timing + injections)                */
/* ------------------------------------------------------------------ */

/**
 * `waitThinkTime` is a plan-level concern: the behavior engine's `buildRunPlan`
 * (task 2.x) assigns `thinkTimeMs` per step — the runner waits that before
 * executing the step (see `execute.ts`). This action therefore only records
 * the declared wait in the action log; it does not double-wait.
 */
export function actionWaitThinkTime(
  _page: Page,
  step: Extract<SemanticStep, { kind: 'waitThinkTime' }>,
): string {
  return `waitThinkTime ms=${step.ms ?? 0}`;
}

export function actionMaybeMakeMistake(
  _page: Page,
  step: Extract<SemanticStep, { kind: 'maybeMakeMistake' }>,
): string {
  // The behavior engine attaches per-step injections from the persona's rates
  // (`dispatchWithInjection` in execute.ts). A step authored as
  // `maybeMakeMistake` records its declared injection (or 'none') here.
  const injection = step.injection ?? 'none';
  return `maybeMakeMistake injection=${injection}`;
}

export function actionAbandonForm(_page: Page): string {
  // Deterministic mode: no abandonment. The negative-oracle pattern asserts
  // nothing persisted (the caller wraps this with an `unchanged` oracle).
  return 'abandonForm none';
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export async function actionGoOffline(page: Page): Promise<string> {
  await setOffline(page, true);
  return 'goOffline';
}

export async function actionGoOnline(page: Page): Promise<string> {
  await setOffline(page, false);
  return 'goOnline';
}

export async function actionAdvanceClockToNextDay(
  page: Page,
  step: Extract<SemanticStep, { kind: 'advanceClockToNextDay' }>,
): Promise<string> {
  const days = step.days ?? 1;
  await advanceToNextDay(page, { days, afterMidnightMs: step.afterMidnightMs ?? 60_000 });
  return `advanceClockToNextDay days=${days}`;
}

export async function actionInjectFailure(
  page: Page,
  step: Extract<SemanticStep, { kind: 'injectFailure' }>,
): Promise<string> {
  const { failure, status, entities } = step;
  switch (failure) {
    case 'server-error':
      await injectServerError(page, { status: status ?? 503 });
      break;
    case 'timeout':
      await injectTimeout(page);
      break;
    case 'malformed':
      await injectMalformed(page);
      break;
    case 'partial':
      await injectPartialFailure(page, {
        failingEntities: entities ?? ['todos'],
        status: status ?? 503,
      });
      break;
    case 'offline':
      await setOffline(page, true);
      break;
  }
  return `injectFailure ${failure}`;
}

export async function actionClearFailures(page: Page): Promise<string> {
  await clearInjectedFailures(page);
  return 'clearFailures';
}

export async function actionReloadApp(page: Page): Promise<string> {
  await returnToApp(page);
  return 'reloadApp';
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export async function actionExpectAcrossSurfaces(
  page: Page,
  step: Extract<SemanticStep, { kind: 'expectAcrossSurfaces' }>,
): Promise<string> {
  await runnerExpectAcrossSurfaces(page, {
    text: step.text,
    tabs: step.tabs,
    afterReload: step.afterReload,
  });
  return `expectAcrossSurfaces text=${JSON.stringify(step.text)} tabs=${step.tabs.join(',')}`;
}

/** Export TAB_LABELS for the journey harness's JourneyContext-like callers. */
export const SECTION_LABELS = TAB_LABELS;
