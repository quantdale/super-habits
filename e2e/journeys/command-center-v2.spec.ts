import { expect, test } from '../fixtures';
import { clearDatabase } from '../helpers/db';
import { queryRows, returnToApp } from '../helpers/dbHarness';
import {
  expectDraftOutcome,
  expectPreviewRowContains,
  expectUnsupportedOutcome,
  openCommandScreen,
  parseCommand,
} from '../helpers/commandObservation';
import { seedSql } from '../helpers/seed';
import { goToTab } from '../helpers/navigation';

async function seedTodo(page: Parameters<typeof seedSql>[0], title: string, id = 'todo_e2e_1') {
  await seedSql(
    page,
    `INSERT INTO todos (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id, created_at, updated_at, deleted_at)
     VALUES ('${id}', '${title.replaceAll("'", "''")}', NULL, 0, NULL, 'normal', 1, NULL, NULL, datetime('now'), datetime('now'), NULL);`,
  );
  await returnToApp(page);
}

async function seedHabit(page: Parameters<typeof seedSql>[0]) {
  await seedSql(
    page,
    `INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES ('habit_e2e_1', 'Drink water', 2, NULL, 'anytime', 'local-drink', '#3b82f6', '[]', datetime('now'), datetime('now'), NULL);`,
  );
  await returnToApp(page);
}

async function seedRoutine(page: Parameters<typeof seedSql>[0]) {
  await seedSql(
    page,
    `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
     VALUES ('routine_e2e_1', 'Push Day', NULL, datetime('now'), datetime('now'), NULL);`,
  );
  await returnToApp(page);
}

