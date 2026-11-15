# Repository audit and remediation — 2026-11-14

**Status: IN PROGRESS — ordinary-mode continuation; not a completion or release certification.**

Git publication is explicitly authorized by the user's 2026-11-16 request to
push the validated audit branch and merge it into `main`. Actual commit/PR/merge
state follows Git and the publication receipt; the qualification evidence below
was collected before that publication. Git publication does not apply hosted
migrations or waive the remaining certification gaps.

The user explicitly authorized continuing the audit in normal mode while preserving existing work and reporting blockers. Goal mode remains inactive; earlier Goal objectives, IDs and rules are not authority.

Baseline: clean fetched `main` / `origin/main` at `b98d2d888570d9ba5dd1b55bd260045e050e4855`.
Work is isolated on `audit/repository-remediation-20261114`; unrelated worktrees are untouched.
Living execution state: `.agent/execplans/repository-remediation-20261114.md`.
Evidence root: `D:/Documents/tryPython/_AgentArtifacts/superhabits/sessions/20261114-pi-repository-remediation/`.
All test results below use session-local Node 22.23.2/npm 10.9.8, with the Node ZIP SHA-256 verified against the official release manifest. The default Node 24/npm 11 is unsupported and is not used for conclusions.

## Current qualification — A31–A33 (2026-11-15)

All reproduced product/test assertion failures addressed in this wave now pass.
This is not a guarantee of defect absence or release/native certification.

- **5,295 unit/integration tests pass**,2 existing skips; current `qa:fast`
  passes compiler, zero-warning lint,4,459 unit checks and all guards.
- **Strict visuals:34/34 twice on Windows and34/34 twice on Ubuntu**, including
  all four readiness/pixel negative controls, zero retries/flaky/skipped cases.
  Individually reviewed30 Windows/28 Linux replacements; two Linux originals
  retained. Missing-emoji-font captures were rejected, prerequisites corrected,
  then inspected again. No masks/threshold/per-test timeout relaxation.
- **Remote-boundary journeys52/52**, zero skips/retries, on rebuilt current
  dummy-only output in an owned Windows-git worktree with hash-verified WIP
  overlay; unowned canonical `dist-sync/` was preserved. **Real two-export
  PWA9/9**, including explicit apply, bystander stability, offline boot and
  preserved local data; no two-build prerequisite skips remain.
- Current production-like hermetic revision **sha-15d364b4a1d6db79** has no
  Supabase hosts or simulation bridge. Current simulation **sha-ae428438f863ae85**
  is intentionally armed and credential-free.
- Actual seeded exploration (`0x20261115`): **23 unique scenarios/658 steps
  pass** across22 completed full-library reports plus a fresh exact-seed Smoke
  replay. The original1000s outer envelope expired; the residual runner's final
  Smoke browser failed before start with OS DLL-init0xC0000142. Original failure
  retained, not called a single-invocation green run. Fresh Smoke passes; no
  assertion was retried/weakened. `a33-seeded-complete-summary.json` accounts for
  every scenario exactly once.
- Current runtime advisory gate passes (zero high/critical).32 moderate/2 low
  findings remain report-only under policy, not waived or described as fixed.

### New repairs

**A31 — meaningful visual capture:** scroll normalization used to exclude the
named long-title task (viewport ratio0 RED). Normalize before reveal, require
full viewport/exactly1real-search result; protect four-line wrapping without
pinning unrelated rollover-neighbor order. Both platform per-image reviews and
preserved hashes are in the linked review documents and external evidence.

**A32 — scope-faithful test transport:** P6 compared serialized theme-key order
instead of exact decoded values, then the HTTP fake wrongly demanded current22
entities for a valid Scope7 cutover. Decode and require the exact theme object;
freeze2–9 transport entity sets, enforce exact scope/manifest agreement and
staged-chunk membership, truthfully seed current9.16 new transport regressions
first11RED/5controls; expanded HTTP/drift suite33PASS. Unknown, missing, extra,
future and mismatched groups still reject.

**A33 — legacy-restore forward progress:** even after the double was fixed, the
real client rejected a legitimate restored device's next upload. Import bound
provenance to raw unsigned future columns rather than the certified rows it
actually imported, and historical absent groups hashed differently from empty
restored groups. Bind certified bytes and canonical empty groups; retain the
pre-series21-table durable proof only for historical<=7 captures without a
recurrence-series group. Current epochs cannot be authorized by dropping their
new group. Real-SQLite6/7/9 unchanged/changed-remote/other-owner regression first
2RED/7controls; older-proof compatibility2RED/1guard. Expanded recovery/ownership
**94PASS**, original P6 all3steps and full52boundary cases pass after rebuild.
No schema/migration, observed-head adoption, owner bypass or conflict waiver.

Evidence: `a33-full-vitest-serial.log`, `a33-qa-fast-final.log`,
`a33-{windows,linux}-visual-complete{1,2}*`, `a33-full-sync*`,
`a33-pwa-two-build*`, `legacy-restore-*`, `generation-http-scope-*`, and
`a33-seeded-*` under the evidence root. One concurrent build/source-crawl5s
failure and outer batch-budget interruptions are retained; unchanged isolated
and serial gates pass. Native/independent/hosted/design/performance qualifications
below remain explicit.

## Baseline evidence

