import { type Page } from '@playwright/test';

/**
 * Remote-failure injection at the network boundary for the sync engine.
 *
 * The app pushes to Supabase (`lib/supabase.ts` reads
 * `EXPO_PUBLIC_SUPABASE_URL`; leaves the adapter a no-op when unset, but in a
 * build that bundled the env, `supabase-js` fetches `{origin}/rest/v1/...` and
 * `{origin}/auth/v1/...`). All injectors target a glob that matches any
 * `*.supabase.co` host (see the `SUPABASE_ROUTE` constant below), so they work
 * for any configured origin WITHOUT knowing it in advance — and are inert on
 * local-only builds because no such request is ever made.
 *
 * Offline is simulated with `context.setOffline()`, which also drives NetInfo
 * on web (online/offline events). Routing is layered on top: Playwright routes
 * are still fulfilled even when offline, so journeys must pick one mechanism
 * per phase — offline to accumulate an outbox, routes to simulate a broken
 * backend while online.
 *
 * Multiple injectors replace each other for the same pattern; call
 * `clearInjectedFailures()` to restore pass-through.
 */

/** Entities the sync engine pushes (matches `SYNCABLE_ENTITIES` in the adapter). */
export const SYNCABLE_ENTITIES = [
  'todos',
  'habits',
  'calorie_entries',
  'workout_routines',
] as const;

export type SyncEntity = (typeof SYNCABLE_ENTITIES)[number];

const SUPABASE_ROUTE = '**/*.supabase.co/**';

/**
 * Simulate loss of connectivity. Affects all origin requests (the app page is
 * already loaded, so only Supabase calls fail; local OPFS writes keep working).
 */
export async function setOffline(page: Page, offline: boolean): Promise<void> {
  await page.context().setOffline(offline);
}

/**
 * Fulfil every Supabase request (REST and auth) with an HTTP error (default
 * 503). Use to exercise the backoff schedule and the error state in Settings.
 */
export async function injectServerError(page: Page, opts: { status?: number } = {}): Promise<void> {
  const status = opts.status ?? 503;
  await routeSupabase(page, (route) => {
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: '{"error":"injected server error"}',
    });
  });
}

/**
 * Simulate a request the server never answers: abort after the client's own
 * timeout would have fired. The sync adapter treats this like a network error
 * and requeues.
 */
export async function injectTimeout(page: Page): Promise<void> {
  await routeSupabase(page, (route) => {
    // Deliberately never fulfil. In practice Playwright aborts routed requests
    // when the test ends; for the app this reads as a stalled request, which is
    // what a real timeout looks like. Use a long delay so the app's own
    // timeout/abort is what surfaces.
    setTimeout(() => {
      route.abort('timedout').catch(() => {});
    }, 60_000);
  });
}

/**
 * Fulfil every Supabase request with an unparseable body (status 200,
 * invalid JSON). Exercises the adapter/parser robustness paths.
 */
export async function injectMalformed(page: Page): Promise<void> {
  await routeSupabase(page, (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
  });
}

/**
 * Partial per-entity failure: requests for the listed entities fail with
 * `status`, all other Supabase requests pass through. This is what produces a
 * `SyncPushPartialFailureError` — only the failed entity's records requeue.
 */
export async function injectPartialFailure(
  page: Page,
  opts: { failingEntities: SyncEntity[]; status?: number },
): Promise<void> {
  const failing = new Set<string>(opts.failingEntities);
  const status = opts.status ?? 503;
  await routeSupabase(page, (route) => {
    const url = route.request().url();
    const entityHit = SYNCABLE_ENTITIES.find((e) => url.includes(`/rest/v1/${e}`));
    if (entityHit && failing.has(entityHit)) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: '{"error":"injected partial failure"}',
      });
    }
    return route.continue();
  });
}

/** Remove all interceptors, restoring real (pass-through) network behaviour. */
export async function clearInjectedFailures(page: Page): Promise<void> {
  await page.unroute(SUPABASE_ROUTE);
}

async function routeSupabase(
  page: Page,
  handler: (route: import('@playwright/test').Route) => void | Promise<void>,
): Promise<void> {
  await page.unroute(SUPABASE_ROUTE);
  await page.route(SUPABASE_ROUTE, (route) => handler(route));
}
