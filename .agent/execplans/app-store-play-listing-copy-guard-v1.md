# ExecPlan: app-store-play-listing-copy-guard-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the recommended next local gap from the version-build checkpoint:
`docs/release/store-data-declarations.md` §3 ships Play short/full listing
drafts with stated limits (short ≤ 80 chars, full ≤ 4000 chars) but no test
guards the lengths (release-notes only guards Apple What's New ≤ 4000 /
Play notes ≤ 500). Add a focused guard test so future copy drift cannot
silently break Play submission limits. Docs + static guard-test change
only; no product code, no submission, no owner identity.

## Context

- Prior store plans COMPLETED uncommitted: privacy-artifacts,
  privacy-hosting, release-notes, age-rating-dsa, store-assets-checklist,
  icon-splash-audit, version-build-consistency (all visible as untracked +
  modified files on `main` at HEAD `e311634`).
- No ACTIVE App Store ExecPlans remain; this is the highest-value
  agent-executable store gap left.
- Target file: `docs/release/store-data-declarations.md` §3
  "Google Play — listing copy (drafts)":
  - Short: `> Offline-first habits, tasks, focus, workouts & meals. No account needed.`
    (measured 2026-09-19: 72 chars — within 80).
  - Full: three-paragraph `> ...` draft (measured 812 chars — within 4000).
  - Contact email stays `[OWNER ACTION]` outside the paste-ready blocks.