- TypeScript and ESLint passed in `baseline-qa-fast.log`.
- Unit suite: **4,381 passed / 3 failed**, 190 files. Three failures are CRLF-sensitive source-wiring assertions in `pomodoroContrast` / `workoutSessionContrast`, independently reproduced on this Windows checkout.
- Integration: **680 passed / 2 skipped**, 114 passing files / 1 skipped (`baseline-integration.log`). Existing skips are not passes.
- Production dependency gate: **zero high/critical; 27 moderate / 2 low**, report-only under current policy (`baseline-audit-runtime.log`). Historical high-advisory blocker claims are not current audit evidence.
- All-dependency audit: **2 critical / 2 high / 35 moderate / 2 low**, 41 package findings (`baseline-audit-all.json`). Critical/high development-tooling findings require investigation/remediation; a green production-only gate does not cover these.
- Ports 8081/8082 free at initial `web:hygiene`.
- Full Vitest and Playwright inventories saved in the evidence root; no stale documented test totals are used as gates.

## Verified findings and fixes

| ID  | Class / impact                          | Root cause and remediation                                                                                                                                                                                                                                                       | Evidence / current status                                                                                                                  |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 | TEST_BUG — Windows baseline falsely red | Three source-wiring assertions assumed LF although Git checks out CRLF. Normalize line endings only; retain every semantic assertion, label, dimension and contrast floor.                                                                                                       | Baseline 3 failures; focused green 155 contrast tests.                                                                                     |
| A02 | Security / resource exhaustion          | `readBoundedJson` buffered all bytes before checking the 32 KiB cap. Read/count chunks, reject and cancel on the first over-limit chunk, decode UTF-8 incrementally, release the reader lock.                                                                                    | New stream regression read all 100 chunks pre-fix versus exactly 3 after the 16-byte test cap; multibyte/exact-boundary coverage retained. |
| A03 | PWA correctness / cache ownership       | Activation deleted every other same-origin cache, including unrelated applications. Restrict deletion to obsolete `superhabits-shell-` caches.                                                                                                                                   | Red→green execution of the actual worker source in a VM with current/old/unrelated cache names.                                            |
| A04 | PWA offline reliability                 | Runtime writes were detached from the fetch event; worker termination could lose newly fetched assets, and cache-open failures were unhandled. Register `waitUntil` synchronously, retain the write promise, and handle cache-storage failures without losing network responses. | Deferred-write lifetime and cache read/open failure regressions red→green.                                                                 |
| A05 | PWA inefficiency                        | A failed network request was immediately repeated despite no cached fallback. Remove the duplicate fetch.                                                                                                                                                                        | Network-failure regression: two requests before, one after.                                                                                |

Foundation regression command: `npx vitest run --project unit tests/aiSecurity.test.ts tests/serviceWorkerCache.test.ts tests/pomodoroContrast.test.ts tests/workoutSessionContrast.test.ts`: **170/170 PASS** (`foundation-red.log`, `foundation-green.log`). This is focused evidence; browser and broad validation remain required. Active LSP probes returned no diagnostics but all six results were **inconclusive**, not confirmed-clean; compiler/lint gates remain authoritative fallbacks.

### Integrity and feature fixes

| ID        | Class / impact                                          | Root cause and remediation                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A06 (C01) | P1 — valid backups could not be restored                | Recovery inherited a 1,000-character fallback for valid 4,000-character weekly reflections and serialized review/priority snapshots. Set field-appropriate bounds; preserve data, no truncation. Daily reflections keep their 2,000-character bound, weekly reviews their 4,000-character bound; large snapshots remain bounded by the existing 100 MiB envelope (cloud requests retain their own byte budget). | Four actual source→export→prepare→confirm regressions failed before, passed after; existing portable equivalence suite also passed (11/11 combined). Also independently exposed escaped daily-title and 2,000-character daily-reflection recovery mismatches. |
| A07 (C02) | P1 — duplicate linked effects after a successful commit | Ordinary errors after the effect overwrote atomic terminal receipts with `failed`. Read the durable receipt in the catch path, preserve terminal status, report the actual applied/skipped effect and retain diagnostics rather than replaying it.                                                                                                                                                              | All three injected metadata/notice/post-effect errors produced authoritative habit count **2** before fix, **1** after replay with terminal receipt intact. Existing crash/multi-rule/replay battery: 30/30.                                                  |
| A08 (C03) | P1 — protected import ownership bypass                  | Settings-only imported datasets have no entity rows, so pristine checks alone let a temporary session claim them or own settings intents. Protect the recorded origin, fail closed on read failure, and resolve entity/settings intent ownership against durable state inside the committing transaction. Local writes remain usable/unowned; verified matching-owner recovery can adopt them.                  | Four regressions red→green for ordinary todo/settings writes, unreadable origin and a stale decision at the transaction boundary. Existing matching-owner recovery and first-activity ownership coverage also passed.                                         |
| A09       | Reliability / avoidable Auth latency                    | Even an established durable owner consulted Auth on every local write. Supabase `getSession` can wait for initialization/refresh. Use the known owner as the candidate without Auth; still recheck the actual durable binding inside the transaction.                                                                                                                                                           | Regression proves zero Auth calls and the correct durable outbox owner; failed before (one Auth call), passed after.                                                                                                                                          |
| A10 (C07) | P2 — saved plan shows the wrong task title              | Initial plan save normalized IDs only after snapshot input was selected; duplicate IDs produced misaligned/over-cap title arrays. Normalize once before both filtering and snapshotting, matching the update path.                                                                                                                                                                                              | Real SQLite create/update regressions assert exact IDs, title arrays and rendered title resolution; create failed before, both pass after.                                                                                                                    |
| A11 (C08) | P2 — false next-week success                            | Suggestion application counted missing/deleted tasks before the canonical writer pruned them. Resolve live candidate IDs in the same transaction, report failures, count only real additions and do not create empty plans/intents for all-invalid suggestions.                                                                                                                                                 | Missing/deleted-only and mixed/duplicate regressions red→green; existing invalid-date test now uses a real task AND verifies its persisted selection instead of asserting success for phantom `y1`. Planning battery 20/20.                                   |
| A12 (C06) | P2 — reconciliation permanently loses rewards           | The 25-row query limit selected already-paid rows before checking dedupe. Exclude canonical and legacy paid keys before limiting, using the existing indexed receipt key, with deterministic ordering; retain the 25-new-awards-per-pass bound and the authoritative transaction dedupe.                                                                                                                        | Six regressions failed before: action 26 starved for todos/habits/focus/workout, legacy todo keys and housekeeping. All now progress 25→1→0, preserve local-only outbox state and idempotence. Reward/cost/legacy/idless battery 44/44.                       |

