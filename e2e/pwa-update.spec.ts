import { type Page, test, expect } from './fixtures';

/**
 * PWA update-lifecycle specs (audit AREA 9): connectivity indicator,
 * waiting-worker banner semantics, the gated single-reload apply flow, and
 * ignored-update resurfacing. Runs in the dedicated `pwa` project with real
 * service workers enabled (`serviceWorkers: 'allow'`) against dist/ served by
 * scripts/serve-e2e.js, which neutralizes the localhost dev bypass so the
 * real fetch handler executes.
 *
 * Update detection strategy: Playwright cannot intercept service-worker
 * script fetches with page.route, so specs flip a marker on the E2E server
 * (POST /__e2e__/sw-variant/<marker>) that changes the served /sw.js bytes,
 * then force detection with registration.update(). register() on every page
 * load re-checks the same bytes, so reloads are deterministic too: variant
 * bytes vs an installed original worker produce a waiting worker; identical
 * bytes after apply produce steady state.
 *
 * Cross-tab note: the app holds one OPFS SQLite lock per context, so a second
 * app tab lands on the "Unable to start" card — but registerServiceWorker()
 * runs BEFORE database init (AppProviders), so that tab still exercises the
 * real gated update module. It is used as the bystander that must never
 * auto-reload.
 */

test.use({ serviceWorkers: 'allow' });

const LOAD_COUNTER_KEY = '__pwa_e2e_loads';
const OFFLINE_PILL_TEXT = 'Offline — changes stay on this device';

/** Count of document loads in this tab; sessionStorage survives reloads. */
async function getLoadCount(page: Page): Promise<number> {
  return page.evaluate((key) => Number(sessionStorage.getItem(key) ?? '0'), LOAD_COUNTER_KEY);
}

function installLoadCounter(page: Page): Promise<unknown> {
  return page.addInitScript((key) => {
    const current = Number(sessionStorage.getItem(key) ?? '0');
    sessionStorage.setItem(key, String(current + 1));
  }, LOAD_COUNTER_KEY);
}

async function waitForControlled(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout,
  });
}

async function waitForDbReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
    timeout,
  });
}

async function waitForShell(page: Page, timeout = 30_000): Promise<void> {
  await page.getByRole('button', { name: 'Today', exact: true }).first().waitFor({ timeout });
}

/** Change the served /sw.js bytes via the E2E server's variant endpoint. */
async function setSwVariant(page: Page, marker: string): Promise<void> {
  const response = await page.request.post(`/__e2e__/sw-variant/${marker}`);
  if (!response.ok()) {
    throw new Error(`failed to set sw variant (${response.status()}): ${marker}`);
  }
}

/** Force a service-worker update check against the (possibly varied) /sw.js. */
async function triggerUpdateCheck(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('no service worker registration');
    await registration.update();
  });
}

/**
 * NetInfo's web implementation listens on navigator.connection 'change' when
 * the Network Information API exists (Chromium), and CDP offline emulation
 * does not fire that event. Nudge it so the listener recomputes from
 * navigator.onLine; harmless when only window online/offline listeners exist.
 */
async function nudgeConnectivityListeners(page: Page): Promise<void> {
  await page.evaluate(() => {
    const connection = (navigator as { connection?: EventTarget }).connection;
    connection?.dispatchEvent(new Event('change'));
  });
}

