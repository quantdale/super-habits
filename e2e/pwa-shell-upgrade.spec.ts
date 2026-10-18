import { type Page, test, expect } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';

/**
 * AUD-SH05-A/B — a REAL two-build PWA shell upgrade.
 *
 * The audited defect: the worker blob was byte-identical across shell revisions,
 * so a browser never installed the new worker and existing clients kept serving
 * the old precached shell from a cache-first handler. `e2e/pwa-update.spec.ts`
 * covers the update MACHINERY by flipping a synthetic server-side worker variant;
 * that proves the banner/apply plumbing but explicitly cannot prove the
 * production revision step. This spec uses two ACTUAL exports:
 *
 *   build A (this `dist/`, served on :8081)          → the installed client
 *   build B (`dist-shell-b/`, served from the SAME origin/port mid-test) →
 *            different shell bytes, therefore a different generated revision
 *
 * and asserts the observable upgrade: a waiting worker appears, the in-app
 * "Update available" banner shows, the explicit apply reloads exactly the tab
 * that asked, the new shell content is served, and the SQLite data written under
 * build A survives.
 *
 * Preparation: `npm run build:e2e` produces `dist/`; this spec additionally
 * requires `dist-shell-b/` (see `scripts/prepare-shell-b.mjs`, run by the
 * `e2e:shell-upgrade` script). When it is absent the spec SKIPS with an explicit
 * reason instead of silently passing.
 */

test.use({ serviceWorkers: 'allow' });

const LOAD_COUNTER_KEY = '__pwa_shell_b_loads';

async function getLoadCount(page: Page): Promise<number> {
  return page.evaluate((key) => Number(sessionStorage.getItem(key) ?? '0'), LOAD_COUNTER_KEY);
}

function installLoadCounter(page: Page): Promise<unknown> {
  return page.addInitScript((key) => {
    const current = Number(sessionStorage.getItem(key) ?? '0');
    sessionStorage.setItem(key, String(current + 1));
  }, LOAD_COUNTER_KEY);
}

async function waitForControlled(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout });
}

async function waitForDbReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
    timeout,
  });
}

/** The worker revision the browser currently has installed. */
async function installedWorkerRevision(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
    if (!worker?.scriptURL) return '';
    const response = await fetch(worker.scriptURL, { cache: 'no-store' });
    const source = await response.text();
    return /const CACHE_VERSION = '([^']+)'/.exec(source)?.[1] ?? '';
  });
}

/**
 * The revision of the worker the SERVER is currently serving.
 *
 * Fetched from the Playwright request context, not the page: once a worker
 * controls the page it may answer `/sw.js` itself, and a worker script request
 * also bypasses the page's HTTP cache only sometimes. Going through the test
 * runner's own request keeps this a true statement about the server.
 */
async function servedWorkerRevision(page: Page): Promise<string> {
  const response = await page.request.get('/sw.js', { headers: { 'cache-control': 'no-cache' } });
  const source = await response.text();
  return /const CACHE_VERSION = '([^']+)'/.exec(source)?.[1] ?? '';
}

/** Whether `dist-shell-b/` was prepared for this run. */
function shellBAvailable(): boolean {
  return process.env.E2E_SHELL_B_READY === '1';
}