### A13 (C04): workout prescription validation

The real SQLite writers accepted invalid target values (negative/nonfinite loads, distances and pace; noninteger or invalid rep/duration targets; reversed rep ranges), and invalid explicit set numbering/timing lacked proper validation. Validate at the data boundary, resolving partial rep updates against the stored sibling bound inside the transaction. Preserve valid decimal loads/distances/pace, zero optional targets and explicit null clearing.

- New regression suite: **44 failed / 1 passed before**, **45/45 passed after**. Assertions cover unchanged set rows, parent timestamps and outbox after rejected writes, plus recovery-row-validator compatibility of valid persisted values. This is not a newly executed complete export/import round trip.
- Focused new + existing workout mutation/integrity/portable integration: **67/67 PASS**; validation/workout unit: **46/46 PASS** (`workout-prescription-red.log`, `workout-prescription-green.log`, `workout-prescription-unit.log`).
- Pause checkpoint: typecheck and lint PASS (zero warnings), `qa:affected` and `git diff --check` PASS; `web:hygiene` PASS, ports 8081/8082 free. LSP probes: 3 inconclusive, no confirmed-clean claim.
- Broad suites, web build/browser, native, timezone and simulation checks **have not been rerun after A13**. Earlier browser/build evidence below covers the previous code checkpoint only.

### Broad validation at the second code checkpoint

- `npm run qa:fast`: **PASS**, TypeScript, ESLint (zero warnings), **4,391 unit tests / 191 files**, journey/quarantine/release/isolation guards (`wave2-qa-fast.log`).
- `npm run qa:integration`: **PASS 702 tests / 119 files**, **2 existing skips / 1 file** remain visible (`wave2-integration.log`).
- Initial post-ownership unit run exposed 31 order-sensitive/mock-export fixture failures. Explicitly stubbed the two new owner/origin reads in four feature-only fixtures, leaving every feature assertion unchanged. Real SQLite ownership regressions remain unstubbed. Original failures preserved in `wave1-qa-fast.log`; repaired full runs passed.
- Hermetic `npm run build:e2e`: **PASS**, no Supabase host or simulation mutation bridge included; generated revision `sha-2d3a95ccc8cb7518` (`wave2-build-e2e.log`).
- Focused Playwright infrastructure, real PWA update lifecycle, planning hub, weekly review and linked-action log: **24/24 PASS**, no retries (`wave2-focused-e2e.log`; failure-artifact destination `playwright-wave2/` in evidence root).
- Full browser/native/dependency/timezone/simulation and final independent review still remain; these results are not whole-product certification.

### Ordinary-mode continuation: transaction integrity and dependencies

| ID        | Finding and repair                                                                                                                                                                                                                                                                                                    | Executed evidence                                                                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A14 (C11) | Prefix parsing accepted malformed schema versions and the empty-device guard inspected only three entity tables. Require a complete nonnegative safe integer, an exact final head, and bounded existence checks across existing non-metadata tables. Historical migration blocks and schema version remain unchanged. | RED 8 failures/6 passes; GREEN 25/25 new + existing migration tests. Preserves malformed populated metadata/rows and empty-device recovery; `schema-version-{red,green}.log`.                                                                |
| A15 (C12) | Owner/provisional caches published tentative writes before commit and survived rollback. Publish synchronous cache updates after commit while retaining the writer FIFO; serialize base-handle owner readers and resolve mutation owners from current durable state.                                                  | RED 7 failures/1 pass; GREEN expanded cache/ownership/recovery/concurrency battery 45/45. Covers first-content adoption/promotion, clear/replace, pre-commit failure and concurrent readers; `owner-cache-{red,green}.log`.                  |
| A16       | A `no transaction is active` message alone caused a failed account bind/adoption to report success. Require durable proof that the owner, permanent state and requested outbox adoption actually landed before accepting a cosmetic driver error.                                                                     | Additional RED false-success regression; rollback rejection and genuine post-commit cosmetic-error acceptance now both pass (`owner-bind-cosmetic-red.log`, `owner-cache-green.log`).                                                        |
| A17 (C13) | Carry-forward used a pending-task snapshot captured before its transaction. Read selected IDs' completion/deletion state inside the committing transaction; query only the previous plan's at-most-three priorities, not the whole pending backlog.                                                                   | Completion and reopen races both RED before, GREEN after; combined planning integration 18/18. Rejected completed carry creates no plan/intent; `carry-forward-{red,green}.log`.                                                             |
| A18       | Development graph contained critical tinypool/Vitest and high Vite/brace-expansion advisories. Upgrade to maintained patched Vitest ^4.1.11 (lock resolves 4.1.12; removes tinypool), Node-22-compatible Vite 7.3.8 and patched brace-expansion v1 1.1.21. No blind audit fix or test-isolation downgrade.            | All-dependency audit now **0 critical / 0 high / 34 moderate / 2 low**; clean `npm ls --all`; all eight patches apply. Original lock/manifest preserved. `security-audit-all.json`, `security-patches.log`, `security-dependency-tree.json`. |

