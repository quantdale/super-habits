# SuperHabits — Deep Engineering Audit

- **Date:** 2026-07-12
- **Pinned commit:** `cfe8f12b5638f9176771c93a081e065398871653` ("Add multi-theme system design proposal with WCAG-validated catalog (#53)")
- **Scope:** entire repository (app source, edge function, tests, CI/CD, configs, docs)
- **Mode:** read-only audit — no source was modified; all proposed changes live in this report
- All `file:line` references are at the pinned commit.

---

## 1. Executive summary

SuperHabits is in better shape than most solo-built products of this size: strict TypeScript passes clean, 340 unit tests pass, e2e runs on every PR, SQL is consistently parameterized, and the feature-module layering (data/domain/UI) is real and mostly respected. The domain logic core (sync engine, restore coordinator, linked-actions engine, command parsing) is genuinely well tested.

The biggest risks cluster in four places:

1. **The sync/backup subsystem is the weakest load-bearing wall.** The queue is in-memory only (lost on kill), a single persistently-failing record jams the entire pipeline forever with silent 30-second retries (`core/sync/sync.engine.ts:34-47`), the remote Postgres schema and RLS policies exist only in the Supabase dashboard — not in the repo — and anonymous-auth identity means a lost session permanently orphans the backup. The restore feature can essentially never work on a genuinely new device. Failures are invisible to users: backup can be silently dead indefinitely.
2. **The AI command edge function is broken and abusable.** A confirmed argument-passing bug (`supabase/functions/parse-ai-command/index.js:546`) makes every remote _todo_ parse crash with a 502 (the feature silently falls back to the mock parser, which is why nobody noticed), and the endpoint has no rate limiting or abuse controls in code while spending OpenAI credits with a public anon key and `Access-Control-Allow-Origin: *`.
3. **Web deploys don't reach users.** The hand-rolled service worker (`public/sw.js`) is cache-first for everything with a manually-bumped `CACHE_VERSION`; forget the bump and existing users stay pinned to the old bundle indefinitely, while the runtime cache grows without eviction.
4. **Dark mode is systemically broken and accessibility is the weakest quality dimension.** A complete dark token system ships (`core/providers/ThemeProvider.tsx`), but `app.json` pins native to light, zero `dark:` Tailwind variants exist repo-wide, and dozens of components hardcode slate-on-white classes — dark mode renders dark-on-dark text. Interactive primitives (Button, PillChip, habit circle, todo checkbox) lack accessibility roles/labels/state.

Highest-leverage moves, in order: fix the edge-function bug (one line), remove the unused-but-vulnerable dependencies (six packages incl. `uuid@13.0.0` with a CVE), make sync failures visible + isolated, commit the remote schema/RLS to the repo, replace the SW versioning with build-derived versioning, add ESLint (there is currently **no linter at all**), and then execute the already-written multi-theme design doc to fix dark mode.

Counts: **7 High**, **18 Medium**, **14 Low** findings. No Critical: nothing observed loses local data or crashes a common path today — the High findings are "silently broken/abusable subsystems," not burning buildings.

---

## 2. System map

**Product:** offline-first productivity PWA + native app (todos, habits, pomodoro, workout, calories, experimental AI quick-command shell).

**Stack:** Expo SDK 55 / React Native 0.83.4 / React 19.2 / expo-router (typed routes) / NativeWind 4 + Tailwind 3 / Zustand-style local state via hooks / expo-sqlite (WAL on native, WASM+OPFS on web) / Supabase (anonymous auth, push backup, restore v1, edge function for AI parse) / Vitest 4 / Playwright 1.58 / Vercel static hosting (COOP/COEP for SharedArrayBuffer) / EAS for Android APK.

**Size:** ~31,300 lines of TS/TSX/JS/SQL; 179 TS/TSX files.

**Layering (consistently applied):**

```
app/                      expo-router routes (thin re-exports; 5-line files)
  (tabs)/_layout.tsx      custom top-tab rail (expo-router/ui) + swipe gesture
features/<f>/             one module per feature
  <f>.data.ts             SQLite reads/writes + syncEngine.enqueue()
  <f>.domain.ts           pure functions (well unit-tested)
  *Screen.tsx, *.tsx      UI (580-740-line screen monoliths)
core/
  db/client.ts            singleton DB promise, bootstrap DDL + versioned migrations (v11)
  db/appMeta.ts           typed key registry over app_meta KV table
  sync/sync.engine.ts     in-memory queue → adapter.push(); restore-on-failure
  sync/supabase.adapter.ts groups queue by entity, SELECT * local rows, upsert to Supabase
  sync/restore.coordinator.ts  empty-device-only restore of todos/habits/calorie_entries
  auth/guestProfile.ts    local guest id (written once, never read — dead)
  linked-actions/         rule engine: events, executions, dedupe/chain guards, effects registry
  providers/AppProviders  bootstrap: SW → DB → guest → anon auth → restore prompt; flush every 30s + visibility + NetInfo
  ui/                     themed primitives (tokens via ThemeProvider)
lib/                      id, time (local date keys), validation, notifications, supabase client
supabase/functions/parse-ai-command/  Deno edge fn → OpenAI chat completions (strict JSON schema)
public/sw.js              hand-rolled cache-first service worker (CACHE_VERSION = "v3")
```

**Data flow (write path):** Screen → `features/*/data.ts` → SQLite write → `syncEngine.enqueue({entity,id,...})` → (30s/visibility/NetInfo) `flush()` → `SupabaseSyncAdapter.push()` → re-read full rows from SQLite → `supabase.from(entity).upsert(rows, {onConflict:"id"})`. Deletes are soft (`deleted_at`) everywhere on synced tables; the upserted row state carries the tombstone.

**Synced entities:** `todos`, `habits`, `calorie_entries`, `workout_routines` (parent row only). Local-only: completions, pomodoro sessions, workout logs/exercises/sets, saved meals, linked-action tables, app_meta.

**State:** no server-state library in use (React Query is installed and mounted but has zero `useQuery`/`useMutation` callers); screens hold list state in `useState` and refresh manually on focus/foreground.

**Docs vs reality drift is called out in findings DOC-001/DOC-002.**

---

## 3. Methodology & scope

Passes applied: A correctness, B security, C performance, D concurrency/async, E error handling/observability, F architecture, G code quality/debt, H testing, I dependencies/supply chain, J build/CI/CD/release, K data layer, L UI/UX/a11y, M docs/onboarding, N modernization — followed by a cross-referencing/self-challenge pass over all High findings.

Commands actually executed this session (full output in Appendix):

| Command            | Result                                                         |
| ------------------ | -------------------------------------------------------------- |
| `npm ci`           | success (exit 0)                                               |
| `npx tsc --noEmit` | **exit 0, no errors**                                          |
| `npx vitest run`   | **32 files, 340 tests, all passed** (2.52s)                    |
| `npm audit --json` | **23 vulnerabilities: 1 critical, 6 high, 15 moderate, 1 low** |

Every source file in `core/`, `lib/`, `features/*/(data|domain)`, `app/`, `supabase/functions/`, `public/sw.js`, and all configs/CI were read directly. UI components, the full test suite, and screen files were additionally swept by focused read-only subagent passes whose load-bearing claims (ThemeProvider behavior, `app.json` light lock, absence of `dark:` variants, absence of any lint config, CI job structure) I re-verified directly against the files before including them here.

**Not covered / limits:** the live Supabase project's actual schema, RLS policies, and edge-function JWT settings (not represented in the repo — see SEC-003/SEC-002); iOS/Android native build artifacts; `npm run build:web` and the Playwright e2e suite were **not executed** in this session (CI runs them; no claim is made here about their current pass/fail state); runtime profiling (all performance findings are code-derived, labeled accordingly).

---

## 4. Findings

Severity model: impact × likelihood, weighted toward reliability/security. Effort: quick win (localized) / medium (multi-file) / large (staged initiative).

### 4.1 High severity

---

### [SEC-001] Edge function passes a string where an object is expected — every remote todo parse crashes with 502

