import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { browserLocalTodayKey } from './helpers/browserDate';
import { seedSql } from './helpers/seed';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';

/**
 * W11.5 planning write-failure regressions.
 *
 * These tests close the W11 audit's D10 gap ("browser failed-write
 * injection NOT STAGEABLE") using the same real-SQLite technique the W10
 * Calories suite proved: a `RAISE(ABORT)` trigger installed through the
 * same-origin DB harness rejects a specific write at the SQLite layer,
 * so the browser UI must — and does — distinguish a rejected write from
 * a successful one, and the durable database must agree with what the
 * screen claims.
 *
 * Harness rule (dbHarness.ts): navigating to the DB document destroys the
 * app page's React state. Every test therefore runs UI interactions in
 * app context, uses a DB round-trip only at interaction boundaries
 * (seed trigger → UI failure assertions → row/outbox oracles + DROP
 * TRIGGER → retry), and never invalidates React state mid-interaction.
 */

/**
 * Browser-local `YYYY-MM-DD` "today" — mirrors the app's `toDateKey()`
 * local-calendar contract (`lib/time.ts`). Defined in
 * `./helpers/browserDate` and shared with the deterministic timezone
 * boundary spec (`planning-w1151-timezone.spec.ts`) so the crossover
 * regression exercises the exact helper the fixtures use.
 */

/** Fixed ids keep seed SQL, navigation labels and row oracles aligned. */
const SEED = {
  goal: 'goal_w115_seed',
  project: 'proj_w115_seed',
  todo: 'todo_w115_seed',
  habit: 'habit_w115_seed',
};

async function openPlanning(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(page.getByRole('tab', { name: 'Projects' })).toBeVisible({ timeout: 20_000 });
}

/** Seed a committed plan for today (raw rows carry no outbox intent). */
function seedCommittedPlanSql(today: string): string {
  const now = new Date().toISOString();
  return `INSERT INTO daily_plans
    (id, date_key, intention, top_todo_ids, top_todo_titles, focus_target_minutes,
     notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at)
    VALUES ('dplan_w115_seed', '${today}', 'Seeded intention', '[]', '[]', 0,
            '', '', NULL, 'committed', NULL, '${now}', '${now}', NULL);`;
}

/** Seed an active project with one linked todo, habit and goal. */
function seedLinkedProjectSql(): string {
  const now = new Date().toISOString();
  return `
    INSERT INTO projects (id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at)
    VALUES ('${SEED.project}', 'Lifecycle Project', NULL, '#3b82f6', 'active', NULL, NULL, 1, '${now}', '${now}', NULL);
    INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
    VALUES ('${SEED.todo}', 'Linked task', NULL, 0, '${now}', '${now}', NULL, NULL, 'normal', 1, '${SEED.project}', NULL);
    INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, created_at, updated_at, deleted_at, project_id, goal_id)
    VALUES ('${SEED.habit}', 'Linked habit', 1, NULL, 'anytime', 'check-circle', '#64748b', '${now}', '${now}', NULL, '${SEED.project}', NULL);
    INSERT INTO goals (id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at)
    VALUES ('goal_w115_linked', '${SEED.project}', 'Linked goal', NULL, 'month', NULL, 'active', NULL, 0, '${now}', '${now}', NULL);`;
}

/** Seed one active goal with one linked (pending) todo. */
function seedGoalWithTodoSql(): string {
  const now = new Date().toISOString();
  return `
    INSERT INTO goals (id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at)
    VALUES ('${SEED.goal}', NULL, 'Doomed goal', NULL, 'month', NULL, 'active', NULL, 0, '${now}', '${now}', NULL);
    INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
    VALUES ('${SEED.todo}', 'Task under goal', NULL, 0, '${now}', '${now}', NULL, NULL, 'normal', 1, NULL, '${SEED.goal}');`;
}

async function countRows(page: Page, sql: string): Promise<number> {
  const rows = await queryRows(page, sql);
  return Number(rows[0]?.n ?? 0);
}

