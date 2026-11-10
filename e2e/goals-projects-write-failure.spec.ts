import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, planningHubTab } from './helpers/navigation';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * Tier-2 silent-write honesty: Projects and Goals link/unlink writes, and the
 * Projects manual-order write.
 *
 * The audited defect class (WINDOWS-FIRST successor report §10, row "Tier-2
 * silent-no-op UI writes"): a rejected LOCAL write leaves the database and the
 * screen unchanged, so the tap looks like it silently did nothing. The three
 * sibling specs merged for To Do, Habits and Focus pin the same contract; this
 * spec pins the Projects/Goals half of the same row:
 *
 *   - project association links/unlinks (todo, habit, goal)
 *   - goal association links/unlinks (next-action cue, linked-tasks list)
 *   - project manual reorder
 *
 * Contract per site:
 *  a. the failure is VISIBLE and announced — an inline `accessibilityRole="alert"`
 *     rendered next to the action that failed (exactly one; never a duplicate
 *     report), showing the site's curated copy, not raw engine noise;
 *  b. the database, the sync outbox and the rendered state all stay at the
 *     PRE-TAP value (no optimistic link/unlink, no order change, no intent);
 *  c. once the injected failure is removed, retrying the same action from the
 *     UI commits exactly once.
 *
 * Failure injection uses the established real-SQLite technique the W7/W10/W11
 * and Tier-2 suites proved: a `RAISE(ABORT)` trigger installed through the
 * same-origin DB harness (`e2e/helpers/dbHarness.ts`). `e2e/helpers/failure.ts`
 * injects at the REMOTE boundary only (its routes match `*.supabase.co`), which
 * cannot fail a local OPFS write — the hermetic `dist/` export bundles no
 * Supabase host at all — so it is deliberately not used here (same reasoning,
 * verbatim, as `e2e/todos-write-failure.spec.ts`).
 *
 * Harness rule: navigating to the DB document destroys the app page's React
 * state. Every test installs the trigger BEFORE the surface is opened and
 * queries/drops only at an interaction boundary.
 */

const LINK_FAILURE_COPY = 'Could not update that link. Please try again.';
const ORDER_FAILURE_COPY = 'Could not save the new order. Please try again.';

/** Fixed ids keep seed SQL, navigation labels and row oracles aligned. */
const SEED = {
  project: 'proj_wfail_seed',
  projectAlpha: 'proj_wfail_alpha',
  projectBeta: 'proj_wfail_beta',
  goal: 'goal_wfail_seed',
  goalOpen: 'goal_wfail_open',
  todoOpen: 'todo_wfail_open',
  todoLinked: 'todo_wfail_linked',
  habit: 'habit_wfail_seed',
} as const;

const NOW = '2026-01-01T00:00:00.000Z';

/** The Planning Hub sheet ("Plan"), which hosts the Projects and Goals views. */
function hub(page: Page) {
  return page.getByRole('dialog', { name: 'Plan', exact: true });
}

function seedProjectSql(id: string, name: string, sortOrder: number): string {
  return `INSERT INTO projects (id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at)
    VALUES ('${id}', '${name}', NULL, '#3b82f6', 'active', NULL, NULL, ${sortOrder}, '${NOW}', '${NOW}', NULL);`;
}

function seedTodoSql(input: {
  id: string;
  title: string;
  projectId?: string | null;
  goalId?: string | null;
}): string {
  const project = input.projectId ? `'${input.projectId}'` : 'NULL';
  const goal = input.goalId ? `'${input.goalId}'` : 'NULL';
  return `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
    VALUES ('${input.id}', '${input.title}', NULL, 0, '${NOW}', '${NOW}', NULL, NULL, 'normal', 1, ${project}, ${goal});`;
}

function seedHabitSql(id: string, name: string): string {
  return `INSERT INTO habits
      (id, name, target_per_day, reminder_time, category, icon, color, status,
       rule_history, lifecycle_history, created_at, updated_at, deleted_at, project_id, goal_id)
    VALUES ('${id}', '${name}', 1, NULL, 'anytime', 'check-circle', '#0ea5e9', 'active',
            '[]', '[]', '${NOW}', '${NOW}', NULL, NULL, NULL);`;
}

function seedGoalSql(input: { id: string; title: string; projectId?: string | null }): string {
  const project = input.projectId ? `'${input.projectId}'` : 'NULL';
  return `INSERT INTO goals (id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at)
    VALUES ('${input.id}', ${project}, '${input.title}', NULL, 'month', NULL, 'active', NULL, 0, '${NOW}', '${NOW}', NULL);`;
}

/** Open the Planning Hub from Overview (the product entry: "Plan today"). */
async function openHub(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
}

async function openHubView(page: Page, view: 'Projects' | 'Goals'): Promise<void> {
  await openHub(page);
  await planningHubTab(page, view).click();
  const create = view === 'Projects' ? 'Create project' : 'Create goal';
  await expect(hub(page).getByRole('button', { name: create })).toBeVisible({ timeout: 20_000 });
}

async function openProjectDetail(page: Page, name: string): Promise<void> {
  await hub(page)
    .getByRole('button', { name: `${name}, Active, 0 percent progress`, exact: true })
    .click();
  await expect(hub(page).getByRole('button', { name: 'Back to projects' })).toBeVisible({
    timeout: 20_000,
  });
}

async function openGoalDetail(page: Page, title: string, percent: number): Promise<void> {
  await hub(page)
    .getByRole('button', { name: `${title}, Active, ${percent} percent`, exact: true })
    .click();
  await expect(hub(page).getByRole('button', { name: 'Back to goals' })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Assert the failure surface for one site: one announced alert (never a
 * duplicate report), carrying the site's curated copy.
 */
async function expectFailure(page: Page, copy = LINK_FAILURE_COPY): Promise<void> {
  const alerts = hub(page).getByRole('alert');
  await expect(alerts).toHaveCount(1);
  await expect(alerts).toHaveText(copy);
}

/** Enable the project detail's habits/goals association section. */
async function expandProjectAssociations(page: Page): Promise<void> {
  await hub(page).getByRole('button', { name: 'Manage project associations' }).click();
}

async function expectNoLinkIntents(
  page: Page,
  entity: 'todos' | 'habits' | 'goals',
): Promise<number> {
  const rows = await queryRows(
    page,
    `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = '${entity}'`,
  );
  return Number(rows[0]?.n ?? -1);
}

test.describe('Projects and Goals write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('project todo link: rejected link is announced, leaves the todo unlinked, and the retry links once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedProjectSql(SEED.project, 'Failures Project', 1)}
       ${seedTodoSql({ id: SEED.todoOpen, title: 'Loose task' })}
       CREATE TRIGGER pg_wfail_todo_link
         BEFORE UPDATE ON todos
         WHEN OLD.project_id IS NULL AND NEW.project_id IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'project-link-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');

    const candidate = hub(page).getByRole('button', { name: '• Loose task', exact: true });
    await expect(candidate).toBeVisible();
    await candidate.click();

    // (a) one visible, announced failure; (b) the candidate is still a candidate.
    await expectFailure(page);
    await expect(candidate).toBeVisible();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose task' })).toHaveCount(0);
    const afterFailure = await queryRows(
      page,
      `SELECT (SELECT project_id FROM todos WHERE id = '${SEED.todoOpen}') AS project_id,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos') AS intents`,
    );
    expect(afterFailure[0]?.project_id).toBeNull();
    expect(Number(afterFailure[0]?.intents)).toBe(0);

    // (c) retry after the failure is cleared links exactly once.
    await runSql(page, 'DROP TRIGGER pg_wfail_todo_link;');
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await hub(page).getByRole('button', { name: '• Loose task', exact: true }).click();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose task' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT project_id, goal_id FROM todos WHERE id = '${SEED.todoOpen}'`,
    );
    expect(afterRetry).toEqual([{ project_id: SEED.project, goal_id: null }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'todos'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('project todo unlink: rejected unlink is announced, keeps the todo linked, and the retry unlinks once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedProjectSql(SEED.project, 'Failures Project', 1)}
       ${seedTodoSql({ id: SEED.todoLinked, title: 'Attached task', projectId: SEED.project })}
       CREATE TRIGGER pg_wfail_todo_unlink
         BEFORE UPDATE ON todos
         WHEN OLD.project_id IS NOT NULL AND NEW.project_id IS NULL
         BEGIN SELECT RAISE(ABORT, 'project-unlink-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');

    const unlink = hub(page).getByRole('button', { name: 'Unlink Attached task' });
    await expect(unlink).toBeVisible();
    await unlink.click();

    await expectFailure(page);
    await expect(unlink).toBeVisible();
    const afterFailure = await queryRows(
      page,
      `SELECT (SELECT project_id FROM todos WHERE id = '${SEED.todoLinked}') AS project_id,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos') AS intents`,
    );
    expect(afterFailure[0]?.project_id).toBe(SEED.project);
    expect(Number(afterFailure[0]?.intents)).toBe(0);

    await runSql(page, 'DROP TRIGGER pg_wfail_todo_unlink;');
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await hub(page).getByRole('button', { name: 'Unlink Attached task' }).click();
    // The unlinked todo drops back into the candidate list.
    await expect(
      hub(page).getByRole('button', { name: '• Attached task', exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT project_id FROM todos WHERE id = '${SEED.todoLinked}'`,
    );
    expect(afterRetry).toEqual([{ project_id: null }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'todos'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('project habit link: rejected link is announced, leaves the habit unlinked, and the retry links once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedProjectSql(SEED.project, 'Failures Project', 1)}
       ${seedHabitSql(SEED.habit, 'Chore habit')}
       CREATE TRIGGER pg_wfail_habit_link
         BEFORE UPDATE ON habits
         WHEN OLD.project_id IS NULL AND NEW.project_id IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'habit-link-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await expandProjectAssociations(page);

    const candidate = hub(page).getByRole('button', { name: '• Chore habit', exact: true });
    await expect(candidate).toBeVisible();
    await candidate.click();

    await expectFailure(page);
    await expect(candidate).toBeVisible();
    await expect(hub(page).getByRole('button', { name: 'Unlink Chore habit' })).toHaveCount(0);
    expect(await expectNoLinkIntents(page, 'habits')).toBe(0);
    const afterFailure = await queryRows(
      page,
      `SELECT project_id FROM habits WHERE id = '${SEED.habit}'`,
    );
    expect(afterFailure).toEqual([{ project_id: null }]);

    await runSql(page, 'DROP TRIGGER pg_wfail_habit_link;');
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await expandProjectAssociations(page);
    await hub(page).getByRole('button', { name: '• Chore habit', exact: true }).click();
    await expect(hub(page).getByRole('button', { name: 'Unlink Chore habit' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT project_id, goal_id FROM habits WHERE id = '${SEED.habit}'`,
    );
    expect(afterRetry).toEqual([{ project_id: SEED.project, goal_id: null }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'habits'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('project goal link: rejected link is announced, leaves the goal unlinked, and the retry links once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedProjectSql(SEED.project, 'Failures Project', 1)}
       ${seedGoalSql({ id: SEED.goalOpen, title: 'Loose goal' })}
       CREATE TRIGGER pg_wfail_goal_link
         BEFORE UPDATE ON goals
         WHEN OLD.project_id IS NULL AND NEW.project_id IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'goal-link-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await expandProjectAssociations(page);

    const candidate = hub(page).getByRole('button', { name: '• Loose goal', exact: true });
    await expect(candidate).toBeVisible();
    await candidate.click();

    await expectFailure(page);
    await expect(candidate).toBeVisible();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose goal' })).toHaveCount(0);
    expect(await expectNoLinkIntents(page, 'goals')).toBe(0);
    const afterFailure = await queryRows(
      page,
      `SELECT project_id FROM goals WHERE id = '${SEED.goalOpen}'`,
    );
    expect(afterFailure).toEqual([{ project_id: null }]);

    await runSql(page, 'DROP TRIGGER pg_wfail_goal_link;');
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await openProjectDetail(page, 'Failures Project');
    await expandProjectAssociations(page);
    await hub(page).getByRole('button', { name: '• Loose goal', exact: true }).click();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose goal' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT project_id FROM goals WHERE id = '${SEED.goalOpen}'`,
    );
    expect(afterRetry).toEqual([{ project_id: SEED.project }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'goals'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('project manual order: a rejected move is announced, keeps the stored order, and the retry reorders once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedProjectSql(SEED.projectAlpha, 'Alpha', 1)}
       ${seedProjectSql(SEED.projectBeta, 'Beta', 2)}
       CREATE TRIGGER pg_wfail_project_reorder
         BEFORE UPDATE ON projects
         WHEN NEW.sort_order IS NOT OLD.sort_order
         BEGIN SELECT RAISE(ABORT, 'reorder-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Projects');

    const rows = hub(page).getByRole('button', { name: /percent progress/ });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveText(/Alpha/);
    await hub(page).getByRole('button', { name: 'Move Beta up' }).click();

    // (a) the rejected move is visible, (b) the rendered order is the stored one.
    await expectFailure(page, ORDER_FAILURE_COPY);
    await expect(rows.first()).toHaveText(/Alpha/);
    await expect(rows.last()).toHaveText(/Beta/);
    const afterFailure = await queryRows(
      page,
      `SELECT name, sort_order FROM projects WHERE deleted_at IS NULL ORDER BY sort_order ASC`,
    );
    expect(afterFailure).toEqual([
      { name: 'Alpha', sort_order: 1 },
      { name: 'Beta', sort_order: 2 },
    ]);
    expect(
      Number(
        (
          await queryRows(page, `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'projects'`)
        )[0]?.n ?? -1,
      ),
    ).toBe(0);

    // (c) retry once the failure is cleared commits the swap exactly once.
    await runSql(page, 'DROP TRIGGER pg_wfail_project_reorder;');
    await returnToApp(page);
    await openHubView(page, 'Projects');
    await hub(page).getByRole('button', { name: 'Move Beta up' }).click();
    await expect(rows.first()).toHaveText(/Beta/, { timeout: 20_000 });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT name, sort_order FROM projects WHERE deleted_at IS NULL ORDER BY sort_order ASC`,
    );
    expect(afterRetry).toEqual([
      { name: 'Beta', sort_order: 1 },
      { name: 'Alpha', sort_order: 2 },
    ]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'projects'`),
    ).toEqual([{ operation: 'update' }, { operation: 'update' }]);
    await returnToApp(page);
  });

  test('goal next-action link: rejected link is announced, leaves the task unlinked, and the retry links once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedGoalSql({ id: SEED.goal, title: 'Focus goal' })}
       ${seedTodoSql({ id: SEED.todoOpen, title: 'Loose task' })}
       CREATE TRIGGER goal_wfail_cue_link
         BEFORE UPDATE ON todos
         WHEN OLD.goal_id IS NULL AND NEW.goal_id IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'goal-link-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);

    const cue = hub(page).getByRole('button', {
      name: 'Link task Loose task to this goal',
      exact: true,
    });
    await expect(hub(page).getByText('No next action linked yet', { exact: true })).toBeVisible();
    await cue.click();

    // (a) the failure is announced; (b) the cue (and its task) survive untouched.
    await expectFailure(page);
    await expect(cue).toBeVisible();
    const afterFailure = await queryRows(
      page,
      `SELECT (SELECT goal_id FROM todos WHERE id = '${SEED.todoOpen}') AS goal_id,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos') AS intents`,
    );
    expect(afterFailure[0]?.goal_id).toBeNull();
    expect(Number(afterFailure[0]?.intents)).toBe(0);

    // (c) retry links once and the cue disappears with a real next action.
    await runSql(page, 'DROP TRIGGER goal_wfail_cue_link;');
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);
    await hub(page)
      .getByRole('button', { name: 'Link task Loose task to this goal', exact: true })
      .click();
    await expect(hub(page).getByText('No next action linked yet', { exact: true })).toHaveCount(0);
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT goal_id FROM todos WHERE id = '${SEED.todoOpen}'`,
    );
    expect(afterRetry).toEqual([{ goal_id: SEED.goal }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'todos'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('goal linked-task candidate: rejected link is announced, leaves the task unlinked, and the retry links once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedGoalSql({ id: SEED.goal, title: 'Focus goal' })}
       ${seedTodoSql({ id: SEED.todoLinked, title: 'Attached task', goalId: SEED.goal })}
       ${seedTodoSql({ id: SEED.todoOpen, title: 'Loose task' })}
       CREATE TRIGGER goal_wfail_candidate_link
         BEFORE UPDATE ON todos
         WHEN OLD.goal_id IS NULL AND NEW.goal_id IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'goal-link-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);
    await hub(page).getByRole('button', { name: 'Manage linked goal tasks' }).click();

    const candidate = hub(page).getByRole('button', { name: /Loose task/ });
    await expect(candidate).toBeVisible();
    await candidate.click();

    await expectFailure(page);
    await expect(candidate).toBeVisible();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose task' })).toHaveCount(0);
    const afterFailure = await queryRows(
      page,
      `SELECT (SELECT goal_id FROM todos WHERE id = '${SEED.todoOpen}') AS goal_id,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos') AS intents`,
    );
    expect(afterFailure[0]?.goal_id).toBeNull();
    expect(Number(afterFailure[0]?.intents)).toBe(0);

    await runSql(page, 'DROP TRIGGER goal_wfail_candidate_link;');
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);
    await hub(page).getByRole('button', { name: 'Manage linked goal tasks' }).click();
    await hub(page)
      .getByRole('button', { name: /Loose task/ })
      .click();
    await expect(hub(page).getByRole('button', { name: 'Unlink Loose task' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT goal_id FROM todos WHERE id = '${SEED.todoOpen}'`,
    );
    expect(afterRetry).toEqual([{ goal_id: SEED.goal }]);
    // Only the freshly linked row minted a backup intent (the seeded rows are
    // historical, exactly like the raw-SQL fixtures elsewhere).
    expect(
      await queryRows(page, `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'todos'`),
    ).toEqual([{ n: 1 }]);
    await returnToApp(page);
  });

  test('goal linked-task unlink: rejected unlink is announced, keeps the task linked, and the retry unlinks once', async ({
    page,
  }) => {
    await seedSql(
      page,
      `${seedGoalSql({ id: SEED.goal, title: 'Focus goal' })}
       ${seedTodoSql({ id: SEED.todoLinked, title: 'Attached task', goalId: SEED.goal })}
       CREATE TRIGGER goal_wfail_unlink
         BEFORE UPDATE ON todos
         WHEN OLD.goal_id IS NOT NULL AND NEW.goal_id IS NULL
         BEGIN SELECT RAISE(ABORT, 'goal-unlink-blocked'); END;`,
    );
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);
    await hub(page).getByRole('button', { name: 'Manage linked goal tasks' }).click();

    const unlink = hub(page).getByRole('button', { name: 'Unlink Attached task' });
    await expect(unlink).toBeVisible();
    await unlink.click();

    await expectFailure(page);
    await expect(unlink).toBeVisible();
    const afterFailure = await queryRows(
      page,
      `SELECT (SELECT goal_id FROM todos WHERE id = '${SEED.todoLinked}') AS goal_id,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'todos') AS intents`,
    );
    expect(afterFailure[0]?.goal_id).toBe(SEED.goal);
    expect(Number(afterFailure[0]?.intents)).toBe(0);

    await runSql(page, 'DROP TRIGGER goal_wfail_unlink;');
    await returnToApp(page);
    await openHubView(page, 'Goals');
    await openGoalDetail(page, 'Focus goal', 0);
    await hub(page).getByRole('button', { name: 'Manage linked goal tasks' }).click();
    await hub(page).getByRole('button', { name: 'Unlink Attached task' }).click();
    // The linked row's own Unlink control disappearing is the settled signal
    // (the write resolved AND the link refresh re-rendered); waiting on the
    // task title instead would match the still-linked row text immediately and
    // race the DB round trip below.
    await expect(hub(page).getByRole('button', { name: 'Unlink Attached task' })).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(hub(page).getByRole('alert')).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT goal_id FROM todos WHERE id = '${SEED.todoLinked}'`,
    );
    expect(afterRetry).toEqual([{ goal_id: null }]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'todos'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });
});
