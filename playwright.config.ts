import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

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
      "html",
      {
        outputFolder: ".cursor/playwright-output/e2e-report",
        open: "never",
      },
    ],
    // Also log to terminal during run so you can see progress
    ["list"],
  ],

  use: {
    baseURL: "http://localhost:8081",
    headless: true,

    // Only capture screenshot on failure — avoids disk bloat
    screenshot: "only-on-failure",

    // Store failure screenshots in the gitignored output folder
    // Note: Playwright uses outputDir for test artifacts
    video: "off",

    // Capture trace on first retry — helps diagnose flaky tests in CI
    trace: "on-first-retry",

    // Use "domcontentloaded" instead of "networkidle" by default.
    // "networkidle" waits for ALL network activity to stop — can be slow on
    // dev servers with HMR; static E2E build avoids that.
    // "domcontentloaded" fires as soon as the DOM is ready.
    // Individual tests can override with page.waitForLoadState("networkidle")
    // when they specifically need it.
    navigationTimeout: 20_000,
  },

  // Failure screenshots and traces go to the gitignored output folder
  outputDir: ".cursor/playwright-output/e2e-failures",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: "./e2e/global.setup.ts",
  globalTeardown: "./e2e/global.teardown.ts",

  webServer: {
    command: "node scripts/serve-e2e.js",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});