import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, planningHubTab } from './helpers/navigation';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { auditPage } from './helpers/a11yAudit';

/**
 * Projects & Goals user lifecycles, end to end.
 *
 * The existing planning specs pin presentation (W11 disclosures), the W12
 * progress/timeline surfaces, the W11.5 rejected-write paths, and the status-write
 * vs. back-navigation race. What none of them drive is the ordinary user lifecycle:
 * validating a create, editing, walking every status transition and reversing it,
 * associating real work, deleting the parent without taking the child with it,
 * and finding all of it again after a cold reload — each step asserted on the
 * screen *and* on the persisted SQLite rows through the same DB harness the rest
 * of the suite uses.
 *
 * Product contract this file pins (verified against the shipped UI):
 * - Project/Goal delete is IMMEDIATE: the detail view owns the tombstone write and
 *   neither surface shows a confirmation dialog. The journeys therefore assert
 *   the real delete (and that a rejected write keeps the row) instead of inventing
 *   a confirm step the product does not have.
 * - Status is reversible only through the editor's Status chips + Save: the detail
 *   lifecycle row offers forward moves only (Complete/Pause/Archive) and disappears
 *   once the row is archived. Both reversal paths are exercised that way.
 *
 * Determinism rules: no fixed sleeps — every wait is a `expect` on rendered state
 * or a row oracle, and all UI steps finish before a row oracle (the DB harness
 * replaces the app page).
 */

/** The Planning Hub sheet ("Plan"), which hosts the Projects and Goals views. */
function hub(page: Page) {
  return page.getByRole('dialog', { name: 'Plan', exact: true });
}

/** Projects/Goals list rows and their accessible names, e.g. `Name, Status, N percent`. */
function projectRow(page: Page, name: string, status: string, percent: number) {
  return hub(page).getByRole('button', {
    name: `${name}, ${status}, ${percent} percent progress`,
    exact: true,
  });
}

function goalRow(page: Page, name: string, status: string, percent: number) {
  return hub(page).getByRole('button', {
    name: `${name}, ${status}, ${percent} percent`,
    exact: true,
  });
}

/** Open the hub from Overview (the product entry: "Plan today"). */
async function openHub(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
}

/** Open the hub (when closed) and land on one of its list views. */
async function openHubView(page: Page, view: 'Projects' | 'Goals'): Promise<void> {
  if ((await hub(page).count()) === 0) await openHub(page);
  await planningHubTab(page, view).click();
  const create = view === 'Projects' ? 'Create project' : 'Create goal';
  await expect(hub(page).getByRole('button', { name: create })).toBeVisible({ timeout: 20_000 });
}

