import { test, type BrowserContext, type Page } from '@playwright/test';
import { TAB_LABELS } from './navigation';
import { seedFixture } from './seed';

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

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext();
      page = await context.newPage();
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
      test(`${persona} — ${i + 1}. ${step.name}${tagSuffix}`, async () => {
        const ctx: JourneyContext = {
          page,
          switchSection: async (tab) => {
            await page.getByRole('button', { name: TAB_LABELS[tab], exact: true }).click();
          },
        };
        if (fixture && i === 0) {
          // First step runs after an implicit reset+seed so the starting state
          // matches the declared fixture. `seedFixture` resets first. Journeys
          // that manage reset/seed themselves can omit `fixture`.
          await seedFixture(page, fixture);
        }
        await step.run(ctx);
      });
    }
  });

  void risks;
  return declaration;
}
