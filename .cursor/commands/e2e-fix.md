# e2e-fix

Run the full E2E suite, read the HTML report using the Playwright
MCP, identify every failure, and fix each one autonomously.
Plan-first for any code changes — wait for approval before
modifying application source files.

Requires: `npm run web` running on localhost:8081.
Requires: Playwright MCP connected in Cursor Settings → MCP.

---

## Phase 1 — Run the E2E suite

Run in terminal: `npm run e2e`

Capture:
- Exit code (0 = all pass, 1 = failures)
- Raw terminal output (test names, pass/fail counts, error messages)
- Path to the HTML report:
  `.cursor/playwright-output/e2e-report/index.html`

If exit code is 0 (all tests pass):
  Report "All E2E tests passing — nothing to fix." and stop.

---

## Phase 2 — Read the HTML report via Playwright MCP

Use the Playwright MCP to open and inspect the report:

1. `browser_navigate` → `file://.cursor/playwright-output/e2e-report/index.html`
   (use absolute path if relative doesn't resolve)

2. `browser_take_screenshot` → `.cursor/playwright-output/e2e-report-overview.png`

3. `browser_evaluate`:
   Extract all failed test entries from the report DOM:
   ```js
   Array.from(document.querySelectorAll('[class*="test-result"][class*="failed"], [class*="failed"]'))
     .map(el => ({
       title: el.querySelector('[class*="title"]')?.textContent?.trim(),
       error: el.querySelector('[class*="error"], [class*="message"]')?.textContent?.trim(),
       file: el.querySelector('[class*="file"], [class*="location"]')?.textContent?.trim(),
     }))
   ```

4. For each failed test entry found, `browser_click` on it to
   expand the details, then `browser_take_screenshot` of the
   expanded failure with filename:
   `.cursor/playwright-output/failure-{test-name}.png`

5. `browser_evaluate` to extract the full error stack trace
   from the expanded failure panel.

---

## Phase 3 — Categorize every failure

For each failed test, classify the failure type:

**Type A — Selector mismatch**
  Symptom: "locator.click: Error: strict mode violation" or
            "getByText('...') — no elements found" or
            "Timeout waiting for element"
  Cause: The test selector doesn't match the actual rendered DOM.
         Common in React Native Web where component text or roles
         may differ from what was assumed during test authoring.
  Fix scope: e2e/*.spec.ts only — no app source changes needed.

**Type B — Logic / data bug**
  Symptom: expect(actual).toBe(expected) fails with wrong value.
            e.g. expected "147 kcal" but got "0 kcal"
  Cause: App domain logic or data layer returning wrong result.
  Fix scope: features/*.domain.ts or features/*.data.ts via /fix.

**Type C — Infrastructure failure**
  Symptom: crossOriginIsolated is false, SW cache wrong name,
            COEP header missing, DB init error in console.
  Cause: Config regression in metro.config.js, app.json,
         public/sw.js, or AppProviders.tsx.
  Fix scope: config files via /fix.

**Type D — Test flakiness**
  Symptom: Timing-related failure — "Timeout 30000ms exceeded"
            on timer or animation tests.
  Cause: Test is too time-sensitive for the current machine speed.
  Fix scope: Add waitForTimeout or increase specific test timeout
             in e2e/*.spec.ts.

**Type E — Environment issue**
  Symptom: "ERR_CONNECTION_REFUSED" or "net::ERR_FAILED"
  Cause: Metro dev server not running or wrong port.
  Fix: Stop — remind user to run `npm run web` first.

---

## Phase 4 — Build fix plan

Group failures by type and build a prioritized fix plan:

For each failure, state:
1. Test name and file
2. Failure type (A/B/C/D/E)
3. Exact error message
4. Proposed fix (file + line + change)
5. Confidence level: HIGH (clear fix) / MEDIUM (needs verification)
   / LOW (ambiguous — needs human input)

Present the full plan and **wait for approval** before implementing
any changes to application source files (Type B and C).

Type A (selector fixes in e2e/ files) and Type D (timeout tweaks)
may be implemented without separate approval if confidence is HIGH
— state this clearly in the plan.

---

## Phase 5 — Implement fixes

### Type A — Selector fixes

For each selector mismatch:
1. Use Playwright MCP to navigate to the failing screen:
   `browser_navigate` → `http://localhost:8081/(tabs)/{feature}`
2. `browser_evaluate`:
   ```js
   Array.from(document.querySelectorAll('button, input, [role="button"]'))
     .map(el => ({
       tag: el.tagName,
       text: el.textContent?.trim(),
       placeholder: el.getAttribute('placeholder'),
       role: el.getAttribute('role'),
       ariaLabel: el.getAttribute('aria-label'),
     }))
   ```
3. Use the actual values found to correct the selector in the
   spec file.
4. Re-run the specific test file:
   `npx playwright test e2e/{file}.spec.ts`
   Confirm it passes before moving to the next.

### Type B — Logic / data fixes

Use `/fix` with the exact issue description from the failure.
Follow the /fix workflow (plan → approval → implement → test).

### Type C — Infrastructure fixes

Use `/fix` with the exact header/config issue.
After fixing, re-run infrastructure.spec.ts:
  `npx playwright test e2e/infrastructure.spec.ts`

### Type D — Flakiness fixes

Increase timeout for the specific test:
  ```ts
  test("starts timer", async ({ page }) => {
    test.setTimeout(60_000);
    ...
  });
  ```
Or add explicit wait before the assertion:
  ```ts
  await page.waitForTimeout(1_000);
  ```

---

## Phase 6 — Re-run and verify

After all fixes are applied, run the full suite again:
  `npm run e2e`

Then run unit tests to confirm no regressions:
  `npm test`

---

## Phase 7 — Final report

| Test | File | Was | Now | Fix type |
|------|------|-----|-----|----------|
| ... | ... | FAIL | PASS | A/B/C/D |

**Failures resolved:** N
**Failures remaining:** N (with explanation if any)
**Unit tests:** 7 passing (unchanged)

If any failures remain that could not be fixed automatically
(LOW confidence or require human decision), list them clearly
with the information needed to resolve them manually.

---

## Constraints

- Do not modify application source files (.ts, .tsx) without
  approval from the plan in Phase 4
- Type A selector fixes and Type D timeout fixes in e2e/ files
  may proceed without separate approval
- Do not add data-testid attributes to app components
- Do not change test assertions to make tests pass artificially
- If a test reveals a genuine app bug, fix the app — not the test
- Headless only — do not switch to headed mode during fixes
- Re-run after every fix to confirm the specific test passes
  before moving to the next failure
