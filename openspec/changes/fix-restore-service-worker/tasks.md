## 1. Service worker fix (`public/sw.js`)

- [ ] 1.1 **Cross-origin bypass** → in the `fetch` handler of `public/sw.js` (lines 35–61), after the existing non-GET guard (line 36) and dev bypass (lines 40–43), return without calling `event.respondWith` when `new URL(event.request.url).origin !== self.location.origin`, so cross-origin requests (the restore eligibility/import GETs to the Supabase host) are handled natively by the browser. **(`public/sw.js`.)**
- [ ] 1.2 **Never resolve `respondWith(undefined)`** → rework the same-origin fallback so the `caches.match(...).then(...).catch(() => cached)` chain (line 59) always yields a `Response` (e.g. `cached ?? fetch(event.request)` semantics), keeping cache-first with network fallback for the shell.
- [ ] 1.3 **Preserve shell behavior** → same-origin GETs (`/`, `/index.html`, `manifest.json`, icons) stay cache-first with `cache.put` on success; cross-origin responses are never written into `superhabits-shell-v3`.

## 2. Journey release and tests

The SW defect has no quarantine entry — J5's remote-boundary steps already run (not `fixme`) on the `journeys-sync` lane; the change removes the test-side mitigation so they exercise the real SW. `public/sw.js` is a standalone script outside the Vitest harness (`tests/**/*.test.ts` + `core/**/__tests__/**/*.test.ts`), so coverage is the E2E lane unless a pure predicate is extracted.

- [ ] 2.1 **Remove the J5 stub** → delete the `stubOutServiceWorker` helper and its FINDING comment from `e2e/journeys/new-phone.spec.ts` (lines ~225–259) and the `await stubOutServiceWorker(page)` call in step "reset to an empty device…" (line 314), so the restore branches run against the real SW.
- [ ] 2.2 **Check the J4 duplicate** → `e2e/journeys/bad-backend.spec.ts` defines the same `stubOutServiceWorker` (line 66) and files the bypass under this change; confirm J4's 503/outbox determinism still holds via `page.route` alone once the SW bypass lands, and remove the stub + comment if so.
- [ ] 2.3 **Do not weaken assertions** → leave the `test.fixme(!remoteBackupDetected, ...)` gates in `e2e/journeys/new-phone.spec.ts` (lines 342–509) untouched — they are a `dist/`-lane attribute, not the SW defect; the `@sync` steps keep full-strength assertions.
- [ ] 2.4 **Conditional unit test** → only if the origin check is factored into a pure helper that can be imported without touching `self`/`caches`, add `tests/restore.service-worker.test.ts` covering same-origin vs cross-origin request classification; otherwise rely on the lane coverage in 2.1. **(Not required by the proposal.)**
- [ ] 2.5 **Known-gaps check** → confirm no `fix-restore-service-worker` quarantine entry exists in `docs/testing/known-gaps.md`; if the J5 resolution note (line ~102) needs rewording once the real SW runs on the lane, update it — no quarantine release is involved.

## 3. Verification

- [ ] 3.1 `npm run typecheck` and `npm run lint` clean (no new warnings beyond the existing cap).
- [ ] 3.2 `npm test` passes — existing unit + integration suites unaffected (no schema/migration changes).
- [ ] 3.3 `npm run e2e:sync` — the `journeys-sync` project (dist-sync/ on :8082, main/nightly lane) runs J5's restore branches (dismiss, no re-prompt, blocked-after-data, import, not-restored) green against the **real** SW; 0 failed.
- [ ] 3.4 `npm run e2e` — the standard `dist/` lane (chromium + journeys) passes unmodified; J5's boundary steps still show as fixme-skips there (lane attribute, unchanged).
- [ ] 3.5 **SW activation** → verify the updated SW takes control on first load after deploy (existing `self.skipWaiting()` + `clients.claim()`); no cache-name bump is needed because the shell content is unchanged.