- **Status:** CONFIRMED
- **Lens:** A (correctness), B (security-adjacent: availability)
- **Location:** `supabase/functions/parse-ai-command/index.js:546`, with the failure inside `deriveTodoDueDateDirective` at `index.js:99` — at commit `cfe8f12`
- **Evidence:** The handler calls `normalizeModelResponse(parsed, model, requestBody.rawText)` (line 546). The function signature is `normalizeModelResponse(payload, parserVersion, input)` (line 276) and the todo path does `normalizeTodoDraft(payload, parserVersion, input)` (line 299) → `resolveAuthoritativeTodoDueDate(input, requestedDueDate)` (line 184) → `deriveTodoDueDateDirective(input.rawText)` (line 141) → `rawText.match(TODAY_PATTERN)` (line 99). Since `input` is the raw **string**, `input.rawText` is `undefined`, and `undefined.match` throws `TypeError`, caught by the outer handler → HTTP 502 `model_request_failed` (lines 557-569).
- **Problem:** Every `create_todo` draft the model returns crashes the function. The habit path survives but returns `rawText: undefined` (line 303 passes `input.rawText`). The client masks the breakage: on any non-OK response it returns `unavailable/http_error` (`features/command/realCommandParser.ts:465-471`) and the facade silently falls back to the mock parser (`features/command/commandParser.ts:124-131`) — so the paid model path for todos has plausibly never worked in production and nobody saw an error.
- **Severity:** High — a shipped feature's primary path is 100% broken; each failed request still completes a full OpenAI call (cost with zero value).
- **Impact:** Internal-rollout testers always get fallback results for todos; OpenAI spend per broken request; misleading telemetry (`outcome: "unavailable"` logged as model failure).
- **Likelihood:** Deterministic (every todo parse) whenever remote mode is enabled.
- **Root cause:** The client-side twin (`realCommandParser.ts:485` passes the whole `input` object) and the edge copy diverged — this normalization logic is duplicated in two runtimes with no shared tests (the edge function has zero tests).
- **Recommendation:** Pass the request object, not the string.
- **Trade-offs & alternatives:** Longer-term, generate both normalizers from one shared module (see ARC-002); the one-line fix is still correct and immediate.
- **Complexity & risk:** Quick win; no regression risk beyond the currently-dead path.
- **Implementation steps:** (1) change line 546; (2) add a Deno test (or extract to a testable pure module) covering todo/habit/unsupported outcomes; (3) redeploy; (4) verify via `e2e/command.eval.internal.spec.ts` with env set.
- **Proposed change:**

```diff
-    const normalized = normalizeModelResponse(parsed, model, requestBody.rawText);
+    const normalized = normalizeModelResponse(parsed, model, requestBody);
```

- **Regression safety:** Unit-test `normalizeModelResponse` with a `create_todo` payload containing "today"/"tomorrow"/explicit-date raw text; assert 200 with resolved `dueDate` instead of 502.

---

### [SEC-002] AI parse endpoint: no rate limiting or abuse controls while spending OpenAI credits; CORS `*`

- **Status:** CONFIRMED (absence in code); HYPOTHESIS (deployed JWT setting, unverifiable from repo)
- **Lens:** B (security), J
- **Location:** `supabase/functions/parse-ai-command/index.js:2-7` (CORS), `index.js:515-571` (handler — no auth/rate-limit logic), `index.js:419-454` (OpenAI call, no `max_tokens`)
- **Evidence:** `"Access-Control-Allow-Origin": "*"` (line 3); the handler validates only body shape (`normalizeRequestBody`, line 528) — it never inspects `Authorization`, never rate-limits, and there is no `supabase/config.toml` in the repo to prove `verify_jwt` is enabled. The client sends the **public** anon key as `apikey` (`features/command/realCommandParser.ts:382-390`), which ships in the web bundle.
- **Problem:** Even with Supabase's default JWT verification on, the anon key is a valid JWT that any visitor can extract from the deployed bundle. Anyone can then script unlimited POSTs (280 chars each, `index.js:9,495`) that each trigger a paid OpenAI chat completion. There is no per-user/IP throttle, no daily budget guard, no `max_tokens` on the completion request.
- **Severity:** High — direct, trivially scriptable financial abuse of the OpenAI key; also quota-DoS of the feature for legitimate users.
- **Impact:** Unbounded API spend; potential OpenAI account suspension.
- **Likelihood:** Low-medium today (obscure endpoint, experimental feature) but the cost of exploitation is near zero once the URL is known — it is embedded in the public client.
- **Root cause:** Prototype-grade endpoint shipped without an abuse model.
- **Recommendation:** Require a verified authenticated user (reject anon-key-only calls by validating the JWT `sub` claim belongs to a real session), add a per-user + per-IP rate limit (e.g., a Postgres counter table or Upstash), set `max_tokens` (~600 fits the schema), and restrict CORS to the deployed origins. Commit `supabase/config.toml` with `verify_jwt = true` so the setting is reviewable.
- **Trade-offs & alternatives:** A shared static secret header is simpler but extractable from the bundle — pair it with rate limiting at minimum. Cloudflare/Vercel proxy with WAF is heavier.
- **Complexity & risk:** Medium; feature is experimental so regression exposure is small.
- **Implementation steps:** (1) commit `config.toml`; (2) JWT validation + 401 path; (3) rate-limit check before `invokeOpenAiParse`; (4) `max_tokens` + request timeout on the OpenAI fetch (currently none — a hung upstream holds the function open); (5) narrow CORS.
- **Regression safety:** e2e internal specs (`e2e/command.eval.internal.spec.ts`) with env configured; a negative test that an unauthenticated call gets 401/429.
- **Verification (for the HYPOTHESIS part):** run `supabase functions list`/inspect dashboard to confirm whether `verify_jwt` is enabled for `parse-ai-command`.

---

### [SEC-003] Remote schema and RLS policies are not in the repo; sync and restore correctness/privacy are unverifiable and drift-prone

- **Status:** CONFIRMED (repo-side facts); HYPOTHESIS (actual remote posture)
- **Lens:** B, K, F
- **Location:** `core/db/migrations/001_initial_supabase.sql:1-7` (the only remote migration — creates just `profiles`); `core/sync/supabase.adapter.ts:51` (`SELECT * FROM ${entity}` — pushes every local column); `core/sync/restore.coordinator.ts:304-309` (`.select("*")` with no user filter); `lib/id.ts:21-24`
- **Evidence:** The adapter upserts whatever columns the local row has (`supabase.from(entity).upsert(rows, {onConflict:"id"})`, adapter lines 65-67) with **no `user_id`**; restore reads back with **no user predicate** — row scoping rests 100% on RLS policies that exist only in the Supabase dashboard. Local `todos` has gained `due_date`, `priority`, `sort_order`, `recurrence`, `recurrence_id` via migrations v6/v9 (`core/db/client.ts:126-229`) — nothing in the repo proves the remote table was altered in lockstep; any missing remote column makes every `todos` upsert fail, which (see ERR-001) jams the whole sync queue silently and permanently. Additionally, IDs are `Math.random()`-based (`lib/id.ts:22-24`, ~41 bits of entropy + timestamp), and they are primary keys in **shared multi-tenant tables** upserted with `onConflict:"id"`.
- **Problem:** (a) A schema-drift class of total-backup-failure that can't be caught in review or CI; (b) if RLS is even slightly wrong, users can read (restore path) or overwrite (upsert path, ID collision or malicious forged ID) each other's rows — the client would never notice; (c) weak ID entropy makes cross-user PK collision unlikely but not negligible at scale, and forged-ID overwrites are only stopped by RLS you can't see.
- **Severity:** High — this is the data-privacy and backup-integrity backbone resting on invisible configuration.
- **Impact:** Worst case cross-user data exposure/tampering; likely case silent backup death after a local-only migration.
- **Likelihood:** Drift: high over time (it may already have happened — unverifiable). RLS misconfig: unknown, unverifiable from repo.
- **Root cause:** Infrastructure-as-click instead of infrastructure-as-code; adapter design pushes implicit schema (`SELECT *`).
- **Recommendation:** (1) Export the live schema + policies into `supabase/migrations/` (`supabase db pull`) and make it the reviewed source of truth; (2) add `user_id uuid not null default auth.uid()` scoping columns and canonical RLS (`using (user_id = auth.uid())`, `with check (user_id = auth.uid())`) to every synced table, and change upsert conflict target to `(user_id, id)` or keep `id` PK but verify insert-check policies; (3) replace `SELECT *` with explicit column lists per entity so client/remote contract drift becomes a compile-visible diff; (4) switch `createId` to `crypto.randomUUID()` (available in Hermes/modern web; the `uuid` package is already a dependency — currently unused, see DEP-002).
- **Trade-offs & alternatives:** Explicit column lists add maintenance, but that is exactly the point — schema changes must touch the sync contract consciously.
- **Complexity & risk:** Medium (repo work) + care applying policies to a live project; test with a second anon user.
- **Implementation steps:** pull schema → commit → add missing columns/policies as a new migration → adapter column lists → ID generator swap → integration test with two anon sessions asserting isolation.
- **Regression safety:** `core/sync/__tests__/supabase.adapter.test.ts` currently mocks Supabase — add a policy-level integration test (local `supabase start`) asserting user A cannot read/overwrite user B's row.
- **Verification:** `supabase db pull` diff against local expectations; dashboard RLS review.

---

### [ERR-001] Sync pipeline: no durability, no failure isolation, no backoff, no user-visible failure state

