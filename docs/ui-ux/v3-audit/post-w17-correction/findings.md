# Post-W17 correction — findings

Change: `frontend-v3-post-w17-correction`
Branch: `frontend-v3-post-w17-adversarial-correction`
Baseline: `bf09c0d50ca35a23bcc9df2582ea8398124d1038`
Date: 2026-10-14

Every item below names the revision and command that produced its evidence.
Historical run records (W12–W17) stay on their original revisions and are not
re-attributed anywhere in this pack.

## Summary table

| ID        | Item                                     | Disposition                                 | Evidence                                             |
| --------- | ---------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| C-3 / H01 | settings-ripple `Goal 2,400` red journey | `TEST_BUG` — stale selector, retargeted     | journey 6/6 + SQL/reload oracles                     |
| H04/H05   | visual `settle()` fail-open              | `TEST_BUG` — fail-closed after red controls | 3 red controls → named diagnostics; 34/34 ×2 runs    |
| H02/H20   | parent plan restarts W12                 | fixed in place, plan stays ACTIVE           | parent execplan validates ACTIVE                     |
| H03/H07   | W17 provenance / Android boundary        | annotated in place, counts unmoved          | five W17 docs annotated                              |
| H08       | host-local E2E date keys                 | `TEST_BUG` REPRODUCED + fixed               | 16/41 red under boundary → 41/41 fixed               |
| H12       | weekly-review failure boundaries         | probed correct — no defect                  | orchestration analysis + existing suites             |
| H10       | dependency audit                         | UNREMEDIATED — exposure limited, gate red   | audit output, chains, versions                       |
| H19       | pointer-events hole during fade          | DISPROVEN (source) — no patch               | `app/index.tsx` ties `pointerEvents` to active state |
| —         | overview strip `0/2000` during H01 run   | DISPROVEN — hidden inactive section         | `useActiveForegroundRefresh` refreshes on activation |
| —         | `portable-backup` native flow            | `TEST_BUG` (off-screen assert) — fixed      | 2/2 repro → flow fix → 2/2 green                     |
| —         | native lane flakes (2 flows)             | `FLAKY_TEST` — preserved, classified        | per-run reports + standalone replays                 |

## C-3 / H01 — settings-ripple Calories step

**Disposition: `TEST_BUG` (stale selector) — matches the locked disposition.**

Reproduction at `d0a6fdc` + working tree, hermetic `build:e2e`, owned port 8081:
`npx playwright test --project=journeys e2e/journeys/settings-ripple.spec.ts`
failed at `e2e/journeys/settings-ripple.spec.ts:145` —
`getByText('Goal 2,400')` not found after the Settings save. Step 1 passed.

The failure page snapshot proved the product path is correct — the Calories
surface rendered the shipped W10 grammar:

- title `2,400 kcal left`
- context `Today · 0 of 2,400 kcal logged`
- control `button "Edit daily calorie goal"` (label `Edit goal`)

No `Goal N` statistic exists anywhere in the product source (W10
`calories-logging-first` forbids a second goal fact), so the assertion matched
no surface at any state. Retargeted both the ripple and reload checks to the
W10 title + context line + edit-goal accessible name. Kept intact:
the `app_meta.calorie_goal` JSON equality oracle
(`{calories: 2400, protein: 150, carbs: 200, fats: 65}`), the reload check,
and the unchanged calorie-entry-count negative oracle (2 rows).

Result: **6/6 green** at port 8081 (recorded in the evidence index). Per the
locked disposition, no `Goal 2,400` chip was added and no product code changed.

