import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // The standard projects serve dist/ on :8081 (the default); the dedicated
  // journeys-sync lane serves dist-sync/ on :8082 via `npm run e2e:sync`,
  // which sets E2E_BASE_URL. Validate whichever base this run targets
  // (Playwright starts that project's webServer before globalSetup runs).
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app and wait for it to be healthy before any tests run
  await page.goto(baseUrl, {
    waitUntil: 'load',
    timeout: 120_000,
  });
  await page.waitForLoadState('load', { timeout: 120_000 });

  // Confirm crossOriginIsolated — abort early if headers are wrong
  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  if (!isolated) {
    throw new Error(
      `E2E setup failed: crossOriginIsolated is false on ${baseUrl}. ` +
        'Check COEP/COOP headers in metro.config.js and app.json. ' +
        'Run /pre-pr to diagnose.',
    );
  }

  await browser.close();
}

export default globalSetup;
