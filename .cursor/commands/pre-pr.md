# pre-pr

Run the full SuperHabits pre-PR health check before opening or merging
any pull request. Combines the live web inspection (playwright MCP) with
the code quality gate (typecheck + tests). Both must pass for a green light.

Requires:
- `npm run web` running on localhost:8081 (one tab only)
- Playwright MCP must be connected in Cursor Settings → MCP
- **inspect-web is no longer a separate command** — its full functionality is available via **“run pre-pr in deep mode”** (see Phase 2, §2e).

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

## Phase 2 — Live web inspection (playwright MCP)

**For a deeper inspection pass, tell Cursor: “run pre-pr in deep mode”** — this adds SW transfer size checks, per-tab body text evaluation, and `window.__dbReady` probe to the standard checks (see §2e below).

Use the playwright MCP to inspect the running app (`browser_navigate`,
`browser_evaluate`, `browser_take_screenshot`; `browser_click` /
`browser_fill` if needed).

SCREENSHOT OUTPUT FOLDER: .cursor/playwright-output/
 Save every browser_take_screenshot call to this folder.
 Use descriptive filenames:
   pre-pr-initial-load.png
   pre-pr-todos.png
   pre-pr-habits.png
   pre-pr-pomodoro.png
   pre-pr-workout.png
   pre-pr-calories.png
 Create the folder if it does not exist. Do not save
 screenshots anywhere else.

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

Take a screenshot of the initial load to `.cursor/playwright-output/pre-pr-initial-load.png`.

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

Navigate to each URL. Take a screenshot to the path shown. Check for blank/error state.

| URL | Expected | Screenshot | Status |
|-----|----------|------------|--------|
| `http://localhost:8081/(tabs)/todos` | Todos screen renders | `.cursor/playwright-output/pre-pr-todos.png` | ? |
| `http://localhost:8081/(tabs)/habits` | Habits screen renders | `.cursor/playwright-output/pre-pr-habits.png` | ? |
| `http://localhost:8081/(tabs)/pomodoro` | Pomodoro screen renders | `.cursor/playwright-output/pre-pr-pomodoro.png` | ? |
| `http://localhost:8081/(tabs)/workout` | Workout screen renders | `.cursor/playwright-output/pre-pr-workout.png` | ? |
| `http://localhost:8081/(tabs)/calories` | Calories screen renders | `.cursor/playwright-output/pre-pr-calories.png` | ? |

For each screen, also evaluate `document.body.innerText` — confirm
it contains screen-specific text (not just a blank or error message).

### 2d — Console error summary

After all tabs are visited, collect all console messages:
- List every `console.error` with full message
- List every `console.warn` worth noting
- Ignore React DevTools and HMR noise

### 2e — Deep mode additions (run when requested)

Only run this subsection when the user asked for **pre-pr in deep mode** (optional; extends §2a–2d).

**Transfer size check**

Evaluate: `performance.getEntriesByType("navigation")[0].transferSize`

- If `0`: served from cache (SW or disk)
- If `> 0`: served from network (fresh)

**DB ready probe**

Evaluate: `window.__dbReady ?? "not exposed"`

(`"not exposed"` is acceptable — the app does not expose this global.)

**Per-tab body text**

After each tab screenshot in §2c, evaluate `document.body.innerText` and confirm it contains screen-specific text (not a blank error state). In deep mode, treat this as mandatory evidence per tab.

**Headed mode**

To watch the browser live, ask: **“run pre-pr in headed mode”**. Playwright MCP supports this via browser launch options.

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
- Recommended fix command (**/fix**, or specific action)
- Whether it blocks the PR or is acceptable tech debt

Screenshots saved to: .cursor/playwright-output/
 This folder is in .gitignore — not committed to the repo.

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
- Playwright runs headless by default — no browser window will
  appear. The check runs fully in the background. You do not need
  to keep any window visible or in focus. (Use **headed mode** only when explicitly requested — see §2e.)
- Run this before every PR, not just when something seems broken