- **Status:** CONFIRMED
- **Lens:** E, D, A
- **Location:** `core/sync/sync.engine.ts:28-47`; `core/sync/supabase.adapter.ts:57-71`; `core/providers/AppProviders.tsx:95-125`
- **Evidence:** The queue is a plain array (`sync.engine.ts:28`) — process death loses every pending record, and rows whose enqueue was lost are never re-discovered (no dirty-flag or outbox table). `flush()` restores the **entire** snapshot on any error (`sync.engine.ts:42-46`); the adapter throws on the first failing entity (`supabase.adapter.ts:59-63` missing local rows; `:69-71` any upsert error), so one poisoned record blocks every other entity's records behind it. The only retry policy is the unconditional 30-second interval whose errors go to `console.error` (`AppProviders.tsx:98-102`) — no backoff, no dead-letter, no notice, no settings indicator of last successful backup.
- **Problem:** Any persistent per-entity failure (remote schema drift per SEC-003, RLS denial, deleted remote table) turns backup off **forever, silently**, while retrying + re-SELECTing every 30s and growing the restored queue unboundedly with duplicates (enqueue has no dedupe, `sync.engine.ts:30-32`; each reorder of N todos enqueues N records, `features/todos/todos.data.ts:176-188`).
- **Severity:** High — the product's stated durability promise ("optionally backed up to Supabase", README:5) can be silently false indefinitely; memory growth on a long-lived session compounds it.
- **Impact:** Users lose the backup they think they have; discovered only at restore time — the worst possible moment.
- **Likelihood:** Medium — requires a persistent remote error, but SEC-003 makes those structurally likely over time.
- **Root cause:** Prototype queue design carried into production use; "restore everything on failure" conflates transient and permanent errors.
- **Recommendation:** Make the outbox durable and isolate failures: (1) persist pending sync state in SQLite (either an `outbox` table or a `needs_sync` flag per row — the adapter already re-reads rows, so a flag is natural); (2) flush per-entity with per-record error partitioning: drop-and-park poison records in a dead-letter state after N failures instead of re-queuing the whole batch; (3) exponential backoff after consecutive failures; (4) surface "last backup at / backup failing since" in Settings (the restore preview already computes remote freshness — mirror it locally); (5) dedupe enqueues by `(entity,id)`.
- **Trade-offs & alternatives:** A full CRDT/sync-log design is overkill for one-way push backup; the flag-based outbox keeps the current architecture.
- **Complexity & risk:** Medium; the engine is small and already well-tested (`tests/sync.engine.test.ts`), so behavior changes are cheap to lock in.
- **Implementation steps:** schema migration (v12: `needs_sync` flag or outbox) → engine reads pending from DB at flush → per-entity try/catch with failure counters in app_meta → Settings surface → tests.
- **Regression safety:** Extend `tests/sync.engine.test.ts` (already covers batch-restore semantics) with: poison record isolates, other entities still push; backoff schedule; queue survives simulated restart (new engine instance reads DB state).

---

### [OPS-001] Service worker pins users to stale deploys unless a human remembers to bump `CACHE_VERSION`; runtime cache grows forever

- **Status:** CONFIRMED
- **Lens:** J, C
- **Location:** `public/sw.js:1-2` (manual version), `:47-75` (cache-first fetch for all GETs), `:5-20` (install-time precache); `core/pwa/registerServiceWorker.ts:6-13`; asserted brittle at `e2e/infrastructure.spec.ts:49`
- **Evidence:** `const CACHE_VERSION = "v3"` (line 1). The fetch handler serves cache-first for every GET (`caches.match(...)` then network, line 60-73) and adds every OK response to the single named cache (line 64-69). The cached `/index.html` is only refreshed during a SW `install` event — which only fires when the sw.js **bytes change**. A redeploy that forgets the manual bump produces a byte-identical sw.js → no install → users keep the old shell and old hashed bundles indefinitely. Old entries in the same-named cache are never evicted (activate only deletes _differently named_ caches, line 34-45).
- **Problem:** Release rollout silently depends on a manual constant; storage grows unboundedly with every hashed bundle a user ever loaded.
- **Severity:** High — every web release is affected; bug fixes (including security fixes) may never reach installed-PWA users.
- **Impact:** Stale clients, unbounded origin storage, confusing "works on my machine" support burden.
- **Likelihood:** High — it is the default outcome of any deploy that doesn't touch sw.js.
- **Root cause:** Hand-rolled SW without build integration; `workbox-window` is used only as a `register()` wrapper (`registerServiceWorker.ts:10-11`) while Workbox's actual precache-manifest machinery goes unused.
- **Recommendation:** Generate the SW at build time with an injected build hash: either `workbox-build injectManifest` in a post-`expo export` step (precache manifest of hashed `dist/` assets revs itself), or minimally inject `CACHE_VERSION = "<git sha>"` into sw.js during `build:web`. Serve `sw.js` and `index.html` with `Cache-Control: no-cache` and hashed assets with `immutable` via `vercel.json` headers (see OPS-003). Add LRU/`maxEntries` eviction for the runtime cache.
- **Trade-offs & alternatives:** Network-first for navigations is simpler and fixes staleness but costs offline-first startup; stale-while-revalidate for the shell is the usual middle ground.
- **Complexity & risk:** Medium; update `e2e/infrastructure.spec.ts:49` (hardcodes `"v3"`) to assert version ≠ cached-version behavior instead of a literal.
- **Implementation steps:** build script injection → vercel headers → eviction policy → e2e assertion update → manual two-deploy verification.
- **Regression safety:** e2e: deploy A, verify cached; deploy B (no manual edits), verify new shell served after reload ×2.

---

### [UX-001] Dark mode is systemically broken: complete dark token system undermined by hardcoded light classes, zero `dark:` variants, and a native light lock

- **Status:** CONFIRMED
- **Lens:** L, G
- **Location:** `app.json:9` (`"userInterfaceStyle": "light"`); `tailwind.config.js` (no `darkMode` key, light-only section palette); `core/providers/ThemeProvider.tsx:52-67` (full dark token set exists), `:85-97` (async mode load → flash of wrong theme); representative breakage: `features/todos/TodosScreen.tsx:324-337` (`text-slate-900`/`text-slate-500`/`bg-slate-100` inside token-surfaced cards), `features/pomodoro/PomodoroScreen.tsx:368,378` (`text-slate-400`, `bg-slate-200`), `features/todos/TodoItem.tsx`, `DueDateBadge.tsx:19-20`, `PriorityBadge.tsx:6-8`, all four charts (`DailyCalorieChart.tsx:58-121`, `MacroDonutChart.tsx:6-7,79-93`, `GitHubHeatmap.tsx:46-188`, `GardenGrid.tsx:23-39`)
- **Evidence:** Repo-wide grep: **zero** occurrences of `dark:` Tailwind variants; dozens of static `text-slate-*/bg-white/bg-slate-*` classes and hex literals sit inside components whose containers use `tokens.surface` dark backgrounds. `app.json:9` locks the native OS-reported scheme to light, so `Appearance.getColorScheme()` (`ThemeProvider.tsx:87`) can never report dark on native — the "system" mode is dead there.
- **Problem:** Choosing dark mode yields dark text on dark surfaces across every feature screen; system-follow never works on native; first web paint flashes the wrong theme (mode loads from AsyncStorage post-mount, `ThemeProvider.tsx:89-96`, with no pre-paint script).
- **Severity:** High (product quality) — the setting exists in the UI and visibly malfunctions.
- **Impact:** All dark-mode users; a11y contrast failures.
- **Root cause:** Token system added later; feature surfaces were never migrated; the merged design doc (`docs/multi-theme-system-design.md`, this very commit) exists precisely because this is known.
- **Recommendation:** Execute the design doc: remove `userInterfaceStyle: "light"` (or set `"automatic"`), define semantic Tailwind colors bound to CSS vars/tokens, migrate the listed offender files, and add a pre-paint theme script for web (set `data-theme` from localStorage before hydration). Gate with a lint rule banning raw `slate-*`/hex colors in feature code once ESLint exists (TST-003).
- **Complexity & risk:** Large initiative (touches most UI files) but mechanical; do it after ESLint + component memoization so churn happens once.
- **Regression safety:** `scripts/validate-theme-contrast.mjs` already exists for the token catalog — extend it; add an e2e screenshot pass in dark mode.

---

### [DEP-001] 23 known vulnerabilities in the dependency tree; the only runtime-dependency hit (`uuid@13.0.0`) is also completely unused