Pre-recurrence checkpoint literal `npm test`: **5,169 passed / 315 files**, **2 pre-existing skips / 1 file** (4,394 unit + 775 integration). Final `qa:fast` passes **4,394 unit tests**, all bundled guards and typecheck/lint with zero warnings. Five timezone lanes pass **124 tests each**; OpenSpec validates **91/91 items**. Three Vitest4 mock-type lint findings and four earlier incomplete fixtures were repaired without changing assertions; original failures remain in evidence. Additional exclusive/portable commit-path and simulation-root tests pass **15/15** and are included in the final test total. LSP probes remain inconclusive, not confirmed clean.

**A19 — QA evidence routing:** simulation output was hardcoded inside the checkout. Add optional `SIMULATION_OUTPUT_DIR`, preserve the default and resolve report pointers consistently. New path-only regressions went from two failures/one pass to **3/3 PASS**; no simulation oracle was weakened. The live P0 run stored all evidence outside the checkout.

The pre-recurrence hermetic build passes with revision `sha-fee4044ae9f5e0db`, zero Supabase hosts and no simulation bridge. Browser inventory is **707 across all projects** (not an executed pass count). Actual results:

- Standard chromium/journeys/PWA/visual invocation: **219 passed, 20 skipped, 407 not run**, then the 1,200-second campaign limit ended the suite and teardown with two global timeout errors. **INCOMPLETE**, not a full pass; no individual assertion failed and no retry occurred. Original report: `normal-wave4-e2e-report.json`.
- Focused critical Workout/Gym V2/editor, planning/review, linked log, infrastructure/PWA lifecycle: **51/51 PASS**, no retries (`normal-wave4-critical-e2e-report.json`).
- P0 journeys: **25/25 PASS**, no retries (`normal-wave4-p0-e2e-report.json`). These runs overlap; do not sum them as unique coverage.
- Deterministic P0 simulation: **one scenario / 24 steps PASS**, owned port 8092, external evidence under `simulation-normal-p0/`. This is not an all-scenario/seeded/soak pass.

Full browser, strict quarantined accessibility assertions, all-scenario/soak, native, sync-boundary and independent review qualifications remain unfinished.

## Accessibility repair and quarantine release (A25 / A26)

- **A25 / C09:** the unchanged current responsive assertion reproduced109 named undersized controls. Shared Pressable3D now gives the actual interactive face a44px web floor/full-face growth, Chips and segmented faces use real44px web minima, and inline search/reward/planning/calorie/reminder/workout controls honor the same floor. The week strip recovers its half-gutters so seven44px targets fit360px, with wrap fallback rather than clipping. Native compact dimensions remain unchanged. Boolean notification switches retain the exact native Switch path while web owns a44px semantic target around a compact track. First wave reduced offenders109→35; second wave reaches **zero**, and the entire responsive suite passes **7/7** (phone/wide, both themes, no overflow and reduced motion). `ui-wave2-responsive{.log,-report.json}`; hermetic build `sha-6e9cb664aa0c5073`.
- **A26 / C10:** actual strict browser tests reproduced all three remaining keyboard defects. Closed swipe actions now leave web tab/AT navigation until revealed; rail tabs bind Space; nested task checkboxes own Enter/Space without triggering the editor. Original strict3/3 RED→3/3 GREEN, and the full keyboard file passes with unchanged bodies. `ui-wave1-cg13*`, `ui-wave2-keyboard-settings*`. All runs use zero retries.
- Both obsolete CG-12/13 register entries were removed only after their complete release assertions passed; parity guard passes (26 gate files,28 remaining entries). No assertion threshold, control set or meaningful skip was weakened.
- New notification padding/key/reload tests pass in **both themes (2/2)**. The initial new test incorrectly clicked outside the rounded target at(2,2); agent-browser `elementFromPoint` inspection confirmed that point is outside the circular hit shape, while(22,2)/(22,6)/(2,22) are owned padding. Corrected to top-centre padding, added an explicit hit-ownership assertion, retained44px geometry and persistence checks. Initial two failures remain preserved as TEST_BUG in `ui-wave2-keyboard-settings*`; successful proof in `ui-wave2-settings-padding*`, inspection JSON/screenshot in `toggle-hit-shape*`. Exact owned inspection server/browser stopped;8081/8082/8091free.
- Post-UI full compiler/lint,5,228 tests and4,426 fast-unit checks passed; the subsequent C17 checkpoint below supersedes those totals. Native provenance and independent-review blockers remain.

## Follow-up identity and standalone-owner repairs (A27 / A28)

C16 and bespoke owner-resolution leads were independently tested after the UI checkpoint. A27 requires non-empty bounded series IDs at recovery and direct-spawn boundaries without imposing canonical ID syntax on legitimate historical text. A28 removes the duplicated standalone rule transaction/outbox owner implementation in favor of the existing shared helper; row writes, intents, dirty state and cache publication remain atomic. New permanent regressions cover real SQLite/outbox state, not only mocks.

