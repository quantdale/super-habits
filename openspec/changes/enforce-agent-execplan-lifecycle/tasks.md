## 1. OpenSpec and plan contract

- [x] 1.1 Create and maintain a versioned implementation ExecPlan for this
      change with ACTIVE/BLOCKED/COMPLETED lifecycle evidence.
- [x] 1.2 Update `.agent/PLANS.md` with the versioned schema, lifecycle rules,
      checkpoint fields, loop, delegation, and recovery protocol.
- [x] 1.3 Add `.agent/EXECPLAN_TEMPLATE.md` as one concise initialization shape.

## 2. Read-only repository tooling

- [x] 2.1 Refactor `scripts/qa-impact.mjs` to export its existing map and impact
      logic without changing its CLI contract.
- [x] 2.2 Implement `scripts/agent-execplan.mjs` with validate, list, resume,
      JSON, root, and versioned all-plan modes.
- [x] 2.3 Add npm commands for plan validation, discovery, resume, and CI-safe
      versioned-plan validation.
- [x] 2.4 Add Git reconciliation warnings and shared QA impact output to resume.

## 3. Coverage and repository integration

- [x] 3.1 Add focused Vitest coverage for valid, missing, placeholder, wrapped,
      Windows/path-with-spaces, BLOCKED, and COMPLETED plans.
- [x] 3.2 Add fixture coverage for parallel discovery, stale/unaccounted Git
      paths, and date/time QA impact reuse.
- [x] 3.3 Add concise commands and compaction/fresh-session guidance to
      `AGENTS.md`.
- [x] 3.4 Add the narrow versioned-plan validation step to CI.

## 4. Dogfood and validation

- [x] 4.1 Repeatedly validate and resume this task's own ExecPlan while
      implementing milestones.
- [x] 4.2 Simulate zero-context, compaction, parallel-plan, BLOCKED, and
      COMPLETED recovery using only repository artifacts and commands.
- [x] 4.3 Run changed-file impact resolution, focused tests, typecheck, lint,
      unit/integration tests, OpenSpec validation, and diff checks.
- [x] 4.4 Complete this ExecPlan with final evidence, limitations, and a
      zero-context handoff verdict.
