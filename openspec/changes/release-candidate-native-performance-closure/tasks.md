# Tasks — Release Candidate: Native/Performance/Production Closure

## 1. State repair and campaign setup

- [x] 1.1 Fetch/prune, reconcile Git (HEAD `6cc4172`, clean tree, main-only), inspect all ExecPlans.
- [x] 1.2 Reproduce CI failure locally (`agent:plan:validate:all` → FAIL on `harden-parallel-completion-wave-v2/execplan.md`).
- [x] 1.3 Repair the checkpoint drift by restoring required labeled fields; all plans PASS again.
- [x] 1.4 Create this OpenSpec change (proposal, design, spec, tasks, ExecPlan).

## 2. Fresh exact-HEAD baseline

- [x] 2.1 `npm run typecheck`, `npm run lint`, `npm run qa:fast` — record counts.
- [x] 2.2 `npm run test:unit`, `npm run test:integration`, full `npm test` — record exact totals.
- [x] 2.3 `npm run qa:timezones`, `npm run qa:impact:validate`, `npm run validate:themes`, `npm run supabase:schema:validate`, `npm run openspec:validate`.
- [x] 2.4 Classify and root-cause any failure from 2.1–2.3; fix; re-run.

## 3. Browser/simulation baseline

- [x] 3.1 Fresh `npm run build:web` and `npm run build:sync`.
- [x] 3.2 Full `npm run e2e` (chromium + journeys + simulation + pwa) — record pass/fail counts and artifacts.
- [x] 3.3 Deterministic simulation all scenarios (`qa:simulation -- --all --mode deterministic`) + `sim:validate`.
- [x] 3.4 `npm run e2e:sync` against fresh `dist-sync/`.
- [x] 3.5 Classify/fix failures; preserve evidence.

## 4. HEAVY performance resolution

- [x] 4.1 Locate the D14/latency harness and measurement method.
- [x] 4.2 Run N>=10 controlled repetitions per configuration; record min/p50/p90/max distributions.
- [x] 4.3 Isolate cause(s): harness contention, dev artifacts, GC, OPFS, render/mount architecture.
- [x] 4.4 Implement product-side optimization only if evidence justifies it (behavior-preserving).
- [x] 4.5 Stabilize the gate with justified headroom/method; document final classification replacing FLAKY_TEST.

## 5. Android native (current source)

- [x] 5.1 Inventory local toolchain (SDK/emulator/JDK/NDK/EAS auth); name gaps exactly.
- [x] 5.2 Build/install current-source E2E-capable APK when possible.
- [x] 5.3 Run smoke + persistence/lifecycle lanes available; capture artifacts for failures.
- [x] 5.4 Record iOS status precisely (Windows host ⇒ ENVIRONMENT unless runtime exists).

## 6. Production remote audit

- [x] 6.1 Compare repository `supabase/migrations/**` vs live ledger (linked CLI if credentials exist).
- [x] 6.2 Verify `parse-ai-command` parity tests; attempt deploy only with credentials; else record exact gap.
- [x] 6.3 Advisors if tooling permits; else honest ENVIRONMENT note.

## 7. Documentation truth sweep

- [x] 7.1 Correct schema-version claims in `.cursorrules`, `.cursor/rules/superhabits-rules.mdc`, `docs/PROJECT_STRUCTURE_MAP.md`, `AGENTS.md` (v21 actual; next >=22).
- [x] 7.2 Fix stale sync-scope exceptions wording; verify entity count vs `core/backup/backup.types.ts`.
- [x] 7.3 Verify service-worker cache version claim vs `public/sw.js`; correct other stale facts found.

## 8. Repository hygiene

- [x] 8.1 Audit lint warnings, TODO/FIXME/HACK markers, debug instrumentation (incl. any `restore-dbg` remnants in runtime source).
- [x] 8.2 Audit stale flags/fixtures/duplicated helpers/generated files; determine policy before removals.

## 9. Recovery invariant re-proof

- [x] 9.1 Targeted Vitest suites green after all changes (backup validators, restore coordinator, portable import/export, account coordinator, sync engine).
- [x] 9.2 Recovery-relevant journeys green (new-phone, recoverable-account-v1, portable-owner-recovery).

## 10. Certification and handoff

- [x] 10.1 Serialize coherent commits with meaningful messages; push.
- [x] 10.2 (quality PASS both SHAs; e2e classified FLAKY_TEST/ENVIRONMENT with local-equivalence proof; re-run admin-gated — see ExecPlan blockers) Verify GitHub `quality` + `e2e` on the exact pushed SHA via API.
- [x] 10.3 Reconcile ExecPlan; mark COMPLETED with evidence.
- [ ] 10.4 Post-RC gap audit → select next product campaign → separate OpenSpec change + ExecPlan → begin implementation.
