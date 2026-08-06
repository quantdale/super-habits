## ADDED Requirements

### Requirement: The service worker does not intercept cross-origin data requests
The app-shell service worker (`public/sw.js`) SHALL NOT intercept requests whose origin differs from the app origin. For a cross-origin request — including the restore-eligibility and import data GETs to the Supabase host — the `fetch` handler SHALL skip `event.respondWith` entirely and let the browser handle the request natively. The restore prompt SHALL be able to appear on a genuinely empty device while the service worker controls the page.

#### Scenario: Restore-eligibility GETs reach Supabase with the SW active
- **WHEN** the app-shell service worker controls the page and `getRestorePreview()` issues cross-origin data GETs to the Supabase host
- **THEN** the requests reach the Supabase origin natively, no `net::ERR_FAILED` occurs, and `getRestorePreview()` reports the real remote state so the restore prompt can appear.

### Requirement: The SW never resolves `respondWith` with a non-Response
For any request the service worker does handle, the `respondWith` promise SHALL always resolve to a `Response` — never `undefined`. A cache miss followed by a failed network fetch SHALL NOT produce a resolved-`undefined` response.

#### Scenario: Cache miss plus network failure on a handled request
- **WHEN** a same-origin request misses the shell cache and the network fetch fails
- **THEN** the handler either responds with a real fallback `Response` or does not call `respondWith` at all; it never resolves `undefined`.

### Requirement: Same-origin shell caching behaviour is preserved
Same-origin GETs for the app shell (`/`, `/index.html`, icons, manifest) SHALL continue to use cache-first with network fallback exactly as today.

#### Scenario: Shell assets are still served cache-first
- **WHEN** the app requests a same-origin shell asset that is present in the shell cache
- **THEN** the cached response is served without a network fetch, and a cache miss falls back to the network and populates the cache as before.
