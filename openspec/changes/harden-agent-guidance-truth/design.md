## Context

See proposal.md for the motivation. The current `main` is `c1bc380`, worktree-clean except the gitignored local iOS extract. `tests/agentDocConsistency.test.ts` already exists and already derives the schema version, runtime dependency pins, the service-worker cache generation, and the backup entity count from source at test time — but it only writes its assertions against `.github/copilot-instructions.md`, `AGENTS.md`, the unified knowledge base, `docs/PROJECT_STRUCTURE_MAP.md`'s schema line, `CLAUDE.md`'s service-worker string, and `.cursor/commands/pre-pr.md`'s service-worker string. `README.md`, `.cursor/rules/superhabits-rules.mdc`, `ONBOARDING.md`, `docs/codex-workflow.md`, and `core/db/schema.sql` are outside its inventory, and no document is checked for the export command it prescribes before a Playwright lane. `docs/master-context.md` already self-marks as superseded and is out of scope for pinning.

## Goals / Non-Goals

**Goals:**

- Make the `build:web`-before-E2E instruction mechanically impossible to keep, in every document a session might read.
- Make the Ask/Auto rollout default, the local schema version, the bootstrap order, and the lint warning cap derive from source rather than from prose.
- Keep the doc-drift guard a single flat, self-describing file that a later contributor can extend by adding one document path.

**Non-Goals:**

- Rewriting the substantive content of the superseded knowledge base. It is demoted, not repaired.
- Pinning every sentence of every doc. Only values that are derivable from executing source and that a wrong reading can turn into an unsafe command or a false product claim.
- Touching `AGENTS.md`'s startup checklist structure, or the ExecPlan/spec docs this campaign owns.
- Any product, schema, or Supabase change.

## Decisions

### 1. One guard, extended — not a second guard file

Extend `tests/agentDocConsistency.test.ts`. It already owns the derivation helpers (`currentSchemaVersion()`, `read()`) and its header states the design intent: every expected value is derived at test time so docs track reality and the test cannot pin two stale copies of one number.

Alternative: a separate `agentGuidanceTruth.test.ts`. Rejected. Two guards that both claim "documentation must not contradict source truth" invites the same blind spot the original guard was written to close, and doubles the document inventory that has to be maintained.

### 2. A document inventory array, not ad-hoc reads

Define one `GUIDANCE_DOCS` array of repository-relative paths, and drive the cross-document assertions from it. The existing per-document `read()` calls stay for values that only one document states.

Alternative: assert each document in its own `it()` block with its own `read()`. Rejected. That is exactly the current shape, and it is why `README.md` and the Cursor rules drifted — adding a document requires remembering to add an assertion.

### 3. The export-command rule is a substring prohibition, scoped to agent guidance

The guard asserts that no file in `GUIDANCE_DOCS` contains `build:web` in proximity to an E2E or Playwright command. Proximity rather than a bare global ban, because `build:web` remains the correct command for producing a Vercel deploy (`README.md:171`, `CLAUDE.md:89`).

Alternative: ban the string `build:web` from all guidance. Rejected. That is false and would force the deploy instruction to lie. Alternative: rename the script. Rejected — a tracked-script rename is a wider blast radius than the drift it fixes, and `package.json:36` keeps the honest name.

### 4. Schema snapshot header is corrected, not deleted

Change `core/db/schema.sql:6` to declare version 25 and to say explicitly that the snapshot can lag the runtime. The guard derives the runtime maximum from `core/db/client.ts` and asserts equality.

Alternative: delete the version line. Rejected. The file is a hand-maintained reference whose header is the only place a reader learns it is a snapshot; removing the number removes the signal, not the drift.

### 5. The superseded knowledge base is demoted, but its existing pins are kept

`AGENTS.md` stops listing it under "Authoritative Docs" and gains a clearly historical reference. The five assertions `tests/agentDocConsistency.test.ts:44-56` already make against it stay in place, so its numbers cannot rot further while it remains on disk.

Alternative: delete the knowledge base. Rejected. It is tracked history and other docs cite it. Alternative: keep it authoritative. Rejected. Its own header declares it superseded and states its baselines are stale.

### 6. The register's status labels are corrected, and its assertions are not touched

`docs/testing/known-gaps.md` gap 15 keeps its heading and every recorded number, but its status label is corrected to match its own 2026-09-24 root-cause resolution note. The 800 ms ceiling, the 15% floor, and every recorded excursion value stay exactly as written. The new guard compares an entry's status label against the entry's own later notes and fails on a contradiction; it never rewrites a number.

Alternative: leave gap 15 labelled open because a floor miss was observed once after the fix. Rejected. The entry's own resolution note records the root cause as fixed and the assertion as holding; an "open" label on top of a recorded resolution is the drift this change exists to catch, and the recorded 884 ms excursion is preserved as evidence either way. Alternative: delete the historical notes. Rejected. They are the evidence base for the host-variance classification.

### 7. Doc edits are wording-only and reviewed as a set

Every correction is a prose substitution. No document's structure, heading order, or cross-reference graph changes. `docs/master-context.md` is left untouched because it already declares itself superseded and nothing currently treats it as current.

Alternative: rewrite `docs/PROJECT_STRUCTURE_MAP.md` and `CLAUDE.md` wholesale. Rejected. Unrelated churn in the two files an agent reads first is exactly the review cost this change is trying to reduce.

## Risks / Trade-offs

- [A guard assertion is phrased too tightly and a future legitimate doc edit trips it] → Assert the substantive value (version number, cap, command name), never a whole sentence, and keep each assertion's expected string derived from source.
- [`GUIDANCE_DOCS` is incomplete and a new guidance file drifts unnoticed] → The inventory itself is asserted non-empty and each listed path asserted to exist, and enabling a new doc is a one-line diff that the diff review can see.
- [Proximity-based export-command detection has false positives] → Scope the check to a line window around E2E/Playwright mentions and verify the four known-true sites (`README.md:171`, `CLAUDE.md:89`, plus the deploy phrasing) stay green.
- [Demoting the knowledge base breaks a citation elsewhere] → The demotion adds a historical pointer; no existing link is removed.
- [Doc corrections and the guard land in different commits, leaving a red window] → Single change, single commit; the guard is written in the same change as the corrections it protects.

## Migration Plan

No data or schema migration. Apply order: (1) correct the four `--max-warnings` claims and the superseded-authoritative listing; (2) correct the schema snapshot header; (3) correct the three bootstrap-order statements; (4) correct the export-command instruction in `CLAUDE.md`, `ONBOARDING.md`, and `docs/codex-workflow.md`; (5) correct `README.md`'s Ask/Auto paragraph and add the flag to the README/`CLAUDE.md`/`.env.example` env-var lists with valid `.env.example` values; (6) extend `tests/agentDocConsistency.test.ts` with the `GUIDANCE_DOCS` inventory and the new derivations; (7) run `npm run test:unit -- tests/agentDocConsistency.test.ts`, then `npm run qa:fast`. Rollback is a revert of the single commit: no product code depends on any of these files.

## Open Questions

None. Every value this change pins is derivable from source today, and the four documents outside the guard's inventory are known by path.
