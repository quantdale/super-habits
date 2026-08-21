import { defineConfig, devices } from '@playwright/test';

const e2ePort =
  process.env.E2E_PORT ?? (process.env.E2E_DIST_DIR === 'dist-sync' ? '8082' : '8081');
if (!/^\d+$/.test(e2ePort)) {
  throw new Error(`E2E_PORT must be numeric, received ${JSON.stringify(e2ePort)}`);
}

const e2eBaseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${e2ePort}`;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';

export default defineConfig({
  testDir: './e2e',

  // Tests within the same file run serially by default (fullyParallel: false).
  fullyParallel: false,

  // Every standard project shares the same localhost origin and therefore the
  // same OPFS SQLite database. A per-project `workers: 1` setting is not
  // sufficient: Playwright can still run different projects concurrently and
  // one project's reset can erase another project's in-flight write. Keep the
  // whole invocation serial so clearDatabase(), reloads, and continuity
  // journeys cannot race across projects.
  workers: 1,

  // Retry on CI only — locally you want to see failures immediately
  retries: process.env.CI ? 2 : 0,

  // beforeEach often does goToTab + clearDatabase (reload) + goToTab — needs
  // headroom. Infrastructure OPFS test waits up to ~30s for isolation.
  timeout: 60_000,
  expect: { timeout: 5_000 },

  // Prevent accidental test.only from being committed
  forbidOnly: !!process.env.CI,

  // HTML report — viewable in browser after run
  reporter: [
    [
      'html',
      {
        outputFolder: '.cursor/playwright-output/e2e-report',
        open: 'never',
      },
    ],
    // Also log to terminal during run so you can see progress
    ['list'],
  ],

  use: {
    baseURL: e2eBaseUrl,
    headless: true,

    // Only capture screenshot on failure — avoids disk bloat
    screenshot: 'only-on-failure',

    // Store failure screenshots in the gitignored output folder
    // Note: Playwright uses outputDir for test artifacts
    video: 'off',

    // Retain a trace for every failed attempt, including local failures where
    // retries are disabled. A retry is evidence to inspect, not a substitute
    // for diagnosing synchronization or product state.
    trace: 'retain-on-failure',

    // Use "domcontentloaded" instead of "networkidle" by default.
    // "networkidle" waits for ALL network activity to stop — can be slow on
    // dev servers with HMR; static E2E build avoids that.
    // "domcontentloaded" fires as soon as the DOM is ready.
    // Individual tests can override with page.waitForLoadState("networkidle")
    // when they specifically need it.
    navigationTimeout: 20_000,
  },

  // Failure screenshots and traces go to the gitignored output folder
  outputDir: '.cursor/playwright-output/e2e-failures',

  projects: [
    {
      name: 'chromium',
      // Feature tests use the DB harness through Playwright routing. Blocking
      // service workers here prevents a previously registered worker from
      // bypassing that route; infrastructure.spec.ts opts back into worker
      // control for the dedicated service-worker assertions.
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
      // Journey specs must not run in the default E2E suite (they have their
      // own project, longer timeouts, and are serial/continuity-based).
      // pwa-update.spec.ts has its own lane (real workers required).
      testIgnore: ['**/e2e/journeys/**', '**/e2e/pwa-update.spec.ts'],
    },
    {
      // Dedicated PWA update-lifecycle lane (audit AREA 9): registration,
      // waiting-worker detection, SKIP_WAITING apply + single gated reload,
      // connectivity indicator. Needs REAL service workers, so it cannot
      // share the chromium project (which blocks them for the DB harness).
      // Opt-in via --project=pwa; serial because every test registers a
      // worker against the shared localhost origin.
      name: 'pwa',
      testMatch: /pwa-update\.spec\.ts/,
      timeout: 90_000,
      expect: { timeout: 10_000 },
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
    },
    {
      name: 'journeys',
      testDir: 'e2e/journeys',
      // Continuity journeys are long (multi-step, multiple reloads, seeding)
      // and must never run in parallel (OPFS holds one lock per origin).
      timeout: 120_000,
      expect: { timeout: 10_000 },
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
    },
    {
      name: 'simulation',
      // The runner's own integration specs (task 3.4): the scenario executor
      // under Playwright against the served dist/ export. Each spec drives the
      // full runner (executeScenario) — the smoke scenario twice in
      // deterministic mode (3.5) and the cross-lane reports (4.4). The specs
      // launch their own contexts through the injected `browser` fixture;
      // `workers: 1` because OPFS holds one lock per origin. CI wiring for the
      // simulation lanes is task 9.x — this project is opt-in via
      // `--project=simulation` and also participates in the default `e2e` run.
      testDir: 'simulation/runner/specs',
      timeout: 300_000,
      expect: { timeout: 10_000 },
      workers: 1,
      fullyParallel: false,
      retries: 0,
      // The scenario executor owns tracing for its independently-created
      // contexts so repro bundles can stop/retain the focused trace. The
      // global retain-on-failure policy would auto-start a second trace under
      // current Playwright and fail before the scenario executes.
      use: { ...devices['Desktop Chrome'], trace: 'off' },
    },
    {
      // Dedicated dist-sync lane (OpenSpec task 6.1a / Q5): the remote-boundary
      // journey branches (J3 reconnect-push, J4 backend failures, J5 restore
      // round-trip — all tagged @sync) run FOR REAL here against the
      // dummy-Supabase `dist-sync/` export, served by its own webServer on
      // :8082 (the port-arg version of scripts/serve-e2e.js). In the standard
      // projects those branches stay runtime-gated (test.fixme when the served
      // build has no Supabase boundary) and show as skipped.
      //
      // This project is OPT-IN via `npm run e2e:sync` and is deliberately NOT
      // part of the default run — the default `npm run e2e` script lists the
      // three standard projects explicitly, so PR feedback never waits on the
      // dist-sync build. Main/nightly CI builds dist-sync/ first, then runs
      // this lane. `E2E_BASE_URL`/`E2E_DIST_DIR` are set by the e2e:sync script
      // so the DB harness (APP_BASE_URL, wa-sqlite asset dir) and globalSetup
      // target :8082/dist-sync.
      name: 'journeys-sync',
      testDir: 'e2e/journeys',
      grep: /@sync/,
      timeout: 180_000,
      expect: { timeout: 10_000 },
      workers: 1,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], baseURL: e2eBaseUrl, serviceWorkers: 'block' },
    },
  ],

  globalSetup: './e2e/global.setup.ts',
  globalTeardown: './e2e/global.teardown.ts',

  // The web server is config-global in this Playwright version (no per-project
  // webServer). Use E2E_PORT when another development server owns :8081;
  // reuse is opt-in because a stale dev server can silently become the system
  // under test.
  webServer: {
    command:
      process.env.E2E_DIST_DIR === 'dist-sync'
        ? `node scripts/serve-e2e.js --port ${e2ePort} --dist dist-sync`
        : `node scripts/serve-e2e.js --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer,
    timeout: 180_000,
  },
});