- **Status:** CONFIRMED
- **Lens:** I, B
- **Location:** `package.json:57` (`"uuid": "^13.0.0"`), lockfile-resolved `uuid@13.0.0`; audit output in Appendix
- **Evidence:** `npm audit` (this session): 1 critical (`shell-quote` ≤1.8.3), 6 high (`xmldom`, `axios`, `form-data`, `tmp`, `vite`, `ws`), 15 moderate, 1 low — all in the Expo/CLI dev toolchain **except** `uuid`: GHSA-w5hq-g745-h8pq (moderate, CVSS 7.5, out-of-bounds write in v3/v5/v6, fixed in 13.0.1) matches the direct dependency. Grep shows **zero imports of `uuid` anywhere in app code**.
- **Problem:** Vulnerable direct dependency shipping in `dependencies` for no reason; a red audit baseline means real new vulns won't stand out; no CI audit gate exists (`.github/workflows/ci.yml` has none).
- **Severity:** High as an aggregate posture (individual items mostly dev-time; practical runtime exploitability low since v3/v5/v6+buf is never called).
- **Recommendation:** Remove `uuid` (or keep at ≥13.0.1 only if adopted for SEC-003's ID fix — prefer `crypto.randomUUID()` and remove anyway); `npm audit fix` the dev-chain items; add a scheduled/PR `npm audit --omit=dev --audit-level=high` CI step so runtime regressions fail loudly while dev noise stays advisory.
- **Complexity & risk:** Quick win.
- **Regression safety:** `npm ci && npm run typecheck && npm test` after removal (nothing imports it; risk ≈ 0).

---

### 4.2 Medium severity

---

### [DATA-001] Migrations swallow every error and advance the schema version anyway; no transactional boundaries

- **Status:** CONFIRMED
- **Lens:** K, E
- **Location:** `core/db/client.ts:85-92, 93-105, 106-115, 126-145, 217-229` (empty `catch {}` around ALTERs, then unconditional `setAppMetaText(..., "N")`); no `withTransactionAsync` anywhere in `runMigrations` (`:82-350`)
- **Evidence:** e.g. v6: `try { await db.runAsync("ALTER TABLE todos ADD COLUMN due_date TEXT") } catch { /* Column may already exist */ }` (:127-131) — the catch also swallows disk-full/locked/corruption errors, after which `db_schema_version` is still bumped (:153).
- **Problem:** A genuinely failed ALTER is recorded as applied; later code reads/writes columns that don't exist → runtime failures far from the cause, and the migration will never re-run.
- **Severity:** Medium (high impact, low likelihood).
- **Root cause:** Using broad catch to express "duplicate column is OK".
- **Recommendation:** Only swallow the duplicate-column case: check `PRAGMA table_info(<table>)` before ALTER (or match the error message `duplicate column name`); wrap each version block in `withTransactionAsync`; on failure, abort bootstrap with the existing `dbError` UX rather than limping.
- **Proposed change (pattern):**

```ts
async function hasColumn(db: SQLiteDatabase, table: string, column: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}
// in v6 block:
if (!(await hasColumn(db, 'todos', 'due_date'))) {
  await db.runAsync(`ALTER TABLE todos ADD COLUMN due_date TEXT`);
}
```

- **Complexity & risk:** Quick-to-medium; migration tests exist (`tests/db.client.test.ts`) — add per-version failure-path cases (they currently cover only the aggregate 0→11 run).

---

### [COR-001] `incrementHabit` writes completion rows before checking the habit exists, and its read-modify-write races

- **Status:** CONFIRMED
- **Lens:** A, D, K
- **Location:** `features/habits/habits.data.ts:62-101` (write at :83-94 precedes the `!habit` gate at :96, which only guards linked-actions); UNIQUE constraint at `core/db/client.ts:37`
- **Evidence:** The habit row is fetched (:68-74) but a missing/soft-deleted habit does not prevent the INSERT/UPDATE of `habit_completions` (:83-94) — it only skips linked-action dispatch (:96-100). Separately, two rapid calls interleave at the awaits: both read `existing = null` (:75-79) → both INSERT → second violates `UNIQUE(habit_id, date_key)` and throws to the UI; or both read `count = n` → both write `n+1`, losing an increment.
- **Problem:** Orphan completion rows for deleted habits; double-tap can crash or under-count. Same read-then-insert race exists in `upsertSavedMeal` (`features/calories/calories.data.ts:181-230`) against the unique index at `client.ts:210-213`.
- **Severity:** Medium.
- **Recommendation:** Guard first, then use SQLite upsert so the operation is atomic:

```ts
if (!habit) return { count: 0, linkedActions: EMPTY_LINKED_ACTIONS_RESULT };
await db.runAsync(
  `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
   VALUES (?, ?, ?, 1, ?, ?)
   ON CONFLICT(habit_id, date_key) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
  [createId('hcmp'), habitId, dateKey, now, now],
);
const row = await db.getFirstAsync<{ count: number }>(/* re-read for return value */);
```

Apply the same `ON CONFLICT` pattern to `upsertSavedMeal` (keyed on `food_name COLLATE NOCASE`).

- **Complexity & risk:** Quick win per site; behavior covered by `tests/habits.data.test.ts` — extend with a double-call test.

---

### [COR-002] Deleting a daily recurring todo resurrects it on next focus (except on its first day)

- **Status:** CONFIRMED
- **Lens:** A, L
- **Location:** `features/todos/todos.data.ts:352-364` (`removeTodo` soft-deletes one instance); `features/todos/TodosScreen.tsx:109-130` (`loadTodosOnFocus` recreates); `features/todos/todos.domain.ts:33-57` (`findMissingRecurrenceIds`); template pick at `todos.data.ts:143-160`
- **Evidence:** `findMissingRecurrenceIds` receives only non-deleted rows (`listAllActiveTodosForRecurrence`, `todos.data.ts:162-171`, filters `deleted_at IS NULL`). Deleting today's instance removes it from `coveredToday`, while any older instance keeps the series in `allRecurrenceIds` → `createRecurringInstance` re-creates today's todo on the next focus/foreground. If the deleted instance was the only one (series created today), the series dies instead. There is no "end series" affordance in `TodosScreen.tsx`.
- **Problem:** Inconsistent semantics: delete sometimes means "skip today" (it comes back!), sometimes "end series". Users cannot reliably stop a daily todo.
- **Severity:** Medium — data keeps reappearing; erodes trust.
- **Recommendation:** Define semantics explicitly: deleting an instance should either (a) offer "Delete just today / End series" (end series = also clear `recurrence`/`recurrence_id` on the template or record a series tombstone), and (b) `findMissingRecurrenceIds` must treat a soft-deleted instance dated today as "covered" (skip re-creation for that day). The one-line data fix: include deleted rows in the query and count `due_date === todayKey` regardless of `deleted_at` when building `coveredToday` (the type already carries `deleted_at`, `todos.domain.ts:38-40`, but the SQL filters it out before it arrives).
- **Complexity & risk:** Quick win (domain fn + query) + small UX for "end series"; unit-test in `tests/todos.domain.test.ts`.

---

### [COR-003] Workout `addSet`/`updateSet` silently swallow validation failures; `addSet` returns `""` as an ID

- **Status:** CONFIRMED
- **Lens:** A, E
- **Location:** `features/workout/workout.data.ts:242-243` (`if (timingErr) return "";`), `:293-294` (`if (timingErr) return;`)
- **Evidence:** As cited — the data layer returns an empty-string "id" / silently no-ops instead of surfacing the error.
- **Problem:** Callers can't distinguish success from rejection; a `""` id propagated anywhere breaks lookups. Silent no-op on update leaves UI state implying success.
- **Severity:** Medium (currently mitigated by UI-side validation, but the API contract is a trap).
- **Recommendation:** Throw (or return a typed result) from the data layer; UI already knows how to render validation messages.
- **Complexity & risk:** Quick win; adjust `tests/workout.data.test.ts` accordingly.

---

### [COR-004] Pomodoro: timer drift vs scheduled notification, double-start race, paused time inflates logged duration, and the cycle-dots display zeroes out exactly when the long break is earned

- **Status:** CONFIRMED (all code-derived)
- **Lens:** A, D, L
- **Location:** `features/pomodoro/PomodoroScreen.tsx:139-197` (interval accumulates `Math.round` deltas — sub-second remainders are discarded each tick, so a throttled tab drifts slow relative to the wall-clock notification scheduled at `:237`); `:226-243` (`start` is async and the button is not disabled during the `await scheduleTimerEndNotification` — a second tap schedules a second OS notification and orphans the first id, since `notificationIdRef` is only written after the await); `:161-175` (session logged with planned `totalSec` and original `started` even after pause/resume — paused time counts as focus); `:374-381` (`i < completedFocus % sessionsBeforeLongBreak` renders 0 filled dots right after the 4th focus completes, exactly when the user earned the long break)
- **Problem:** Notification can fire visibly before the on-screen timer ends; stray notifications after double-tap; stats overstate focus time; confusing progress display.
- **Severity:** Medium (UX/data quality; no data loss).
- **Recommendation:** Derive `remaining` from an absolute `endAt` timestamp (recompute on each tick and on visibility resume) instead of accumulating deltas; disable Start while starting (or make it idempotent by canceling before scheduling with a guard flag); log `duration_seconds` as accumulated running time; render dots as `completedFocus % N || (justEarnedLongBreak ? N : 0)` — i.e., show N filled while the long break is pending.
- **Complexity & risk:** Quick-to-medium, isolated to one screen; domain helpers (`getNextMode` etc.) already unit-tested.

---

### [CON-001] Concurrent flush triggers can interleave; `isRemoteEnabled` is read once at mount; a failed flush reorders records behind newer ones

- **Status:** CONFIRMED
- **Lens:** D
- **Location:** `core/providers/AppProviders.tsx:95-125` (three independent triggers, no in-flight guard, `[]` deps with `isRemoteEnabled()` checked once at line 96); `core/sync/sync.engine.ts:34-47` (failure re-queue appends old snapshot _before_ records enqueued during the in-flight push: `this.queue = [...preservedForRetry, ...this.queue]`)
- **Evidence:** As cited. Interval + visibilitychange + NetInfo can all fire `flush()` while a previous flush awaits network. Because the adapter re-reads current row state at push time (`supabase.adapter.ts:53`), interleaved flushes are _mostly_ idempotent — the real effects are duplicate upserts of the same rows and, on failure, stale/new record order mixing (harmless today because `operation`/`updatedAt` are ignored — see ARC-001 — but a landmine for any future pull/merge logic).
- **Severity:** Medium (latent).
- **Recommendation:** Add an in-flight promise guard (`if (this.flushing) return this.flushing;`) plus trailing re-flush if enqueues arrived during a flush; dedupe queue by `(entity,id)` keeping latest `updatedAt`. Fold into the ERR-001 outbox rework.
- **Complexity & risk:** Quick win inside the engine; extend `tests/sync.engine.test.ts` (it already tests concurrent enqueue-during-flush — add concurrent double-flush).

---

### [ERR-002] No error boundary anywhere; web DB-failure message tells users to clear site data — which would destroy their local-only data

- **Status:** CONFIRMED
- **Lens:** E, L
- **Location:** No `ErrorBoundary` in the repo (grep: only hit-free); `app/_layout.tsx` exports no error component; `core/providers/AppProviders.tsx:60-66`: _"Try Chrome or Edge with site data cleared."_
- **Evidence:** As cited. All app data on web lives in OPFS + localStorage for that origin; "site data cleared" deletes the SQLite database of a local-first app whose backup may be silently dead (ERR-001) and whose restore only covers 3 of 10+ tables (README:44-49).
- **Problem:** Any render-time exception blank-screens the app with no recovery UI; the one bootstrap error message actively coaches data destruction.
- **Severity:** Medium (High if a user follows the advice after real data accrual).
- **Recommendation:** Export `ErrorBoundary` from `app/_layout.tsx` (expo-router supports route-level error boundaries) with a reload action; rewrite the web bootstrap message to distinguish "unsupported browser" (fresh visit) from "initialization failed" (never advise clearing storage; suggest closing duplicate tabs — the OPFS lock is a known cause per `e2e/infrastructure.spec.ts:68-103`).
- **Complexity & risk:** Quick win.

---

### [DATA-002] Missing indexes on every child-table foreign key and hot query column; `getRoutineWithExercises` is N+1; `updateTodoOrder` runs N statements outside a transaction

- **Status:** CONFIRMED (schema-derived; not runtime-profiled)
- **Lens:** K, C
- **Location:** `core/db/client.ts` DDL: no index on `habit_completions.date_key`-leading queries beyond the UNIQUE (fine), none on `workout_logs.routine_id` (:55-61), `routine_exercises.routine_id` (:156-166), `routine_exercise_sets.exercise_id` (:168-179), `workout_session_exercises.log_id` (:181-189), `calorie_entries.consumed_on` (:62-75), `todos.recurrence_id` (:219-228); `features/workout/workout.data.ts:379-389` (per-exercise sets query); `features/todos/todos.data.ts:173-189` (loop of UPDATE + enqueue per id, no transaction); O(n²) correlated-subquery backfill at `client.ts:146-152`
- **Problem:** Full scans on every range/parent lookup; a reorder interrupted mid-loop leaves inconsistent `sort_order`; per-row awaits are slow on WASM/OPFS where each statement round-trips.
- **Severity:** Medium (small data today keeps this invisible; it's cheap insurance and the app's data grows monotonically — `calorie_entries` and `pomodoro_sessions` accrue daily forever).
- **Recommendation:** Migration v12 adding the six indexes; single-query sets fetch (`WHERE exercise_id IN (...)` then group in JS); wrap `updateTodoOrder`/`updateExerciseOrder` in `withTransactionAsync`; also enable `PRAGMA foreign_keys = ON` (currently never set — FKs are purely conventional).
- **Complexity & risk:** Quick win; index-only migration is safe.

---

### [DATA-003] `linked_action_events` / `linked_action_executions` grow unboundedly — every qualifying completion writes an event row forever, with no retention or pruning

- **Status:** CONFIRMED
- **Lens:** K, C
- **Location:** `core/linked-actions/linkedActions.engine.ts:266-271` (event persisted for every processed source action, before rule matching); `linkedActions.data.ts:377-425`; no DELETE/prune anywhere in the module
- **Problem:** A habit user completing 5 habits/day writes ~1,800 event rows/year even with zero rules configured (todos gate dispatch on transition, `todos.data.ts:315-321`; habits dispatch whenever the daily target is crossed, `habits.data.ts:96-122`). Local DB and (worse) OPFS storage on web accrete indefinitely.
- **Severity:** Medium-low today, structural.
- **Recommendation:** Skip event persistence when `rules.length === 0` (move `createLinkedActionEvent` after `listMatchingLinkedActionRules`, keeping the pre-check dedupe semantics via the eventId lookup), and add a retention sweep (e.g., delete events/executions older than 90 days with terminal status) run at bootstrap.
- **Complexity & risk:** Quick-to-medium; engine is thoroughly unit-tested (`tests/linkedActions.engine.test.ts`) so reordering is safe to verify.

---

### [ARC-001] `SyncRecord.operation` and `updatedAt` are dead fields; delete propagation semantics exist only implicitly

- **Status:** CONFIRMED
- **Lens:** F, A
- **Location:** `core/sync/sync.engine.ts:3-8` (fields defined); `core/sync/supabase.adapter.ts:35-73` (never read — only `entity` and `id` are used)
- **Evidence:** The adapter ignores the operation; deletes work only because rows are soft-deleted and the tombstone row-state is upserted. A future hard-delete anywhere (or a pull implementation using `updatedAt`) inherits an undefined contract; a missing row today throws and jams the queue (`supabase.adapter.ts:57-63`) rather than propagating a delete.
- **Severity:** Medium (design debt at the system's most sensitive seam).
- **Recommendation:** Either remove the unused fields (honest minimal contract) or implement them: treat `operation:"delete"` + missing local row as "push tombstone by id" instead of throwing. Document the invariant "synced tables are never hard-deleted" where it's enforced (it's currently only stated in a comment in `habits.data.ts:143-144` and a Cursor skill file).
- **Complexity & risk:** Quick win to de-throne the throw; medium to implement full semantics.

---

### [SEC-004] Supabase CLI state and editor debug logs are committed; `.gitignore` doesn't cover them

- **Status:** CONFIRMED
- **Lens:** B (info disclosure), G
- **Location:** `supabase/.temp/linked-project.json` (project ref `kruubbynsmxzxfdunaal`, org id), `supabase/.temp/pooler-url` (`postgresql://postgres.kruubbynsmxzxfdunaal@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`), `supabase/.temp/{project-ref,rest-version,...}`; `.cursor/debug-{29741c,6867cf,6879f5}.log` (~33 KB of session traces); `.gitignore` (no `supabase/.temp`, no `.cursor/*.log` entries)
- **Evidence:** Files present at pinned commit; contents inspected — no credentials, but the pooler username/host and project ref are infrastructure fingerprints (the Supabase URL is derivable: `https://kruubbynsmxzxfdunaal.supabase.co`), useful for targeting SEC-002.
- **Severity:** Medium-low (anon key is public-by-design anyway; this still lowers attacker effort and is repo hygiene).
- **Recommendation:** `git rm -r --cached supabase/.temp .cursor/debug-*.log`; add `.gitignore` entries (`supabase/.temp/`, `.cursor/debug-*.log`, `.cursor/playwright-output/` beyond the .gitkeep). Rotating the project ref isn't practical; rely on SEC-002/SEC-003 hardening.
- **Complexity & risk:** Quick win.