Current literal `npm test`: **5,235 PASS /322 passing files**, two pre-existing skips/one file. Focused new/existing battery39/39 PASS; compiler PASS. Logs: `recurrence-identity-{red}.log`, `linked-rule-owner-red.log`, `integrity-wave2-{focused,typecheck,vitest}.log`. Their full fast gate and rebuilt42-test browser batch subsequently passed; the later C17 checkpoint below is current. Earlier current-UI batches against sha-6e9cb664aa0c5073: tasks/workout59/59; Calories/settings/planning37 PASS/one existing skip; P0 journeys25/25, no retries. These overlap earlier tests and must not be summed into unique whole-suite coverage.

## C17 causal recurring undo repair (A29 — locally qualified)

The timezone probe also exposed two causality/atomicity defects: undo could delete an unrelated rollover created in the same clock tick, and a spawn failure left the parent completed despite the caller's rejection. Permanent actual-writer regressions reproduced all **8/8 RED**.

- Appended local migration **27** with `todos.recurrence_spawned_by_id` and its lookup index; migrations1–26 unchanged. Completion-created children carry the exact source id, and single/bulk completion, canonical spawn and durable outbox commit together. Undo requires that parent identity and pristine provenance; unproven historical/rollover copies are retained, never guessed from time windows.
- Backup scope **9** certifies the new column. Scope8 columns/entity set are frozen, Scope7/8 captures/files retain their own bytes, and untagged22-entity manifests resolve to historical8 rather than inventing certification of new fields. Legacy cutover carries its verified source epoch. Cloud/portable restore preserve parent links without replaying effects.
- Added append-only remote `supabase/migrations/20261115100000_add_recurring_spawn_provenance.sql`: capability9, private validated content contract and exact-parent graph, historical metadata fences. Public provenance wrapper/owner RLS/private execution protections remain intact. **No hosted SQL applied.**
- Focused provenance/isolation/correction25/25 and compiler pass. Expanded migration/legacy compatibility/hostile schema mutations/two-cloud-recovery battery **93/93 PASS**. Genuine frozen-schema26 rollback, restart, conservative legacy undo and cloud recovery both travel directions are covered. Static SQL guard and disposable PostgreSQL17.5 **84 checks PASS** across six migrations, including550 historical validator negatives, exact new parent fields, frozen8 preservation and rejection of Scope9 metadata under8. Owned SQL server stopped.
- First broad post-change run preserved128 failures across22 files (old capability8 mocks, schema26 live pins and untagged-current inference assumptions); fixtures now model remote9/head27 while retaining historical coverage. Final full `npm test`: **5,254 PASS /324 files**, two existing skips/one file. Final `qa:fast`: compiler/lint zero warnings, **4,433 unit tests /194 files**, all bundled guards PASS. Five timezone lanes×124 and OpenSpec91/91 PASS. Evidence `recurrence-provenance-{final-vitest,qa-fast-first,final-focused,postgres-first,timezones,openspec}.log`.
- Fresh hermetic production-like build **sha-3d8184a2d1d3ac9c** has no Supabase hosts or simulation bridge. Current affected Chromium batch **52/52 PASS**, zero retries, covering full keyboard/responsive/task/linked-log/settings/infrastructure files. Original run51PASS/1 forced-click visibility failure is preserved; history swaps the draggable list for a measured SectionList. Removed forced click, awaited the expanded/visible control, retained exact row/outbox assertions; focused3/3 then52/52 passed. `recurrence-provenance-{build,browser,browser-fixed,todo-sync}*`. This is affected coverage, not the whole browser suite.

### Simulation qualification follow-up

The standalone simulation compiler initially rejected the seed helper's app-only `@/` import. A relative import of the same pure shared reconstruction resolves it; `sim:validate` checks all23 scenarios. The original smoke then correctly detected one unexpected Todo CREATE. Its first screenshot already showed an A-title recurring copy: adding canonical series to fixtures had unintentionally activated the SMALL fixture's deleted sample task. A minimized real-SQLite rollover reproduces this on initial and next day (**2 RED /8 controls PASS**).

This is **TEST_BUG**, not duplicate product writes. Explicit recurrence options keep SMALL's documented inert one-visible-task baseline; TYPICAL/HEAVY retain active recurring coverage. All10 fixture-contract tests pass, and original deterministic P0 smoke passes **one scenario /24 steps** with its exact outbox/count assertions unchanged. Evidence `simulation-small-fixture-{red,green}.log`, `simulation-provenance-p0-fixture-fixed.log`, report `simulation-provenance-p0-fixture-fixed/run_mwhk56i5_o8cjh8eh/run-report.json`; initial failures remain in `recurrence-provenance-simulation-p0{,-fixed}.log`. Standard ports8081/8082/8091/8092 are free. All-scenario/seeded/soak qualification remains open; LSP probes are inconclusive, not clean.

## Prior qualification checkpoints (2026-11-15, before final A33 qualification)

The counts and pending statements in this historical subsection apply to those
source phases only; the current qualification above supersedes them.