- Existing guard pattern: `tests/release-notes.test.ts` (extract
  ```text blocks, assert lengths + no placeholders + version pins);
  `tests/store-assets-checklist.test.ts` (read declaration/readiness files,
  assert cross-refs). New test follows the same read-only style.
  ```
- Constraints: no `[OWNER ACTION]` in paste-ready copy assertions must keep
  the contact-email placeholder outside the blocks; do not invent emails /
  URLs / owner identity; do not weaken tests; no commit/push/tag/submit.

## Scope

- Add `tests/play-listing-copy.test.ts`: parse §3 of
  `store-data-declarations.md`, extract the short + full paste-ready copy,
  assert short (1–80 chars) and full (1–4000 chars), assert paste-ready copy
  contains no `[OWNER ACTION]`, assert key content markers (offline-first,
  six surfaces, English, 1.0.0), assert the stated limit headers exist, and
  assert readiness item 2/3 still points at the declarations file.
- Validate: plan validate, prettier on the new test, focused vitest on the
  new test + prior store guards, `qa:affected` cheapest gate, hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No copy rewrites beyond what is needed to pass (drafts already pass; do
  not reword for style).
- No screenshot capture, trader filing, locale claims, or legal advice.
- No commit, push, tag (especially no v1.0.0 tag), or EAS submit.
- No invented contact email, URL, or owner identity.

## Current Checkpoint

- Current milestone: DONE — task complete. Guard test ships and all
  applicable gates are green; working tree left uncommitted.
- Completed: startup + gap re-check (OPEN); wrote
  `tests/play-listing-copy.test.ts` (5 tests); fixed two test-side parse
  issues (short/full split at the Full-description header; case-insensitive
  workout match) with no doc copy changes; ran store-guard battery (7
  files, 31 tests PASS), prettier PASS, plan validate PASS,
  `tests/agent-execplan.test.ts` 9/9 PASS, typecheck + lint PASS (via
  qa:fast prefix), hygiene PASS (8081/8082 free).
- In progress: none.
- Important modified files: `tests/play-listing-copy.test.ts` (new); this
  plan file (new). No product code, no doc copy, no version changes.
- Last successful validation: 2026-09-19 — store-guard battery 31/31 PASS
  + agent-execplan 9/9 PASS + hygiene PASS.
- Current failures: one pre-existing ENVIRONMENT fail in
  `tests/web-lifecycle.test.ts` (`terminateOwnedTree > cleans up after a
  failing probe`, line 160: child exitCode still null 500ms after
  terminate) — fails in isolation, untouched by this task, no assertion
  weakened; recorded as follow-up.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete (guard exists + passes; QA
  evidence recorded; no commit/push/tag per loop intent).

## Progress

- [x] Startup + gap re-check (OPEN: no §3 length guard).
- [x] Write `tests/play-listing-copy.test.ts` (5 tests, all passing).
- [x] Validate (plan validate, format, store-guard battery, qa:affected →
  qa:fast prefix + focused execplan test, hygiene).
- [x] Mark COMPLETED with evidence.

## Surprises & Discoveries

- The short quote block and the full draft's first paragraph have no empty
  `>` separator between them (a `**Full description...**` header sits
  between), so a naive quote-paragraph parse merges them into one 395-char
  paragraph. The test splits the section at the header instead — future
  editors must keep the short block before and the full draft after the
  `Full description` header, which the test enforces via the split
  assertion.

## Decision Log

- 2026-09-19 — Chose test-only guard over copy rewrite: drafts already
  within limits (72/812), so a drift-guard test is the minimal durable fix.
- 2026-09-19 — Chose §3-scoped blockquote parsing over whole-file
  blockquotes: keeps the contact-email `[OWNER ACTION]` line (outside the
  paste blocks) from false-failing the no-placeholder assertion.

## Validation Ledger

- 2026-09-19 — gap lengths measured via python3 — PASS (short 72 ≤ 80,
  full 812 ≤ 4000, evidence for guard thresholds).
- 2026-09-19 — `npx vitest run tests/play-listing-copy.test.ts` — PASS
  (5/5).
- 2026-09-19 — store-guard battery (play-listing-copy, release-notes,
  store-assets-checklist, version-build-consistency, age-rating-dsa,
  icon-splash-asset-audit, privacy-hosting) — PASS (31/31 across 7 files).
- 2026-09-19 — `npx prettier --check tests/play-listing-copy.test.ts` —
  PASS.
- 2026-09-19 — `npm run agent:plan:validate -- --plan <this plan>` —
  PASS (valid, ACTIVE at check time).
- 2026-09-19 — `npm run qa:affected` — resolved docs/test-only change to
  `agent-workflow-and-documentation` → `qa:fast` + focused
  `tests/agent-execplan.test.ts`, no broad regression.
- 2026-09-19 — `npm run qa:fast` — typecheck PASS, lint PASS,
  `test:unit` 1790/1791 with ONE pre-existing ENVIRONMENT fail
  (`tests/web-lifecycle.test.ts` failing-probe cleanup, line 160,
  exitCode null after 500ms grace; fails identically in isolation;
  untouched file; preserved, not weakened).
- 2026-09-19 — `npx vitest run tests/agent-execplan.test.ts` — PASS
  (9/9).
- 2026-09-19 — `npm run web:hygiene` — PASS (8081/8082 free).

## Changed Files / Areas

- `.agent/execplans/app-store-play-listing-copy-guard-v1.md` — this plan.
- `tests/play-listing-copy.test.ts` — new guard test (pending).

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this plan completely.
3. Run `git status --short` and `git diff --stat`; HEAD expected near
   `e311634` on `main` with prior store files uncommitted.
4. Continue from `Exact next action` above; do not commit/push/tag/submit.
5. Before closing: `npm run agent:plan:validate -- --plan .agent/execplans/app-store-play-listing-copy-guard-v1.md`.

## Outcomes & Retrospective

- Status: Complete.
- Summary: Play listing-copy length guard ships as
  `tests/play-listing-copy.test.ts` (5 tests: limit headers, short ≤ 80,
  full ≤ 4000, no placeholders in paste copy with owner contact box
  preserved, readiness cross-ref). Drafts pass as-is (short 72, full ~812
  incl. separators); no copy, product, or version changes. All applicable
  gates green; tree left uncommitted per loop intent.
- Follow-up: (1) the pre-existing `tests/web-lifecycle.test.ts`
  failing-probe cleanup ENVIRONMENT fail (line 160) remains open — timing
  fix only if safely doable, never by weakening the assertion; (2) with
  this gap closed, App Store agent-executable surface is nearly exhausted —
  remaining items are owner/device/credential-bound (screenshot capture,
  trader filing, policy hosting + URL paste, submit credentials, v1.0.0
  tag) — recommend pivoting to product/code-quality gaps next.
- Lessons: quote-block parsing must respect non-quote separator lines
  (headers) between paste blocks; splitting at the named header is more
  robust than assuming empty-quote separators.
