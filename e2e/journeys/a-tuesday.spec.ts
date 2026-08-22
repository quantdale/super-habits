import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows, expectRowsEventually } from '../helpers/oracles';
import { returnToApp } from '../helpers/dbHarness';
import { fillCaloriesMacros } from '../helpers/forms';
import { TAB_LABELS } from '../helpers/navigation';

/**
 * J1 — "A Tuesday" (task 4.1, priority P1, tagged @p0).
 *
 * Persona P1 (Maya, the Daily Driver): one continuous session across
 * Overview → Habits → Todos → Calories → Pomodoro, with a 25-minute focus
 * timer running across every section switch. The multi-live-screen regression
 * this journey exists for: six sections stay mounted (opacity/zIndex switch,
 * never unmounted), so a timer and each section's aggregates must survive
 * switching — and the inactive sections must refresh on re-activation.
 *
 * Fixture: TYPICAL (~14 days of history) seeded through the real app database.
 * Clock: fixed at 08:00 local on Tuesday 2026-06-30 (installed before first
 * render).
 *
 * Oracles per the design's D7 triple: every mutating step asserts (1) the
 * acting surface's UI, (2) an independent surface (Overview aggregate) and/or
 * the SQLite rows via the DB harness, and (3) a negative oracle (untouched
 * tables/rows must not change). Because the DB harness is a separate document
 * that destroys the app's in-memory state, no SQL runs while the timer is
 * live; the timer's row-level assertions happen after the session completes.
 */