- Final current `npm test`: **5,260 PASS**, two pre-existing skips/one file; `qa:fast`: compiler, zero-warning lint, **4,433 unit tests**, all bundled guards terminal0 PASS. The12-case fixture suite includes the two new canonical-series/idempotency regressions.
- **A30 — compatible residual advisory patches:** `node-forge`1.4.2→1.4.3 and `postcss-selector-parser`6.1.4→6.1.6; scripts disabled during targeted install, all8 patches reapplied, clean `npm ls --all`. Manifest/lock before-images and minimal lock delta are preserved externally. Audit now **0 critical /0 high /32 moderate /2 low**; production gate PASS. No blind forced upgrade/downgrade. Remaining glob/minimatch fixes cross major APIs, uuid7 is used by xcode, and latest deepmerge4.3.1 has no published patch; these remain open rather than waived. Fresh web build has the identical hermetic **sha-3d8184a2d1d3ac9c** revision.
- Full deterministic simulation: **23/23 scenarios,658 steps, no skipped/failed steps**. Includes356-step long-history recovery and132-step soak; a second fresh132-step soak also passes integrity. Four-run self-test proves identical deterministic action logs and valid seeded(`0x5e1f7e57`)/repro reports. `simulation-deterministic-all-current/`, `simulation-soak-current-second/`, `simulation-self-test-current/` and their logs. Timing comparison shows stable UI/CRUD medians; reload medians1217→1333ms and1300→1416ms (~9%, only one sample/window) mean strict no-growth performance acceptance remains unconfirmed, not a leak/memory certification.
- **Complete current Chromium inventory:**483 unique cases/80files accounted for across bounded zero-retry runs: **435 latest PASS /48 registered skips /0 unresolved failures**. Exact-title latest-outcome accounting is in `current-browser-coverage.json`; overlapping attempts are not summed. The initial64-test integrity batch61PASS/3FAIL is retained: Scope7 export pin was stale (now asserts9,22entities and new columns); real host-day rotation legitimately granted15-XP Quick win, so reward tests now pin2026-10-19 while retaining exact original XP/event-count/outbox assertions. Actual diagnostic ledgers prove no duplicate Todo award. Corrected files11/11PASS. Other batches: write-boundaries54/1skip, command/shell71/7skips, feature remainder102/15skips and92/25skips; counts overlap the unique ledger.
- Standard journeys: **79 PASS /42 remote-boundary skips /1 stale J8 oracle failure** initially. The oracle counted live occurrence identities rather than canonical series, missing three HEAVY identities with deleted-only seeds. Canonical baseline correction retains every exact one-copy/outbox/tombstone check. All12 real-SQLite fixture regressions and full7-step J8 then PASS, including unchanged D14 and15%headroom assertions. Original report `browser-journeys-current-report.json`, focused `browser-j8-current-fixed-report.json`. Complete standard-project replay then passes **80/42 registered skips**, zero failures/retries (`browser-journeys-current-fixed*`). J8 measures cold598ms, worst switch292ms, diary search67ms and picker77ms, all original ceilings/headroom gates green.
- Windows visual: original31FAIL/3readiness PASS retained. All30 old Windows/Linux-reference/current Windows triples individually reviewed against canonical Playful Momentum; dispositions in `WINDOWS_VISUAL_BASELINE_REVIEW_2026-11-15.md`, originals/hashes in external `visual-review/`. A31 captured the wrong long-title scroll region (ratio0 RED); normalize→reveal→full viewport plus real-search/exactly1row now protects its four-line title rather than unrelated rollover order. Exactly30 reviewed Windows PNGs adopted; two fresh normal comparisons **34/34 PASS each**, zero retries/skips/flaky results, including all4 negative controls, no mask/threshold/readiness relaxation. Genuine Linux compatibility execution is underway; no Windows PNG is substituted for Linux.
- Genuine two-build PWA qualification now **9/9 PASS**, zero skips/retries,45.7s, in a new Windows-git worktree with a SHA-verified WIP overlay. Actual exports A/B have distinct app bytes/revisions sha-0dcb36d33d7bbe50 /sha-76724fd1f1ba326b. Explicit apply/local data/offline boot/bystander/no-spurious-banner assertions all retained; canonical outputs preserved. `qualification-{overlay-provenance.json,build-a.log,build-b.log,pwa-two-build*}`. This removes the three prior two-build prerequisite skips.
- Four checked ports8081/8082/8091/8092 are free. Native, hosted/sync-boundary and independent-review qualification remain separately unresolved; no whole-audit or release completion claimed.

## Candidate / disposition ledger

Read-only data and feature specialists inspected current source under repository task-routing instructions. Findings start as leads, not executed proof; the dispositions below identify which now have independent red→green evidence. Full reports: `specialist-pass1.task-1.md` and `specialist-pass1.task-2.md` in the evidence root.

| ID  | Candidate                                                                                                                        | Required reproduction / disposition                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| C01 | Valid 1,001–4,000 character weekly-review reflections / structured payloads rejected by 1,000-character backup validator default | FIXED A06 — independently reproduced and verified.                                                                  |
| C02 | Ordinary post-effect bookkeeping failure downgrades atomic linked-action `applied` receipt and permits duplicate habit increment | FIXED A07 — independently reproduced and verified.                                                                  |
| C03 | Settings-only protected portable import can be claimed by provisional unrelated session on first content write                   | FIXED A08 — independently reproduced and verified, including settings intents and stale/unreadable-origin checks.   |
| C04 | Workout prescription data writer accepts negative/nonfinite/invalid numeric values that restore rejects                          | FIXED A13 — real SQLite rejection/row+outbox invariance and valid decimal/zero/null recovery-row compatibility.     |
| C05 | Instance-only recurring task edits leak into subsequent copies                                                                   | FIXED A20/A29 — recurrence/recovery/SQL and affected browser/sync evidence pass; native remains separately blocked. |
| C06 | Reward reconciliation permanently skips action 26 onward of a kind                                                               | FIXED A12 — all four unbounded source kinds, legacy keys and housekeeping independently reproduced and verified.    |
| C07 | New daily-plan duplicate IDs misalign normalized IDs and title snapshots                                                         | FIXED A10 — independently reproduced and verified for create/update, dedupe and cap.                                |
| C08 | Weekly next-plan application reports additions for missing/deleted IDs pruned by its writer                                      | FIXED A11 — independently reproduced and verified for missing/deleted/mixed/duplicate IDs.                          |
| C09 | CG-12 web hit targets remain under decided 44px floor                                                                            | FIXED A25 — current full responsive suite7/7; zero sub-44 entries, original thresholds/helpers/surfaces retained.   |
| C10 | CG-13 hidden swipe actions / rail Space / nested todo keyboard control failures remain                                           | FIXED A26 — original3 RED, rebuilt strict3/3 GREEN; full keyboard suite passes, obsolete quarantine retired.        |

