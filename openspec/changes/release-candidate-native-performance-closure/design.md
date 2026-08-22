# Design — Release Candidate: Native/Performance/Production Closure

## Context

The repository just finished three consecutive hardening waves. The last two commits ("progress", "unfinished progress") were closure commits mixing QA evidence logs under `.agent/hardening-evidence/` with small real fixes (journey fixture IDs conforming to the backup-row contract, tab-rail scoping in journeys, SettingsScreen restore-error preservation). The tree itself is clean and main-only, but CI is red because plan-validation drifted, and several certification questions were left open rather than answered.

## Approach

### 1. State repair first

Fix the ExecPlan checkpoint drift (restore required labeled fields without changing meaning), re-run `agent:plan:validate:all`, and confirm OpenSpec validation passes before any other gate. This unblocks the CI `quality` job.

### 2. Fresh exact-HEAD baseline

Run the repository's own scripts (from `package.json`) in dependency order:

- Static: `typecheck`, `lint`, `qa:fast`, `format:check`
- Tests: `test:unit`, `test:integration`, `test` (both projects)
- QA: `qa:timezones`, `qa:impact:validate`, `validate:themes`, `supabase:schema:validate`, `openspec:validate`, `agent:plan:validate:all`
- Builds: `build:web`, `build:sync`
- Browser: `e2e` (chromium + journeys + simulation + pwa projects), `sim:run --mode deterministic` (all scenarios), `e2e:sync`

Every failure is classified with the repository taxonomy (PRODUCT_BUG / TEST_BUG / TEST_DRIFT / FLAKY_TEST / ENVIRONMENT / EXPECTED_KNOWN_GAP / SPEC_AMBIGUITY), preserved as evidence, and fixed at root cause. Committed logs under `.agent/hardening-evidence/` are treated as historical records, never as proof for this baseline.

### 3. HEAVY-device performance resolution

Prior observation: ~846 ms section switch vs 800 ms ceiling (D14 scenario), isolated rerun passed, classified FLAKY_TEST. Design:

- Locate the measurement harness (D14 / latency journey spec) and run it repeatedly (target N>=10 per configuration) under controlled conditions, collecting a distribution (min/p50/p90/max), not single samples.
- Vary suspected factors one at a time: dev instrumentation off/on (production bundle vs dev), CPU throttling settings, cold vs warm sections, GC pauses, OPFS/SQLite read cost, list/chart mounting cost, and whether the shell keeps multiple sections mounted simultaneously.
- Instrument locally (temporary, removed afterward) if needed to attribute time across render vs DB vs mount.
- Decision rule: if the ceiling is breached only under harness contention/dev-mode artifacts, document that with distributions and keep the assertion but add headroom or stabilize the measurement method (without weakening the meaningful assertion). If product-side cost is genuinely dominant, optimize the specific hot path (memoization, deferred mount, chart virtualization, query trimming) without changing observable behavior.
- Endstate: a performance gate whose pass/fail is stable across normal machine jitter, plus recorded distributions as evidence.

### 4. Native Android with the current build

- Prefer local toolchain first (`adb` present): build/install an E2E-capable APK from current source (`expo run:android` debug or EAS `e2e-test` profile when credentials exist), boot an emulator, then run `qa:native:android` smoke plus targeted persistence/lifecycle lanes as available.
- Every missing dependency is named exactly (missing emulator image, missing JDK/NDK, missing EAS credentials), producing honest `ENVIRONMENT` classifications instead of vague "environment issue" notes.
- iOS: Windows host ⇒ record precise ENVIRONMENT unless a valid macOS/iOS runtime is actually reachable. No fabrication.

### 5. Production remote convergence audit

- Compare `supabase/migrations/**` against the live ledger via available access (linked CLI if credentials exist; otherwise classify access-gated and verify from repository-side validator `supabase:schema:validate` + previously preserved snapshots).
- Inspect `parse-ai-command`: confirm source parity tests pass; attempt deployment only with explicit available credentials; otherwise record the exact missing credential/access.
- Run security/performance advisors only if tooling permits; else classify honestly.

### 6. Documentation truth sweep

Correct stale facts wherever source proves them outdated — minimum set already identified:

- Schema version: v21 actual; fix `.cursorrules` (v15→v21, next 22), `.cursor/rules/superhabits-rules.mdc` (v15→v21), `docs/PROJECT_STRUCTURE_MAP.md` (v15→v21), `AGENTS.md` (v20→v21).
- Stale sync-scope exceptions in rules.mdc (`pomodoro_sessions` etc. ARE synced now).
- Service-worker cache version claim in rules.mdc vs actual `public/sw.js`.
- Verify entity counts (`BACKUP_ENTITIES` = 17) against `core/backup/backup.types.ts` and align prose.

Historical ExecPlans stay untouched except where their structure breaks validation.

### 7. Repository hygiene

Audit lint warnings (≤25 budget), TODO/FIXME/HACK markers, temporary debug instrumentation (specifically any `restore-dbg` remnants in runtime source — committed evidence logs are history, runtime code must be clean), obsolete flags, stale fixtures, duplicated helpers. Determine policy before removing anything intentional.

### 8. Recovery invariant re-proof

After all changes: targeted Vitest suites (backup validators, restore coordinator, portable import/export, account coordinator, sync engine outbox durability) plus the relevant journeys (new-phone, recoverable-account-v1, portable-owner-recovery) prove: local restart persistence, durable outbox, owner binding, wrong-account protection, anonymous→protected transition, empty-device restore, malformed-backup rejection, legacy compatibility, portable export/import, no side-effect replay, and post-restore normal syncing.

### 9. Certification

Serialize commits (no parallel shared-tree mutation). Push once coherent; capture exact SHA; watch GitHub `quality` + `e2e` on that SHA via API; no bookkeeping commit after declaring green. Then open the follow-up product campaign as its own OpenSpec change and begin it.

## Parallel-agent policy

Shared infrastructure (`core/db/client.ts`, migrations, backup/portable contracts, Supabase schema, providers, navigation, OpenSpec state) is primary-agent-owned. Delegation only for disjoint read-only audits. Commits serialized.

## Risks

- Emulator/EAS unavailability → precise ENVIRONMENT records, not blockers to RC certification (web + local gates carry correctness).
- Live Supabase credentials absent → remote convergence verified from repo-side validator + prior snapshots, residual documented.
- Performance attribution may implicate architecture-level costs (multi-section mount) → prefer measured, behavior-preserving optimizations; document anything deferred as known gap rather than quick hack.