test.describe('PWA update lifecycle', () => {
  test('offline indicator appears when offline and clears when back online', async ({ page }) => {
    await installLoadCounter(page);
    await page.goto('/');
    await waitForShell(page);

    const pill = page.getByText(OFFLINE_PILL_TEXT);
    await expect(pill).toHaveCount(0);

    await page.context().setOffline(true);
    await nudgeConnectivityListeners(page);
    await expect(pill).toBeVisible();

    await page.context().setOffline(false);
    await nudgeConnectivityListeners(page);
    await expect(pill).toBeHidden();
  });

  test('first visit claims control without reloading or showing the banner', async ({ page }) => {
    // Audit AREA 9 F1 regression: clients.claim() on first visit dispatches
    // controllerchange; the app must neither reload nor show the banner.
    await installLoadCounter(page);
    await page.goto('/');
    await waitForControlled(page);
    // Give the claim-driven controllerchange a beat to (wrongly) fire.
    await page.waitForTimeout(1_500);

    await expect(page.getByText('Update available', { exact: true })).toHaveCount(0);
    expect(await getLoadCount(page)).toBe(1);
  });

  test('apply-update activates with exactly one reload; bystander tabs never reload', async ({
    page,
  }) => {
    await installLoadCounter(page);
    await page.goto('/');
    await waitForControlled(page);
    await waitForDbReady(page);

    await setSwVariant(page, 'apply-once');
    await triggerUpdateCheck(page);
    await page.getByText('Update available', { exact: true }).waitFor({ timeout: 20_000 });

    // Bystander app tab: shares the context and SW registration. It cannot
    // open the OPFS database (page1 holds the lock) but still runs the real
    // gated update module, which is exactly what must not self-reload.
    const bystander = await page.context().newPage();
    await installLoadCounter(bystander);
    await bystander.goto('/');
    await bystander.waitForTimeout(1_000);
    const bystanderLoadsBefore = await getLoadCount(bystander);

    // Arm the load listener before the worker-driven reload. Polling
    // sessionStorage while the old execution context is being torn down can
    // otherwise fail with "Execution context was destroyed".
    const reloadPromise = page.waitForEvent('load', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Apply app update' }).click();
    await reloadPromise;

    // Loads: initial (1) + apply reload (2).
    await expect.poll(() => getLoadCount(page), { timeout: 20_000 }).toBe(2);
    // AT MOST once: no further reload may follow.
    await page.waitForTimeout(2_000);
    expect(await getLoadCount(page)).toBe(2);

    // Steady state: shell is healthy, variant worker active, nothing waiting.
    await waitForShell(page);
    await expect(page.getByText('Update available', { exact: true })).toHaveCount(0);

    // The bystander tab must have kept running without interruption.
    expect(await getLoadCount(bystander)).toBe(bystanderLoadsBefore);
  });

  test('dismissed update resurfaces on the next visit', async ({ page }) => {
    await installLoadCounter(page);
    await page.goto('/');
    await waitForControlled(page);
    await waitForDbReady(page);

    await setSwVariant(page, 'resurface');
    await triggerUpdateCheck(page);
    const banner = page.getByText('Update available', { exact: true });
    await banner.waitFor({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Dismiss update banner' }).click();
    await expect(banner).toHaveCount(0);

    // Next visit: the waiting worker is still there; the banner returns.
    await page.reload();
    await page.getByText('Update available', { exact: true }).waitFor({ timeout: 20_000 });
  });

  test('reload during registration never surfaces an unhandled rejection (WM2.4)', async ({
    page,
  }) => {
    // WM2.4 regression gate: when a reload lands while register() is in
    // flight, navigator.serviceWorker.register() can resolve undefined and
    // workbox's internal registration.waiting access rejects. The app's
    // registration boundary must swallow it (log + retry next load), never
    // surface it as an unhandled page error.
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));

    // Reload as early as possible, twice, to maximize the chance of landing
    // inside the register() window on both cold and controlled loads.
    await page.goto('/');
    await page.reload({ waitUntil: 'commit' });
    await page.reload({ waitUntil: 'commit' });
    await waitForShell(page);
    await waitForControlled(page);
    await waitForDbReady(page);

    const waitingCrash = pageErrors.find((message) => message.includes("reading 'waiting'"));
    expect(
      waitingCrash,
      `unhandled SW registration crash: ${pageErrors.join(' | ')}`,
    ).toBeUndefined();
  });
});
