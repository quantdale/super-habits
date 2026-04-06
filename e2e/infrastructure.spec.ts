import { test, expect, chromium } from "@playwright/test";

test.describe("Infrastructure", () => {
  test("crossOriginIsolated is true", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isolated).toBe(true);
  });

  test("SharedArrayBuffer is available", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const sabAvailable = await page.evaluate(() => typeof SharedArrayBuffer !== "undefined");
    expect(sabAvailable).toBe(true);
  });

  test("COEP header is require-corp", async ({ page }) => {
    const response = await page.goto("/");
    const coep = response?.headers()["cross-origin-embedder-policy"];
    expect(coep).toBe("require-corp");
  });

  test("COOP header is same-origin", async ({ page }) => {
    const response = await page.goto("/");
    const coop = response?.headers()["cross-origin-opener-policy"];
    expect(coop).toBe("same-origin");
  });

  test("service worker registers and controls the page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
      timeout: 10_000,
    });
    const swActive = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    expect(swActive).toBe(true);
  });

  test("SW cache name matches superhabits-shell version", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    // On localhost, dev bypass may leave CacheStorage empty; assert the registered SW script defines the name.
    const swSource = await page.evaluate(async () => {
      const r = await fetch("/sw.js", { cache: "no-store" });
      return r.text();
    });
    expect(swSource).toContain("superhabits-shell-");
    expect(swSource).toContain('CACHE_VERSION = "v3"');
  });

  test("stale v1 cache is not present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const cacheKeys = await page.evaluate(async () => caches.keys());
    expect(cacheKeys).not.toContain("superhabits-shell-v1");
  });

  test("localhost serves assets from network not SW cache", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const transferSize = await page.evaluate(
      () => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.transferSize ?? -1,
    );
    expect(transferSize).toBeGreaterThan(0);
  });

  test("second tab gets OPFS lock error when first is open", async () => {
    test.setTimeout(90_000);
    const browser = await chromium.launch({ headless: true });
    // Same browser context = shared OPFS (separate contexts each have their own OPFS)
    const context = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto("http://localhost:8081");
    await page1.waitForLoadState("load");
    await page1.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 30_000 });
    await page1.waitForTimeout(3_000);

    const page2 = await context.newPage();
    const errors: string[] = [];
    const pageErrors: string[] = [];
    page2.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page2.on("pageerror", (err) => {
      pageErrors.push(String(err));
    });

    await page2.goto("http://localhost:8081");
    await page2.waitForLoadState("load");
    await page2.waitForTimeout(4_000);

    const combined = [...errors, ...pageErrors].join("\n");
    const hasLockError =
      combined.includes("createSyncAccessHandle") ||
      combined.includes("NoModificationAllowedError") ||
      combined.includes("initializeDatabase failed") ||
      combined.includes("Unable to open") ||
      combined.includes("database is locked");

    await browser.close();
    expect(hasLockError).toBe(true);
  });

  test("no DB init error on clean load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    const dbError = errors.find((e) => e.includes("initializeDatabase failed"));
    expect(dbError).toBeUndefined();
  });
});
