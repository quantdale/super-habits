import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { openCommandScreen, openSettingsScreen } from './helpers/commandObservation';

const INTERNAL_ROLLOUT_BUILD_ENABLED =
  process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT === 'true' &&
  process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE === 'remote_with_fallback';
const INTERNAL_REMOTE_BACKEND_CONFIGURED =
  process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST === 'custom_url'
    ? Boolean(process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL)
    : Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function parseCommand(page: Page, rawText: string) {
  await page.locator('#command-input').fill(rawText);
  await page.getByText('Parse command', { exact: true }).locator('..').click({ force: true });
}

async function fillById(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value, { force: true });
}

test.describe('Command shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearDatabase(page);
  });

  test('uses Add as the only global launcher and reaches Command Center through Describe it', async ({
    page,
  }) => {
    const commandLauncher = page.getByRole('button', { name: 'Open command center', exact: true });
    const addLauncher = page.getByRole('button', { name: 'Quick capture', exact: true });
    const visibleTabs = ['overview', 'todos', 'habits', 'pomodoro', 'workout', 'calories'] as const;

    for (const tab of visibleTabs) {
      await goToTab(page, tab);
      await expect(addLauncher).toBeVisible();
      await expect(commandLauncher).toHaveCount(0);
    }

    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click({ force: true });
    await expect(page.locator('#command-input')).toBeHidden();
    await expect(addLauncher).toBeVisible();
    await expect(commandLauncher).toHaveCount(0);
  });

  test('keeps the single Add launcher available through an active pomodoro session', async ({
    page,
  }) => {
    const addLauncher = page.getByRole('button', { name: 'Quick capture', exact: true });
    const commandLauncher = page.getByRole('button', { name: 'Open command center', exact: true });
    const startButton = page.getByText('Start focus', { exact: true });
    const pauseButton = page.getByText('Pause', { exact: true });

    await goToTab(page, 'pomodoro');
    await expect(addLauncher).toBeVisible();
    await expect(commandLauncher).toHaveCount(0);

    await startButton.click({ force: true });
    try {
      await expect(pauseButton).toBeEnabled({ timeout: 3_000 });
    } catch {
      await startButton.click({ force: true });
      await expect(pauseButton).toBeEnabled({ timeout: 3_000 });
    }
    await expect(addLauncher).toBeVisible();
    await expect(commandLauncher).toHaveCount(0);

    await page.getByRole('button', { name: /^Reset \(not logged\)$/ }).click({ force: true });
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();
    await expect(addLauncher).toBeVisible();
  });

  test('parses todo, allows inline edits, and saves edited values on confirm', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow');

    await expect(page.getByText('Review before saving', { exact: true })).toBeVisible();
    await fillById(page, 'command-edit-todo-title', 'call dad');
    await fillById(page, 'command-edit-todo-due-date', '2026-04-25');

    await page.getByText('Confirm and save', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Todo saved.', { exact: true })).toBeVisible();

    await page.getByText('Go to Todos', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Todos', { exact: true })).toBeVisible();
    await expect(page.getByText('call dad', { exact: true }).last()).toBeVisible();
  });

  test('parses habit, allows inline edits, and saves edited values on confirm', async ({
    page,
  }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Create a habit to drink water every morning');

    await fillById(page, 'command-edit-habit-target', '2');
    await page.getByText('Evening', { exact: true }).click({ force: true });

    await page.getByText('Confirm and save', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Habit saved.', { exact: true })).toBeVisible();

    await page.getByText('Go to Habits', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByLabel('Enter habit edit mode')).toBeVisible();
    await expect(page.getByText('drink water', { exact: true }).last()).toBeVisible();
  });

  test('keeps no-write-before-confirm behavior', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow');

    await goToTab(page, 'todos');
    await expect(page.getByText('Todos', { exact: true })).toBeVisible();
    await expect(page.getByText('call mom', { exact: true })).toHaveCount(0);
  });

  test('allows inline correction for needs_input commands', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo tomorrow');

    await expect(page.getByText('Needs input', { exact: true }).first()).toBeVisible();
    await fillById(page, 'command-edit-todo-title', 'call mom');
    await page.getByText('Confirm and save', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Todo saved.', { exact: true })).toBeVisible();
  });

  test('keeps parse warnings visible after editing', async ({ page }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow at 7pm');

    await expect(
      page.getByText('Time will not be saved in this version.', { exact: true }),
    ).toBeVisible();
    await fillById(page, 'command-edit-todo-title', 'call dad');
    await fillById(page, 'command-edit-todo-due-date', '2026-04-26');
    await expect(
      page.getByText('Time will not be saved in this version.', { exact: true }),
    ).toBeVisible();
  });

  test('keeps raw input unchanged while editing and reparse reseeds editable draft', async ({
    page,
  }) => {
    const rawCommand = 'Add a todo to call mom tomorrow';

    await openCommandScreen(page);
    await parseCommand(page, rawCommand);

    await fillById(page, 'command-edit-todo-title', 'call dad');
    await expect(page.locator('#command-input')).toHaveValue(rawCommand);

    await page.getByText('Parse command', { exact: true }).locator('..').click({ force: true });
    await expect(page.locator('#command-edit-todo-title')).toHaveValue('call mom');

    await fillById(page, 'command-edit-todo-title', 'call dad');
    await page.getByText('Confirm and save', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Todo saved.', { exact: true })).toBeVisible();

    await page.getByText('Go to Todos', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Todos', { exact: true })).toBeVisible();
    await expect(page.getByText('call dad', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('call mom', { exact: true })).toHaveCount(0);
  });

  test('keeps internal parser metadata hidden until internal rollout is enabled on the device', async ({
    page,
  }) => {
    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow');

    await expect(page.getByText('Internal parser metadata', { exact: true })).toHaveCount(0);
  });
});

test.describe('Command shell internal rollout', () => {
  test.skip(
    !INTERNAL_ROLLOUT_BUILD_ENABLED || !INTERNAL_REMOTE_BACKEND_CONFIGURED,
    'Internal rollout tests require an internal-capable build with a configured remote backend.',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearDatabase(page);
  });

  test('shows internal metadata only when the device-local rollout toggle is enabled and rolls back to mock immediately when disabled', async ({
    page,
  }) => {
    await openSettingsScreen(page);
    await page
      .getByText('Enable model parser', { exact: true })
      .locator('..')
      .click({ force: true });

    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow');

    await expect(page.getByText('Internal parser metadata', { exact: true })).toBeVisible();
    await expect(page.getByText(/remote_with_fallback|remote/, { exact: false })).toBeVisible();

    await openSettingsScreen(page);
    await page
      .getByText('Use mock parser only', { exact: true })
      .locator('..')
      .click({ force: true });

    await openCommandScreen(page);
    await parseCommand(page, 'Add a todo to call mom tomorrow');

    await expect(page.getByText('Internal parser metadata', { exact: true })).toHaveCount(0);
    await expect(page.getByText('mock_rules v1', { exact: true })).toBeVisible();
  });
});
