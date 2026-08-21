# Repro bundles — capture & replay

Bug-reproduction packages (`add-user-simulation-platform` task 5, design D5): a
portable, replayable snapshot of the **state + actions + environment** that
produced a bug. A bundle lets a developer restore the exact database + storage
into a fresh browser context, re-execute the recorded actions, and confirm
whether a newer/corrected build still fails — or whether the fix landed.

## Layout

A bundle is a **plain directory** (not a zip) so it can be inspected and edited
by hand. Captures land in `<simulation-output>/bundles/<runId>/` (gitignored —
see below).

```
<bundleDir>/
  bundle.json      # metadata: schema version, commit, scenario/persona refs,
                   #   seed, mode, lane, timezone, browser, timestamps, file index
  report.json      # the original run-report (run-report.json schema) — the
                   #   divergence baseline for replay
  db.sqlite.json   # SQLite row-level dump: { tables: { <table>: [row, ...] } }
  storage.json     # AsyncStorage dump: { "<superhabits.* key>": "<value>" }
  actions.jsonl    # one semantic step per line (the replayable action log)
  trace.zip        # Playwright trace from the run (best-effort)
  console.log      # captured console error/warn/log lines (best-effort)
  network.har      # HAR-lite network log (best-effort; empty when not captured)
  narrative.md     # template for the human story of the bug
```

### Why `db.sqlite.json`, not a binary `db.sqlite`

The web export stores the app database in the browser's OPFS (per-origin, not a
single file on disk), so a capture cannot copy a `*.sqlite` file. The DB harness
(`e2e/helpers/dbHarness.ts`) opens the _same_ database the app uses, so the
writer dumps every app table's rows and replay re-inserts them after the app has
bootstrapped the real schema. This is a deliberate, documented deviation from
the design's `db.sqlite` name.

## API (`simulation/repro/bundle.ts`)

| Export                                                                                     | Purpose                                                                            |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `captureBundle({ page, report, runId, steps, consoleLines?, networkEvents?, outputDir? })` | Capture a bundle from a live page + run report. Returns `{ bundleDir, metadata }`. |
| `getCurrentCommit()`                                                                       | Git HEAD short sha via `child_process`, `null` when unavailable.                   |
| `detectTimezone()` / `makeBundleId()`                                                      | Capture-time host timezone / stable bundle id.                                     |
| `serializeActionsJsonl` / `parseActionsJsonl`                                              | One semantic step per line ⟷ `SemanticStep[]`.                                     |
| `serializeSqliteDump` / `parseSqliteDump`                                                  | ⟷ `{ tables }` row dump.                                                           |
| `buildRestoreSql(dump)`                                                                    | `DELETE FROM` + `INSERT` per table in dependency-safe order.                       |
| `sqlLiteral(v)`                                                                            | SQLite literal escaping for restore SQL.                                           |
| `buildHar(events)`                                                                         | HAR-lite log from captured network events.                                         |
| `buildNarrativeTemplate(meta)`                                                             | The `narrative.md` template.                                                       |
| `validateBundleMetadata` / `parseBundleMetadata`                                           | `bundle.json` validation (pure, unit-tested).                                      |
| `dumpSqliteRows(page)` / `dumpStorage(page)`                                               | Browser-side dumps.                                                                |

## Capture wiring (task 5.2)

`simulation/runner/execute.ts` owns failure handling. The minimal hook added:
**`executeScenario({ ..., onFailure })`** — called _after_ a scenario failure is
recorded but _before_ context teardown, with the page/context still alive so the
bundle can dump the DB + storage. It also records console lines and (only when
`onFailure` is registered) network events. Capture failures are best-effort and
never mask the original scenario failure.

Two ways to capture:

```bash
# 1. Runner-driven, automatic on failure (task 5.2):
npm run sim:repro:capture -- --scenario <filter> [--mode m] [--seed s]

# 2. On demand from any committed scenario / manual session:
#    drive captureBundle() from your own Playwright script (see API above).
#    For a true manual session (no scenario), start a context, interact, then
#    call captureBundle({ page, report, runId, steps }) with a hand-written
#    step list — see the CLI's `--help` for the scenario path.
```

The bundle's `bundle.json` records the **commit** (via `git rev-parse`, with a
graceful `null` fallback when git is unavailable), scenario ref, seed, timezone,
browser, and timestamps.

## Replay (task 5.3)

```bash
npm run sim:repro:replay <bundle-dir> [--build <dir>] [--base-url <url>]
```

Restores db + storage into a fresh context (full reset → app load to bootstrap
the schema → row re-insert → storage restore), re-executes `actions.jsonl`
through the runner's own step machinery (`replaySteps` — identical action
dispatch + oracle evaluation), and prints a **step-level divergence report**:

- `same` — both runs passed the step;
- `reproduced-failure` — the original failure at step N reproduced at the same
  step kind on replay;
- `diverged` — the statuses differ (the fix path: correct the expectation in
  `actions.jsonl`, replay → the step now passes and is reported `diverged`).

`--build <dir>` is a **provenance hint** validated for existence and recorded in
the result; the build must already be served at the base URL (default
`http://localhost:8081`) — replay does not re-serve. Replay results persist under
`simulation-output/<replayId>/` (`run-report.json` + `replay-result.json`).

### Fidelity note

The bundle captures the DB state **at the failure point**, and replay re-executes
the full action log from that state. Failures at pure verification steps
(`expectOracle`, `expectAcrossSurfaces`) reproduce bit-for-bit. If the _failing_
step itself mutates the DB, re-running the log re-applies earlier mutations —
the divergence report surfaces this, and the reproducible pattern is to capture
a bundle whose failing step is verification-only (or trim `actions.jsonl` to the
steps leading to the assertion). For the common bug shape — "the UI state was X,
the assertion expected Y, and it should have been Z" — this is exact.

## Retention & gitignore (task 5.4)

- **Gitignore**: bundles and replay results live under `simulation-output/`
  (already ignored) with an explicit `/simulation-output/bundles/` entry;
  `simulation/.build/` is ignored too. Nothing in the repro layer is committed.
- **CI retention**: artifact uploads use **7-day retention**, matching the
  existing `e2e-report` convention (design D6). The actual CI wiring is task
  9.3 of the change; this README is the documented contract: bundles, run
  reports, traces, and failure digests uploaded from CI expire after **7 days**.
- **Local**: artifacts are unbounded but gitignored; bundles persist only as
  defect attachments outside the repo.

## ⚠️ Synthetic-data-only rule (mandatory)

**A repro bundle must only ever contain synthetic test data** — fixture rows
(SMALL / TYPICAL / HEAVY) and rows written by a scenario's own steps. Never
capture a bundle from a session that touched real user data, never attach a
bundle containing real user information to an issue, and never commit one. The
app is single-user with no real-user corpus today; keep it that way. If a
capture unexpectedly contains data that did not come from a fixture or the
scenario's own writes, treat it as a release-blocking finding and delete the
bundle.
