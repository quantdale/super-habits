import { chromium } from "@playwright/test";
import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app and wait for it to be healthy before any tests run
  await page.goto("http://localhost:8081", {
    waitUntil: "load",
    timeout: 120_000,
  });
  await page.waitForLoadState("load", { timeout: 120_000 });

  // Confirm crossOriginIsolated — abort early if headers are wrong
  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  if (!isolated) {
    throw new Error(
      "E2E setup failed: crossOriginIsolated is false. " +
        "Check COEP/COOP headers in metro.config.js and app.json. " +
        "Run /pre-pr to diagnose."
    );
  }

  await browser.close();
}

export default globalSetup;