defineJourney({
  persona: 'P1 — Maya, the Daily Driver',
  goal: 'One Tuesday from Overview → Habits → Todos → Calories → Pomodoro, with a focus timer surviving every section switch',
  fixture: 'TYPICAL',
  clock: { startAt: '2026-06-30T08:00:00' },
  tags: ['@p0'],
  risks: ['R6', 'R8'],
  steps: [
    {
      name: 'Open on Overview: seeded aggregates match the persisted rows',
      run: async ({ page }) => {
        await switchTab(page, 'overview');
        const today = await todayKey(page);

        // Row-level ground truth (seeded TYPICAL): 8 pending todos, 8 focus
        // sessions, 600 kcal today (two seeded entries: a 0-kcal row and a
        // 600-kcal "Dark chocolate"), 4 live habits.
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND completed = 0',
          (rows) => expect(Number(rows[0]?.n)).toBe(8),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(8),
        );
        await expectRows(
          page,
          `SELECT COALESCE(SUM(calories),0) AS n FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = '${today}'`,
          (rows) => expect(Number(rows[0]?.n)).toBe(600),
        );
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL',
          (rows) => expect(Number(rows[0]?.n)).toBe(4),
        );

        // Capture seeded baselines used for relative (seed-drift-proof)
        // negative oracles in the remaining steps.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) =>
          setActingStore('completionsBase', Number(rows[0]?.n)),
        );
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM habit_completions WHERE date_key = '${today}'`,
          (rows) => setActingStore('completionsTodayBase', Number(rows[0]?.n)),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL', (rows) =>
          setActingStore('todosLiveBase', Number(rows[0]?.n)),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          setActingStore('pomodoroBase', Number(rows[0]?.n)),
        );
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = '${today}'`,
          (rows) => setActingStore('calTodayBaseRows', Number(rows[0]?.n)),
        );
        await expectRows(
          page,
          `SELECT COALESCE(SUM(calories),0) AS n FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = '${today}'`,
          (rows) => setActingStore('calTodayBaseSum', Number(rows[0]?.n)),
        );

        // Assert the Overview surfaces reflect those rows.
        await returnToApp(page);
        await switchTab(page, 'overview');
        await expect(page.getByText('8 pending', { exact: true })).toBeVisible();
        // The redesigned Overview Focus card is WEEK-scoped (last 7 local
        // days) and counts only session_type='focus'. TYPICAL seeds 8
        // sessions over daysAgo 0..7 with type i%3, so exactly i=0,3,6 are
        // focus rows inside the week window → 3 sessions.
        setActingStore('weekFocusBase', 3);
        await expect(page.getByText('min · 3 sessions this week')).toBeVisible();
        // The redesigned Calories card renders the consumed number and the
        // "/ <goal> kcal" label as sibling nodes.
        await expect(
          page
            .getByText('/ 2000 kcal', { exact: true })
            .locator('..')
            .getByText('600', { exact: true }),
        ).toBeVisible();

        // Second, independent surface: the Focus section's own stat card. The
        // reworked Pomodoro screen counts only session_type='focus' — TYPICAL
        // seeds 3 focus rows (i=0,3,6 of the 8 sessions).
        await switchTab(page, 'pomodoro');
        await expectFocusStat(page, 'Focus sessions', '3');
      },
    },
    {
      name: 'Tick two habits on Habits; row oracle + negative oracle + Overview unchanged',
      run: async ({ page }) => {
        await switchTab(page, 'habits');
        await expect(
          page.getByText('4 habits across your daily routine', { exact: true }),
        ).toBeVisible();

        // Tick two distinct habits (Habit 2: target 3, morning; Habit 5:
        // target 99, anytime). Each creates one habit_completions row today.
        await tickHabit(page, 'Habit 2');
        await tickHabit(page, 'Habit 5');

        const today = await todayKey(page);
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM habit_completions WHERE date_key = '${today}'`,
          (rows) =>
            // Relative to the seeded today-baseline (the TYPICAL fixture's last
            // history day can carry seeded completions), never a hardcoded 2 —
            // all J1 aggregates are seed-drift-proof by design.
            expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsTodayBase') + 2),
        );
        // Row-level: exactly one today-row per TICKED habit, count 1. Scoped to
        // the two ticked habits because the TYPICAL fixture's last history day
        // can carry seeded completions for other habits (seed-drift-proof).
        await expectRows(
          page,
          `SELECT h.name, c.count FROM habit_completions c JOIN habits h ON h.id = c.habit_id WHERE c.date_key = '${today}' AND h.name IN ('Habit 2', 'Habit 5') ORDER BY h.name`,
          (rows) => {
            expect(rows).toHaveLength(2);
            expect(rows.map((r) => r.name).sort()).toEqual(['Habit 2', 'Habit 5']);
            for (const r of rows) expect(Number(r.count)).toBe(1);
          },
        );
        // Negative oracle: nothing else changed — todos, habits, calories,
        // pomodoro untouched; completions total = seeded baseline + 2 ticks.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsBase') + 2),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('todosLiveBase')),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('pomodoroBase')),
        );

        // Second surface: Overview was mounted before the ticks; its To-Do and
        // Focus aggregates must be unchanged (negative), and it must NOT have
        // leaked the habit ticks into other cards.
        await returnToApp(page);
        await switchTab(page, 'overview');
        await expect(page.getByText('8 pending', { exact: true })).toBeVisible();
        // Negative oracle: the week-scoped focus aggregate is unchanged.
        await expect(
          page.getByText(`min · ${getActingStore<number>('weekFocusBase')} sessions this week`),
        ).toBeVisible();
      },
    },
    {
      name: 'Add a todo on Todos; Overview pending count rises (stale-aggregate catch)',
      run: async ({ page }) => {
        await switchTab(page, 'todos');
        await page.getByRole('button', { name: 'Add task' }).last().click();
        await page.getByPlaceholder(/Add a task/i).fill('Buy groceries');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByPlaceholder(/Add a task/i)).toBeHidden({ timeout: 15_000 });

        const today = await todayKey(page);
        // Row-level: exactly one new non-deleted, incomplete todo.
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Buy groceries' AND deleted_at IS NULL AND completed = 0",
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        // Negative oracle: habits/completions/calories/pomodoro untouched.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsBase') + 2),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('pomodoroBase')),
        );

        // Real product behaviour: activating Todos instantiates today's copy of
        // the seeded daily-recurring "Task 7" (its due date is yesterday, so the
        // series is uncovered today). Assert that instantiation happened exactly
        // once — the R5 duplicate-write guard.
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM todos WHERE title = 'Task 7' AND deleted_at IS NULL AND due_date = '${today}'`,
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        // Capture the DB's authoritative pending count (seeded pending + one
        // recurring instance + the todo we just added) for the Overview assert.
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND completed = 0',
          (rows) => setActingStore('todosPendingAfterAdd', Number(rows[0]?.n)),
        );

        // Immediate UI: the new todo is present in the Todos list.
        await returnToApp(page);
        await switchTab(page, 'todos');
        await page.getByText('Buy groceries', { exact: true }).first().scrollIntoViewIfNeeded();
        await expect(page.getByText('Buy groceries', { exact: true }).first()).toBeVisible();

        // Second surface: Overview was mounted before the add; on re-activation
        // it must refresh to the DB's authoritative pending count (this is the
        // R6 stale-aggregate regression: if Overview rendered its held value,
        // this would fail).
        await switchTab(page, 'overview');
        await expect(
          page.getByText(pendingText(getActingStore<number>('todosPendingAfterAdd')), {
            exact: true,
          }),
        ).toBeVisible();
      },
    },
    {
      name: 'Log breakfast in Calories; Overview daily total reflects it',
      run: async ({ page }) => {
        await switchTab(page, 'calories');
        // Form view is the default after reset. Select the Breakfast meal type
        // explicitly, then fill macros. 12/1/8/0 → 124 kcal.
        await page.getByText('Breakfast', { exact: true }).click();
        await fillCaloriesMacros(page, 'Scrambled eggs 🍳', '12', '1', '8', '0');
        // RN Web fields are controlled inputs. Wait for both the input value and
        // the derived kcal value before pressing the async submit action; this
        // keeps the row oracle about persistence rather than input hydration.
        await expect(page.locator('#cal-entry-food')).toHaveValue('Scrambled eggs 🍳');
        await expect(
          page
            .getByText('Calories (kcal)', { exact: true })
            .locator('..')
            .getByText('124', { exact: true }),
        ).toBeVisible();
        await page
          .getByText('Add entry', { exact: true })
          .last()
          .click({ force: true, timeout: 30_000 });

        // The handler commits the ledger and saved-meal index before refreshing
        // the mounted screen. Wait for that visible commit before entering the
        // separate SQLite harness for the row-level assertions below.
        await expect(page.getByText('Scrambled eggs 🍳 - 124 kcal', { exact: true })).toBeVisible();

        const today = await todayKey(page);
        // Row-level: exactly one breakfast entry with the computed kcal.
        await expectRows(
          page,
          "SELECT food_name, calories, meal_type, consumed_on FROM calorie_entries WHERE deleted_at IS NULL AND food_name = 'Scrambled eggs 🍳'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(Number(rows[0]?.calories)).toBe(124);
            expect(rows[0]?.meal_type).toBe('breakfast');
            expect(rows[0]?.consumed_on).toBe(today);
          },
        );
        // The add also upserts a saved_meal (TYPICAL seeded none).
        await expectRows(page, 'SELECT COUNT(*) AS n FROM saved_meals', (rows) =>
          expect(Number(rows[0]?.n)).toBe(1),
        );
        // Negative oracle: todos/habits/completions/pomodoro untouched.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsBase') + 2),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('pomodoroBase')),
        );

        // Immediate UI: the entry appears in "Logged today" and the daily total.
        await returnToApp(page);
        await switchTab(page, 'calories');
        await expect(page.getByText('Scrambled eggs 🍳 - 124 kcal', { exact: true })).toBeVisible();
        await expect(page.getByText('Today: 724 kcal', { exact: true })).toBeVisible();

        // Second surface: Overview daily total = seeded + 124 logged. The
        // redesigned Calories card renders the consumed number and the
        // "/ <goal> kcal" label as sibling nodes.
        await switchTab(page, 'overview');
        await expect(
          page
            .getByText('/ 2000 kcal', { exact: true })
            .locator('..')
            .getByText(String(getActingStore<number>('calTodayBaseSum') + 124), { exact: true }),
        ).toBeVisible();
      },
    },
    {
      name: 'Start a 25-minute focus session on Focus; timer is running',
      run: async ({ page }) => {
        await switchTab(page, 'pomodoro');
        await page.getByText('Start focus', { exact: true }).click();
        await expect(page.getByText('Pause', { exact: true })).toBeVisible({ timeout: 5_000 });

        // Record the fake-clock "now" as the boundary marker for the session row,
        // and the starting timer display. No SQL here — the harness would kill
        // the in-memory timer.
        const startTs = await page.evaluate(() => Date.now());
        const startTxt = await readTimer(page);
        // Freshly started 25-minute countdown (allow a second or two of real
        // drift between the click and the read).
        expect(startTxt).toMatch(/^(25:00|24:5\d)$/);
        setActingStore('focusStartMs', startTs);
        setActingStore('focusStartIso', new Date(startTs).toISOString());
      },
    },
    {
      name: 'Timer survives a detour through Todos; complete a todo mid-focus',
      run: async ({ page }) => {
        // Switch away — the mounted Focus section must keep its timer alive.
        await switchTab(page, 'todos');
        // Complete the seeded pending todo 'Task 5' (sort 4: near the top of
        // the list and NOT in Overview's top-3, so its title is unique here).
        // Its checkbox is the sibling before the title's wrapping
        // View in the content row.
        await page
          .getByText('Task 5', { exact: true })
          .first()
          .locator('..')
          .locator('..')
          .locator('xpath=preceding-sibling::*[1]')
          .click({ force: true });
        // Completed todos leave the visible pending list (showCompleted=false),
        // so the row-level completion is asserted in the next step's SQL.
        await expect(page.getByText('Task 5', { exact: true })).toBeHidden();

        // Return to Focus: the timer must still be running (Pause visible) and
        // actively counting. Advance the already-installed browser clock by
        // one second so this assertion does not depend on an arbitrary amount
        // of wall-clock time elapsing while the previous step tears down.
        // This is the R6 multi-live-screen regression: a timer that died on
        // section switch would never reach 24:xx; one that restarted would
        // still show 25:00 forever.
        await switchTab(page, 'pomodoro');
        await expect(page.getByText('Pause', { exact: true })).toBeVisible({ timeout: 5_000 });
        await page.clock.fastForward(1_000);
        await expect(page.locator('.text-5xl').getByText(/^24:/)).toBeVisible({ timeout: 5_000 });
        const nowSec = parseTime(await readTimer(page), false);
        // Advanced past 25:00 but nowhere near 0 — a sane short-detour delta.
        expect(nowSec).toBeLessThan(1500);
        expect(nowSec).toBeGreaterThanOrEqual(24 * 60);
      },
    },
    {
      name: 'Complete the focus session via the clock; exactly one session is logged',
      run: async ({ page }) => {
        // Still on Focus with the timer running — jump the clock past the full
        // focus duration. The auto-advancing clock fires the countdown interval
        // once with a wall-clock delta covering the whole gap, so the session
        // completes and is logged.
        await page.clock.fastForward(25 * 60 * 1000);
        await expect(page.getByText('Pause', { exact: true })).toBeHidden({ timeout: 5_000 });
        // The session insert is fire-and-forget; the note prompt renders only
        // after recordCompletedPomodoroSession CONFIRMS the row, so waiting
        // for it guarantees the durable write before any row oracle below
        // navigates to the DB harness (which destroys the app page).
        await expect(page.getByPlaceholder('Optional note for this session…')).toBeVisible({
          timeout: 15_000,
        });
        // NOTE: the Focus section's own "Focus sessions" stat is NOT asserted
        // here — the completion path fires `void logPomodoroSession()` and
        // `void loadHistory()` concurrently, so the stat can lag one render
        // until the next foreground refresh (a benign self-healing race). The
        // durable session-logged check is the row oracle below, and the
        // "Overview focus count updated" check follows after returnToApp.

        const startIso = getActingStore<string>('focusStartIso');
        // Row-level: seeded count + exactly ONE new session, a focus session of
        // 1500s created within the 25-minute session window (no partial
        // session, no duplicate logging — the D11 / R5 regression guard). The
        // upper bound excludes the seeded "today" session, which is created at
        // 09:00 local — ~59 min after this session's 08:00 start.
        // The completion path logs asynchronously; poll the durable row.
        await expectRowsEventually(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('pomodoroBase') + 1),
        );
        const startUpperIso = new Date(
          getActingStore<number>('focusStartMs') + 26 * 60 * 1000,
        ).toISOString();
        await expectRows(
          page,
          `SELECT session_type, duration_seconds FROM pomodoro_sessions WHERE created_at >= '${startIso}' AND created_at < '${startUpperIso}'`,
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0]?.session_type).toBe('focus');
            expect(Number(rows[0]?.duration_seconds)).toBe(1500);
          },
        );
        // Negative oracle: the mid-focus completion persisted for exactly the seeded
        // todo we completed ('Task 5'); the todo we added ('Buy groceries')
        // stays pending; no other surface lost rows.
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Task 5' AND completed = 1 AND deleted_at IS NULL",
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Buy groceries' AND completed = 0 AND deleted_at IS NULL",
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsBase') + 2),
        );

        // Capture the post-focus todo aggregates (seeded + recurring instance +
        // added − completed mid-focus) so the reload step can assert Overview
        // against the DB's authoritative value.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL', (rows) =>
          setActingStore('todosLiveAfterFocus', Number(rows[0]?.n)),
        );
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND completed = 0',
          (rows) => setActingStore('todosPendingAfterFocus', Number(rows[0]?.n)),
        );

        // Second surface: Overview's week-scoped focus card reflects the
        // completed session (it landed today, inside the 7-day window).
        await returnToApp(page);
        await switchTab(page, 'overview');
        await expect(
          page.getByText(`min · ${getActingStore<number>('weekFocusBase') + 1} sessions this week`),
        ).toBeVisible();
      },
    },
    {
      name: 'Reload: every aggregate survives on its section and rows persist',
      run: async ({ page }) => {
        // Hard reload (fresh bootstrap). The running timer is gone by design
        // (D11) — the completed session and all writes persist.
        const sessionsExpected = getActingStore<number>('pomodoroBase') + 1;
        const calTodayExpected = getActingStore<number>('calTodayBaseSum') + 124;
        await returnToApp(page);
        await switchTab(page, 'overview');
        await expect(
          page.getByText(pendingText(getActingStore<number>('todosPendingAfterFocus')), {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText(`min · ${getActingStore<number>('weekFocusBase') + 1} sessions this week`),
        ).toBeVisible();
        await expect(
          page
            .getByText('/ 2000 kcal', { exact: true })
            .locator('..')
            .getByText(String(calTodayExpected), { exact: true }),
        ).toBeVisible();

        // Second surfaces after reload. The Focus stat counts focus-type
        // sessions only: the week base plus the session completed in-journey.
        await switchTab(page, 'pomodoro');
        await expectFocusStat(
          page,
          'Focus sessions',
          String(getActingStore<number>('weekFocusBase') + 1),
        );
        await switchTab(page, 'habits');
        await expect(
          page.getByText('4 habits across your daily routine', { exact: true }),
        ).toBeVisible();
        await switchTab(page, 'todos');
        // The todo we added is still pending and listed after the reload.
        await expect(page.getByText('Buy groceries', { exact: true }).first()).toBeVisible();

        // Final row-level state: exactly the expected rows, nothing deleted
        // beyond the seeded soft-deletes, one completed todo, one breakfast
        // entry, two today completions, one saved meal, one extra focus session.
        const today = await todayKey(page);
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          (rows) => {
            expect(Number(rows[0]?.n)).toBe(getActingStore<number>('todosLiveAfterFocus'));
          },
        );
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'Task 5' AND completed = 1 AND deleted_at IS NULL",
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NOT NULL',
          (rows) => expect(Number(rows[0]?.n)).toBe(1),
        );
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM habit_completions WHERE date_key = '${today}'`,
          (rows) =>
            // Relative seed-drift-proof: seeded today-completions + the two ticks.
            expect(Number(rows[0]?.n)).toBe(getActingStore<number>('completionsTodayBase') + 2),
        );
        await expectRows(
          page,
          `SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = '${today}'`,
          (rows) => expect(Number(rows[0]?.n)).toBe(getActingStore<number>('calTodayBaseRows') + 1),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(sessionsExpected),
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM saved_meals', (rows) =>
          expect(Number(rows[0]?.n)).toBe(1),
        );
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Helpers (spec-local; no app source, spec, or helper file is modified).
// ---------------------------------------------------------------------------

/** Local `YYYY-MM-DD` from the (fake) page clock — the same anchor the seed uses. */
async function todayKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

/**
 * Switch section by clicking the top tab rail. Uses `.first()` because once the
 * Pomodoro section is mounted, its "Focus" mode chip also exposes
 * role=button with the accessible name "Focus" — the tab rail is always the
 * first match in DOM order (lazy-mounted sections come after the rail).
 */
async function switchTab(page: Page, tab: keyof typeof TAB_LABELS): Promise<void> {
  await page.getByRole('button', { name: TAB_LABELS[tab], exact: true }).first().click();
}

/** Click a habit's ring (the HabitCircle wrapper is the sibling before its name). */
async function tickHabit(page: Page, name: string): Promise<void> {
  // Click the habit ring through its accessibility label (the label locator
  // re-resolves to the live element across re-renders), then WAIT for the
  // ring to reflect the increment: the click's async mutation chain runs
  // after the click resolves, and a SQL oracle navigates the page away —
  // which would abort an in-flight transaction on slower runners. The UI
  // label only updates after the mutation commits.
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ring = page.getByLabel(new RegExp(`^${escapedName}: (\\d+) of \\d+ today\\.`)).first();
  const before = Number((await ring.getAttribute('aria-label'))?.match(/(\d+) of/)?.[1] ?? 0);
  await ring.click({ force: true });
  await expect
    .poll(
      async () => Number((await ring.getAttribute('aria-label'))?.match(/(\d+) of/)?.[1] ?? 0),
      { timeout: 10_000 },
    )
    .toBe(before + 1);
}

/** Assert a FeatureStatCard's value (scoped so hidden Overview cards don't collide). */
async function expectFocusStat(page: Page, title: string, value: string): Promise<void> {
  // The restructured FeatureStatCard renders the value as a sibling of the
  // title subtree, so match the innermost element containing both texts.
  const statCard = page
    .locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByText(value, { exact: true }) })
    .last();
  await expect(statCard).toBeVisible();
}

/** Read the Focus timer's `mm:ss` display. */
async function readTimer(page: Page): Promise<string> {
  const el = page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/);
  await el.waitFor();
  return (await el.textContent())?.trim() ?? '';
}

/** Parse `mm:ss` to total seconds. */
function parseTime(txt: string, strict = true): number {
  const m = /^(\d{2}):(\d{2})$/.exec(txt);
  if (!m) {
    if (strict) throw new Error(`expected mm:ss, got "${txt}"`);
    return -1;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The Overview To-Do card text for a pending count (TodosCard renders "N pending"). */
function pendingText(n: number): string {
  return `${n} pending`;
}

// Module-scoped scratch pad so steps can carry values across the serial journey.
const actingStore = new Map<string, unknown>();
function setActingStore(key: string, value: unknown): void {
  actingStore.set(key, value);
}
function getActingStore<T>(key: string): T {
  return actingStore.get(key) as T;
}
