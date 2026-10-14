import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';
import { ACTIVE_SECTION_SELECTOR } from './helpers/oracles';
import { browserLocalWeekday } from './helpers/browserDate';

/**
 * W9 Workout reconstruction regressions: the quick-start-first landing
 * (SYS-20), the collapsed week strip with explicit template-vs-override
 * assignment (SUR-06), the set-logging-first session anatomy, the
 * nonblocking rest dock, the session-local Add set, and the truthful
 * leave/cancel draft behavior. SQL oracles stay strict; no selector here
 * depends on implementation strings beyond the documented labels.
 */

test.describe('W9 Workout', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  async function openRoutineBuilder(page: Page, name: string) {
    await fillRoutineName(page, name);
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByText(name, { exact: true }).first().click();
    return page.getByRole('dialog').filter({ hasText: 'Routine builder' });
  }

  test('quick start leads the landing while rest day stays compact context', async ({ page }) => {
    await fillRoutineName(page, 'Push Day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Push Day')).toBeVisible();

    const section = page.locator(ACTIVE_SECTION_SELECTOR);
    // No schedule is set, so today resolves to rest: the rest line is compact
    // context, and the quick-start rows sit directly beneath it.
    await expect(section.getByText('Today · Rest scheduled')).toBeVisible();
    await expect(section.getByText('Rest day')).toBeVisible();
    const quickStartTop = await section.getByText('Quick start').boundingBox();
    const addFormTop = await page.getByText('Add routine', { exact: true }).boundingBox();
    const historyTop = await page
      .getByRole('button', { name: 'History and insights' })
      .boundingBox();
    // Hierarchy: training state → quick start → week → new routine → history.
    expect(quickStartTop!.y).toBeLessThan(addFormTop!.y);
    expect(addFormTop!.y).toBeLessThan(historyTop!.y);
    // The quick-start row carries counts and a start action for the routine.
    await expect(section.getByText('0 exercises · 0 sets')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Start Push Day' })).toBeVisible();
    // Start does not require opening the routine first: it goes straight
    // into the session screen for the row's own routine.
    await page.getByText('Push Day', { exact: true }).first().click();
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByLabel('Close').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await section.getByRole('button', { name: 'Start Push Day' }).click();
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await expect(page.getByText('Press')).toBeVisible();
  });

  test('week strip shows readable assignments and today, and a just-today override leaves the template intact', async ({
    page,
  }) => {
    await openRoutineBuilder(page, 'Push Day');
    await page.getByRole('dialog').getByLabel('Close').click();
    await fillRoutineName(page, 'Pull Day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Pull Day')).toBeVisible();

    // Calendar-independent weekday resolution (the strip always renders all
    // seven days; today's own weekday is the one whose assign control opens a
    // scoped sheet). Browser-evaluated (post-W17 correction H08): a Node-side
    // `new Date().getDay()` follows the HOST timezone and can name a different
    // weekday than the app's pinned Asia/Manila day across a date boundary.
    const weekdayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const todayWeekday = await browserLocalWeekday(page);
    const todayName = weekdayNames[todayWeekday];
    const todayWeekdayNum = ((todayWeekday + 6) % 7) + 1; // Monday = 1

    const section = page.locator(ACTIVE_SECTION_SELECTOR);
    // The strip exposes a per-day rest control and an assign control at 44pt.
    const mondayRest = section.getByRole('button', { name: 'Monday rest', exact: true });
    await expect(mondayRest).toBeVisible();
    const box = await mondayRest.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    // Assign TODAY's weekday in the recurring template: the sheet opens on the
    // "Just today" scope, so the "Every <weekday>" chip is chosen explicitly.
    await section.getByRole('button', { name: `${todayName} assign routine` }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: `Every ${todayName}` }).click();
    await sheet.getByText('Push Day', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(section.getByText('Push Day').first()).toBeVisible();

    // A one-day override for today assigns a different routine without
    // touching the recurring row for the SAME weekday.
    await page.getByText('Change today', { exact: true }).click();
    const todaySheet = page.getByRole('dialog');
    await expect(todaySheet.getByText('Choose a one-day override for')).toBeVisible();
    await todaySheet.getByText('Pull Day', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const planRows = await queryRows(
      page,
      `SELECT weekday, plan_kind, routine_id FROM workout_weekly_plan WHERE deleted_at IS NULL ORDER BY weekday`,
    );
    expect(planRows).toHaveLength(1);
    expect(planRows[0]).toMatchObject({ weekday: todayWeekdayNum, plan_kind: 'workout' });
    const planRoutine = await queryRows(
      page,
      `SELECT r.name AS name FROM workout_routines r
         JOIN workout_weekly_plan p ON p.routine_id = r.id
         WHERE p.deleted_at IS NULL`,
    );
    expect(planRoutine).toEqual([{ name: 'Push Day' }]);

    const overrides = await queryRows(
      page,
      `SELECT o.override_kind, r.name AS routine_name
         FROM workout_schedule_overrides o
         LEFT JOIN workout_routines r ON r.id = o.routine_id
         WHERE o.deleted_at IS NULL`,
    );
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({ override_kind: 'workout', routine_name: 'Pull Day' });

    // Today's cell shows the resolved override marked as an override.
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(section.getByText('Pull Day').first()).toBeVisible();
    await expect(section.getByText('Override').first()).toBeVisible();
  });
  test('the live session logs sets through a flat table with previous context', async ({
    page,
  }) => {
    await openRoutineBuilder(page, 'Table Day');
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Bench Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('8');
    await expect(builder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('8', {
      timeout: 10_000,
    });
    await builder.getByText('Start workout', { exact: true }).click();

    // The routine + set progress header leads; the exercise set table follows.
    await expect(page.getByText('Table Day', { exact: true })).toBeVisible();
    await expect(page.getByText('0/1 sets')).toBeVisible();
    await expect(page.getByText('Bench Press')).toBeVisible();
    await expect(page.getByText('Set 1 of 1')).toBeVisible();

    // Enter and complete the set from the table row.
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByRole('button', { name: 'Complete set 1' }).click();

    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Done', { exact: true }).click();

    // SQL oracle: the entered values persisted with the completed set.
    const sets = await queryRows(
      page,
      `SELECT s.set_number, s.weight, s.reps, s.completed
         FROM workout_session_sets s
         JOIN workout_session_exercises e ON e.id = s.session_exercise_id
         ORDER BY s.set_number ASC`,
    );
    expect(sets).toEqual([{ set_number: 1, weight: 80, reps: 8, completed: 1 }]);
  });

  test('an in-session added set persists through the log with correct numbering', async ({
    page,
  }) => {
    await openRoutineBuilder(page, 'Add Set Day');
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Curl');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('8');
    await expect(builder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('8', {
      timeout: 10_000,
    });
    await builder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('button', { name: 'Add set' }).click();
    // The routine now has two actionable sets in this session only.
    await expect(page.getByText('Set 1 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    // The added set inherits the exercise's rest, so rest comes first.
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Skip rest' }).click();
    await expect(page.getByText('Set 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete set 2' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Done', { exact: true }).click();

    const sets = await queryRows(
      page,
      `SELECT s.set_number, s.completed FROM workout_session_sets s
         JOIN workout_session_exercises e ON e.id = s.session_exercise_id
         ORDER BY s.set_number ASC`,
    );
    expect(sets).toEqual([
      { set_number: 1, completed: 1 },
      { set_number: 2, completed: 1 },
    ]);
    // The routine template still prescribes exactly one set.
    const prescribed = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM routine_exercise_sets WHERE deleted_at IS NULL`,
    );
    expect(Number(prescribed[0]?.n)).toBe(1);
  });

  test('leaving a session keeps the resumable draft and logs nothing', async ({ page }) => {
    await openRoutineBuilder(page, 'Draft Day');
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Squat');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByText('Start workout', { exact: true }).click();

    await page.getByRole('textbox', { name: 'Weight' }).fill('60');
    await page.getByText('Start', { exact: true }).first().click();
    // Leaving is confirmed with truthful draft-preserving copy.
    await page.getByRole('button', { name: 'End workout' }).click();
    await expect(page.getByText('Leave workout?')).toBeVisible();
    await page.getByRole('button', { name: 'Leave', exact: true }).click();

    // The landing shows the single dominant Resume naming the routine.
    await expect(page.getByText('Session in progress', { exact: true })).toBeVisible();
    await expect(page.getByText('Draft Day is saved where you left it')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume workout · Draft Day' })).toBeVisible();

    // Nothing was logged, and the entered weight survives the resume.
    const logs = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logs[0]?.n)).toBe(0);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Resume workout · Draft Day' }).click();
    await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('60');
  });

  test('the rest dock stays visible without covering the next set inputs', async ({ page }) => {
    await openRoutineBuilder(page, 'Rest Dock Day');
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('8');
    await builder.getByRole('textbox', { name: 'Rest (seconds, 0 = no rest)' }).fill('90');
    await expect(builder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('8', {
      timeout: 10_000,
    });
    await builder.getByText('+ Add set').first().click();
    await expect(builder.getByText('Set 2')).toBeVisible();
    await builder.getByText('Start workout', { exact: true }).click();

    await page.getByRole('textbox', { name: 'Weight' }).fill('50');
    await page.getByRole('button', { name: 'Complete set 1' }).click();

    // Rest is a docked panel: remaining time, adjust, skip, and next context.
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await expect(page.getByText('Next: Press')).toBeVisible();
    const skipRest = page.getByRole('button', { name: 'Skip rest' });
    await expect(skipRest).toBeVisible();
    // The dock never overlaps the session's scroll content: the set table for
    // the finished set is still laid out in flow above it.
    const tableBox = await page.getByText('Press', { exact: true }).first().boundingBox();
    const dockBox = await page.getByText('Rest', { exact: true }).boundingBox();
    expect(dockBox!.y).toBeGreaterThan(tableBox!.y);
    // Adjusting the dock keeps the rest phase (no accidental completion).
    await page.getByRole('button', { name: 'Add 15 seconds of rest' }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    // Skipping rest advances to set 2; the rest countdown never completes a set.
    await skipRest.click();
    await expect(page.getByText('Set 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete set 2' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    // Exactly one log exists: the rest window produced no duplicate session.
    const logsAfter = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(logsAfter[0]?.n)).toBe(1);
  });
});
