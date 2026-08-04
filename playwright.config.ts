import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Tests within the same file run serially by default (fullyParallel: false).
  fullyParallel: false,

  // OPFS + expo-sqlite hold one lock per origin; parallel workers against
  // localhost:8081 cause flaky navigation/reload (see config comments).
  // Keep fullyParallel false so tests within a file stay serial (clearDatabase()
  // in beforeEach must not race).
  workers: process.env.CI ? 2 : 1,

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
    baseURL: 'http://localhost:8081',
    headless: true,

    // Only capture screenshot on failure — avoids disk bloat
    screenshot: 'only-on-failure',

    // Store failure screenshots in the gitignored output folder
    // Note: Playwright uses outputDir for test artifacts
    video: 'off',

    // Capture trace on first retry — helps diagnose flaky tests in CI
    trace: 'on-first-retry',

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
      use: { ...devices['Desktop Chrome'] },
      // Journey specs must not run in the default E2E suite (they have their
      // own project, longer timeouts, and are serial/continuity-based).
      testIgnore: '**/e2e/journeys/**',
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
      use: { ...devices['Desktop Chrome'] },
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
      use: { ...devices['Desktop Chrome'] },
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
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8082' },
    },
  ],

  globalSetup: './e2e/global.setup.ts',
  globalTeardown: './e2e/global.teardown.ts',

  // The web server is config-global in this Playwright version (no per-project
  // webServer), so it branches on the targeted build env: the default projects
  // serve dist/ on :8081; the dedicated journeys-sync lane (`npm run e2e:sync`)
  // sets E2E_DIST_DIR=dist-sync and serves dist-sync/ on :8082 via the
  // port-arg server. Default behavior (8081 → dist/) is unchanged.
  webServer:
    process.env.E2E_DIST_DIR === 'dist-sync'
      ? {
          command: 'node scripts/serve-e2e.js --port 8082 --dist dist-sync',
          url: 'http://localhost:8082',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        }
      : {
          command: 'node scripts/serve-e2e.js',
          url: 'http://localhost:8081',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
});