Additional parent findings and remaining review seams:

- C11: FIXED A14 — malformed populated versions fail closed, genuinely empty recovery and canonical upgrade remain supported; no historical migration edits.
- C12: FIXED A15/A16 at the shared transaction/account-cache boundary; bespoke standalone stale-decision coverage is now supplied by A28/C18.
- C13: FIXED A17 — independently reproduced both completion and reopening across the transaction boundary.
- C14: FIXED A23 — explicit scope metadata and legacy cutover require exact certified state.
- C15: FIXED A24 — settings projection honors the verified integrity epoch.
- C16: FIXED A27 — empty recovery identity and empty/oversized direct-spawn IDs now reject before rows/intents; historical bounded text remains valid. Permanent suite3 RED/2 controls PASS→5/5 GREEN.
- C17: FIXED A29 — exact completion-spawn parent identity and atomic completion/child/outbox. Permanent8 RED→8 GREEN; migration27, frozen Scope8/current9, two-cloud-recovery travel, PostgreSQL84, full5254, fast4433, timezone and current affected browser52 all pass. Native/hosted/independent qualification stays separate; original failures remain retained.
- C18: FIXED A28 — standalone linked-rule writes duplicated pre-transaction owner resolution. A matching-owner recovery can bind while the writer is queued, after which its newly written outbox intent incorrectly remains unowned. Route the wrapper through canonical `runBackupMutation` for durable transaction-time ownership and commit publication. Owner-boundary test was RED; protected-origin control already passed and stays green. New/existing owner/linked/recurrence battery39/39 PASS.

## Coverage ledger

A repository-wide audit is not proof of defect absence. Coverage records actual inspection and execution, not an unsupported claim of exhaustive correctness.

| Area                                                    | Executed evidence                                                                                             | Remaining work                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Git / ownership / workspace                             | Validated audit wave preserved; owner-authorized branch push/main merge; only owned worktree/temp removed     | Owner-controlled commit/release decisions                                        |
| Persistence / auth / backup / portable / linked actions | Owner/cache/import/receipt repairs; A33 recovery/ownership94 and current5295full gates; sync52/52             | Further adversarial/independent and hosted Auth/PostgREST qualification          |
| Feature data / domain / calendar / rewards              | Recurrence isolation/atomic undo, planning truth/reward progress, portable/twice-cloud recovery and SQL proof | Affected native and further adversarial feature review                           |
| UI / accessibility / native                             | Actual44px/keyboard repairs, both-platform34×2visuals; other registered gaps retained                         | Native clean-source/toolchain, broader exploration and P22 human acceptance      |
| Web / PWA                                               | Worker regressions, infrastructure/update/offline and current9/9genuine two-build PWA                         | Hosted/platform qualification beyond these local proofs                          |
| Edge functions                                          | Both entrypoints/security boundaries traced; bounded-stream regressions pass                                  | Endpoint/static and broader negative-boundary inspection                         |
| Dependencies / patches                                  | Zero critical/high, clean tree, eight patches apply, hermetic rebuild                                         | Residual32moderate/2low reachability/compatible fixes and platform certification |
| CI / scripts / simulation / architecture                | Full deterministic library plus current seeded23/658 across two batches; guards pass                          | Further subsystem review and strict comparable reload/resource qualification     |
| Documentation / specs / tests                           | Authority/history distinguished; current per-image reviews and validated task plan                            | Remaining behavior-linked spec/adversarial checks; no speculative bulk rewrites  |

## A20 / C05 — durable recurrence isolation

The recurrence contract requires instance-scoped edits to change only that row (`openspec/specs/todos-recurrence-management/spec.md`). Both original completion/rollover diagnostics reproduced the defect; both now pass (`recurrence-original-probes-green.log`). Their original red evidence remains preserved.

