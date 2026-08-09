## 1. Protocol and plan foundation

- [x] 1.1 Create `.agent/PLANS.md` with required ExecPlan sections, per-task
      locations, waypoint rules, and the Git/OpenSpec/QA authority boundaries.
- [x] 1.2 Maintain this change's `execplan.md` with a self-contained checkpoint,
      recovery instructions, decision log, and validation ledger.

## 2. Repository integration

- [x] 2.1 Add concise stable ExecPlan discovery, compaction-recovery, and
      fresh-session handoff rules to `AGENTS.md` without modifying unrelated
      autonomous-QA/native-E2E content.
- [x] 2.2 Confirm the existing `.agents/` structure and `.mcp.json` remain
      untouched, and document the decision not to add duplicate helper tooling or
      a repository skill in the change design/plan.

## 3. Dogfood and protocol review

- [x] 3.1 Simulate compaction recovery using only `AGENTS.md`, `.agent/PLANS.md`,
      this ExecPlan, Git state, and available validation evidence; record the
      recovered goal, checkpoint, changed files, last validation, and next action.
- [x] 3.2 Simulate a zero-context fresh-session handoff and verify the plan is
      discoverable from the repository root without the original task prompt.
- [x] 3.3 Verify two independent task plan paths can coexist without a global
      state-file collision, using temporary documentation-only plan fixtures or
      clearly documented path checks that do not alter unrelated user files.
- [x] 3.4 Verify an active plan can transition to completed status with final
      validation evidence and an Outcomes & Retrospective section.
- [x] 3.5 Repair any ambiguity discovered during dogfooding and update the
      current checkpoint before proceeding to final validation.

## 4. Validation and handoff

- [x] 4.1 Run `npm run qa:impact:validate` and `npm run qa:affected` for the
      task-owned changed files; record resolved gates and classifications.
- [x] 4.2 Run `npm run openspec:validate` and formatting checks appropriate to
      the changed Markdown/config files; record concise evidence.
- [x] 4.3 Inspect the final diff/status, confirm no unrelated files were
      overwritten or normalized, complete this ExecPlan's checkpoint and
      Outcomes & Retrospective, and mark the implementation tasks complete.