Spec `calorie-goal-settings-propagation` scenario "Over-goal days do not invent
a goal chip": the prohibition is structurally enforced — no goal-chip surface
exists anywhere in product source (the hero renders only the remaining/over
fact, the consumed-of-goal context, and the edit-goal control; the over-goal
branch is `features/calories/CaloriesScreen.tsx:657`) and the W10 suite pins
the absence (`Goal 2,000` `toHaveCount(0)` at `e2e/calories-w10.spec.ts:118`)
plus domain unit tests — but, as the independent review found, **no gated test
exercises an over-goal DAY**: the `calories-w10.spec.ts` "over target is
factual" test is an under-goal day (1,300/2,000 → `700 kcal left`; "over
target" refers to macro targets), and the over-goal title clause is exercised
only in opt-in lanes (`e2e/calories-w10-audit.spec.ts:139,148` behind
`VISUAL_AUDIT=1`; a loose identity regex at
`e2e/health-nav-w10-measure.spec.ts:286` behind `D3_MEASURE=1`). Recorded as
a coverage gap (the scenario's positive THEN is opt-in-only), not claimed as
covered.

## H04/H05 — visual capture readiness (`settle()`)

**Disposition: `TEST_BUG` (fail-open harness) — red-first controls, then
fail-closed helper. Goldens and tolerance untouched.**

The old `settle()` could continue to `toHaveScreenshot` after an unmet
condition: it returned silently when its 4s deadline expired, treated
non-finite computed opacity as settled, and swallowed `document.fonts.load`
rejections.

Negative controls (in `e2e/visual-regression.spec.ts`, page-side stubs via
`page.evaluate`) were run against the OLD helper first and failed as required:

```text
npx playwright test --project=visual -g "capture readiness self-checks"
→ 3 failed / 1 passed
  each failure: "settle() unexpectedly succeeded — readiness must fail closed here"
```

The three failures are the proof that the old helper fail-opens on: (1) a
stuck opaque inactive hidden section, (2) a non-finite computed opacity,
(3) a rejected required font face. The fourth control (strict comparison) passes
on both helpers by design.

After the fix, `settle()` throws named diagnostics BEFORE any golden
comparison:

- `visual settle: section readiness unmet after 4000ms — N inactive hidden
section(s) still not fully transparent: <tag #id .class opacity=…>. Capture
refused before toHaveScreenshot.`
- `visual settle: required font load failed — <family> (<reason>). Capture
refused before toHaveScreenshot.`

Non-finite opacity now counts as UNMET (fail-closed), not settled. The
strict-comparison control proves a settled capture still matches the committed
golden at `maxDiffPixels: 0` and that a deliberate pixel perturbation still
fails; it skips itself under `--update-snapshots` so it can never rewrite a
golden.

Preserved: `maxDiffPixels: 0`, no masks, all 30 goldens byte-untouched
(`git status` clean on `e2e/__screenshots__/`), the bounded 4s wait (no
unbounded wait added).

Golden-set hash (method: `sha256sum e2e/__screenshots__/visual-regression.spec.ts/*.png | sha256sum`):

- **current set hash: `f19261d5d676ac1ef10cc526a4fb19d41e0edbf1a6e3ebd87fcb437c50dcdeaa`**
  — stable across two fresh full-suite runs (34/34 each) at the correction tree.
- historical W15 two-run-proof hash: `0676368d…` — the PRE-regeneration set,
  kept as history and never presented as current. (The W15 README itself
  records both: `0676368d…` for the original proof and `f19261d5…` for the
  post-fix baseline after `e70ccc7` regenerated three reviewed goldens.)

## H02/H20 — parent Calm Momentum recovery record

**Fixed in place; the plan stays `ACTIVE`.**

`openspec/changes/frontend-v3-calm-momentum/execplan.md`'s Current Checkpoint
and Recovery sections were replaced in place (not appended). The Exact next
action is now "resume `openspec/changes/frontend-v3-post-w17-correction/…`",
never "author W12". The checkpoint states that W12–W17 are published, warns
that slice `tasks.md` checkbox counts are not current authority, and records
the `b50034d` Android boundary. `npm run agent:plan:validate` reports the plan
valid and `ACTIVE`. Historical wave notes under Progress and the Validation
Ledger are unchanged.

## H03/H07 — W17 provenance reconciliation

**Annotated in place; historical run counts are not moved.**

Present-tense claims corrected with inline `[Post-W17 correction: …]` notes in
`docs/ui-ux/v3-audit/w17/{README,verification-matrix,rc-manifest,correction-handoff,defect-register}.md`:

- `1177ac2` and `3aaca2a` are no longer described as the current head. Each
  document now states that its records belong to the W17-closure revision and
  that docs-only `bf09c0d` followed `1177ac2` on `main`.
- The Android inheritance claim is corrected: the `b50034d` APK's test/docs-only
  chain holds through `3aaca2a` ONLY — `af8eeda` changed user-facing
  `features/activity/*` and `features/weekly-review/*`, so `af8eeda` and every
  later revision (including `1177ac2`, `bf09c0d`, and this correction) are not
  covered by that APK.
- The stale golden-set hash `0676368d…` in README/matrix/manifest/handoff is
  identified as the historical W15 proof; the current set hash `f19261d5…` is
  recorded beside it.
- The three Vitest totals 2,691 / 2,699 / 2,700 stay attached to their own
  named runs (local `npm test`, hosted CI, the "re-verified" lane detail); the
  matrix counting rules now say explicitly that they must not be merged or
  re-attributed. The matrix's self-contradictory sentence (the plan-gate defect
  attributed to `1177ac2` as both failing head and fix) is annotated with the
  defect register's own attribution (`b9e775f`).
