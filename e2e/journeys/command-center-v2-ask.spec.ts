import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { openCommandScreen } from '../helpers/commandObservation';
import { auditPage } from '../helpers/a11yAudit';
import { queryRows, returnToApp } from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';
import { fulfillDummySupabaseAuth } from '../helpers/supabaseAuth';

type AskIntent =
  | 'pending_todos'
  | 'calorie_summary'
  | 'habit_progress'
  | 'workout_summary'
  | 'focus_summary'
  | 'daily_overview';

const SUPABASE_ROUTE = '**/*.supabase.co/**';

let supabaseRequestsSeen = 0;
let latestFacts: { intent: string; facts: Record<string, unknown> } | null = null;

function intentForQuestion(question: string): AskIntent {
  if (/calor/i.test(question)) return 'calorie_summary';
  if (/habit|streak|consistent/i.test(question)) return 'habit_progress';
  if (/workout|work out|routine/i.test(question)) return 'workout_summary';
  if (/focus|pomodoro/i.test(question)) return 'focus_summary';
  if (/overview|doing today/i.test(question)) return 'daily_overview';
  return 'pending_todos';
}

function phraseForIntent(intent: AskIntent): string {
  return `Deterministic mock answer for ${intent}.`;
}

async function routeAskBoundary(page: Page): Promise<void> {
  await page.route(SUPABASE_ROUTE, async (route: Route) => {
    supabaseRequestsSeen += 1;
    const url = route.request().url();
    if (url.includes('/auth/v1/')) {
      await fulfillDummySupabaseAuth(route);
      return;
    }

    if (!url.includes('/functions/v1/user-ai-ask')) {
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: '[]',
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      stage?: string;
      question?: string;
      todayDateKey?: string;
      retrievedFacts?: { intent?: string; facts?: Record<string, unknown> };
    };
    if (body.stage === 'classify') {
      const intent = intentForQuestion(body.question ?? '');
      const todayDateKey = body.todayDateKey ?? '2026-08-14';
      const params =
        intent === 'pending_todos'
          ? { due: 'all', priority: 'all' }
          : intent === 'daily_overview'
            ? { dateKey: todayDateKey }
            : {
                startDateKey: todayDateKey,
                endDateKey: todayDateKey,
                ...(intent === 'habit_progress' ? { habitName: null } : {}),
                ...(intent === 'workout_summary' ? { routineName: null } : {}),
              };
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ outcome: 'classified', intent, params }),
      });
      return;
    }

    const retrievedFacts = body.retrievedFacts;
    if (!retrievedFacts || typeof retrievedFacts.intent !== 'string' || !retrievedFacts.facts) {
      await route.fulfill({
        status: 400,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ error: 'missing bounded facts' }),
      });
      return;
    }
    latestFacts = { intent: retrievedFacts.intent, facts: retrievedFacts.facts };
    const answer = phraseForIntent(retrievedFacts.intent as AskIntent);
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ answer }),
    });
  });
}

