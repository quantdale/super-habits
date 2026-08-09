import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // The standard projects serve dist/ on :8081 by default. E2E_PORT allows an
  // isolated local server when another development server owns that port;
  // journeys-sync sets E2E_BASE_URL explicitly.
  const port = process.env.E2E_PORT ?? (process.env.E2E_DIST_DIR === 'dist-sync' ? '8082' : '8081');
  const baseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
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