async function closeHub(page: Page): Promise<void> {
  await hub(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(hub(page)).toHaveCount(0);
}

/** Create a project through the detail editor (the only create path). */
async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('New Project', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Project name').fill(name);
  await page.getByRole('button', { name: 'Create Project' }).click();
}

/** Create a goal through the detail editor, optionally pressing +10 first. */
async function createGoal(page: Page, title: string, plusTenPresses = 0): Promise<void> {
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByText('New Goal', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Goal title').fill(title);
  for (let press = 0; press < plusTenPresses; press += 1) {
    await page.getByRole('button', { name: '+10', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Create Goal' }).click();
}

/**
 * Change status through the editor's Status chips and save. The options
 * disclosure is named after its view (`Project more options` / `Goal more
 * options`) and starts collapsed, so it is opened first (idempotent: it is only
 * pressed while `aria-expanded` is false).
 */
async function setStatusViaEditor(
  page: Page,
  status: 'Active' | 'Paused' | 'Completed' | 'Archived',
  saveLabel: 'Save Project' | 'Save Goal',
): Promise<void> {
  const more = page.getByRole('button', {
    name: saveLabel === 'Save Project' ? 'Project more options' : 'Goal more options',
    exact: true,
  });
  if ((await more.getAttribute('aria-expanded')) === 'false') await more.click();
  await page.getByRole('button', { name: status, exact: true }).click();
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
}

/** Run one forward lifecycle transition through its confirmation panel. */
async function confirmLifecycleAction(
  page: Page,
  action: 'Complete project' | 'Pause project' | 'Archive project',
): Promise<void> {
  await page.getByRole('button', { name: action, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  // The panel collapses only in the handler's `finally`, i.e. after the durable
  // write resolved — an absent Confirm is the completion signal.
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
}

/**
 * `auditPage` walks the whole document, and with the Plan overlay open the app
 * shell behind the scrim is still rendered. Hide the shell's tab panels/rails
 * for the audit's duration (the same scoping the P21 planning audit uses) so
 * the composited canvas is the overlay the user is actually reading.
 */
async function auditSurface(page: Page, label: string): Promise<void> {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'pg-audit-scope';
    style.textContent = '[role="tabpanel"], [role="tablist"] { display: none !important; }';
    document.head.appendChild(style);
  });
  const result = await page.evaluate(auditPage);
  await page.evaluate(() => document.getElementById('pg-audit-scope')?.remove());
  expect(result.nameless, `${label}: controls without accessible names`).toEqual([]);
  expect(result.duplicateIds, `${label}: duplicate element ids`).toEqual([]);
  expect(result.hiddenFocusable, `${label}: focusable content inside aria-hidden`).toEqual([]);
  expect(result.contrast, `${label}: WCAG AA contrast`).toEqual([]);
}

/** Accessible identity of the currently focused control. */
function focusedName(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    return (active.getAttribute('aria-label') ?? active.textContent ?? '').trim();
  });
}

/** One open, unassociated todo so the project can link it through the real UI. */
function seedOpenTodoSql(): string {
  const now = '2026-01-01T00:00:00.000Z';
  return `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
    VALUES ('todo_pg_link', 'Linked task', NULL, 0, '${now}', '${now}', NULL, NULL, 'normal', 1, NULL, NULL);`;
}

test.describe('Projects and Goals lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('project create rejects an empty name and an over-length name/objective, then the row and its edit survive reload', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await openHubView(page, 'Projects');
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByText('New Project', { exact: true })).toBeVisible();

    // Empty name: visibly rejected, and the editor keeps the draft open.
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByText('Name is required.', { exact: true })).toBeVisible();
    await expect(page.getByText('New Project', { exact: true })).toBeVisible();

    // Over-length name (> PROJECT_NAME_MAX = 120) is rejected with the limit.
    await page.getByPlaceholder('Project name').fill('x'.repeat(121));
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(
      page.getByText('Name must be 120 characters or fewer.', { exact: true }),
    ).toBeVisible();

    // The objective lives behind the options disclosure; > 1000 chars fails too.
    await page.getByPlaceholder('Project name').fill('Home renovation');
    await page.getByRole('button', { name: 'Project more options' }).click();
    await expect(page.getByRole('button', { name: 'Project more options' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.getByRole('textbox', { name: /Project description/ }).fill('y'.repeat(1001));
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(
      page.getByText('Description must be 1000 characters or fewer.', { exact: true }),
    ).toBeVisible();

    // A valid objective saves and returns to the list with the real row.
    await page
      .getByRole('textbox', { name: /Project description/ })
      .fill('Renovate the kitchen and repaint the hallway');
    await page.getByRole('button', { name: 'Create Project' }).click();
    const row = projectRow(page, 'Home renovation', 'Active', 0);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Active · No linked work yet', { exact: true })).toBeVisible();

    // Edit the title through the same editor.
    await row.click();
    await expect(page.getByRole('button', { name: 'Back to projects' })).toBeVisible();
    await page.getByPlaceholder('Project name').fill('Home renovation phase 2');
    await page.getByRole('button', { name: 'Save Project' }).click();
    await expect(projectRow(page, 'Home renovation phase 2', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Row + durable-intent oracle: one coalesced update for the same id.
    const projects = await queryRows(
      page,
      `SELECT name, description, status, color FROM projects WHERE deleted_at IS NULL`,
    );
    expect(projects).toEqual([
      {
        name: 'Home renovation phase 2',
        description: 'Renovate the kitchen and repaint the hallway',
        status: 'active',
        color: '#3B82F6',
      },
    ]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'projects'`),
    ).toEqual([{ operation: 'update' }]);

    // Cold reload: the list re-reads the persisted row and the editor re-reads
    // the persisted objective.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await expect(projectRow(page, 'Home renovation phase 2', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });
    await projectRow(page, 'Home renovation phase 2', 'Active', 0).click();
    await page.getByRole('button', { name: 'Project more options' }).click();
    await expect(page.getByRole('textbox', { name: /Project description/ })).toHaveValue(
      'Renovate the kitchen and repaint the hallway',
    );
  });

  test('project status walks pause, complete and archive, each reversal lands back on Active, and completed_at stays coherent', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await openHubView(page, 'Projects');
    await createProject(page, 'Lifecycle Project');
    await expect(projectRow(page, 'Lifecycle Project', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Pause: a cancelled confirmation writes nothing, a confirmed one commits.
    await projectRow(page, 'Lifecycle Project', 'Active', 0).click();
    await page.getByRole('button', { name: 'Pause project' }).click();
    await expect(
      page.getByText('Pause this project? You can resume it later.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause project' })).toBeVisible();
    await confirmLifecycleAction(page, 'Pause project');
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(projectRow(page, 'Lifecycle Project', 'Paused', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Reverse through the editor's Status chips (the lifecycle row cannot go back).
    await projectRow(page, 'Lifecycle Project', 'Paused', 0).click();
    await setStatusViaEditor(page, 'Active', 'Save Project');
    await expect(projectRow(page, 'Lifecycle Project', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Complete: enters completed and stamps completed_at.
    await projectRow(page, 'Lifecycle Project', 'Active', 0).click();
    await page.getByRole('button', { name: 'Complete project' }).click();
    await expect(page.getByText('Mark this project as completed?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(projectRow(page, 'Lifecycle Project', 'Completed', 0)).toBeVisible({
      timeout: 20_000,
    });

    const completed = await queryRows(
      page,
      `SELECT status, completed_at FROM projects WHERE name = 'Lifecycle Project'`,
    );
    expect(completed).toHaveLength(1);
    expect(completed[0]?.status).toBe('completed');
    expect(typeof completed[0]?.completed_at).toBe('string');
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'projects'`),
    ).toEqual([{ operation: 'update' }]);

    // Leaving completed clears the completion fact again.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await projectRow(page, 'Lifecycle Project', 'Completed', 0).click();
    await setStatusViaEditor(page, 'Active', 'Save Project');
    await expect(projectRow(page, 'Lifecycle Project', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Archive is the last forward move and removes the lifecycle row entirely
    // (there is no un-archive control; the Status chips are the only reversal).
    await projectRow(page, 'Lifecycle Project', 'Active', 0).click();
    await page.getByRole('button', { name: 'Archive project' }).click();
    await expect(
      page.getByText('Archive this project? It stays in your data but leaves active lists.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive project' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Complete project' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause project' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(projectRow(page, 'Lifecycle Project', 'Archived', 0)).toBeVisible({
      timeout: 20_000,
    });

    await projectRow(page, 'Lifecycle Project', 'Archived', 0).click();
    await setStatusViaEditor(page, 'Active', 'Save Project');
    await expect(projectRow(page, 'Lifecycle Project', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Every transition coalesced onto the single project id: one live row, one
    // intent, and a cleared completion fact.
    const final = await queryRows(
      page,
      `SELECT status, completed_at FROM projects WHERE name = 'Lifecycle Project'`,
    );
    expect(final).toEqual([{ status: 'active', completed_at: null }]);
    expect(await queryRows(page, `SELECT id FROM projects WHERE deleted_at IS NULL`)).toHaveLength(
      1,
    );
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'projects'`),
    ).toEqual([{ operation: 'update' }]);
  });

  test('linking a todo updates the project counts/progress, and deleting the project leaves the todo alive and unlinked', async ({
    page,
  }) => {
    test.setTimeout(360_000);

    await seedSql(page, seedOpenTodoSql());
    await returnToApp(page);
    await goToTab(page, 'overview');

    await openHubView(page, 'Projects');
    await createProject(page, 'Renovation');
    await expect(projectRow(page, 'Renovation', 'Active', 0)).toBeVisible({ timeout: 20_000 });

    // Link the pending todo from the detail's "Next up" candidates. The todo is
    // also rendered on the Overview "To-Do card" surface behind the overlay, so
    // the candidate is selected by its own candidate-row accessible name.
    await projectRow(page, 'Renovation', 'Active', 0).click();
    await expect(page.getByText('Next up', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '• Linked task', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unlink Linked task' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('0/1 tasks done', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to projects' }).click();

    // The row grammar reports the linked counts with the open-only progress.
    await expect(
      page.getByText('Active · 1 tasks · 0 habits · 0 goals', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(projectRow(page, 'Renovation', 'Active', 0)).toBeVisible();

    // Complete the linked todo from the canonical Todos surface.
    await closeHub(page);
    await goToTab(page, 'todos');
    const completion = page.getByRole('checkbox', { name: 'Mark complete: Linked task' });
    await expect(completion).toBeVisible({ timeout: 20_000 });
    await completion.click();
    const showCompleted = page.getByRole('button', { name: 'Show completed tasks' });
    await expect(showCompleted).toBeVisible({ timeout: 20_000 });
    await showCompleted.click();
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Linked task' }).first(),
    ).toHaveAttribute('aria-checked', 'true');

    // The project now reports the finished task: counts unchanged, 100% done.
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await expect(projectRow(page, 'Renovation', 'Active', 100)).toBeVisible({ timeout: 20_000 });
    await projectRow(page, 'Renovation', 'Active', 100).click();
    await expect(page.getByText('1/1 tasks done', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to projects' }).click();

    // Delete the project: the detail owns the tombstone write, so leaving the
    // view is the user's whole delete gesture (no confirmation exists here).
    await projectRow(page, 'Renovation', 'Active', 100).click();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });

    // Deletion is a tombstone: the project row survives for backup, the linked
    // todo keeps existing (completed, no longer pointing at the project), and
    // the H9 reconciliation enqueues the child's update.
    const project = await queryRows(
      page,
      `SELECT deleted_at FROM projects WHERE name = 'Renovation'`,
    );
    expect(project).toHaveLength(1);
    expect(project[0]?.deleted_at).not.toBeNull();
    expect(await queryRows(page, `SELECT id FROM projects WHERE deleted_at IS NULL`)).toEqual([]);
    const todo = await queryRows(
      page,
      `SELECT title, completed, project_id, deleted_at FROM todos WHERE id = 'todo_pg_link'`,
    );
    expect(todo).toEqual([
      { title: 'Linked task', completed: 1, project_id: null, deleted_at: null },
    ]);
    const intents = await queryRows(
      page,
      `SELECT entity, operation FROM sync_outbox WHERE entity IN ('projects','todos')`,
    );
    expect(
      new Set(intents.map((intent) => `${String(intent.entity)}:${String(intent.operation)}`)),
    ).toEqual(new Set(['projects:delete', 'todos:update']));

    // The todo is still there after the reload, through the Todos surface, and
    // no project was resurrected.
    await returnToApp(page);
    await goToTab(page, 'todos');
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Linked task' }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });
  });

  test('goal create validates its title, rejects out-of-range typed progress, clamps at 100%, links a project, and survives reload', async ({
    page,
  }) => {
    test.setTimeout(360_000);

    await openHubView(page, 'Projects');
    await createProject(page, 'Launch Project');
    await expect(projectRow(page, 'Launch Project', 'Active', 0)).toBeVisible({ timeout: 20_000 });
    await openHubView(page, 'Goals');
    await expect(page.getByText('No goals yet')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Create goal' }).click();
    await expect(page.getByText('New Goal', { exact: true })).toBeVisible();

    // Empty title is rejected visibly and the draft stays open.
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
    await expect(page.getByText('New Goal', { exact: true })).toBeVisible();

    // Over-length title (> GOAL_TITLE_MAX = 160).
    await page.getByPlaceholder('Goal title').fill('z'.repeat(161));
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(
      page.getByText('Title must be 160 characters or fewer.', { exact: true }),
    ).toBeVisible();

    await page.getByPlaceholder('Goal title').fill('Ship the release');

    // Typed progress is validated, never silently truncated.
    const progressField = page.getByRole('textbox', { name: 'Goal progress percent' });
    await progressField.fill('150');
    await page.getByRole('button', { name: 'Set', exact: true }).click();
    await expect(
      page.getByText('Progress must be between 0 and 100.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Progress: 0%', { exact: true })).toBeVisible();

    await progressField.fill('-5');
    await page.getByRole('button', { name: 'Set', exact: true }).click();
    await expect(
      page.getByText('Progress must be a whole number between 0 and 100.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Progress: 0%', { exact: true })).toBeVisible();

    // +10 clamps at the ceiling: eleven presses from 0 stay at 100, never 110.
    for (let press = 0; press < 11; press += 1) {
      await page.getByRole('button', { name: '+10', exact: true }).click();
    }
    await expect(page.getByText('Progress: 100%', { exact: true })).toBeVisible();
    await expect(page.getByText('Progress: 110%', { exact: true })).toHaveCount(0);

    // Associate the goal with the project, a quarter horizon, and Completed.
    await page.getByRole('button', { name: 'Goal more options' }).click();
    await page.getByRole('button', { name: 'Launch Project', exact: true }).click();
    await page.getByRole('button', { name: 'This Quarter', exact: true }).click();
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await page.getByRole('button', { name: 'Create Goal' }).click();

    await expect(goalRow(page, 'Ship the release', 'Completed', 100)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Completed · This Quarter · Launch Project', { exact: true }),
    ).toBeVisible();

    // Row oracle: title, clamp, status, completion fact, project link.
    const goals = await queryRows(
      page,
      `SELECT title, status, progress_percent, completed_at IS NOT NULL AS has_completed_at,
              project_id IS NOT NULL AS has_project
       FROM goals WHERE deleted_at IS NULL`,
    );
    expect(goals).toEqual([
      {
        title: 'Ship the release',
        status: 'completed',
        progress_percent: 100,
        has_completed_at: 1,
        has_project: 1,
      },
    ]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'goals'`),
    ).toEqual([{ operation: 'create' }]);

    // Cold reload: the stored progress and the project association re-read.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Goals');
    await expect(goalRow(page, 'Ship the release', 'Completed', 100)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Completed · This Quarter · Launch Project', { exact: true }),
    ).toBeVisible();
  });

  test('goal edit, manual and typed progress, completion reversal, and the immediate delete are all durable', async ({
    page,
  }) => {
    test.setTimeout(360_000);

    await openHubView(page, 'Goals');
    await createGoal(page, 'Read more', 3);
    await expect(goalRow(page, 'Read more', 'Active', 30)).toBeVisible({ timeout: 20_000 });

    // Edit the title and exercise the manual controls at the floor: -10 from 30
    // lands on 0 and never goes negative.
    await goalRow(page, 'Read more', 'Active', 30).click();
    await page.getByPlaceholder('Goal title').fill('Read 12 books');
    for (let press = 0; press < 3; press += 1) {
      await page.getByRole('button', { name: '-10', exact: true }).click();
    }
    await expect(page.getByText('Progress: 0%', { exact: true })).toBeVisible();
    await expect(page.getByText('Progress: -10%', { exact: true })).toHaveCount(0);
    // Typed progress agrees with the manual controls.
    await page.getByRole('textbox', { name: 'Goal progress percent' }).fill('42');
    await page.getByRole('button', { name: 'Set', exact: true }).click();
    await expect(page.getByText('Progress: 42%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save Goal' }).click();
    await expect(goalRow(page, 'Read 12 books', 'Active', 42)).toBeVisible({ timeout: 20_000 });

    // Completion state: completed_at is stamped and the value is unchanged.
    await goalRow(page, 'Read 12 books', 'Active', 42).click();
    await setStatusViaEditor(page, 'Completed', 'Save Goal');
    await expect(goalRow(page, 'Read 12 books', 'Completed', 42)).toBeVisible({ timeout: 20_000 });

    const completed = await queryRows(
      page,
      `SELECT status, progress_percent, completed_at FROM goals WHERE title = 'Read 12 books'`,
    );
    expect(completed).toHaveLength(1);
    expect(completed[0]?.status).toBe('completed');
    expect(completed[0]?.progress_percent).toBe(42);
    expect(typeof completed[0]?.completed_at).toBe('string');

    // Reversal leaves completed: the completion fact clears, progress stays.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Goals');
    await goalRow(page, 'Read 12 books', 'Completed', 42).click();
    await setStatusViaEditor(page, 'Active', 'Save Goal');
    await expect(goalRow(page, 'Read 12 books', 'Active', 42)).toBeVisible({ timeout: 20_000 });

    // Delete is immediate on this surface (no confirmation dialog exists), and
    // the tombstone keeps the row (and its clamped progress) for backup.
    await goalRow(page, 'Read 12 books', 'Active', 42).click();
    await page.getByRole('button', { name: 'Delete Goal' }).click();
    await expect(page.getByText('No goals yet')).toBeVisible({ timeout: 20_000 });

    const deleted = await queryRows(
      page,
      `SELECT deleted_at, progress_percent, completed_at FROM goals WHERE title = 'Read 12 books'`,
    );
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.deleted_at).not.toBeNull();
    expect(deleted[0]?.progress_percent).toBe(42);
    expect(deleted[0]?.completed_at).toBeNull();
    expect(await queryRows(page, `SELECT id FROM goals WHERE deleted_at IS NULL`)).toEqual([]);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'goals'`),
    ).toEqual([{ operation: 'delete' }]);

    // The delete survives a cold reload: the list is still empty.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Goals');
    await expect(page.getByText('No goals yet')).toBeVisible({ timeout: 20_000 });
  });

  test('a rejected delete keeps the row and its links, and the retry after the failure is what tombstones it', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // A real SQLite trigger rejects the tombstone writes at the storage layer,
    // so the UI must surface the failure instead of claiming a delete. This is
    // the user-visible half the W11.5 suite covers for the data layer; here the
    // journey also proves the CANCEL path of the confirmation the product does
    // offer (lifecycle) and that a later retry still commits exactly once.
    await seedSql(
      page,
      `${seedOpenTodoSql()};
       CREATE TRIGGER pg_reject_project_delete
         BEFORE UPDATE ON projects
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'project-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await createProject(page, 'Doomed project');
    await expect(projectRow(page, 'Doomed project', 'Active', 0)).toBeVisible({ timeout: 20_000 });

    await projectRow(page, 'Doomed project', 'Active', 0).click();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await expect(
      page.getByText('Could not delete the project. Please try again.', { exact: true }),
    ).toBeVisible();
    // The detail stays open on the failure; nothing claims success.
    await expect(page.getByRole('button', { name: 'Back to projects' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to projects' }).click();
    await expect(projectRow(page, 'Doomed project', 'Active', 0)).toBeVisible();

    const before = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS live,
              (SELECT COUNT(*) FROM sync_outbox WHERE entity = 'projects') AS intents,
              (SELECT COUNT(*) FROM sync_outbox
                WHERE entity = 'projects' AND operation = 'delete') AS delete_intents`,
    );
    // The failed write rolled back, but the project's own create intent is
    // still queued; what must not exist is a DELETE intent for it.
    expect(before).toEqual([{ live: 1, intents: 1, delete_intents: 0 }]);
    await runSql(page, 'DROP TRIGGER pg_reject_project_delete');

    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHubView(page, 'Projects');
    await projectRow(page, 'Doomed project', 'Active', 0).click();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });

    const after = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM projects WHERE deleted_at IS NOT NULL) AS tombstoned,
              (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS live,
              (SELECT COUNT(*) FROM sync_outbox
                WHERE entity = 'projects' AND operation = 'delete') AS delete_intents`,
    );
    expect(after).toEqual([{ tombstoned: 1, live: 0, delete_intents: 1 }]);
  });

  test('every Projects and Goals control keeps an accessible name and rows are keyboard-activatable at 390px', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await openHubView(page, 'Projects');
    await createProject(page, 'Keyboard project');
    await createProject(page, 'Second project');
    await expect(projectRow(page, 'Keyboard project', 'Active', 0)).toBeVisible({
      timeout: 20_000,
    });

    // Rendered AA + naming + duplicate-id audit on the populated Projects list.
    await auditSurface(page, 'projects list');

    // Keyboard: the create control is a real focus stop, and Tab moves to a
    // different control that stays inside the overlay's dialog.
    await page.getByRole('button', { name: 'Create project' }).focus();
    expect(await focusedName(page)).toBe('Create project');
    await page.keyboard.press('Tab');
    const afterTab = await focusedName(page);
    expect(afterTab).not.toBeNull();
    expect(afterTab).not.toBe('Create project');
    expect(
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      }),
    ).toBe(true);

    // Enter on a focused row runs its press handler: the detail opens.
    await projectRow(page, 'Keyboard project', 'Active', 0).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Back to projects' })).toBeVisible({
      timeout: 20_000,
    });

    // The project detail (progress panel, lifecycle, associations, delete) is
    // AA-clean and every control is named.
    await expect(page.getByText('No linked tasks', { exact: true })).toBeVisible();
    await auditSurface(page, 'project detail');
    await page.getByRole('button', { name: 'Back to projects' }).click();

    // Goals surface: audit the populated list, then the detail.
    await planningHubTab(page, 'Goals').click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Keyboard goal');
    await page.getByRole('button', { name: '+10', exact: true }).click();
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(goalRow(page, 'Keyboard goal', 'Active', 10)).toBeVisible({ timeout: 20_000 });
    await auditSurface(page, 'goals list');

    await goalRow(page, 'Keyboard goal', 'Active', 10).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Back to goals' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Progress: 10%', { exact: true })).toBeVisible();
    await auditSurface(page, 'goal detail');

    // Both created rows are real and the audits/writes left no extra state.
    const rows = await queryRows(
      page,
      `SELECT (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS projects,
              (SELECT COUNT(*) FROM goals WHERE deleted_at IS NULL) AS goals`,
    );
    expect(rows).toEqual([{ projects: 2, goals: 1 }]);
    expect(
      await queryRows(
        page,
        `SELECT operation FROM sync_outbox WHERE entity = 'projects' ORDER BY revision ASC`,
      ),
    ).toEqual([{ operation: 'create' }, { operation: 'create' }]);
  });
});
