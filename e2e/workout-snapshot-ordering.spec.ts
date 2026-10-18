import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { fillRoutineName } from './helpers/forms';

/**
 * C2 — snapshot sequencer proof at its real call site.
 *
 * `RoutineDetailScreen` runs overlapping `refresh()` reads and guards state
 * application with `createSnapshotSequencer()` (begin per read, claim only the
 * newest sequence). Removing that guard leaves a race: a slower OLDER read can
 * resolve after a newer snapshot has been applied and silently revert the UI.
 *
 * The test creates that exact ordering without app hooks: an init-script patch
 * delays ONLY the worker RESPONSE carrying `SELECT * FROM routine_exercises`
 * (the query has already executed, so its payload is genuinely older) while the
 * interleaved user action adds an exercise and refreshes normally. The delayed
 * stale snapshot must then lose the claim and never overwrite the newer list.
 */

type HoldWindow = Window & {
  __shRoutineHold?: { captured: boolean; delayed: boolean };
  __armRoutineHold?: () => void;
};

async function installResponseDelayPatch(page: Page) {
  await page.addInitScript(() => {
    const proto = Worker.prototype;
    const originalPostMessage = proto.postMessage;
    const originalAddEventListener = proto.addEventListener;
    const DELAY_MS = 1800;
    let armed = false;
    let heldRequestId: number | null = null;
    let targetStatementId: number | null = null;

    const state = { captured: false, delayed: false };
    (window as HoldWindow).__shRoutineHold = state;
    (window as HoldWindow).__armRoutineHold = () => {
      armed = true;
      heldRequestId = null;
      targetStatementId = null;
      state.captured = false;
      state.delayed = false;
    };

    proto.postMessage = function (
      message: unknown,
      transferOrOptions?: Transferable[] | StructuredSerializeOptions,
    ) {
      const candidate = message as {
        id?: unknown;
        type?: unknown;
        data?: { nativeStatementId?: unknown };
      } | null;
      const type = typeof candidate?.type === 'string' ? candidate.type : '';
      // 1. Arm: remember the statement prepared from the routine-exercises SQL.
      //    Do NOT delay the prepare: its response is what lets the query run.
      if (armed && type === 'prepare') {
        let text = '';
        try {
          text = JSON.stringify(message);
        } catch {
          text = '';
        }
        const statementId = candidate?.data?.nativeStatementId;
        if (
          /SELECT \* FROM routine_exercises/i.test(text) &&
          typeof statementId === 'number' &&
          typeof candidate?.id === 'number'
        ) {
          targetStatementId = statementId;
          armed = false;
        }
      }
      // 2. Delay the response of the FIRST getAll for that statement: the rows
      //    were read BEFORE any interleaved mutation, so delivering late makes
      //    the snapshot genuinely stale.
      if (
        heldRequestId === null &&
        targetStatementId !== null &&
        type === 'getAll' &&
        candidate?.data?.nativeStatementId === targetStatementId &&
        typeof candidate?.id === 'number'
      ) {
        heldRequestId = candidate.id;
        state.captured = true;
      }
      const options = Array.isArray(transferOrOptions)
        ? { transfer: transferOrOptions }
        : transferOrOptions;
      return originalPostMessage.call(this, message, options);
    };

    proto.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === 'message' && typeof listener === 'function') {
        const wrapped = (event: Event) => {
          const id = (event as MessageEvent).data?.id;
          if (heldRequestId !== null && id === heldRequestId) {
            heldRequestId = null;
            state.delayed = true;
            setTimeout(() => listener(event), DELAY_MS);
            return;
          }
          listener(event);
        };
        return originalAddEventListener.call(this, type, wrapped, options);
      }
      if (listener === null) return;
      return originalAddEventListener.call(this, type, listener, options);
    };
  });
}

async function workoutSection(page: Page) {
  await goToTab(page, 'workout');
  await expect(page.getByText('Workout', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  return page;
}

async function addExerciseInBuilder(page: Page, name: string) {
  const builder = page.getByRole('dialog');
  await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill(name);
  await builder.getByText('Add', { exact: true }).click({ force: true });
  await expect(builder.getByText(name, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('routine detail snapshot ordering', () => {
  test.setTimeout(180_000);

  test('a delayed older refresh cannot revert a newer exercise list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await seedFixture(page, 'TYPICAL');

    // Build a routine with one exercise through the real builder.
    await workoutSection(page);
    await fillRoutineName(page, 'Ordering Day');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Ordering Day', { exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await addExerciseInBuilder(page, 'Squat');

    // Reboot with the worker-response delay patch installed before app boot.
    await installResponseDelayPatch(page);
    await returnToApp(page);
    await workoutSection(page);
    await page.getByRole('button', { name: /Open Ordering Day routine/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const builder = page.getByRole('dialog');
    await expect(builder.getByText('Squat', { exact: false }).first()).toBeVisible();

    // Arm the one-shot delay, then trigger the OLDER refresh by reopening the
    // detail (the effect refresh on open). Its listExercises query executes
    // now and its response is held for 1.8s.
    await page.evaluate(() => (window as HoldWindow).__armRoutineHold?.());
    await builder.getByLabel('Close').click();
    await page.getByRole('button', { name: /Open Ordering Day routine/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForFunction(
      () => (window as HoldWindow).__shRoutineHold?.captured === true,
      null,
      { timeout: 5_000 },
    );

    // While the stale response is held, add an exercise: this mutation triggers
    // the NEWER refresh, which applies the two-exercise snapshot immediately.
    await addExerciseInBuilder(page, 'Bench Press');
    await expect
      .poll(() => page.evaluate(() => (window as HoldWindow).__shRoutineHold?.delayed === true), {
        timeout: 6_000,
      })
      .toBe(true);

    // Let the delayed older snapshot arrive and try to apply.
    await page.waitForTimeout(2_500);

    // The sequencer must reject the stale claim: the newer list survives.
    await expect(builder.getByText('Squat', { exact: false }).first()).toBeVisible();
    await expect(builder.getByText('Bench Press', { exact: false }).first()).toBeVisible();

    // Oracle: both exercises really exist (the UI is not showing stale state).
    await builder.getByLabel('Close').click();
    const rows = await queryRows(
      page,
      `SELECT re.name FROM routine_exercises re
       JOIN workout_routines r ON r.id = re.routine_id
       WHERE r.name = 'Ordering Day' AND re.deleted_at IS NULL
       ORDER BY re.sort_order ASC, re.created_at ASC`,
    );
    expect(rows.map((row) => String(row.name))).toEqual(['Squat', 'Bench Press']);
  });
});