test.describe('W11.5 planning write-failure regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  // A — Daily Plan: rejected INSERT on first save.
  test('rejected Daily Plan save surfaces the failure, keeps the draft, and the retry persists exactly once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER w115_reject_plan_insert
         BEFORE INSERT ON daily_plans
         WHEN NEW.intention = 'Blocked intention'
         BEGIN SELECT RAISE(ABORT, 'plan-write-blocked'); END;`,
    );
    await openPlanning(page);
    await page
      .getByPlaceholder('What is the one thing that matters most today?')
      .fill('Blocked intention');
    await page.getByRole('button', { name: 'Save Plan' }).click();

    // UI truth: the failure is visible, nothing claims a commit, and the
    // unsaved edit survives for the retry.
    await expect(page.getByText('Could not save the plan. Please try again.')).toBeVisible();
    await expect(page.getByText('Not yet saved')).toBeVisible();
    await expect(
      page.getByPlaceholder('What is the one thing that matters most today?'),
    ).toHaveValue('Blocked intention');

    // Durable truth after the rejected write: no row, no outbox intent,
    // no backup marker. DROP the trigger in the same round-trip so the
    // retry below can succeed.
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM daily_plans')).toBe(0);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'daily_plans'"),
    ).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_plan_insert');

    await returnToApp(page);
    await openPlanning(page);
    await page
      .getByPlaceholder('What is the one thing that matters most today?')
      .fill('Recovered intention');
    await page.getByRole('button', { name: 'Save Plan' }).click();
    await expect(page.getByRole('dialog').getByText('Committed', { exact: true })).toBeVisible();

    const rows = await queryRows(
      page,
      'SELECT intention, status FROM daily_plans WHERE deleted_at IS NULL',
    );
    expect(rows).toEqual([{ intention: 'Recovered intention', status: 'committed' }]);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'daily_plans'"),
    ).toBe(1);

    // Fresh-mount persistence: a cold reload still shows the committed
    // plan hydrated from SQLite (no in-memory-only success).
    await returnToApp(page);
    await openPlanning(page);
    await expect(page.getByRole('dialog').getByText('Committed', { exact: true })).toBeVisible();
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM daily_plans')).toBe(1);
  });

  // B — Daily Plan: rejected UPDATE on Complete of an existing plan.
  test('rejected Daily Plan completion keeps the committed state, keeps edits, and retries', async ({
    page,
  }) => {
    // W11.5.1: derive the fixture date from the BROWSER context (Asia/Manila)
    // before entering DB context — the app reads its own local-calendar
    // toDateKey(), so a Node-host date would seed the wrong day on a UTC host
    // inside the 16:00–24:00 UTC crossover window.
    const today = await browserLocalTodayKey(page);
    await seedSql(
      page,
      `${seedCommittedPlanSql(today)};
       CREATE TRIGGER w115_reject_plan_complete
         BEFORE UPDATE ON daily_plans
         WHEN NEW.status = 'completed'
         BEGIN SELECT RAISE(ABORT, 'plan-complete-blocked'); END;`,
    );
    await openPlanning(page);
    // Fixture-selection proof: the app opened the seeded plan, i.e. the
    // browser's daily-plan key equals the seeded date_key.
    await expect(page.getByText(`Plan for ${today}`)).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Committed', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'End-of-day reflection' }).click();
    await page.getByRole('textbox', { name: 'Reflection' }).fill('Blocker reflection');
    await page.getByRole('button', { name: 'Energy 4' }).click();
    await page.getByRole('button', { name: 'Complete Daily Plan' }).click();

    // UI truth: completion did not appear to succeed and the unsaved
    // reflection/energy survive for the retry.
    await expect(page.getByText('Could not save the plan. Please try again.')).toBeVisible();
    await expect(page.getByText('Plan completed.')).toHaveCount(0);
    await expect(page.getByRole('dialog').getByText('Committed', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Reflection' })).toHaveValue(
      'Blocker reflection',
    );
    await expect(page.getByText('Energy score (1–5): 4')).toBeVisible();

    // Durable truth: the prior committed state is untouched (no completion
    // timestamp, no persisted reflection, no outbox intent) — and the row
    // the UPDATE targeted is the seeded one for the browser-local date.
    const before = await queryRows(
      page,
      `SELECT status, completed_at, reflection, energy_score FROM daily_plans WHERE date_key = '${today}'`,
    );
    expect(before).toEqual([
      { status: 'committed', completed_at: null, reflection: '', energy_score: null },
    ]);
    // No second plan row exists for any date (W11.5.1: the date_key filter
    // above proves the seeded row is the targeted one; this restores the
    // table-wide exactly-one-row durable-truth property).
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM daily_plans')).toBe(1);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'daily_plans'"),
    ).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_plan_complete');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('button', { name: 'End-of-day reflection' }).click();
    await page.getByRole('textbox', { name: 'Reflection' }).fill('Retry reflection');
    await page.getByRole('button', { name: 'Energy 4' }).click();
    await page.getByRole('button', { name: 'Complete Daily Plan' }).click();
    await expect(page.getByText('Plan completed.')).toBeVisible();

    const after = await queryRows(
      page,
      `SELECT status, completed_at, reflection, energy_score FROM daily_plans WHERE date_key = '${today}'`,
    );
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      status: 'completed',
      completed_at: expect.any(String),
      reflection: 'Retry reflection',
      energy_score: 4,
    });
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM daily_plans')).toBe(1);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'daily_plans'"),
    ).toBe(1);
  });

  // C — Goals: rejected INSERT on create, then rejected soft-delete UPDATE.
  test('rejected goal create keeps the editor and values; the retry writes exactly one goal', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER w115_reject_goal_insert
         BEFORE INSERT ON goals
         WHEN NEW.title = 'Blocked goal'
         BEGIN SELECT RAISE(ABORT, 'goal-write-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Blocked goal');
    await page.getByRole('button', { name: '+10' }).click();
    await page.getByRole('button', { name: 'Create Goal' }).click();

    // UI truth: editor stays open, values intact, failure visible.
    await expect(page.getByText('Could not save the goal. Please try again.')).toBeVisible();
    await expect(page.getByText('New Goal')).toBeVisible();
    await expect(page.getByPlaceholder('Goal title')).toHaveValue('Blocked goal');
    await expect(page.getByText('Progress: 10%')).toBeVisible();

    // Durable truth: no phantom goal, no outbox intent.
    expect(await countRows(page, 'SELECT COUNT(*) AS n FROM goals')).toBe(0);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'goals'"),
    ).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_goal_insert');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Recovered goal');
    await page.getByRole('button', { name: '+10' }).click();
    await page.getByRole('button', { name: 'Create Goal' }).click();

    await expect(
      page.getByRole('button', { name: /^Recovered goal, Active, 10 percent/ }),
    ).toBeVisible();
    const rows = await queryRows(
      page,
      'SELECT title, status, progress_percent FROM goals WHERE deleted_at IS NULL',
    );
    expect(rows).toEqual([{ title: 'Recovered goal', status: 'active', progress_percent: 10 }]);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'goals'"),
    ).toBe(1);
  });

  test('rejected goal delete keeps the goal and its links; the retry reconciles once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedGoalWithTodoSql()};
       CREATE TRIGGER w115_reject_goal_soft_delete
         BEFORE UPDATE ON goals
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'goal-delete-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Doomed goal, Active, 0 percent', exact: true }).click();
    await expect(page.getByText('Goal', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Goal' }).click();

    // UI truth: the detail view did not close as though deletion worked.
    await expect(page.getByText('Could not delete the goal. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to goals' })).toBeVisible();

    // Durable truth: no tombstone, no partial child unlinking, no outbox.
    const before = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM goals WHERE id = '${SEED.goal}' AND deleted_at IS NULL) AS goal_live,
              (SELECT COUNT(*) FROM todos WHERE id = '${SEED.todo}' AND goal_id = '${SEED.goal}') AS linked_todos,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity IN ('goals','todos')) AS outbox_rows`,
    );
    expect(Number(before[0]?.goal_live)).toBe(1);
    expect(Number(before[0]?.linked_todos)).toBe(1);
    expect(Number(before[0]?.outbox_rows)).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_goal_soft_delete');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Doomed goal, Active, 0 percent', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Goal' }).click();
    await expect(page.getByRole('button', { name: 'Create goal' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Doomed goal/ })).toHaveCount(0);

    // Durable truth after the successful retry: tombstone + child
    // reconciliation + coherent outbox intents.
    const after = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM goals WHERE id = '${SEED.goal}' AND deleted_at IS NOT NULL) AS tombstoned,
              (SELECT COUNT(*) FROM todos WHERE id = '${SEED.todo}' AND goal_id IS NULL) AS unlinked_todos,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'goals' AND operation = 'delete') AS goal_intents,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos' AND operation = 'update') AS todo_intents`,
    );
    expect(Number(after[0]?.tombstoned)).toBe(1);
    expect(Number(after[0]?.unlinked_todos)).toBe(1);
    expect(Number(after[0]?.goal_intents)).toBe(1);
    expect(Number(after[0]?.todo_intents)).toBe(1);
  });

  // D — Projects: rejected UPDATE during a lifecycle transition.
  test('rejected project completion shows no false status, keeps durable state, and retries', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedLinkedProjectSql()};
       CREATE TRIGGER w115_reject_project_complete
         BEFORE UPDATE ON projects
         WHEN NEW.status = 'completed'
         BEGIN SELECT RAISE(ABORT, 'project-complete-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await page
      .getByRole('button', { name: 'Lifecycle Project, Active, 0 percent progress' })
      .click();
    await expect(page.getByText('Project', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete project' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // UI truth: no false committed status; the confirmation closed and
    // the failure is actionable.
    await expect(
      page.getByText('Could not update the project status. Please try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(
      page.getByRole('button', { name: 'Lifecycle Project, Active, 0 percent progress' }),
    ).toBeVisible();

    // Durable truth: status/timestamp unchanged, links intact, no outbox.
    const before = await queryRows(
      page,
      `SELECT (SELECT status FROM projects WHERE id = '${SEED.project}') AS status,
              (SELECT completed_at FROM projects WHERE id = '${SEED.project}') AS completed_at,
              (SELECT COUNT(*) FROM todos WHERE project_id = '${SEED.project}') AS linked_todos,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'projects') AS outbox_rows`,
    );
    expect(before[0]).toMatchObject({
      status: 'active',
      completed_at: null,
      linked_todos: 1,
      outbox_rows: 0,
    });
    await runSql(page, 'DROP TRIGGER w115_reject_project_complete');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await page
      .getByRole('button', { name: 'Lifecycle Project, Active, 0 percent progress' })
      .click();
    await page.getByRole('button', { name: 'Complete project' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('button', { name: 'Back to projects' }).click();

    await expect(
      page.getByRole('button', { name: 'Lifecycle Project, Completed, 0 percent progress' }),
    ).toBeVisible();
    const after = await queryRows(
      page,
      `SELECT (SELECT status FROM projects WHERE id = '${SEED.project}') AS status,
              (SELECT completed_at FROM projects WHERE id = '${SEED.project}') AS completed_at,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'projects' AND operation = 'update') AS intents`,
    );
    expect(after[0]?.status).toBe('completed');
    expect(typeof after[0]?.completed_at).toBe('string');
    expect(Number(after[0]?.intents)).toBe(1);
  });

  // F — Goals: rejected UPDATE on rename (the updateGoal path incl. progress).
  test('rejected goal rename keeps the editor and prior values; the retry updates once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedGoalWithTodoSql()};
       CREATE TRIGGER w115_reject_goal_rename
         BEFORE UPDATE ON goals
         WHEN NEW.title = 'Renamed goal'
         BEGIN SELECT RAISE(ABORT, 'goal-rename-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Doomed goal, Active, 0 percent', exact: true }).click();
    await page.getByPlaceholder('Goal title').fill('Renamed goal');
    await page.getByRole('button', { name: '+10' }).click();
    await page.getByRole('button', { name: 'Save Goal' }).click();

    // UI truth: the editor did not navigate away and both edits survive.
    await expect(page.getByText('Could not save the goal. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to goals' })).toBeVisible();
    await expect(page.getByPlaceholder('Goal title')).toHaveValue('Renamed goal');
    await expect(page.getByText('Progress: 10%')).toBeVisible();

    // Durable truth: the prior title and progress are untouched.
    const before = await queryRows(
      page,
      `SELECT title, progress_percent FROM goals WHERE id = '${SEED.goal}'`,
    );
    expect(before).toEqual([{ title: 'Doomed goal', progress_percent: 0 }]);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'goals'"),
    ).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_goal_rename');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Doomed goal, Active, 0 percent', exact: true }).click();
    await page.getByPlaceholder('Goal title').fill('Renamed goal');
    await page.getByRole('button', { name: '+10' }).click();
    await page.getByRole('button', { name: 'Save Goal' }).click();

    // Explicit bound sized to the meaning of this wait (WM2.4/CG-9): the
    // renamed row appears only after transaction commit → onBack remount →
    // Promise.all list reload → render — a load-sensitive real-I/O chain. The
    // 5s default budget produced a recovered first-attempt failure on hosted
    // runners (run 39814238152); classifying that as product flake would hide
    // a test-budget defect. The assertions themselves are unchanged.
    await expect(
      page.getByRole('button', { name: /^Renamed goal, Active, 10 percent/ }),
    ).toBeVisible({ timeout: 20_000 });
    const after = await queryRows(
      page,
      `SELECT title, progress_percent FROM goals WHERE id = '${SEED.goal}'`,
    );
    expect(after).toEqual([{ title: 'Renamed goal', progress_percent: 10 }]);
    expect(
      await countRows(page, "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'goals'"),
    ).toBe(1);
  });

  // G — outbox-only failure: the entity row and its backup intent land in ONE
  // transaction, so rejecting the intent rolls the row back with it.
  test('a rejected backup intent rolls the goal row back with it', async ({ page }) => {
    await seedSql(
      page,
      `CREATE TRIGGER w115_reject_goal_outbox
         BEFORE INSERT ON sync_outbox
         WHEN NEW.entity = 'goals'
         BEGIN SELECT RAISE(ABORT, 'goal-outbox-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Outbox-blocked goal');
    await page.getByRole('button', { name: 'Create Goal' }).click();

    // UI truth: the failure is visible and the editor stays open.
    await expect(page.getByText('Could not save the goal. Please try again.')).toBeVisible();
    await expect(page.getByText('New Goal')).toBeVisible();

    // Durable truth: neither the row nor the intent survived — the pair is
    // atomic, so no orphan row can exist without its backup intent.
    const before = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM goals WHERE title = 'Outbox-blocked goal') AS goal_rows,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'goals') AS outbox_rows`,
    );
    expect(Number(before[0]?.goal_rows)).toBe(0);
    expect(Number(before[0]?.outbox_rows)).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_goal_outbox');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Outbox-blocked goal');
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(
      page.getByRole('button', { name: /^Outbox-blocked goal, Active, 0 percent/ }),
    ).toBeVisible();

    const after = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM goals WHERE title = 'Outbox-blocked goal') AS goal_rows,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'goals') AS outbox_rows`,
    );
    expect(Number(after[0]?.goal_rows)).toBe(1);
    expect(Number(after[0]?.outbox_rows)).toBe(1);
  });

  // E — Projects: rejected soft-delete UPDATE (tombstone + H9 reconciliation).
  test('rejected project delete keeps the project and children; the retry reconciles once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedLinkedProjectSql()};
       CREATE TRIGGER w115_reject_project_soft_delete
         BEFORE UPDATE ON projects
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'project-delete-blocked'); END;`,
    );
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await page
      .getByRole('button', { name: 'Lifecycle Project, Active, 0 percent progress' })
      .click();
    await page.getByRole('button', { name: 'Delete Project' }).click();

    // UI truth: the detail view did not close as though deletion worked.
    await expect(page.getByText('Could not delete the project. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to projects' })).toBeVisible();

    // Durable truth: no tombstone, no partial child unlinking, no outbox.
    const before = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM projects WHERE id = '${SEED.project}' AND deleted_at IS NULL) AS live,
              (SELECT COUNT(*) FROM todos WHERE id = '${SEED.todo}' AND project_id = '${SEED.project}') AS linked_todos,
              (SELECT COUNT(*) FROM habits WHERE id = '${SEED.habit}' AND project_id = '${SEED.project}') AS linked_habits,
              (SELECT COUNT(*) FROM goals WHERE project_id = '${SEED.project}') AS linked_goals,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity IN ('projects','todos','habits','goals')) AS outbox_rows`,
    );
    expect(Number(before[0]?.live)).toBe(1);
    expect(Number(before[0]?.linked_todos)).toBe(1);
    expect(Number(before[0]?.linked_habits)).toBe(1);
    expect(Number(before[0]?.linked_goals)).toBe(1);
    expect(Number(before[0]?.outbox_rows)).toBe(0);
    await runSql(page, 'DROP TRIGGER w115_reject_project_soft_delete');

    await returnToApp(page);
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await page
      .getByRole('button', { name: 'Lifecycle Project, Active, 0 percent progress' })
      .click();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await expect(page.getByText('No projects yet')).toBeVisible();

    // Durable truth after the successful retry: tombstone + H9 child
    // reconciliation + coherent outbox intents.
    const after = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM projects WHERE id = '${SEED.project}' AND deleted_at IS NOT NULL) AS tombstoned,
              (SELECT COUNT(*) FROM todos WHERE id = '${SEED.todo}' AND project_id IS NULL) AS unlinked_todos,
              (SELECT COUNT(*) FROM habits WHERE id = '${SEED.habit}' AND project_id IS NULL) AS unlinked_habits,
              (SELECT COUNT(*) FROM goals WHERE project_id IS NULL AND id = 'goal_w115_linked') AS unlinked_goals,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'projects' AND operation = 'delete') AS project_intents,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'goals' AND operation = 'update') AS goal_intents,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos' AND operation = 'update') AS todo_intents,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'habits' AND operation = 'update') AS habit_intents`,
    );
    expect(Number(after[0]?.tombstoned)).toBe(1);
    expect(Number(after[0]?.unlinked_todos)).toBe(1);
    expect(Number(after[0]?.unlinked_habits)).toBe(1);
    expect(Number(after[0]?.unlinked_goals)).toBe(1);
    // Tombstone + H9 child reconciliation each enqueue exactly once, in the
    // same transaction (F1): four coherent intents, no duplicates.
    expect(Number(after[0]?.project_intents)).toBe(1);
    expect(Number(after[0]?.goal_intents)).toBe(1);
    expect(Number(after[0]?.todo_intents)).toBe(1);
    expect(Number(after[0]?.habit_intents)).toBe(1);
  });
});
