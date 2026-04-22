# pre-pr

Run the full SuperHabits pre-PR health check before opening or merging
any pull request. Combines the live web inspection (playwright MCP) with
the code quality gate (typecheck + tests). Both must pass for a green light.

After all local gates pass (Phases 1–3), Phases 4–6 use **GitHub MCP** to
check Actions CI on the open PR for the current branch, fix failures if
needed, and confirm a green run before merge.

Requires:
- App reachable at `http://localhost:8081` — for parity with CI/E2E, run `npm run build:web` then `node scripts/serve-e2e.js` (static `dist/`, `require-corp` COEP). For quick UI iteration, `npm run web` (Metro) on 8081 is fine for manual inspection but does not match the static E2E bundle.
- One tab / one origin for DB-heavy flows (OPFS lock)
- Playwright MCP must be connected in Cursor Settings → MCP
- **GitHub MCP** — for Phases 4–6 (CI status, logs, PR review comments in deep mode)
- **inspect-web is no longer a separate command** — its full functionality is available via **“run pre-pr in deep mode”** (see Phase 2, §2e).

---

## Phase 1 — Code quality gate

Run the following commands in the terminal and capture output:

1. `npm run typecheck`
   Expected: 0 errors
   If errors: stop here — list every error (file + line) and do not proceed.

2. `npm test`
Expected: **334** tests passing, 0 failing
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

---
SCREENSHOT OUTPUT FOLDER: .cursor/playwright-output/
Save ALL browser_take_screenshot calls to this folder.
Use these exact filenames:
  pre-pr-initial-load.png
  pre-pr-todos.png
  pre-pr-habits.png
  pre-pr-pomodoro.png
  pre-pr-workout.png
  pre-pr-calories.png
Create the folder if it does not exist.
Do not save screenshots to the project root or any other path.
---

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

Take a screenshot → save as
`.cursor/playwright-output/pre-pr-initial-load.png`

### 2b — Service worker

Evaluate:

| Expression | Expected | Actual |
|------------|----------|--------|
| `navigator.serviceWorker.controller !== null` | `true` | ? |
| `await (await caches.keys()).join(", ")` | includes `superhabits-shell-v3` | ? |

If `superhabits-shell-v1` appears in cache keys: stale SW cache
still present — user should clear site data and reload.

If `superhabits-shell-v3` missing: SW may not have activated yet —
reload once and re-check.

### 2c — All 5 feature tabs

Navigate to each URL. Take a screenshot → save as the path in the table. Check for blank/error state.

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

If taking additional screenshots in deep mode (optional), save as `.cursor/playwright-output/pre-pr-deep-{tabname}.png` (e.g. `.cursor/playwright-output/pre-pr-deep-todos.png`).

**Lighthouse audit (deep mode)**

Use **Lighthouse MCP** against BASE_URL (or the relevant app URL) to run an audit and report key scores / findings (performance, accessibility, PWA as applicable). Surface any regressions worth fixing before merge.

**Headed mode**

To watch the browser live, ask: **“run pre-pr in headed mode”**. Playwright MCP supports this via browser launch options.

**Bugbot PR comments (deep mode; after CI check in Phases 4–6)**

When Phases 4–6 run and an open PR exists for the branch, use **GitHub MCP** to fetch any **Bugbot** (or Copilot / automated bot) PR review comments and report them **alongside** the CI status in the Phase 4 report and in the Phase 6 final summary. If there is no PR yet, skip.

---

## Phase 3 — Final report

Produce this table:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Typecheck | 0 errors | ? | PASS/FAIL |
| Tests | 334 passing | ? | PASS/FAIL |
| crossOriginIsolated | true | ? | PASS/FAIL |
| SharedArrayBuffer | "function" | ? | PASS/FAIL |
| SW active | true | ? | PASS/FAIL |
| Cache name | superhabits-shell-v3 | ? | PASS/FAIL |
| DB init error | none | ? | PASS/FAIL |
| Todos screen | renders | ? | PASS/FAIL |
| Habits screen | renders | ? | PASS/FAIL |
| Pomodoro screen | renders | ? | PASS/FAIL |
| Workout screen | renders | ? | PASS/FAIL |
| Calories screen | renders | ? | PASS/FAIL |