- The correction-handoff's "Top next action" (C-3) is marked RESOLVED so no
  future session redoes it.

The W12–W17 campaign ExecPlan's unqualified "Windows-CRLF register-parsing
ENVIRONMENT failure" claim is corrected (`TEST_BUG`, fixed at `3aaca2a`), and
its C-3 pointer is marked resolved.

## H08 — host-local E2E date keys

**REPRODUCED, then fixed at the harness layer.**

Probe method: the five suspect specs were run with Node's wall clock shifted a
constant −24h (a `NODE_OPTIONS` Date shim that preserves all deltas), while the
browser keeps its pinned `Asia/Manila` clock — a host/browser calendar
boundary. (`TZ` cannot be used for this on Windows: Node ignores it there —
verified `TZ=Pacific/Honolulu node -e …` still reports GMT+0800.)

Shim used for the probe (kept here for reproducibility; it is NOT shipped):

```js
const SHIFT_MS = -24 * 60 * 60 * 1000;
const RealDate = Date;
class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + SHIFT_MS);
    else super(...args);
  }
  static now() {
    return RealDate.now() + SHIFT_MS;
  }
}
global.Date = ShiftedDate;
```

Results for `planning-hub`, `calories`, `calories-w10`,
`calories-day-navigation`, `workout-w9`:

| Condition                                            | Result                    |
| ---------------------------------------------------- | ------------------------- |
| host date = browser date (control)                   | 41/41 pass                |
| host date = browser date − 1 (boundary), OLD specs   | **16 failed / 25 passed** |
| host date = browser date − 1 (boundary), FIXED specs | 41/41 pass                |
| host date = browser date (control), FIXED specs      | 41/41 pass                |

