import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect } from './fixtures';
import { APP_BASE_URL } from './helpers/dbHarness';

test.use({ serviceWorkers: 'allow' });

const PUBLIC_SW_PATH = path.resolve(process.cwd(), 'public', 'sw.js');

function cacheVersionOf(source: string): string | null {
  return source.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
}

test.describe('Infrastructure', () => {
  test('crossOriginIsolated is true', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    expect(isolated).toBe(true);
  });

  test('SharedArrayBuffer is available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    const sabAvailable = await page.evaluate(() => typeof SharedArrayBuffer !== 'undefined');
    expect(sabAvailable).toBe(true);
  });

  test('COEP header is require-corp', async ({ page }) => {
    const response = await page.goto('/');
    const coep = response?.headers()['cross-origin-embedder-policy'];
    expect(coep).toBe('require-corp');
  });

  test('COOP header is same-origin', async ({ page }) => {
    const response = await page.goto('/');
    const coop = response?.headers()['cross-origin-opener-policy'];
    expect(coop).toBe('same-origin');
  });

  test('service worker registers and controls the page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
      timeout: 10_000,
    });
    const swActive = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    expect(swActive).toBe(true);
  });

  test('served /sw.js is fresh (matches public/sw.js)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    // Freshness invariant (audit AREA 9 F2): the served worker must carry the
    // same CACHE_VERSION as public/sw.js in the repo. A literal version pin
    // here passed against a stale dist/ build and broke on the next rebuild;
    // this fails loudly with the remedy instead.
    const swSource = await page.evaluate(async () => {
      const r = await fetch('/sw.js', { cache: 'no-store' });
      return r.text();
    });
    expect(swSource).toContain('superhabits-shell-');
    const publicSource = fs.readFileSync(PUBLIC_SW_PATH, 'utf8');
    const servedVersion = cacheVersionOf(swSource);
    const publicVersion = cacheVersionOf(publicSource);
    expect(
      servedVersion,
      `dist/sw.js (CACHE_VERSION=${servedVersion}) is stale vs public/sw.js (${publicVersion}) — run \`npm run build:web\`.`,
    ).toEqual(publicVersion);
  });

  test('stale v1 cache is not present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    const cacheKeys = await page.evaluate(async () => caches.keys());
    expect(cacheKeys).not.toContain('superhabits-shell-v1');
  });

  test('SW runtime-caches same-origin assets (dev bypass disabled for E2E)', async ({ page }) => {
    // Audit AREA 9 F5: serve-e2e.js neutralizes the localhost dev bypass, so
    // the real fetch handler runs here. A URL outside the precache/warm set
    // must land in the shell cache after a successful same-origin GET —
    // proof that cache read/write actually executes on localhost.
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 10_000,
    });
    const status = await page.evaluate(async () => {
      const r = await fetch('/_sitemap.html', { cache: 'no-store' });
      return r.status;
    });
    expect(status).toBe(200);
    const foundIn = await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        if (await caches.match('/_sitemap.html', { cacheName: name })) return name;
      }
      return null;
    });
    expect(foundIn).toContain('superhabits-shell-');
  });

  test('second tab gets OPFS lock error when first is open', async () => {
    test.setTimeout(90_000);
    const browser = await chromium.launch({ headless: true });
    // Same browser context = shared OPFS (separate contexts each have their own OPFS)
    const context = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto(APP_BASE_URL);
    await page1.waitForLoadState('load');
    await page1.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 30_000 });
    await page1.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
      timeout: 30_000,
    });

    const page2 = await context.newPage();
    const errors: string[] = [];
    const pageErrors: string[] = [];
    page2.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page2.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    await page2.goto(APP_BASE_URL);
    await page2.waitForLoadState('load');
    await expect(page2.getByText('Unable to start', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const combined = [...errors, ...pageErrors].join('\n');
    const hasLockError =
      combined.includes('createSyncAccessHandle') ||
      combined.includes('NoModificationAllowedError') ||
      combined.includes('initializeDatabase failed') ||
      combined.includes('Unable to open') ||
      combined.includes('database is locked');

    await browser.close();
    expect(hasLockError).toBe(true);
  });

  test('no DB init error on clean load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
      timeout: 30_000,
    });

    const dbError = errors.find((e) => e.includes('initializeDatabase failed'));
    expect(dbError).toBeUndefined();
  });
});
