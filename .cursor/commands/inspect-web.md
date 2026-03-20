# inspect-web

Live browser inspection of the SuperHabits web app using the
Puppeteer MCP. Requires `npm run web` to already be running on
localhost:8081 before invoking this command.

---

Use the puppeteer MCP server to inspect the running SuperHabits
web app. Work through each phase in order. Do not skip phases.

BASE_URL = http://localhost:8081

---

## Phase 1 — Cross-origin isolation check

Navigate to BASE_URL, then evaluate:

1. `crossOriginIsolated`
   Expected: true
   If false: COEP/COOP headers are not working — stop and report.

2. `typeof SharedArrayBuffer`
   Expected: "function"
   If "undefined": SAB unavailable — SQLite WASM will fail.

3. Check console logs for:
   - "[db] initializeDatabase failed" — DB init error
   - Any "Error:" lines on page load
   Take a screenshot of the initial load state.

---

## Phase 2 — Service worker status

Evaluate:

4. `navigator.serviceWorker.controller !== null`
   Expected: true (SW is active and controlling the page)
   If false: SW not registered or not yet controlling.

5. `await (await caches.keys()).join(", ")`
   Expected: "superhabits-shell-v2" (or current version)
   If "superhabits-shell-v1" appears: stale cache still present.

6. Check if the bundle is being served from SW or network:
   Evaluate: `performance.getEntriesByType("navigation")[0].transferSize`
   If 0: served from cache (SW or disk)
   If > 0: served from network (fresh)

---

## Phase 3 — Database health check

Evaluate:

7. Check if SQLite opened successfully by probing a known
   global or data call. Evaluate:
   `window.__dbReady ?? "not exposed"`
   (May return "not exposed" — that is acceptable; proceed.)

8. Navigate to /(tabs)/todos
   Take a screenshot.
   Evaluate: `document.body.innerText`
   Check: does the page show the todos screen content or a blank/error state?

9. Navigate to /(tabs)/habits
   Take a screenshot.
   Check for the same blank/error pattern.

10. Navigate to /(tabs)/calories
    Take a screenshot.

---

## Phase 4 — Tab navigation smoke test

11. Navigate to each tab and take a screenshot:
    - http://localhost:8081/(tabs)/todos
    - http://localhost:8081/(tabs)/habits
    - http://localhost:8081/(tabs)/pomodoro
    - http://localhost:8081/(tabs)/workout
    - http://localhost:8081/(tabs)/calories

    For each: note whether the screen renders content or shows
    an empty/error state.

---

## Phase 5 — Console error summary

12. After navigating all tabs, retrieve all console messages
    captured during the session. Categorize as:
    - Errors (console.error)
    - Warnings (console.warn)
    - Info worth noting

---

## Phase 6 — Report

Produce a summary table:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| crossOriginIsolated | true | ? | PASS/FAIL |
| SharedArrayBuffer | "function" | ? | PASS/FAIL |
| SW controlling | true | ? | PASS/FAIL |
| Cache name | superhabits-shell-v2 | ? | PASS/FAIL |
| DB init error in console | none | ? | PASS/FAIL |
| Todos screen | renders | ? | PASS/FAIL |
| Habits screen | renders | ? | PASS/FAIL |
| Pomodoro screen | renders | ? | PASS/FAIL |
| Workout screen | renders | ? | PASS/FAIL |
| Calories screen | renders | ? | PASS/FAIL |

End with:
- OVERALL: PASS (all green) or FAIL (list failing checks)
- If any FAIL: identify the most likely root cause and
  recommended next step (file + line if known from KB)

---

## Prerequisites

- `npm run web` must be running on localhost:8081
- Puppeteer MCP must be connected in Cursor Settings → MCP
- Only one browser tab should have localhost:8081 open
  (OPFS lock: multiple tabs cause DB init failure)

## Notes

- Screenshots are saved by Puppeteer — reference them by index
  in the report
- The Cursor embedded browser and Puppeteer use separate
  Chromium instances — this inspection targets a fresh Puppeteer
  browser, not your IDE's preview
- Run /check after any code fix to confirm typecheck + tests still pass
