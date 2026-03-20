# pre-pr

Run the full SuperHabits pre-PR health check before opening or merging
any pull request. Combines the live web inspection (puppeteer MCP) with
the code quality gate (typecheck + tests). Both must pass for a green light.

Requires:
- `npm run web` running on localhost:8081 (one tab only)
- Puppeteer MCP connected in Cursor Settings → MCP

---

## Phase 1 — Code quality gate

Run the following commands in the terminal and capture output:

1. `npm run typecheck`
   Expected: 0 errors
   If errors: stop here — list every error (file + line) and do not proceed.

2. `npm test`
   Expected: 7 tests passing, 0 failing
   If failing: stop here — list failing test names and do not proceed.

Report result:
  QUALITY GATE: PASS or FAIL
  If FAIL: list errors/failures and exit — do not proceed to Phase 2.

---

## Phase 2 — Live web inspection (puppeteer MCP)

Use the puppeteer MCP to inspect the running app.
BASE_URL = http://localhost:8081

### 2a — Cross-origin isolation

Navigate to BASE_URL. Evaluate:

| Expression | Expected | Actual |
|------------|----------|--------|
| `crossOriginIsolated` | `true` | ? |
| `typeof SharedArrayBuffer` | `"function"` | ? |

If either fails: report as FAIL — the COEP fix (metro.config.js +
app.json) may have been reverted. Do not continue inspection.

Check console for `[db] initializeDatabase failed` — if present,
DB is not opening (likely isolation failure or OPFS lock).

Take a screenshot of the initial load.

### 2b — Service worker

Evaluate:

| Expression | Expected | Actual |
|------------|----------|--------|
| `navigator.serviceWorker.controller !== null` | `true` | ? |
| `await (await caches.keys()).join(", ")` | includes `superhabits-shell-v2` | ? |

If `superhabits-shell-v1` appears in cache keys: stale SW cache
still present — user should clear site data and reload.

If `superhabits-shell-v2` missing: SW may not have activated yet —
reload once and re-check.

### 2c — All 5 feature tabs

Navigate to each URL. Take a screenshot. Check for blank/error state.

| URL | Expected | Screenshot | Status |
|-----|----------|------------|--------|
| `http://localhost:8081/(tabs)/todos` | Todos screen renders | — | ? |
| `http://localhost:8081/(tabs)/habits` | Habits screen renders | — | ? |
| `http://localhost:8081/(tabs)/pomodoro` | Pomodoro screen renders | — | ? |
| `http://localhost:8081/(tabs)/workout` | Workout screen renders | — | ? |
| `http://localhost:8081/(tabs)/calories` | Calories screen renders | — | ? |

For each screen, also evaluate `document.body.innerText` — confirm
it contains screen-specific text (not just a blank or error message).

### 2d — Console error summary

After all tabs are visited, collect all console messages:
- List every `console.error` with full message
- List every `console.warn` worth noting
- Ignore React DevTools and HMR noise

---

## Phase 3 — Final report

Produce this table:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Typecheck | 0 errors | ? | PASS/FAIL |
| Tests | 7 passing | ? | PASS/FAIL |
| crossOriginIsolated | true | ? | PASS/FAIL |
| SharedArrayBuffer | "function" | ? | PASS/FAIL |
| SW active | true | ? | PASS/FAIL |
| Cache name | superhabits-shell-v2 | ? | PASS/FAIL |
| DB init error | none | ? | PASS/FAIL |
| Todos screen | renders | ? | PASS/FAIL |
| Habits screen | renders | ? | PASS/FAIL |
| Pomodoro screen | renders | ? | PASS/FAIL |
| Workout screen | renders | ? | PASS/FAIL |
| Calories screen | renders | ? | PASS/FAIL |

**OVERALL: PASS or FAIL**

If PASS: safe to open PR.

If FAIL: list every failing check with:
- Root cause (file + line if known)
- Recommended fix command (/fix-data, /fix-ui, or specific action)
- Whether it blocks the PR or is acceptable tech debt

---

## Known non-blocking items (do not fail PR for these)

- `toDateKey()` UTC issue — known, requires migration planning
- Sync flush gated on isRemoteEnabled() — intentional, remote off
- tests/calories.data.STUB.test.ts — intentional skipped placeholder
- No ESLint config — not yet set up, not in CI

---

## Reminders

- Only one localhost:8081 tab open at a time — OPFS lock will cause
  DB init failure if multiple tabs are open
- Puppeteer uses a fresh Chromium instance — results are reproducible
  and independent of your personal browser cache state
- Run this before every PR, not just when something seems broken