**OVERALL: PASS or FAIL**

**Screenshot output:** .cursor/playwright-output/
(Folder is in .gitignore — not committed to the repo.
 Delete contents before each run if you want a clean set.)

If PASS: safe to open PR.

If FAIL: list every failing check with:
- Root cause (file + line if known)
- Recommended fix command (**/fix**, or specific action)
- Whether it blocks the PR or is acceptable tech debt

---

## Phase 4 — Check GitHub Actions CI status

Run **only after** Phases 1–3 have passed (local quality gate + live inspection + Phase 3 report).

Use **GitHub MCP** to:

1. Get the current branch name (`git branch --show-current`).
2. Find the **open PR** for this branch on the **superhabits** repo.
3. Fetch the **latest workflow run** associated with that PR (or the run for the latest push to the PR branch).
4. Report the status of each job:
   - **quality** (typecheck + unit tests)
   - **e2e** (Playwright)

**If no PR exists** for this branch, skip the CI check and note:

> No PR found for this branch — push and open a PR first, then re-run /pre-pr to check CI status.

**If a PR exists but CI is still running:** wait up to **60 seconds**, polling every **15 seconds**. If still running after 60s, report:

> CI still in progress — check back in a few minutes.

**Deep mode:** In addition to the above, fetch any **Bugbot** (or similar bot) PR review comments via GitHub MCP and include them in the report next to CI status (see §2e).

---

## Phase 5 — Fix CI failures if found

If any CI job has **failed**:

1. Fetch the **full logs** for the failed job using **GitHub MCP**.
2. Identify the specific failure:
   - **Typecheck error** → read the file, fix the type error.
   - **Unit test failure** → read the test output, fix the code or test (**never** weaken assertions to force a pass).
   - **E2E failure** → classify as A/B/C/D/E per **/e2e-fix** rules; auto-fix selectors (Type A), route logic bugs (Type B) through **/fix** with plan approval.
3. After fixing locally:
   - Run `npm run typecheck` → confirm 0 errors.
   - Run `npm test` → confirm count matches or exceeds previous.
   - Commit the fix: `git add . && git commit -m "fix: ci failures"`
   - Push: `git push`
4. Report: what was fixed and what the new CI status is (GitHub MCP will reflect the new push and updated run).

**Key rule (from /e2e-fix):** NEVER fix a test to make it pass artificially. If a test failure reveals a genuine app bug, fix the **app** — not the assertion.

---

## Phase 6 — Final CI confirmation

After any fixes are pushed (or if Phase 5 was skipped because CI was already green):

Use **GitHub MCP** to confirm:

- All jobs are green on the **latest** run.
- No new failures were introduced by the fix.

Report final status using one of:

- ✅ All CI jobs passing — PR is ready to merge
- ⚠️ Some jobs still failing — describe what remains
- ℹ️ CI still running — check back manually

**Deep mode:** Include Bugbot / bot review comments again if new since the Phase 4 check (see §2e).

---

## Known non-blocking items (do not fail PR for these)

- `schema.sql` is a stale reference snapshot, not runtime authority
- Sync flush gated on isRemoteEnabled() — intentional, remote off
- tests/calories.data.test.ts — mocked data-layer coverage
- No ESLint config — not yet set up, not in CI

---

## Reminders

- Only one tab using the app on `localhost:8081` at a time for DB flows — OPFS lock will cause DB init failure if multiple tabs are open
- Playwright runs headless by default — no browser window will
  appear. The check runs fully in the background. You do not need
  to keep any window visible or in focus. (Use **headed mode** only when explicitly requested — see §2e.)
- Run this before every PR, not just when something seems broken
