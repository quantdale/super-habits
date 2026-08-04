## Why

The restore round-trip defined by `add-real-world-user-simulation-testing` (journey **J5 — "New phone"**, risk **R3**) is unusable on the web PWA whenever the service worker is active.

`public/sw.js` routes **every GET** through its `fetch` handler:

```js
event.respondWith(
  caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then(...).catch(() => cached);
  }),
);
```

The restore-eligibility check issues **cross-origin** data GETs to the Supabase host (`GET /rest/v1/<entity>?select=updated_at…`). The handler intercepts them: `caches.match` misses (the SW cache is the same-origin app shell), so it tries `fetch`, and when that cross-origin fetch/cache fails the `.catch(() => cached)` resolves with `cached` — **`undefined`**. `respondWith(undefined)` produces `net::ERR_FAILED` / "TypeError: Failed to fetch", so `getRestorePreview()` reports `remoteState: 'error'` and **the restore prompt can never appear** while the SW controls the page.

J5 observed this directly and had to stub out the service worker test-side (`stubOutServiceWorker` in `e2e/journeys/new-phone.spec.ts`) before the restore contract was even observable — a test-side mitigation, explicitly flagged in-spec as a defect to be filed, with no app change and no weakened assertion.

## What Changes

- **Bypass the SW `fetch` handler for cross-origin requests** in `public/sw.js`: if `new URL(event.request.url).origin !== self.location.origin` (or the request is a data/API GET — specifically anything that is not part of the same-origin app shell), skip `event.respondWith` entirely and let the browser handle the request natively. The shell cache (`/`, `/index.html`, icons, manifest) is a same-origin concern; restore data GETs are not.
- **Or, equivalently, never resolve `respondWith(undefined)`**: e.g. `event.respondWith(cached ?? fetch(event.request))` so the promise always yields a Response, or make the handler no-op (no `respondWith`) for requests the shell cache does not own. The cache-and-forward shell behaviour for same-origin GETs must be preserved.
- **Verify on the restore lane**: `J5`'s remote-gated branches already run on the dummy-Supabase `dist-sync/` build (task 6.1a / Q5). With this fix, the `stubOutServiceWorker` mitigation can be removed from `e2e/journeys/new-phone.spec.ts` and the journey exercises the real SW against the restore boundary.

## Capabilities

### New Capabilities

- `restore-over-service-worker`: the restore-eligibility and import GETs reach the Supabase origin even while the app-shell service worker controls the page, so the restore prompt can appear on a genuinely empty device.

### Modified Capabilities

- None. The restore eligibility/import flow (D5, Q5) is unchanged; this only stops the SW from breaking cross-origin data requests.

## Impact

- **Modified files**: `public/sw.js` (cross-origin bypass / no-undefined `respondWith`), `e2e/journeys/new-phone.spec.ts` (remove the `stubOutServiceWorker` mitigation once the lane runs), possibly `docs/testing/known-gaps.md` (if a quarantine entry was added pending the lane).
- **Behaviour change**: no change for same-origin shell requests (still cache-first with network fallback); cross-origin (Supabase) requests now bypass the SW entirely, restoring normal CORS/fetch behaviour.
- **No schema/migration impact**: no SQLite or `app_meta` changes.
- **Testing**: J5's restore branches (dismiss, no re-prompt, blocked-after-data, import, not-restored) run against the real SW on the dist-sync lane.
- **Follow-up changes**: none anticipated; this closes the J5 SW finding.
