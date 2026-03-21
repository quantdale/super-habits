import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // OPFS + expo-sqlite holds one lock per origin; parallel workers against localhost:8081
  // cause reload/goto timeouts and flaky DB init — must run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0, // retry twice on CI, never locally
  // Metro + parallel workers can exceed 30s for first navigation; keep assertions snappy
  timeout: 90_000,
  expect: { timeout: 8_000 },
  forbidOnly: !!process.env.CI, // prevent test.only from being committed
  reporter: [
    [
      "html",
      {
        outputFolder: ".cursor/playwright-output/e2e-report",
        open: "never", // do not auto-open in CI
      },
    ],
  ],
  outputDir: ".cursor/playwright-output/e2e-failures",
  globalSetup: "./e2e/global.setup.ts",
  globalTeardown: "./e2e/global.teardown.ts",
  use: {
    baseURL: "http://localhost:8081",
    headless: true,
    navigationTimeout: 75_000,
    screenshot: "only-on-failure",
    video: "off",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Do not start a web server — npm run web must already be running
  // webServer is intentionally omitted; see e2e/README.md
});