Root cause: those specs derived `localTodayKey()` / weekday names from
Node-side `new Date()` (host timezone) while the app derives date keys from the
browser clock (`toDateKey()`). Fix: `e2e/helpers/browserDate.ts` gained
browser-evaluated date-key-offset, weekday, and locale-label helpers (mirroring
the app's `toDateKey()` / `formatNavLabel` contracts) and every affected use
site now uses them. Absolute `toISOString()` timestamps were left untouched by
design.

## H12 — weekly-review failure boundaries

**Probed correct — no disagreement with the partial-failure contract, so no
regression was added (per the locked disposition).**

- Commitment-create failure: `weeklyReview.executor.ts` catches per-commitment
  failures (`status: 'failed'`), continues the remaining commitments, and still
  saves the review row; the screen renders the fixed copy
  `Review saved — some items need retry` with the failed titles named and the
  retry path retained. Visible and SQL results agree with the contract.
- Decision-update throw: `updateTodo` in the decisions loop is uncaught, so the
  executor rejects → `handleConfirm` sets `The review was not saved: …` and
  never reaches the completion state; no review row is written. The message is
  honest (no false success), and retry is idempotent via the in-memory /
  persisted `createdTodoId` receipts. Observation (not a defect): partial todo
  mutations made before the throw are not itemized in that message.

Existing coverage found at the right layers: `tests/integration/weeklyReviewExecutor.test.ts`
(receipts, same-session retry after partial failure, idempotent re-runs),
`tests/integration/weeklyReviewW12Persistence.test.ts` (rejected review INSERT
leaves no row/outbox intent), `e2e/weekly-review.spec.ts`, `e2e/planning-w12.spec.ts`.

## H10 — dependency audit

**UNREMEDIATED — exposure limited. Gate stays red. Nothing waived.**

`node scripts/audit-runtime-deps.mjs` reports exactly 2 undocumented HIGH
findings (plus 3 already-documented `brace-expansion` entries):

| Advisory                   | Package      | Installed | Latest | Range | Fix    | Chain                                                                                   |
| -------------------------- | ------------ | --------- | ------ | ----- | ------ | --------------------------------------------------------------------------------------- |
| GHSA-vfj7-8cjw-p6xm (high) | `braces`     | 3.0.3     | 3.0.3  | `*`   | **No** | `tailwindcss@3.4.19 → chokidar@3.6.0 / micromatch@4.0.8 → braces`                       |
| GHSA-86w9-cpqp-85rv (high) | `node-forge` | 1.4.0     | 1.4.0  | `*`   | **No** | `expo@55.0.31 → @expo/cli@55.0.36 → @expo/code-signing-certificates@0.0.6 → node-forge` |

Both packages are already at their latest published versions and both advisory
ranges are `*` — no upstream/patched release exists, so no safe upstream or
dependency-graph fix exists at implementation time. Exposure is build-time
tooling only and neither package ships in the web bundle or the APK (bundle
scans: 0 hosts / 0 matches). No allowlist entry, waiver, `continue-on-error`,
or audit-script edit was made; `package.json`/`package-lock.json`/`scripts/audit-runtime-deps.mjs`
are unchanged in this change. Hosted `e2e`/`nightly` remain skipped behind this
gate and are recorded as **not run**, never passed.

## H19 — pointer-events during the section fade

**DISPROVEN at source level; no patch applied (per the locked disposition).**

`SectionContainer` in `app/index.tsx` sets
`pointerEvents: isActive ? 'auto' : 'none'` in the same style pass that starts
the fade — an inactive section never accepts input during its cross-fade, so
there is no hit-test hole to patch. The `inert` attribute (web effect after
commit) is a focus-management concern, and the visual `settle()` change does
not depend on it beyond the existing `[aria-hidden][inert]` selection.

## Disproven observation — overview strip `0/2000` during the H01 run

While reproducing C-3, the failure snapshot showed the hidden Overview
"Today at a glance" tile reading `0/2000` after the goal save. Not a defect:
inactive sections stay mounted (single-page shell) and
`useActiveForegroundRefresh` re-runs `loadSummaries()` on every activation, so
the tile reads the saved goal the moment Today becomes active. The Calories
hero (the section that was switched to) showed the new goal immediately.

## Native lane — exact-source qualification at the correction app source

Provision: `node scripts/qa-native-provision.mjs` (serial `emulator-5594`,
AVD `Nitro_API_36`, API 36) built and installed the credential-free APK at
source `52a10d01a4d73394a699880766a612c009fc0cd8`, APK SHA-256
`65558DFEEA587E11124CE3D4920564EE8938236A7CC37EA731EE0F91156E4D0D`,
bundle scan 0 Supabase hosts, `local-only` remote configuration.

| Tag lane        | Result | Notes                                                                                                                                                                                                                                                      |
| --------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| smoke           | 2/2    | run 1                                                                                                                                                                                                                                                      |
| persistence     | 11/11  | run 3 clean; run 1 `habit-reminder-disable` FAILED once (3/3 standalone replays + green in runs 2–3 → `FLAKY_TEST`); run 2 `workout-gym-v2-persistence` FAILED once (green in runs 1, 3 + one standalone replay; 2 different failure steps → `FLAKY_TEST`) |
| lifecycle       | 6/6    | run 1                                                                                                                                                                                                                                                      |
| reward          | 1/1    |                                                                                                                                                                                                                                                            |
| backup-v2       | 1/1    |                                                                                                                                                                                                                                                            |
| portable-backup | 2/2    | FAILED 2/2 at the same step first (`assertVisible: 'Export data'` after the disclosure-paragraph scroll) — classified `TEST_BUG` (off-screen assertion), flow fixed to scroll before asserting (assertion kept), re-run 2/2 green                          |

Total: **23/23 flows across the six W16 tags at the correction app source**,
with both flake incidents and the flow fix preserved above and in
`simulation-output/native/`. The native flow fix (`eb718ca`) changed only
`.maestro/flow` YAML, so the installed APK's app source still equals the
correction revision `52a10d0`.

**iOS: NOT RUN** (Windows host; no authorized simulator/cloud lane). No iOS
claim is made.

## Regression-impact notes

- No product source changed (`features/`, `core/`, `app/`, `lib/` untouched),
  so no UI/a11y/theme sampling was triggered (task 5.3 NOT APPLICABLE) and the
  247-capture W14 matrix was not regenerated.
- No schema migration (`core/db/client.ts` still ends at `if (version < 25)`),
  no backup-scope, sync, dependency, or security-policy change.
- No assertion was weakened; no quarantine, `data-testid`, or retry-mask was
  added. (Precision note: the retargeted `2,400 kcal left` assertion carries
  `{ timeout: 15_000 }`, mirroring the identical 15s envelope of the stale
  `Goal 2,400` assertion it replaces — not a raise relative to what it
  supersedes.) Failures were fixed at their root layer or classified and
  preserved.
- Residual (accepted, documented): the host-vs-browser calendar-boundary
  proof for H08 is one-shot — the −24h host-shift shim is recorded above but
  not shipped, so no committed regression re-runs the shifted-host condition;
  `qa:timezones` varies the browser timezone, not the host/browser split. The
  browser-evaluated helper contract is the standing guard.
