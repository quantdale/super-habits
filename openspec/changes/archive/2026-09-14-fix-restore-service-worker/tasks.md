## 1. Service worker fix (`public/sw.js`)

- [x] 1.1 **Cross-origin bypass** → in the `fetch` handler of `public/sw.js` (lines 35–61), after the existing non-GET guard (line 36) and dev bypass (lines 40–43), return without calling `event.respondWith` when `new URL(event.request.url).origin !== self.location.origin`, so cross-origin requests (the restore eligibility/import GETs to the Supabase host) are handled natively by the browser. **(`public/sw.js`.)**
- [x] 1.2 **Never resolve `respondWith(undefined)`** → rework the same-origin fallback so the `caches.match(...).then(...).catch(() => cached)` chain (line 59) always yields a `Response` (e.g. `cached ?? fetch(event.request)` semantics), keeping cache-first with network fallback for the shell.
- [x] 1.3 **Preserve shell behavior** → same-origin GETs (`/`, `/index.html`, `manifest.json`, icons) stay cache-first with `cache.put` on success; cross-origin responses are never written into `superhabits-shell-v3`.

## 2. Journey release and tests

The SW defect has no quarantine entry — J5's remote-boundary steps already run (not `fixme`) on the `journeys-sync` lane; the change removes the test-side mitigation so they exercise the real SW. `public/sw.js` is a standalone script outside the Vitest harness (`tests/**/*.test.ts` + `core/**/__tests__/**/*.test.ts`), so coverage is the E2E lane unless a pure predicate is extracted.

- [x] 2.1 **Remove the J5 stub** → delete the `stubOutServiceWorker` helper and its FINDING comment from `e2e/journeys/new-phone.spec.ts` (lines ~225–259) and the `await stubOutServiceWorker(page)` call in step "reset to an empty device…" (line 314), so the restore branches run against the real SW.
- [x] 2.2 **Check the J4 duplicate** → `e2e/journeys/bad-backend.spec.ts` defines the same `stubOutServiceWorker` (line 66) and files the bypass under this change; confirm J4's 503/outbox determinism still holds via `page.route` alone once the SW bypass lands, and remove the stub + comment if so.
- [x] 2.3 **Do not weaken assertions** → leave the `test.fixme(!remoteBackupDetected, ...)` gates in `e2e/journeys/new-phone.spec.ts` (lines 342–509) untouched — they are a `dist/`-lane attribute, not the SW defect; the `@sync` steps keep full-strength assertions.
- [x] 2.4 **Conditional unit test** → the origin check stayed local to the standalone worker, so no pure helper was introduced; real-SW sync-lane coverage is the appropriate regression for this boundary.
- [x] 2.5 **Known-gaps check** → confirmed no `fix-restore-service-worker` quarantine entry exists in `docs/testing/known-gaps.md`; the J5 resolution note now reflects real-worker coverage.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run lint` pass with 0 errors and warnings under the existing cap.
- [x] 3.2 `npm test` passes (656 tests); no schema/migration changes were introduced.
- [x] 3.3 `npm run e2e:sync` passes 19/19 journeys, including J5 restore branches against the real SW.
- [x] 3.4 Standard Chromium and journeys constituents pass unmodified; standard-lane remote branches remain honest fixme-skips.
- [x] 3.5 **SW activation** — infrastructure coverage confirms registration/control and the existing `skipWaiting` + `clients.claim` path remains active; no cache-name bump was needed.