async function askQuestion(page: Page, question: string, intent: AskIntent): Promise<void> {
  requireSyncBoundary();
  await openCommandScreen(page);
  await page.getByRole('button', { name: 'Ask', exact: true }).first().click({ force: true });
  await page.getByLabel('Question').fill(question);
  await page.getByRole('button', { name: 'Ask', exact: true }).last().click({ force: true });
  await expect(page.getByText(phraseForIntent(intent), { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect(latestFacts?.intent).toBe(intent);
  expect(JSON.stringify(latestFacts?.facts)).not.toContain('SELECT ');
  expect(JSON.stringify(latestFacts?.facts)).not.toContain('CREATE TABLE');
}

function requireSyncBoundary(): void {
  if (supabaseRequestsSeen === 0) {
    test.fixme(
      true,
      'Ask boundary tests run against the dummy-Supabase dist-sync export; standard dist/ is local-only.',
    );
  }
}

defineJourney({
  persona: 'P6 — Ask V2 deterministic boundary',
  goal: 'all bounded Ask intents use local facts and safe phrase input',
  tags: ['@ask-v2', '@sync'],
  steps: [
    {
      name: 'reset and install the deterministic Ask boundary',
      run: async ({ page }) => {
        await routeAskBoundary(page);
        await resetAll(page);
        await returnToApp(page);
        requireSyncBoundary();
      },
    },
    {
      name: 'answers pending Todo questions from bounded facts',
      run: async ({ page }) => {
        await askQuestion(page, 'What pending Todos do I have?', 'pending_todos');
        expect(Object.keys(latestFacts?.facts ?? {})).toEqual(['count', 'titles']);
      },
    },
    {
      name: 'answers calorie summary questions from bounded facts',
      run: async ({ page }) => {
        await askQuestion(page, 'How many calories did I eat today?', 'calorie_summary');
        expect(latestFacts?.facts).toMatchObject({
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFats: 0,
          totalFiber: 0,
          entryCount: 0,
        });
      },
    },
    {
      name: 'answers Habit progress questions with insight-shaped facts',
      run: async ({ page }) => {
        await askQuestion(page, 'How consistent have my habits been today?', 'habit_progress');
        expect(latestFacts?.facts).toMatchObject({ scope: 'overall', habits: [] });
      },
    },
    {
      name: 'answers Workout summary questions from bounded logs',
      run: async ({ page }) => {
        await askQuestion(page, 'How many workouts did I do today?', 'workout_summary');
        expect(latestFacts?.facts).toMatchObject({ sessionCount: 0, routineFrequency: [] });
      },
    },
    {
      name: 'answers Focus summary questions from bounded history',
      run: async ({ page }) => {
        await askQuestion(page, 'How much focus time did I do today?', 'focus_summary');
        expect(latestFacts?.facts).toMatchObject({
          completedSessionCount: 0,
          totalFocusedMinutes: 0,
        });
      },
    },
    {
      name: 'answers a cross-feature daily overview from normalized facts',
      run: async ({ page }) => {
        await askQuestion(page, 'How am I doing today?', 'daily_overview');
        expect(latestFacts?.facts).toMatchObject({
          dateKey: expect.any(String),
          todos: expect.any(Object),
          habits: expect.any(Object),
          calories: expect.any(Object),
          focus: expect.any(Object),
          workout: expect.any(Object),
        });
      },
    },
    {
      name: 'retries an Auto Ask result through Create with the exact same text',
      run: async ({ page }) => {
        requireSyncBoundary();
        await openCommandScreen(page);
        await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
        const submittedText = 'Add a todo to buy milk tomorrow';
        await page.getByLabel('Auto mode question').fill(submittedText);
        await page.getByRole('button', { name: 'Send', exact: true }).click({ force: true });
        await expect(page.getByText('Auto → Ask', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Try as Create instead' }).click({ force: true });
        await expect(page.getByText('Auto → Create', { exact: true })).toBeVisible();
        await expect(page.locator('#command-input')).toHaveValue(submittedText);
        await expect(page.locator('#command-edit-todo-title')).toHaveValue(/buy milk/i);
        expect(await queryRows(page, 'SELECT COUNT(*) AS count FROM todos')).toEqual([
          { count: 0 },
        ]);
      },
    },
    {
      name: 'retries an unsupported Auto Create result through Ask',
      run: async ({ page }) => {
        requireSyncBoundary();
        let firstClassify = true;
        const classifyAsCreateOnce = async (route: Route) => {
          const body = route.request().postDataJSON() as { stage?: string };
          if (firstClassify && body.stage === 'classify') {
            firstClassify = false;
            await route.fulfill({
              status: 200,
              headers: { 'access-control-allow-origin': '*' },
              contentType: 'application/json',
              body: JSON.stringify({ outcome: 'unsupported', reason: 'Try Create first.' }),
            });
            return;
          }
          await route.fallback();
        };
        await page.route('**/functions/v1/user-ai-ask', classifyAsCreateOnce);
        try {
          await openCommandScreen(page);
          await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
          const submittedText = 'How many calories did I eat today?';
          await page.getByLabel('Auto mode question').fill(submittedText);
          await page.getByRole('button', { name: 'Send', exact: true }).click({ force: true });
          await expect(page.getByText('Auto → Create', { exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Try as Ask instead' }).click({ force: true });
          await expect(page.getByText(phraseForIntent('calorie_summary'))).toBeVisible();
          await expect(page.getByLabel('Auto mode question')).toHaveValue(submittedText);
          expect(await queryRows(page, 'SELECT COUNT(*) AS count FROM todos')).toEqual([
            { count: 0 },
          ]);
        } finally {
          await page.unroute('**/functions/v1/user-ai-ask', classifyAsCreateOnce);
        }
      },
    },
    {
      name: 'ignores a delayed Auto classification after switching to a newer Create draft',
      run: async ({ page }) => {
        requireSyncBoundary();
        let releaseClassification: (() => void) | undefined;
        let signalClassificationStarted: (() => void) | undefined;
        const classificationStarted = new Promise<void>((resolve) => {
          signalClassificationStarted = resolve;
        });
        const classificationGate = new Promise<void>((resolve) => {
          releaseClassification = resolve;
        });
        const delayClassification = async (route: Route) => {
          const body = route.request().postDataJSON() as { stage?: string };
          if (body.stage !== 'classify') {
            await route.fallback();
            return;
          }
          signalClassificationStarted?.();
          await classificationGate;
          await route.fulfill({
            status: 200,
            headers: { 'access-control-allow-origin': '*' },
            contentType: 'application/json',
            body: JSON.stringify({ outcome: 'unsupported', reason: 'Try Create first.' }),
          });
        };
        await page.route('**/functions/v1/user-ai-ask', delayClassification);
        try {
          await openCommandScreen(page);
          await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
          await page.getByLabel('Auto mode question').fill('Add a todo to call mom tomorrow');
          await page.getByRole('button', { name: 'Send', exact: true }).click({ force: true });
          await classificationStarted;

          await page.getByRole('button', { name: 'Create', exact: true }).click({ force: true });
          const newerText = 'Add a todo to buy bread tomorrow';
          await page.locator('#command-input').fill(newerText);
          await page.getByRole('button', { name: 'Parse command' }).click({ force: true });
          await expect(page.locator('#command-edit-todo-title')).toHaveValue(/buy bread/i);

          const delayedResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/functions/v1/user-ai-ask') &&
              response.request().postDataJSON()?.stage === 'classify',
          );
          releaseClassification?.();
          await delayedResponse;
          await page.waitForTimeout(200);
          await expect(page.locator('#command-input')).toHaveValue(newerText);
          await expect(page.locator('#command-edit-todo-title')).toHaveValue(/buy bread/i);
          expect(await queryRows(page, 'SELECT COUNT(*) AS count FROM todos')).toEqual([
            { count: 0 },
          ]);
        } finally {
          releaseClassification?.();
          await page.unroute('**/functions/v1/user-ai-ask', delayClassification);
        }
      },
    },
    {
      name: 'keeps internal Ask and Auto controls accessible',
      run: async ({ page }) => {
        requireSyncBoundary();
        await openCommandScreen(page);
        await page.getByRole('button', { name: 'Ask', exact: true }).click({ force: true });
        await expect(page.getByText('Ask a question', { exact: true })).toBeVisible();
        await page.waitForTimeout(1200);
        const ask = await page.evaluate(auditPage);
        expect(ask.contrast, 'command ask: WCAG AA contrast').toEqual([]);
        expect(ask.nameless, 'command ask: controls without accessible names').toEqual([]);
        expect(ask.duplicateIds, 'command ask: duplicate element ids').toEqual([]);
        expect(ask.hiddenFocusable, 'command ask: focusable content inside aria-hidden').toEqual(
          [],
        );

        await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
        await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
        await page.waitForTimeout(1200);
        const auto = await page.evaluate(auditPage);
        expect(auto.contrast, 'command auto: WCAG AA contrast').toEqual([]);
        expect(auto.nameless, 'command auto: controls without accessible names').toEqual([]);
        expect(auto.duplicateIds, 'command auto: duplicate element ids').toEqual([]);
        expect(auto.hiddenFocusable, 'command auto: focusable content inside aria-hidden').toEqual(
          [],
        );
      },
    },
    {
      name: 'shows provider-unavailable Ask without changing local data',
      run: async ({ page }) => {
        requireSyncBoundary();
        await page.route('**/functions/v1/user-ai-ask', async (route) => {
          await route.fulfill({
            status: 500,
            headers: { 'access-control-allow-origin': '*' },
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Provider unavailable.' }),
          });
        });
        await openCommandScreen(page);
        await page.getByRole('button', { name: 'Ask', exact: true }).first().click({ force: true });
        await page.getByLabel('Question').fill('How many pending todos do I have?');
        await page.getByRole('button', { name: 'Ask', exact: true }).last().click({ force: true });
        await expect(
          page.getByText('Ask is temporarily unavailable', { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText('Nothing was saved or changed.', { exact: true }),
        ).toBeVisible();
        const rows = await queryRows(page, 'SELECT COUNT(*) AS count FROM todos');
        expect(rows).toEqual([{ count: 0 }]);
      },
    },
    {
      name: 'keeps the exact Auto input visible when classification fails',
      run: async ({ page }) => {
        requireSyncBoundary();
        await page.route('**/functions/v1/user-ai-ask', async (route) => {
          await route.fulfill({
            status: 503,
            headers: { 'access-control-allow-origin': '*' },
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Ask is unavailable.' }),
          });
        });
        await openCommandScreen(page);
        await page.getByRole('button', { name: 'Create', exact: true }).click({ force: true });
        await page.locator('#command-input').fill('Add a todo to buy bananas tomorrow');
        await page.getByRole('button', { name: 'Parse command' }).click({ force: true });
        await expect(page.locator('#command-edit-todo-title')).toHaveValue(/buy bananas/i);
        await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
        const submittedText = 'Add a todo to call mom tomorrow';
        await page.getByLabel('Auto mode question').fill(submittedText);
        await page.getByRole('button', { name: 'Send', exact: true }).click({ force: true });
        await expect(page.getByText('Auto → Create', { exact: true })).toBeVisible();
        await expect(page.getByText(/Classification unavailable/)).toBeVisible();
        await expect(page.locator('#command-edit-todo-title')).toHaveValue(/call mom/i);
        await page.getByRole('button', { name: 'Switch to Create' }).click({ force: true });
        await expect(page.locator('#command-input')).toHaveValue(submittedText);
        await expect(page.locator('#command-edit-todo-title')).toHaveValue(/call mom/i);
        expect(await queryRows(page, 'SELECT COUNT(*) AS count FROM todos')).toEqual([
          { count: 0 },
        ]);
      },
    },
  ],
});
