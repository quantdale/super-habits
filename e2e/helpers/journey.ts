import { test, type BrowserContext, type Page } from '../fixtures';
import { TAB_LABELS } from './navigation';
import { seedFixture } from './seed';

const MAX_JOURNEY_EVENTS = 80;

type JourneyDiagnosticEvent = {
  type: 'console' | 'pageerror' | 'response' | 'requestfailed';
  message?: string;
  url?: string;
  method?: string;
  status?: number;
};

function appendJourneyEvent(events: JourneyDiagnosticEvent[], event: JourneyDiagnosticEvent): void {
  if (events.length < MAX_JOURNEY_EVENTS) events.push(event);
}

/**
 * Journey declaration helper (task 3.1 of the OpenSpec change).
 *
 * A journey is one persona, one device-specific goal, a documented starting
 * state (fixture), named risks, and a strictly ordered list of steps that run
 * against a SINGLE shared page with accumulating state — nothing is reset
 * between steps (that is the point: continuity surfaces staleness, rollover
 * and duplicates the per-test-reset suite is blind to).
 *
 * Wiring guarantees:
 * - `test.describe.serial`: a step failure skips all remaining steps (later
 *   steps are meaningless once continuity breaks) without affecting other
 *   journey files.
 * - One `BrowserContext` + one `Page` created in `beforeAll`, closed in
 *   `afterAll`. Journey steps MUST use `ctx.page` (the shared page), not the
 *   per-test `page` fixture.
 * - Optional `clock.startAt` installs `page.clock` in `beforeAll`, BEFORE the
 *   first render, so day-rollover journeys control time from the start.
 * - Optional `tags` (e.g. `['@p0']`) are appended to every step title so
 *   `npx playwright test --grep @p0` selects the prioritized subset. Tags stay
 *   at the END of the title — CI greps for them (`/@sync/`, `@p0`).
 * - `test()` runs from this helper file, so Playwright attributes every step
 *   here (`helpers/journey.ts`) instead of the spec file. Each step title is
 *   therefore prefixed with the journey's persona so `--list`, `--grep` and
 *   the HTML report remain navigable per journey.
 */

export interface JourneyContext {
  /** The single shared page for the whole journey. */
  page: Page;
  /** Switch the active section WITHOUT navigating/reloading the page. */
  switchSection: (tab: keyof typeof TAB_LABELS) => Promise<void>;
}

export interface JourneyStep {
  /** Human name; appears in the report as the Playwright test title. */
  name: string;
  /** Explicit expected-failure quarantine for a decided contract gap. */
  quarantine?: string;
  /** Async step body. Throwing aborts the remaining steps (serial). */
  run: (ctx: JourneyContext) => Promise<void>;
}

export interface JourneyDeclaration {
  /** Persona code, e.g. "P1 — Maya, the Daily Driver". */
  persona: string;
  /** One-line goal of this journey. */
  goal: string;
  /** Starting state: which fixture to seed, if any. */
  fixture?: 'SMALL' | 'TYPICAL' | 'HEAVY';
  /** Named risks this journey exists to catch (see the risk matrix). */
  risks?: string[];
  /** Browser-clock start time; installed before first render if given. */
  clock?: { startAt: number | string | Date };
  /** Playwright tags, e.g. ['@p0'] — appended to each step title. */
  tags?: string[];
  /** Ordered steps. */
  steps: JourneyStep[];
}

/**
 * Declare and register a journey. Call once at module scope of a journey spec
 * file in `e2e/journeys/`. Returns the declaration (for tooling) and registers
 * the Playwright tests.
 */
export function defineJourney(declaration: JourneyDeclaration): JourneyDeclaration {
  const { persona, goal, fixture, risks, clock, tags, steps } = declaration;
  const tagSuffix = tags && tags.length > 0 ? ` ${tags.join(' ')}` : '';

  test.describe.serial(`${persona} — ${goal}`, () => {
    let context: BrowserContext;
    let page: Page;
    const events: JourneyDiagnosticEvent[] = [];
    const stepResults: { index: number; name: string; status: string }[] = [];

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext();
      page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        appendJourneyEvent(events, {
          type: 'console',
          message: `[${message.type()}] ${message.text()}`,
        });
      });
      page.on('pageerror', (error) => {
        appendJourneyEvent(events, { type: 'pageerror', message: error.stack ?? error.message });
      });
      page.on('response', (response) => {
        if (response.status() < 400) return;
        appendJourneyEvent(events, {
          type: 'response',
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
        });
      });
      page.on('requestfailed', (request) => {
        appendJourneyEvent(events, {
          type: 'requestfailed',
          url: request.url(),
          method: request.method(),
          message: request.failure()?.errorText ?? 'request failed',
        });
      });
      if (clock) {
        await page.clock.install({ time: clock.startAt });
      }
    });

    test.afterAll(async () => {
      await context?.close().catch(() => {});
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // Step titles carry the journey persona (see the header note on
      // attribution); tags must stay appended at the very end for CI greps.
      stepResults.push({ index: i, name: step.name, status: 'not-run' });
      test(`${persona} — ${i + 1}. ${step.name}${tagSuffix}`, async ({}, testInfo) => {
        if (step.quarantine) {
          test.fixme(true, step.quarantine);
        }
        const ctx: JourneyContext = {
          page,
          switchSection: async (tab) => {
            await page.getByRole('button', { name: TAB_LABELS[tab], exact: true }).click();
          },
        };
        try {
          if (fixture && i === 0) {
            // First step runs after an implicit reset+seed so the starting state
            // matches the declared fixture. `seedFixture` resets first. Journeys
            // that manage reset/seed themselves can omit `fixture`.
            await seedFixture(page, fixture);
          }
          await step.run(ctx);
          stepResults[i].status = 'passed';
        } catch (error) {
          stepResults[i].status = 'failed';
          throw error;
        } finally {
          if (testInfo.status !== testInfo.expectedStatus) {
            const metadata = await page
              .evaluate(() => ({
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
                userAgent: navigator.userAgent,
              }))
              .catch(() => ({ timezone: process.env.TZ ?? 'unknown', userAgent: 'unavailable' }));
            const diagnostics = {
              schemaVersion: 1,
              capturedAt: new Date().toISOString(),
              journey: {
                persona,
                goal,
                fixture: fixture ?? null,
                clock: clock ?? null,
                tags,
                risks,
              },
              failingStep: { index: i, name: step.name },
              orderedSteps: stepResults,
              environment: {
                baseUrl: testInfo.project.use.baseURL ?? null,
                project: testInfo.project.name,
                timezone: metadata.timezone,
                viewport: page.viewportSize(),
                userAgent: metadata.userAgent,
              },
              events,
              replay: `npx playwright test --project=${testInfo.project.name} ${testInfo.file}`,
            };
            try {
              await testInfo.attach('qa-journey-diagnostics.json', {
                body: JSON.stringify(diagnostics, null, 2),
                contentType: 'application/json',
              });
            } catch {
              // Preserve the original journey assertion if the page is gone.
            }
            try {
              await testInfo.attach('qa-journey-failure-screenshot.png', {
                body: await page.screenshot({ animations: 'disabled' }),
                contentType: 'image/png',
              });
            } catch {
              // Playwright's built-in screenshot/trace remains the fallback.
            }
          }
        }
      });
    }
  });

  void risks;
  return declaration;
}