test.describe('real two-build shell upgrade', () => {
  test.skip(
    () => !shellBAvailable(),
    'requires dist-shell-b/ (run `npm run e2e:shell-upgrade`, which prepares it)',
  );

  test('build B installs, applies explicitly, and preserves local data', async ({ page }) => {
    test.setTimeout(180_000);
    // Start from build A: the server process is shared across this file, so a
    // previous test's switch must not be inherited.
    await page.request.post('/__e2e__/serve-shell-a');
    await installLoadCounter(page);
    await page.goto('/');
    await waitForControlled(page);
    await waitForDbReady(page);

    const revisionA = await installedWorkerRevision(page);
    expect(revisionA, 'the built worker must carry a generated revision').toMatch(
      /^sha-[0-9a-f]+$/,
    );

    // Local data written under build A must survive the upgrade. Uses the shared
    // navigation helpers so the modal interaction matches every other spec.
    const todoTitle = `shell-upgrade-${Date.now()}`;
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill(todoTitle);
    await submitTodoModal(page);
    await expect(page.getByText(todoTitle).first()).toBeVisible({ timeout: 15_000 });

    // Serve build B at the SAME origin so it is a genuine upgrade, then ask the
    // browser to check for a new worker.
    const before = await getLoadCount(page);
    await page.request.post('/__e2e__/serve-shell-b');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    // The revision really changed, which is what makes the bytes differ.
    const revisionB = await servedWorkerRevision(page);
    expect(revisionB).not.toBe(revisionA);

    // The in-app banner is the update signal; nothing reloads before the apply.
    // The banner is a text label plus an explicit "Apply app update" button.
    await page.getByText('Update available', { exact: true }).waitFor({ timeout: 60_000 });
    const banner = page.getByRole('button', { name: 'Apply app update' });
    expect(await getLoadCount(page)).toBe(before);

    // Explicit apply: this tab reloads exactly once and is controlled by B.
    await banner.click();
    await page.waitForFunction(
      (previous) => Number(sessionStorage.getItem('__pwa_shell_b_loads') ?? '0') > previous,
      before,
      { timeout: 60_000 },
    );
    await waitForControlled(page);
    await waitForDbReady(page);
    expect(await installedWorkerRevision(page)).toBe(revisionB);

    // The new shell serves the build-B document, and the data survived.
    const shellMarker = await page.evaluate(
      () => document.querySelector('meta[name="sh-build"]')?.getAttribute('content') ?? '',
    );
    expect(shellMarker).toBe('shell-b');
    await goToTab(page, 'todos');
    await expect(page.getByText(todoTitle).first()).toBeVisible({ timeout: 15_000 });
  });

  test('build B boots the critical assets with the network unavailable', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await page.request.post('/__e2e__/serve-shell-a');
    await installLoadCounter(page);
    await page.goto('/');
    await waitForControlled(page);
    await waitForDbReady(page);

    await page.request.post('/__e2e__/serve-shell-b');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await page.getByText('Update available', { exact: true }).waitFor({ timeout: 60_000 });
    const banner = page.getByRole('button', { name: 'Apply app update' });
    const before = await getLoadCount(page);
    await banner.click();
    await page.waitForFunction(
      (previous) => Number(sessionStorage.getItem('__pwa_shell_b_loads') ?? '0') > previous,
      before,
      { timeout: 60_000 },
    );
    await waitForDbReady(page);

    // Offline after apply: the precached build-B shell still boots.
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Today', exact: true }).first().waitFor({
        timeout: 60_000,
      });
      const shellMarker = await page.evaluate(
        () => document.querySelector('meta[name="sh-build"]')?.getAttribute('content') ?? '',
      );
      expect(shellMarker).toBe('shell-b');
    } finally {
      await context.setOffline(false);
    }
  });

  test('an identical shell yields an identical revision (no spurious banner)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await waitForControlled(page);
    const first = await servedWorkerRevision(page);
    // Re-checking the SAME served bytes must not produce a waiting worker.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    expect(await servedWorkerRevision(page)).toBe(first);
    await expect(page.getByText('Update available', { exact: true })).toHaveCount(0);
  });
});

test('the built worker carries no hand-maintained cache version', async ({ page }) => {
  await page.goto('/');
  const source = await page.evaluate(async () => {
    const response = await fetch('/sw.js', { cache: 'no-store' });
    return response.text();
  });
  // This is the audited regression guard: a literal `v10` cannot update a client.
  expect(source).not.toMatch(/const CACHE_VERSION = 'v\d+';/);
  expect(source).toMatch(/const CACHE_VERSION = 'sha-[0-9a-f]{8,}';/);
});