---

### [TST-001] Every date/timezone test runs in the CI runner's UTC; the module that exists to reconcile local vs UTC is never exercised off-UTC, and several tests carry a midnight race

- **Status:** CONFIRMED
- **Lens:** H
- **Location:** `vitest.config.ts` (no `TZ`), `.github/workflows/ci.yml` (no `TZ`); real `new Date()` anchoring at `tests/time.test.ts:12-35`, `tests/habits.domain.test.ts:186-315`, `tests/calories.domain.test.ts:65-180`, `tests/workout.domain.test.ts:109-143`, `tests/pomodoro.domain.test.ts:104-217`; the code under test: `lib/time.ts` (`getUtcIsoRangeForLocalDateKeys`, `timestampToLocalDateKey`) and the v5 UTC→local date-key cutover (`core/db/client.ts:116-125`)
- **Problem:** `getUtcIsoRangeForLocalDateKeys` assertions are tautological under UTC; DST-transition days (23h/25h) are never tested; tests that compute "today" twice can straddle midnight and flake.
- **Severity:** Medium — date-key correctness is the backbone of habits/calories/heatmaps.
- **Recommendation:** Add a CI matrix (or second vitest project) with `TZ=Asia/Manila` and `TZ=America/New_York`; use `vi.setSystemTime` for all "today" anchoring; add explicit DST boundary cases.
- **Complexity & risk:** Quick-to-medium; may surface real latent bugs (that's the point).

---

### [TST-002] No linter or formatter exists in the repository at all; CI gates are typecheck + tests only

- **Status:** CONFIRMED
- **Lens:** H, J, G
- **Location:** No `eslint.config.*`/`.eslintrc*`/`biome.json`/`.prettierrc*` anywhere (verified against the full file inventory); `package.json:5-19` has no lint script; `.github/workflows/ci.yml:44-48` runs only typecheck + vitest (+e2e job)
- **Problem:** Whole bug classes this audit found by hand — unused deps, missing hook deps, floating promises, hardcoded colors — are exactly what `eslint-config-expo` + `@tanstack/eslint-plugin-query` + `eslint-plugin-react-hooks` catch mechanically. tsc alone doesn't flag unused dependencies, `no-floating-promises`, or exhaustive-deps.
- **Severity:** Medium (multiplier on everything else).
- **Recommendation:** `npx expo lint` (installs `eslint-config-expo` flat config), enable `@typescript-eslint/no-floating-promises` (type-aware) and `react-hooks/exhaustive-deps` as errors, add `npm run lint` to CI. Add Prettier (or Biome) for format consistency.
- **Complexity & risk:** Quick to add; expect a one-time triage of warnings — land as warnings-then-ratchet if needed.

---

### [PERF-001] Hot list rows (`TodoItem`, `HabitCircle`) are unmemoized and receive fresh inline closures every render; charts rebuild full datasets per render

- **Status:** CONFIRMED (code-derived; not profiled)
- **Lens:** C, L
- **Location:** `features/todos/TodoItem.tsx:22` (no `React.memo`) fed by inline props at `features/todos/TodosScreen.tsx:445-459` and `:425-439`; `features/habits/HabitCircle.tsx` (no memo; SVG ProgressRing child) fed inline at `HabitsScreen.tsx:464-473`; `features/calories/DailyCalorieChart.tsx:53-66` (`barData` built each render, inline `topLabelComponent` closures); `MacroDonutChart.tsx:30` (no memo)
- **Problem:** Every toggle/refresh re-renders every row including SVG re-layout; the drag-list (`DraggableFlatList`, `TodosScreen.tsx:379-461`) additionally fully remounts on view-mode change via `key={viewMode}` (:380) — acceptable, but combined with unmemoized rows makes interactions O(list).
- **Severity:** Medium (lists are small today; the app targets long-lived daily data).
- **Recommendation:** `React.memo` row components; hoist stable callbacks (`useCallback` keyed by id via a single handler `(todo) => ...` already exists — pass `todo` and `handleToggleTodo` directly instead of wrapping per row); `useMemo` chart datasets.
- **Complexity & risk:** Quick win per component; verify drag/swipe still work (gesture handlers capture props).

---

### [UX-002] Accessibility: interactive primitives lack roles/labels/state; several tap targets are sub-44px; data visualizations have no non-visual representation

- **Status:** CONFIRMED (spot-verified subset; full sweep by subagent)
- **Lens:** L
- **Location (representatives):** `core/ui/Button.tsx:38-43` (no `accessibilityRole`); `core/ui/PillChip.tsx:16-29` (no role/selected state; ~32px tall); `core/ui/NumberStepperField.tsx:37-59` (unlabeled +/- with bare glyphs); `features/todos/TodoItem.tsx:53-59` (checkbox with no `role="checkbox"`/`checked` state); `features/habits/HabitCircle.tsx:45-51` (icon-only Pressable, long-press decrement invisible to screen readers); `features/shared/GitHubHeatmap.tsx:199-213` (color-only day cells, no labels); `features/pomodoro/GardenGrid.tsx:66-77` (no-op Pressables that trap focus); `core/ui/Modal.tsx:40-47` (~40px close target)
- **Severity:** Medium (High for affected users; app is currently unusable with a screen reader).
- **Recommendation:** Add roles/labels/state to the five shared primitives first (Button, PillChip, NumberStepperField, Modal close, SwipeRightActions) — that fixes most surfaces transitively; give TodoItem/HabitCircle explicit checkbox/adjustable semantics (`accessibilityActions` for increment/decrement); add `accessibilityLabel` per heatmap cell ("Mar 4: 2 sessions"); remove the no-op garden Pressables; enforce ≥44px targets.
- **Complexity & risk:** Medium (mechanical, wide); no regression risk beyond snapshot churn.

---

### [OPS-002] CI gaps: no lint/audit steps, Playwright browsers re-downloaded every run, full e2e on every branch push, TZ/locale unpinned, retries mask flakes, and the AI-path e2e never runs

- **Status:** CONFIRMED
- **Lens:** J, H
- **Location:** `.github/workflows/ci.yml` (whole file): no lint/audit steps; `:74` `npx playwright install --with-deps chromium` uncached; `on.push.branches: ["**"]` (:4-5) runs the ~full pipeline including e2e for every branch push _and_ again for the PR; `playwright.config.ts:16` `retries: process.env.CI ? 2 : 0`; skip guards at `e2e/command.eval.internal.spec.ts:182`, `e2e/command.spec.ts:138` with no env provided in CI
- **Severity:** Medium (cost + blind spots, not breakage).
- **Recommendation:** Cache `~/.cache/ms-playwright` keyed on the Playwright version; scope push-trigger e2e to `main` (PRs already cover branches); add lint (TST-002) + `npm audit --omit=dev` steps; pin `TZ` matrix (TST-001); track retry-passed tests (`--reporter` flake surfacing) instead of silently accepting 2 retries; add a nightly job with AI env secrets so the remote-parse path (and SEC-001's fix) gets exercised.
- **Complexity & risk:** Quick wins each.

---

### [DEP-002] Six runtime dependencies are unused or unused-in-effect: `uuid`, `expo-background-fetch`, `expo-task-manager`, `expo-file-system`, `expo-linear-gradient`, and React Query (mounted, never queried)

- **Status:** CONFIRMED (import-graph greps; expo packages flagged for verification against transitive/plugin use before removal)
- **Lens:** I, G, F
- **Location:** `package.json:31,33,35,41,57`; React Query: provider mounted at `core/providers/AppProviders.tsx:29,174,190` with **zero** `useQuery`/`useMutation`/`queryClient.` usages repo-wide
- **Problem:** Bundle weight, audit surface (DEP-001), and — for React Query — a misleading architecture signal: the app hand-rolls the exact problems RQ solves (focus refetch, cache invalidation, loading state) with `useState` + manual `refresh()` in every screen, which is where several Medium bugs above live.
- **Severity:** Medium.
- **Recommendation:** Remove `uuid`, `expo-background-fetch`, `expo-task-manager`, `expo-linear-gradient` (verify `expo-file-system` isn't required by `expo-sqlite`'s native config plugin before dropping). For React Query: **decide** — either adopt it for reads (`useQuery(["todos"], listTodos)` + invalidation on writes; a natural follow-on to ERR-001/PERF-001 that deletes a lot of bespoke refresh code) or remove the provider. Adoption is recommended; it directly replaces the fragile manual-refresh pattern.
- **Complexity & risk:** Removal: quick. RQ adoption: medium-large, per-feature increments.

---

### [DOC-001] Documentation sprawl with confirmed drift: 5,900 lines across overlapping maps, a schema reference frozen at v4 while code is at v11

- **Status:** CONFIRMED
- **Lens:** M
- **Location:** `core/db/schema.sql:6` ("Current stored schema version: 4 (next migration: case 5)" vs migrations through v11 at `core/db/client.ts:270-349`); duplicate maps `docs/PROJECT_STRUCTURE_MAP.md` and `docs/knowledge-base/PROJECT_STRUCTURE_MAP.md` (the latter self-describes as a copy "in sync" — a manual promise); `docs/master-context.md` _and_ `docs/master-context/` directory; `docs/repo-map.md` overlapping both; plus `.cursorrules`, `.cursor/rules/*.mdc`, `AGENTS.md`, `.github/copilot-instructions.md` each restating conventions
- **Problem:** Five places to update per architectural change guarantees drift; `schema.sql` actively lies (its own header admits it, `schema.sql:2-8` — but stale-by-7-versions makes it a trap, e.g. `habits` there lacks `category/icon/color`).
- **Severity:** Medium (docs are unusually central here — they drive the AI-assisted workflow).
- **Recommendation:** Either delete `schema.sql` or generate it (dump the bootstrapped DB in a script) so it can't lie; collapse to one structure map + one agent-instructions file with thin pointers from tool-specific locations; date-stamp "current state" claims.
- **Complexity & risk:** Quick win (deletions + pointers).

---

### 4.3 Low severity (condensed records — same schema, terse)

---

### [COR-005] Restore has a TOCTOU window between eligibility check and import

- CONFIRMED — A/D. `core/sync/restore.coordinator.ts:390-422`: eligibility preview (:390), then network fetches (:406-410), then transaction (:415) with no emptiness re-check inside it. A todo created during the fetch coexists with imported rows ("empty device" invariant broken). Likelihood: very low (user-driven). **Fix:** re-run `getLocalSyncBackedCounts()` inside the transaction and abort if non-zero. Quick win.

### [COR-006] Restore imports soft-deleted remote rows, while eligibility/counts consider only live rows

- CONFIRMED — A/K. `fetchRemoteRows` has no `deleted_at` filter (`restore.coordinator.ts:304-309`) but `fetchRemoteEntityMeta` counts `.is("deleted_at", null)` (:141-144). Tombstones are restored (arguably correct for sync-consistency) yet "restored N" counts include them (`:428-432` uses raw lengths) — the success message can overstate. **Fix:** report live-row counts; document tombstone import as intentional. Quick win.

### [COR-007] Android notification channel is only created on the permission-request path

- CONFIRMED — A. `lib/notifications.ts:14-17` early-returns when permission is already granted; `setNotificationChannelAsync` (:21-24) then never runs (fresh install on Android <13 where POST_NOTIFICATIONS is pre-granted → no channel until a request path executes). **Fix:** create the channel unconditionally at module init/first schedule. Quick win.

### [COR-008] `useConfirmationDialog` resolves inside a state updater — double-resolve under StrictMode

- CONFIRMED (agent-sourced, pattern verified) — A. `core/ui/useConfirmationDialog.tsx:51-54`: `setPendingConfirmation((current) => { current?.resolve(confirmed); return null; })` — updaters must be pure; StrictMode double-invokes them. Promise.resolve twice is idempotent-ish today but any side effect added there won't be. **Fix:** resolve outside the updater. Quick win.

### [SEC-005] `getSupabaseFunctionUrl` naive concatenation

- CONFIRMED — G/B-minor. `lib/supabase.ts:45-48`: `${supabaseUrl}/functions/v1/...` — a trailing-slash env value yields `//functions`. **Fix:** `new URL("functions/v1/"+name, supabaseUrl)`. Quick win.

### [ERR-003] `ensureGuestProfile` failure swallowed with `.catch(() => undefined)`; profile never read anywhere

- CONFIRMED — E/G. `core/providers/AppProviders.tsx:70`; `core/auth/guestProfile.ts:11-22` has no consumers. Dead scaffolding pretending to be a bootstrap step. **Fix:** delete the module + call (or wire it to something real). Quick win.

### [QUA-001] Dead/vestigial code inventory

- CONFIRMED — G. `setRemoteMode`/`RemoteMode` never called by app code (`lib/supabase.ts:4-14`; only mocked in `tests/setup.ts:34`) — the documented "local-only mode" is unreachable; `core/ui/SectionTitle.tsx:8-10` is a props-passthrough to PageHeader; dead `border-slate-200` class always overridden (`core/ui/Card.tsx:46,61`); `completeRoutine`'s `insertWorkoutLogRecord` duplication with `logWorkoutSession` (`features/workout/workout.data.ts:103-121` vs `:394-426`); `catch (error) { throw error }` no-op wrapper (`features/command/commandInternalRollout.ts:38-42`); `onDragBegin={() => {}}` (`TodosScreen.tsx:387`). **Fix:** sweep-delete. Quick win.

### [QUA-002] `patches/@react-native+community-cli-plugin+0.83.2.patch` is 45 chmod-noise entries wrapping one real 3-line change

- CONFIRMED — G/J. Only real hunk disables `enableStandaloneFuseboxShell` in `runServer.js`; the mode-flips (644→755 on every file) make the patch fragile across platforms and unreviewable. **Fix:** regenerate the patch from a clean checkout (`patch-package` after fixing local umask). Quick win.

### [PERF-002] `updateTodoOrder`/`updateExerciseOrder` enqueue N sync records per drag

- CONFIRMED — C. `features/todos/todos.data.ts:176-188`: each reorder of an N-item list enqueues N records; with no queue dedupe (ERR-001) three quick reorders of 50 todos = 150 queued records, each flush re-uploading 50 full rows. **Fix:** covered by ERR-001 dedupe + DATA-002 transaction. Folded.

### [UX-003] Theme flash on web start; no pre-hydration theme script

- CONFIRMED — L. `ThemeProvider.tsx:85-97` (async AsyncStorage mode load post-mount) + `:117-123` (`data-theme` set in effect). Forced-dark users see a light flash each load. **Fix:** inline script in the exported HTML head setting `data-theme` from localStorage pre-paint (expo-router `+html.tsx`). Quick-medium.

### [UX-004] `NumberStepperField` accepts out-of-range typed input

- CONFIRMED (agent-sourced) — L/A. `core/ui/NumberStepperField.tsx:44-52`: only the +/- buttons clamp; `onChangeText={onChange}` passes anything. Downstream validation catches most, but the field lies about its contract. **Fix:** clamp on blur. Quick win.

### [OPS-003] `vercel.json` lacks security and caching headers

- CONFIRMED — J/B. Only COEP/COOP set (`vercel.json:12-27`). Missing: `Cache-Control` split for `sw.js`+`index.html` (no-cache) vs hashed assets (immutable) — required by OPS-001; `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a CSP (even report-only), `Permissions-Policy`. **Fix:** add headers block. Quick win.

### [MOD-001] Modernization opportunities (deliberate, low-churn)

- CONFIRMED — N. (a) `crypto.randomUUID()` over `Math.random()` ids (pairs with SEC-003); (b) SQLite `ON CONFLICT` upserts over read-modify-write (pairs with COR-001); (c) adopt the installed React Query for reads (pairs with DEP-002); (d) Workbox `injectManifest` over hand-rolled SW (pairs with OPS-001); (e) `expo lint` flat-config ESLint (pairs with TST-002); (f) consider `expo-sqlite`'s built-in `useSQLiteContext`/hooks only if it reduces code — current singleton is fine. No framework migrations recommended: Expo 55/RN 0.83/React 19.2 are current.

### [DOC-002] README/docs describe behaviors that don't exist

- CONFIRMED — M. README:60 "Gated by `isRemoteEnabled()` (`remoteMode` defaults to enabled)" implies a reachable disabled mode — nothing can set it (QUA-001); `docs/PROJECT_STRUCTURE_MAP.md:3-6` opens with "Error Handling and Validation Flows … See audit findings for more details" referencing audits not in the repo. **Fix:** fold into DOC-001 sweep. Quick win.

---

## 5. Prioritized backlog

| #   | ID          | Title                                                                        | Sev  | Effort     | Depends on            |
| --- | ----------- | ---------------------------------------------------------------------------- | ---- | ---------- | --------------------- |
| 1   | SEC-001     | Fix edge-fn argument bug (todo parses 502)                                   | High | Quick      | —                     |
| 2   | DEP-001/002 | Remove unused deps (`uuid` +4 expo pkgs), audit-fix dev chain, CI audit gate | High | Quick      | —                     |
| 3   | SEC-004     | Untrack `supabase/.temp`, debug logs; fix `.gitignore`                       | Med  | Quick      | —                     |
| 4   | ERR-002     | Error boundary + rewrite destructive bootstrap message                       | Med  | Quick      | —                     |
| 5   | TST-002     | Add ESLint (+hooks, floating-promises) & CI lint step                        | Med  | Quick      | —                     |
| 6   | OPS-002     | CI: cache Playwright, scope e2e triggers, TZ env, audit step                 | Med  | Quick      | 5                     |
| 7   | DATA-001    | Transactional migrations + narrow duplicate-column catch                     | Med  | Quick-Med  | —                     |
| 8   | COR-001     | `ON CONFLICT` upserts for habit completions & saved meals; guard-first       | Med  | Quick      | —                     |
| 9   | COR-003     | Stop swallowing workout validation errors                                    | Med  | Quick      | —                     |
| 10  | COR-002     | Recurring-todo delete semantics ("skip today" vs "end series")               | Med  | Quick-Med  | —                     |
| 11  | COR-004     | Pomodoro timestamp-based timer, start guard, dots fix                        | Med  | Quick-Med  | —                     |
| 12  | DATA-002    | Index migration, FK pragma, transactions on reorders, N+1 fix                | Med  | Quick      | 7                     |
| 13  | DATA-003    | Skip zero-rule event writes + retention sweep                                | Med  | Quick-Med  | 7                     |
| 14  | ERR-001     | Durable outbox, failure isolation, backoff, Settings surface                 | High | Med        | 7, 12                 |
| 15  | CON-001     | Flush in-flight guard + queue dedupe                                         | Med  | Quick      | 14                    |
| 16  | ARC-001     | Define delete/`operation` semantics in adapter                               | Med  | Quick      | 14                    |
| 17  | SEC-003     | Commit remote schema+RLS, explicit column lists, UUID ids, isolation test    | High | Med        | — (before 14 ideally) |
| 18  | SEC-002     | Edge fn auth hardening, rate limit, max_tokens, CORS, config.toml            | High | Med        | 1                     |
| 19  | OPS-001     | Build-derived SW versioning, cache headers, eviction                         | High | Med        | —                     |
| 20  | OPS-003     | vercel.json security/caching headers                                         | Low  | Quick      | with 19               |
| 21  | TST-001     | TZ matrix + fake timers + DST cases                                          | Med  | Quick-Med  | 6                     |
| 22  | PERF-001    | Memoize rows/charts, hoist callbacks                                         | Med  | Quick      | 5                     |
| 23  | UX-002      | A11y roles/labels/targets on shared primitives → rows → charts               | Med  | Med        | —                     |
| 24  | UX-001      | Execute multi-theme design; remove light lock; migrate hardcoded colors      | High | Large      | 5, 22, 23             |
| 25  | DEP-002(b)  | Adopt React Query for reads (or remove provider)                             | Med  | Large      | 14                    |
| 26  | DOC-001/002 | Docs consolidation; delete/generate schema.sql                               | Med  | Quick      | after 17              |
| 27  | Low items   | COR-005..008, SEC-005, ERR-003, QUA-001/002, UX-003/004                      | Low  | Quick each | opportunistic         |

---

## 6. Implementation roadmap

**Stage 0 — Same-day quick wins (items 1-6).** Independent, near-zero risk: the edge-fn one-liner, dependency removals + audit gate, gitignore hygiene, error boundary + message rewrite, ESLint, CI tuning. These de-risk everything after (lint catches regressions in later refactors; CI gets faster and stricter).

**Stage 1 — Data-layer integrity (items 7-13).** Transactional migrations first (7) because stages 2-3 add migrations; then atomic upserts (8), silent-failure removal (9-11), indexes/transactions (12), linked-actions retention (13). Each is locally testable against the existing strong unit suites.

**Stage 2 — Sync you can trust (items 14-18).** Order matters: commit the remote schema/RLS (17) _before_ rebuilding the outbox (14), because the outbox's failure taxonomy (permanent vs transient) depends on knowing the remote contract; then failure isolation/backoff/surfacing (14), flush guard (15), delete semantics (16), and edge-function hardening (18, after its bug fix landed in Stage 0). Exit criterion: a Settings row showing "Last backup: <time>" that turns red when flushes fail.

**Stage 3 — Web delivery & UX platform (items 19-24).** SW rebuild + headers (19-20) is self-contained and urgent-ish (every deploy compounds it). Then TZ tests (21), memoization (22), a11y primitives (23) — all three are prerequisites-in-practice for the theme migration (24), which touches every file those efforts also touch; batching them avoids double churn.

**Stage 4 — Architecture consolidation (items 25-26).** React Query adoption replaces the manual refresh layer (the source of several Stage 1 bugs) once sync is stable; docs consolidation last, documenting the _new_ reality once.

**Conflicts/competition:** (a) OPS-001's Workbox rewrite vs minimal version-injection — pick injection now if Stage 3 capacity is tight; Workbox later. (b) DEP-002 React Query removal vs adoption — adoption is recommended, but if declined, remove the provider in Stage 0 instead. (c) SEC-003's `(user_id,id)` conflict-target change must land together with adapter changes in Stage 2 to avoid a window of failing upserts.

---

## 7. Open questions & hypotheses (with the check that resolves each)

1. **Is `verify_jwt` enabled on the deployed `parse-ai-command` function?** (SEC-002) → check Supabase dashboard / `supabase functions list --json`.
2. **Does the live Supabase schema include the columns added by local migrations v6/v9 (`todos.due_date/priority/sort_order/recurrence/recurrence_id`, `habits.category/icon/color`, `calorie_entries.fiber`)?** If not, todos/habits upserts are failing today and backup is already dead (ERR-001 consequence). → `supabase db pull` or one manual flush with dev tools open; also explains whether SEC-001's fallback masking has a sibling.
3. **What are the actual RLS policies on the four synced tables?** (SEC-003) → dashboard export; test with two anon sessions.
4. **Is `expo-file-system` required transitively by `expo-sqlite`/EAS config plugins?** (DEP-002) → remove in a branch, run `expo prebuild` + native build.
5. **Does the restore flow have any real recovery story after app reinstall (anon session lost)?** Hypothesis: no — new anon user sees zero rows, restore prompt never appears. → reinstall test on a device with a prior backup. If confirmed, the backup feature's user-facing promise needs rewording or account-linking (Supabase `linkIdentity`) on the roadmap.
6. **Do interleaved `flush()` calls occur in practice at 30s cadence + NetInfo flaps?** (CON-001) → add a temporary counter log; low priority since the guard is cheap regardless.
7. **Real-world perf of unmemoized lists at 200+ todos on low-end Android** (PERF-001) → React DevTools profile before/after memoization; keeps the fix honest.

---

## 8. Appendix — commands & raw outputs (this session)

### A. Pinned commit

```
$ git rev-parse HEAD
cfe8f12b5638f9176771c93a081e065398871653
Author: Michael Dale Palaca <93045129+quantdale@users.noreply.github.com>
Date:   Sun Jul 12 17:19:14 2026 +0800
    Add multi-theme system design proposal with WCAG-validated catalog (#53)
```

### B. Typecheck

```
$ npx tsc --noEmit
(exit code 0 — no output)
```

### C. Unit tests

```
$ npx vitest run
 RUN  v4.1.2 /home/user/super-habits
 Test Files  32 passed (32)
      Tests  340 passed (340)
   Duration  2.52s (transform 1.09s, setup 431ms, import 1.40s, tests 641ms)
(exit code 0)
```

### D. npm audit (summary)

```
$ npm audit --json   # metadata.vulnerabilities
{ info: 0, low: 1, moderate: 15, high: 6, critical: 1, total: 23 }

critical: shell-quote 1.1.0-1.8.3 (fix available)
high:     @xmldom/xmldom <=0.8.12; axios 1.0.0-1.15.2; form-data 4.0.0-4.0.5;
          tmp <0.2.6; vite 8.0.0-8.0.15; ws 7.x<=7.5.10 / 8.x<=8.20.1
moderate (runtime-relevant): uuid  "<=11.1.0 || 13.0.0"  — direct dependency
          GHSA-w5hq-g745-h8pq (CVSS 7.5, CWE-787/1285), fixed in 13.0.1
          (also nested under node_modules/xcode)
remaining moderates: expo/@expo CLI chain, brace-expansion, follow-redirects,
          joi, js-yaml, postcss, xcode  (all dev-time)
```

### E. Dead-usage greps (all zero hits in app code)

```
$ grep -rn "from \"uuid\"" --include='*.ts*' .        # (excl. node_modules) → none
$ grep -rn "setRemoteMode" app core features lib      # → only lib/supabase.ts def + tests/setup.ts mock
$ grep -rn "useQuery\|useMutation\|queryClient\." app core features lib  # → none
$ grep -rln "expo-background-fetch\|expo-task-manager\|expo-file-system\|expo-linear-gradient" app core features lib constants  # → none
$ grep -rn "DELETE FROM todos\|DELETE FROM habits\b\|DELETE FROM calorie_entries\|DELETE FROM workout_routines" --include='*.ts' .  # → none (soft-delete invariant holds)
```

### F. Committed Supabase CLI state (SEC-004 evidence)

```
supabase/.temp/linked-project.json:
  {"ref":"kruubbynsmxzxfdunaal","name":"superhabits","organization_id":"mnqrbiambekxvrtuufcn",...}
supabase/.temp/pooler-url:
  postgresql://postgres.kruubbynsmxzxfdunaal@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### G. Subagent assistance disclosure

Three read-only exploration passes (UI components; test suite + CI; feature screens/docs — the latter two terminated early on session limits) supplemented direct reads. Every finding in §4 that originated from a subagent was either re-verified directly against the file (ThemeProvider, app.json, tailwind config, CI workflow, absence of lint configs, absence of `dark:` variants) or is attributed inline as "agent-sourced, pattern verified" (COR-008, UX-004). Line references for UI a11y/theming representatives in UX-001/UX-002 were spot-checked on TodosScreen, PomodoroScreen, ThemeProvider, and Card.