- Migration **26** adds canonical soft-deletable `todo_recurrence_series` and independent occurrence-date/edit-provenance columns. Series and occurrence writes share the atomic owner-bound outbox. Completion, bulk and rollover resolve canonical content inside their transaction; a stopped series cannot be resurrected by stale queued input. Instance edits do not pre-create a future row or rewrite completed history.
- **Scope 8** adds the 22nd owner-scoped entity. Scope-7 entities/columns are frozen, and old immutable generation content remains readable and publishable through the preservation path without inventing local series state. Portable and cloud restores apply series before occurrences.
- Legacy reconstruction deterministically prefers a live pending row, then newer updates. Original content already overwritten by old software cannot be recovered from absent bytes. Historical edit provenance is conservatively marked unknown/touched: undo retains an old follow-up rather than risk deleting a same-tick user edit. New Scope-8 pristine provenance survives restart and two successive cloud recoveries.
- Permanent recurrence/correction/scope/migration regressions pass **27/27**. True schema-25 fixtures prove version-bump rollback, history preservation, restart, and same-tick legacy edit safety. The combined cloud-generation/schema-guard/migration battery passes **64/64**; these runs overlap and are not summed as unique coverage.
- The new append-only remote SQL migration and disposable fixture are statically guarded. A newly owned **PostgreSQL 17.5** cluster executes the five-migration generation chain: **79 checks PASS**, including 550 historical validator counterexamples, actual current 22-entity capture bytes, complete review limits, historical Scope-7 preservation, RLS/ACL reset, private verifier restrictions, pinned provenance, and malformed-parent/date/provenance/checksum rejection. Evidence: `recurrence-postgres-first.log`; its retained cluster/report path is in that log. The server was stopped. This uses a local auth/role shim, not hosted Auth/PostgREST or production deployment.

The first broad Scope-8 run exposed 158 stale schema/scope/series fixtures and compatibility errors; all were preserved, classified and repaired. The subsequent full run passes **5,187 tests / 317 files**, with **2 pre-existing skips / 1 file** (`recurrence-full-tests-second.log`). Typecheck/lint and `qa:fast` then pass, including 4,400 unit tests. New legacy-provenance/cloud/security regressions were added afterward; a final broad rerun is pending. Earlier browser/build results do not validate this migration.

### A21 — confirmation integrity

A payload changed after preview was imported as restored. Confirmation now revalidates a detached JSON snapshot before any await/write. The real-SQLite regression is red→green and proves no task, series or outbox row is imported on rejection (`portable-confirm-integrity-red.log`).

### A22 — scope-certified import fields

Historical checksums did not cover newly added occurrence metadata, yet restore accepted that metadata as state. File/cloud imports now project to the resolved scope's certified columns after integrity checks. A frozen Scope-7 file cannot smuggle a future occurrence date or touched flag; current Scope-8 checksums certify both. Input documents are not mutated (`recurrence-scope-red.log`, `recurrence-projection-green.log`). The analogous legacy-cutover/parser/settings seams are covered by A23/A24 below.

## A23 / C14 — legacy-cutover and manifest-scope integrity

Five independent regressions reproduced explicit scopes accepting missing/extra/wrong entity sets, an unknown data group being silently dropped, and Scope-6 cutover promoting unsigned future exercise metadata into a new immutable recovery point. Require exact scope/entity-set agreement, reject unknown groups, and project verified legacy rows to their certified columns before graph validation and cutover. Full tests then pass **5,202 / 318 files**, with the two pre-existing skips unchanged (`legacy-scope-cutover-red.log`, `legacy-scope-full-tests.log`). A matching-protocol server advertising only Scope 7 is also explicitly refused before any write.

## A24 / C15 — settings integrity epochs

Historical settings V2/V3/V4 checksums excluded newer preferences, but file/cloud restore and legacy cutover still applied them. Reproduced **three unit and two real persistence/cutover failures**, including an unsigned workout goal/reminder being stored on the destination. A shared projection now reuses the exact canonical epoch allowlist, including nested notification fields, before settings are imported or promoted. Preserve preset display order while taking each preset's fields from the certified projection. Focused backup/portable/cloud coverage passes **91/91** (`settings-epoch-red.log`, `settings-epoch-persistence-red-confirmed.log`, `settings-epoch-green.log`). Additional order/unsupported-version and final broad gates are pending.

## Remaining risks

Independent review workflow `1ff9b65b-01e7-4491-bb58-8e55eb419fa1` failed for both reviewers with provider usage-limit errors. Neither returned review findings; that attempt is **not completed independent review coverage**. No replacement route has been launched; local audit work continues while this review gap stays explicit.

Native provenance at WIP qualification reports `sourceTreeClean: false` (`normal-native-provenance.json`). The user's later Git-publication request authorizes committing the source, but a clean commit alone is not a native build/device certification. Local iOS execution requires unavailable Windows Xcode tooling. Neither is a native pass. Development critical/high advisories are repaired; the latest targeted patches leave **32 moderate /2 low** advisories.

The new Scope-8 and Scope-9 backend migrations have **not** been applied to any hosted/production database. Deployment is owner-controlled; the capability handshake fails closed before remote writes until the matching schema is available. Local SQL qualification is not deployment certification.

The former remote-boundary/two-build blockers were safely resolved using an owned Windows-git qualification worktree with a hash-verified WIP overlay. Current52sync cases and9genuine two-build PWA cases pass, without replacing the unowned canonical output or claiming clean-source native certification. Both platform strict visual suites now pass twice. Earlier budget-limited campaigns remain historical incomplete evidence, not relabeled green.

All locally reproduced assertion failures in the implemented repairs now have green evidence; current5295/full,4459/fast, both-platform visuals,52sync,9PWA and seeded23-scenario coverage are recorded above. Native builds/device tests, independent review, hosted migration/Auth/PostgREST, human design acceptance and strict resource/reload-growth certification remain unverified. The pre-publication provenance is `a33-native-source-provenance.json`; publication must not be mistaken for a native pass. Overall subsystem/adversarial/dependency-risk review stays active. The user authorizes publishing `audit/repository-remediation-20261114` and integrating it into `main`; actual publication state follows Git/PR. No hosted deployment/provider/paid action or zero-defects guarantee is claimed. Hygiene and publication receipts are retained with the task evidence.
