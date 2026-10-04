## 1. Documentation corrections

- [x] 1.1 Replace the `build:web` export instruction in `CLAUDE.md:36,45` with `npm run build:e2e`, keeping the sentence that Playwright itself does not build the app
- [x] 1.2 Replace the `build:web` steps in `ONBOARDING.md:72` and `docs/codex-workflow.md:35,69,70` with `npm run build:e2e`
- [x] 1.3 Correct `core/db/schema.sql:6` to declare schema version 25 and state plainly that the snapshot can lag the runtime migration chain in `core/db/client.ts`
- [x] 1.4 Correct the bootstrap-order statement in `docs/PROJECT_STRUCTURE_MAP.md:62` so sync hydration precedes account-ownership reconciliation
- [x] 1.5 Correct the bootstrap-order statement in `README.md:81` so outbox hydration precedes ownership reconciliation
- [x] 1.6 Correct `CLAUDE.md:59` to the real provider order and to state that anonymous session creation is conditional on an empty or unbound dataset
- [x] 1.7 Correct the `--max-warnings` claim in `CLAUDE.md:26`, `.cursor/commands/pre-pr.md:262`, `.cursor/commands/audit-performance.md:128`, and `docs/master-context.md:383` to the pinned value `0` and remove any "warnings tolerated" phrasing
- [x] 1.8 Move `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md` out of `AGENTS.md` "Authoritative Docs" into a section that names it historical and superseded, leaving every existing link intact
- [x] 1.9 Correct the status label on gap 15 in `docs/testing/known-gaps.md:253` so it matches its own 2026-09-24 root-cause resolution note, keeping the ceiling, the 15% floor, and the recorded excursion numbers unchanged
- [x] 1.10 Confirm every other register entry's status label agrees with its most recent note, and correct any other contradiction found without changing an assertion or a threshold

## 2. AI rollout default truth

- [x] 2.1 Rewrite `README.md:148` so Ask/Auto are described as hidden by default and revealed only by `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT`, and delete the "currently `true`" claim and the 2026-08-05 enablement date
- [x] 2.2 Add `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` with its default-off effect to the Command Center env-var list in `README.md` and to the env-var list in `CLAUDE.md:85`
- [x] 2.3 Add `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` to `.env.example` and replace the two invalid placeholder values (`remote_with_fallback` for the parse mode, `default` for the backend host) with values `features/command/commandConfig.ts` actually accepts

## 3. Extend the guidance-truth guard

- [x] 3.1 Add a `GUIDANCE_DOCS` inventory array to `tests/agentDocConsistency.test.ts` covering `README.md`, `.cursor/rules/superhabits-rules.mdc`, `ONBOARDING.md`, `docs/codex-workflow.md`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and `core/db/schema.sql`, and assert every listed path exists
- [x] 3.2 Assert that no document in the inventory instructs `build:web` before an E2E or Playwright command, while leaving the deploy-prose sites that legitimately name `build:web` green
- [x] 3.3 Assert that `README.md` does not claim the Ask/Auto experiment is enabled, and that `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT` is named in the README and `.env.example`
- [x] 3.4 Derive the runtime schema version from `core/db/client.ts` and assert `core/db/schema.sql` declares the same number
- [x] 3.5 Assert the `--max-warnings` value stated in every inventory document that mentions it equals the value configured in `package.json`
- [x] 3.6 Assert no document listed in `AGENTS.md` "Authoritative Docs" declares itself superseded
- [x] 3.7 Add a check that fails when a `docs/testing/known-gaps.md` entry's status label contradicts a later resolution or closure note inside that same entry

## 4. Validate

- [x] 4.1 Run `npx vitest run tests/agentDocConsistency.test.ts` and confirm the extended guard passes with every corrected document
- [x] 4.2 Run `npm run qa:fast` on pinned Node `v22.23.2` and record the exact result
- [x] 4.3 Run `npm run format:check` on every changed file and record the exact result
- [x] 4.4 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 4.5 Review the full diff for accidental churn, and confirm no `app/`, `core/`, `features/`, `lib/`, or `supabase/` product file changed