test.describe('Command Center V2 journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearDatabase(page);
  });

  test('@p0 completes one Todo only after confirmation', async ({ page }) => {
    await seedTodo(page, 'Buy groceries');
    await openCommandScreen(page);
    await parseCommand(page, 'complete Buy groceries');

    await expectDraftOutcome(page, 'ready');
    await expectPreviewRowContains(page, 'Current state', 'Incomplete');
    await expectPreviewRowContains(page, 'Result', 'Complete');

    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Todo completed.', { exact: true })).toBeVisible();

    const rows = await queryRows(page, "SELECT completed FROM todos WHERE id = 'todo_e2e_1'");
    expect(rows).toEqual([{ completed: 1 }]);
  });

  test('@p0 keeps duplicate Todo names ambiguous until a choice is made', async ({ page }) => {
    await seedSql(
      page,
      `INSERT INTO todos (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id, created_at, updated_at, deleted_at)
       VALUES
       ('todo_e2e_a', 'Buy groceries', NULL, 0, NULL, 'normal', 1, NULL, NULL, datetime('now'), datetime('now'), NULL),
       ('todo_e2e_b', 'Buy groceries', NULL, 0, NULL, 'normal', 2, NULL, NULL, datetime('now'), datetime('now'), NULL);`,
    );
    await returnToApp(page);
    await openCommandScreen(page);
    await parseCommand(page, 'complete Buy groceries');

    await expectDraftOutcome(page, 'needs_input');
    await expect(page.getByText('Choose the matching item', { exact: true })).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Confirm and save' });
    await expect(confirm).toHaveCount(0);

    // exact:true — the dialog also renders "Reuse recent command: complete
    // Buy groceries", whose accessible name contains the todo title as a
    // substring; only the two disambiguation chips must be counted.
    const choice = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Buy groceries', exact: true })
      .first();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Buy groceries', exact: true }),
    ).toHaveCount(2);
    await choice.scrollIntoViewIfNeeded();
    await choice.click({ force: true });
    await expect(confirm).toBeVisible();
    await confirm.click({ force: true });
    await expect(page.getByText('Todo completed.', { exact: true })).toBeVisible();
  });

  test('@p0 logs Habit progress through the canonical current-day path', async ({ page }) => {
    await seedHabit(page);
    await openCommandScreen(page);
    await parseCommand(page, 'add one to Drink water');

    await expectDraftOutcome(page, 'ready');
    await expectPreviewRowContains(page, 'Current', '0 / 2');
    await expectPreviewRowContains(page, 'After', '1 / 2');
    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Habit progress logged.', { exact: true })).toBeVisible();

    const rows = await queryRows(
      page,
      "SELECT count FROM habit_completions WHERE habit_id = 'habit_e2e_1'",
    );
    expect(rows).toEqual([{ count: 1 }]);
  });

  test('@p0 logs supplied calories without estimating nutrition', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'add lunch: tuna sandwich, 420 calories, 30g protein');

    await expectDraftOutcome(page, 'ready');
    await expectPreviewRowContains(page, 'Calories', '420 kcal');
    await expectPreviewRowContains(page, 'Protein', '30 g');
    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Calorie entry logged.', { exact: true })).toBeVisible();

    const rows = await queryRows(
      page,
      "SELECT food_name, calories, protein FROM calorie_entries WHERE food_name = 'tuna sandwich'",
    );
    expect(rows).toEqual([{ food_name: 'tuna sandwich', calories: 420, protein: 30 }]);
  });

  test('@p0 asks for missing calories and supports inline correction', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'I ate chicken breast');

    await expectDraftOutcome(page, 'needs_input');
    await expectPreviewRowContains(page, 'Calories', 'Needs calories');

    await page.locator('#command-edit-calorie-calories').fill('300');
    await expectDraftOutcome(page, 'ready');
    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Calorie entry logged.', { exact: true })).toBeVisible();

    const after = await queryRows(
      page,
      "SELECT food_name, calories FROM calorie_entries WHERE food_name = 'chicken breast'",
    );
    expect(after).toEqual([{ food_name: 'chicken breast', calories: 300 }]);
  });

  test('@p0 logs an existing Workout routine without inventing exercise details', async ({
    page,
  }) => {
    await seedRoutine(page);
    await openCommandScreen(page);
    await parseCommand(page, 'log Push Day workout');

    await expectDraftOutcome(page, 'ready');
    await expect(page.getByText(/No exercise, set, weight, or rep details/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Workout logged.', { exact: true })).toBeVisible();

    const rows = await queryRows(
      page,
      "SELECT routine_id FROM workout_logs WHERE routine_id = 'routine_e2e_1'",
    );
    expect(rows).toEqual([{ routine_id: 'routine_e2e_1' }]);
  });

  test('@p0 starts a focus session through the live timer bridge', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'focus for 25 minutes');

    await expectDraftOutcome(page, 'ready');
    await expectPreviewRowContains(page, 'Duration', '25 minutes');
    await page.getByRole('button', { name: 'Confirm and save' }).click({ force: true });
    await expect(page.getByText('Focus session started.', { exact: true })).toBeVisible();
  });

  test('@p0 preserves no-write and rejects unsupported destructive actions', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'complete Missing todo');
    await expectDraftOutcome(page, 'needs_input');
    await goToTab(page, 'todos');
    await expect(page.getByText('Missing todo', { exact: true })).toHaveCount(0);

    await openCommandScreen(page);
    await parseCommand(page, 'delete my todo');
    await expectUnsupportedOutcome(page);
  });

  test('@p0 does not duplicate a Todo when Confirm is double-clicked', async ({ page }) => {
    await seedTodo(page, 'Double confirm task');
    await openCommandScreen(page);
    await parseCommand(page, 'complete Double confirm task');
    await expectDraftOutcome(page, 'ready');

    const confirm = page.getByRole('button', { name: 'Confirm and save', exact: true });
    await Promise.all([confirm.click({ force: true }), confirm.click({ force: true })]);
    await expect(page.getByText(/Todo completed\.|already been submitted/)).toBeVisible({
      timeout: 15_000,
    });

    const rows = await queryRows(page, "SELECT completed FROM todos WHERE id = 'todo_e2e_1';");
    expect(rows).toEqual([{ completed: 1 }]);
  });

  test('shows provider-unavailable Ask state without changing local data', async ({ page }) => {
    test.skip(
      Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
      'Remote Ask builds use the mock edge route.',
    );
    await openCommandScreen(page);
    await page.getByRole('button', { name: 'Ask', exact: true }).last().click({ force: true });
    await page.locator('#ask-input').fill('How many pending todos do I have?');
    await page.getByRole('button', { name: 'Ask', exact: true }).last().click({ force: true });
    await expect(page.getByText('Ask is temporarily unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText('Nothing was saved or changed.', { exact: true })).toBeVisible();
  });
});
