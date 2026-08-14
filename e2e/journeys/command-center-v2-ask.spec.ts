import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { openCommandScreen } from '../helpers/commandObservation';
import { returnToApp } from '../helpers/dbHarness';
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
  if (supabaseRequestsSeen === 0) {
    test.fixme(
      true,
      'Ask boundary tests run against the dummy-Supabase dist-sync export; standard dist/ is local-only.',
    );
  }
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
        if (supabaseRequestsSeen === 0) {
          test.fixme(
            true,
            'Ask boundary tests run against the dummy-Supabase dist-sync export; standard dist/ is local-only.',
          );
        }
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
  ],
});
