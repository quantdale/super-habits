# ExecPlan: Remote branch cleanup and main-only policy

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Consolidate the live GitHub repository so `origin/main` is the only remote
branch head, without silently discarding useful product work, security-relevant
history, or recovery material. The observable outcome is a clean GitHub branch
inventory containing only `main`, with local `main` synchronized to it and this
plan committed on `main`.

## Context

- Repository: `https://github.com/quantdale/super-habits.git`.
- The live fetch at task start was performed with `git fetch --all --prune`.
- Main worktree: `C:/Users/Michael Roy/Documents/super-habits-consolidation`.
- Task worktree: `C:/Users/Michael Roy/Documents/super-habits` on an existing
  local recovery branch; existing worktrees are intentionally not in scope for
  deletion.
- Starting local `main`: `d088b2a35499f5b11677dca8347950bcffa41113`.
- Starting `origin/main`: `d088b2a35499f5b11677dca8347950bcffa41113`.
- Starting remote heads: 32 non-main `backup/predator/*` refs plus `main`.
- No force push is permitted. Remote deletion is permitted only after the
  branch has an explicit evidence-backed classification and action.

## Scope

- Audit every head returned by `git ls-remote --heads origin`, excluding only
  `main` from deletion candidates.
- Record ancestry, merge-base, unique commits, patch/content comparison,
  historical purpose, security observations, classification, and action.
- Integrate any valuable missing product behavior into current `main` before
  deleting its source ref; preserve worthwhile archive/recovery material in a
  local-only ref when appropriate.
- Validate and push `main`, delete audited safe remote branches in controlled
  batches, prune tracking refs, verify GitHub directly, and finish this plan
  with a final inventory and clean worktree.

## Non-Goals

- Do not delete or rewrite `main`.
- Do not delete existing local branches or worktrees merely because their
  remote counterparts are removed.
- Do not revive obsolete architecture or bulk-merge historical snapshots.
- Do not create replacement remote archive branches.
- Do not replicate secrets from historical refs.

## Current Checkpoint

- Current milestone: Full branch audit, local recovery preservation,
  documentation/main validation, pre-deletion main push, and deletion batches 1
  and 2 are complete; 15 non-main remote heads remain.
- Completed: fetched/pruned; confirmed clean starting worktree; confirmed
  local `main == origin/main`; enumerated 32 non-main remote heads; computed a
  merge-base, ancestor result, unique-commit count, and three-dot diff summary
  for every candidate; inspected the unique product/recovery commits and
  current-main counterparts; scanned historical refs for secret-like paths and
  content.
- In progress: continue deleting the audited remote refs in controlled batches
  and verify GitHub after each batch.
- Important modified files: `.agent/execplans/remote-branch-cleanup.md` is
  committed on `main`; no product files changed.
- Last successful validation: `qa:affected` selected `qa:fast`; `qa:fast`
  passed typecheck/lint/unit (0 errors, 19 existing lint warnings, 672 unit
  tests); `npm test` passed 741 tests in 70 files; strict OpenSpec validation
  passed 21/21; QA impact validation and ExecPlan validation passed.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: commit this batch-2 checkpoint on `main`, push it, then
  delete batch 3: the eight locally archived reflog snapshots, with tip-SHA
  checks and post-batch live inventory.
- Remaining definition of done: all branches classified; any valuable work
  integrated and validated; local archive refs created when warranted; cleanup
  plan committed to `main`; `main == origin/main`; all non-main remote heads
  deleted; tracking refs pruned; GitHub verified to expose only `main`; final
  plan validation passes; working main is clean.

## Progress

- [x] Read repository startup and ExecPlan guidance.
- [x] Fetch/prune remote and capture starting Git state.
- [x] Capture exact remote head inventory.
- [x] Compute ancestry, merge-base, unique commit counts, and initial diff
      summaries for every non-main head.
- [x] Inspect unique commit contents and current-main equivalence/supersession.
- [x] Assign final classification and deletion/preservation/integration action
      for every non-main head.
- [ ] Integrate and validate any genuinely missing product work.
- [x] Preserve local-only recovery/archive refs where justified.
- [x] Commit the completed audit plan on `main`.
- [x] Validate the documentation-only main change.
- [x] Synchronize `origin/main` before deletion.
- [x] Delete and verify audited remote batch 1.
- [x] Delete and verify audited remote batch 2.
- [ ] Delete and verify the remaining audited remote batches.
- [ ] Prune tracking refs, verify GitHub and local final state, and validate this
      completed plan.

## Initial Remote Inventory

Every ref below was returned by `git ls-remote --heads origin` at start. All
32 non-main tips were non-ancestors of `origin/main`; this is an inventory, not
an indication that any branch is unsafe to delete.

| Remote branch                                                | Tip SHA                                    | Merge-base                                 | Ancestor of main? | Unique commits | Main commits after merge-base | Initial three-dot content summary |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ----------------- | -------------: | ----------------------------: | --------------------------------- |
| `backup/predator/chore/design-dna-polish-audit`              | `09cd0333e0ebd8fd1560d1ff2e7d38d2f7826317` | `ee91a3881255539bb1af6975beb8d20174d0a68e` | NO                |              1 |                           115 | 13 files, +363/-269               |
| `backup/predator/chore/extensive-codebase-maintenance`       | `0b10f29619ea062694348f99de03b32b413f5989` | `fb48a7dcc0c576f7ef901140992bf2291c6760ce` | NO                |              1 |                           120 | 18 files, +135/-263               |
| `backup/predator/codex/fix-linkedactions-testss`             | `96af1e153d5c06263ceda4d1690b33608af9d1a6` | `7a2557e29fc5185aa2ff23d6cc281ddbc41eec5f` | NO                |              1 |                           127 | 1 file, +17/-10                   |
| `backup/predator/codex/fix-sync-push-retries`                | `0808cb954509ad7147d3c1f0334ef022814e68d0` | `99c340202f1d2506fa4b25089e2e587ce9228540` | NO                |              1 |                           126 | 3 files, +50/-23                  |
| `backup/predator/feat/design-dna-primitives`                 | `44b7b073986f4a421b7f28f0cdcd5b52e9c21dcd` | `034fe82684b5fe72f1219c7d6681aa8d7993adec` | NO                |              1 |                           119 | 5 files, +186/-36                 |
| `backup/predator/feat/design-dna-secondary-screens`          | `75b345b55b5ae3b62222321b78335a328e1e6b5c` | `034fe82684b5fe72f1219c7d6681aa8d7993adec` | NO                |              1 |                           119 | 13 files, +327/-137               |
| `backup/predator/feat/linked-actions-policy-wip`             | `eb7d6d586a5c3e19ece882d807dc41b4a3e1dc4b` | `bcfba253ca4bc20f6a666ebca4812b27ed13c9e9` | NO                |              1 |                           112 | 9 files, +876/-221                |
| `backup/predator/feat/todo-linked-action-first-path`         | `65ec2663d48374dc14834c8aae231d25eb052e18` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO                |              1 |                           114 | 7 files, +538/-26                 |
| `backup/predator/fix/date-boundary-consistency`              | `d352d787e1393b5032df4989e0a2705033b9d7c6` | `69333fb59b604e16aa1685ce724204fde5541224` | NO                |              1 |                           122 | 10 files, +213/-26                |
| `backup/predator/fix/design-dna-post-merge-consolidation`    | `301b08e538818547b96dd7b058421277a3d73ffa` | `894395fd46c8c4fbbfdd50d00f0e5ab8fa8e5f07` | NO                |              1 |                           116 | 12 files, +163/-135               |
| `backup/predator/fix/linked-actions-contract-alignment-safe` | `c49c03b4d062ea3eefc0f7f43f6440f33480b5ba` | `c8dc037aafe0ddcdc074a7c8419342cfaadae077` | NO                |              1 |                           125 | 11 files, +814/-289               |
| `backup/predator/fix/linked-actions-rule-lifecycle`          | `c756ae64c09d81582113e5e687cc6bf64d4a4b5a` | `19ff31c565dc791e4dd0867fdd89f50367fd4400` | NO                |              1 |                           121 | 9 files, +200/-19                 |
| `backup/predator/fix/sync-fail-closed`                       | `6a8d10bc0b0013f79b2557233729571d436bb3e0` | `0b7a8818fa6ea4cb0119a051d3db74277b1b68fd` | NO                |              1 |                           123 | 2 files, +41/-13                  |
| `backup/predator/fix/web-delete-flows`                       | `21881467bac680f425334c3abdc83c141acdcf83` | `51279d1b9d22d5cd43129ec8e68af55004eee0b7` | NO                |              1 |                           124 | 6 files, +268/-163                |
| `backup/predator/reflog/codex-worktree-stash`                | `b8d251ce05134c0b4653ce4e09b0139d744e38ff` | `0f475dc31c8a72636b0afdd90db54d5e2690f10c` | NO                |              3 |                           190 | 14 files, +37/-40                 |
| `backup/predator/reflog/dark-mode-documentation`             | `a74517a6de45c63e21b1e1ea6e313d3bd35e5c15` | `68d48f83bb2fb7854e4ae7a8d7427d33b6c281d1` | NO                |              1 |                           163 | 57 files, +2036/-4818             |
| `backup/predator/reflog/e2e-selector-fix`                    | `e825fad529bdf6d6e918a40f14ab2f4f2816d80d` | `c9828541424218140e506ff2096d4b878fd550cb` | NO                |              2 |                           113 | 12 files, +684/-303               |
| `backup/predator/reflog/linked-actions-calorie-duplicate`    | `7036b62a0f5beefddfadae19f6472e0dd741997d` | `daa2aff527f75bdf6e92b14f7dc77378b84c936f` | NO                |              1 |                           129 | 4 files, +315                     |
| `backup/predator/reflog/linked-actions-habit-merge`          | `553e2c740ecedfee2b5c455d85777c759c09ca8d` | `4a4ce5a3230511f19946f1facd7db16c3e44551b` | NO                |              2 |                           136 | 5 files, +277/-9                  |
| `backup/predator/reflog/linked-actions-merge`                | `2c5c30dd9de6af592a5dd1ea46fea32ad4b19e1c` | `dcab83a179adf943536e208e67033cd0f6b0f6cf` | NO                |              2 |                           128 | 4 files, +308                     |
| `backup/predator/reflog/linked-actions-policy`               | `9d71458882726c51359c7219b8d26dac8f5bc554` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO                |              2 |                           114 | 9 files, +882/-168                |
| `backup/predator/reflog/linked-actions-tests`                | `d34f38bb9ee83fec4f99f0191b73a8ebfd7ef679` | `3e8a9eed112fd6b41b749aed0880f004a0440911` | NO                |              5 |                           106 | 18 files, +686/-62                |
| `backup/predator/reflog/linked-actions-todo`                 | `6613bb2869bcfa0b74c34d504d1a2c0687ebc91b` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO                |              1 |                           114 | 13 files, +859/-115               |
| `backup/predator/reflog/pomodoro-date-helpers`               | `ca14c679194a14ced109c9243148e96fc0897e20` | `db2acc92a4f7b550f3ec72093bf78446c981e27f` | NO                |              1 |                           201 | 5 files, +34/-101                 |
| `backup/predator/reflog/quick-command`                       | `b54dd9dab013569f94c93c0f65c7235e405c041e` | `589fc172617cf8ae1298159156a270589e324015` | NO                |              1 |                           104 | 21 files, +1967/-24               |
| `backup/predator/reflog/remote-backup-restore`               | `3655adc03eca94dd73f81a0dfc1546cf90c6f2c8` | `716f2687bef997648c0bdcac7648b571ec329a4e` | NO                |              1 |                           105 | 16 files, +2230/-38               |
| `backup/predator/reflog/todo-due-dates`                      | `8bbd8bd1101b332578ade4da33ac814d521c3014` | `7de3b52a6f5c8e467bd0f648402dd922b3f8a164` | NO                |              1 |                           101 | 14 files, +399/-46                |
| `backup/predator/reflog/wip-habits`                          | `1200532d9a3f15b3d73b8a43c6cda0ec9999a22f` | `dc3be2edfb86452955a47f04ab1888677f26fe12` | NO                |              2 |                           233 | 1 file, +4/-2                     |
| `backup/predator/reflog/wip-main-change-specs`               | `5f8a12e3af2e8ebae00924bbda7bd54621cc81f1` | `03389c960f733bb694bae3a0cb34876c06ce5df2` | NO                |              2 |                            69 | 86 files, +5968/-4223             |
| `backup/predator/reflog/wip-main-package-directory`          | `6742368f573843a417c06c3c9557de6830f914c7` | `289fbf8db2860a1a824a77f51128d46e94395840` | NO                |              2 |                            84 | 15 files, +105/-92                |
| `backup/predator/stash-pre-recovery-local-changes`           | `c35e281d740df1e367c1be0f38383237ca080239` | `68d48f83bb2fb7854e4ae7a8d7427d33b6c281d1` | NO                |              8 |                           163 | 68 files, +3905/-5347             |
| `backup/predator/worktree-c074-linked-actions`               | `37a4f2a0201e675a58fdcec78d69a36af661ab61` | `c8dc037aafe0ddcdc074a7c8419342cfaadae077` | NO                |              1 |                           125 | 14 files, +120/-242               |

## Final Branch Audit

Every branch below was inspected. The final entry for every branch uses one of
the permitted classifications:
`MERGED`, `CONTENT_EQUIVALENT`, `SUPERSEDED`, `OBSOLETE_WIP`,
`RECOVERY_ONLY`, `UNIQUE_PRODUCT_WORK`, `UNIQUE_BUT_NONPRODUCT_ARCHIVE`,
`SECURITY_SENSITIVE`, or `AMBIGUOUS`.

| Branch                                                       | Tip SHA                                    | Merge-base                                 | Ancestor? | Unique commits                                                           | Classification     | Evidence / reason                                                                                                                                                                      | Action                                     |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------ | --------- | ------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `backup/predator/chore/design-dna-polish-audit`              | `09cd0333e0ebd8fd1560d1ff2e7d38d2f7826317` | `ee91a3881255539bb1af6975beb8d20174d0a68e` | NO        | `09cd033`                                                                | CONTENT_EQUIVALENT | `git cherry` maps the design patch to main `85faf8b`; current design files contain the same behavior.                                                                                  | Delete remote.                             |
| `backup/predator/chore/extensive-codebase-maintenance`       | `0b10f29619ea062694348f99de03b32b413f5989` | `fb48a7dcc0c576f7ef901140992bf2291c6760ce` | NO        | `0b10f29`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `034fe82`; docs/editor maintenance is already in main.                                                                                                        | Delete remote.                             |
| `backup/predator/codex/fix-linkedactions-testss`             | `96af1e153d5c06263ceda4d1690b33608af9d1a6` | `7a2557e29fc5185aa2ff23d6cc281ddbc41eec5f` | NO        | `96af1e1`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `99c3402`; current linked-actions data tests supersede the snapshot.                                                                                          | Delete remote.                             |
| `backup/predator/codex/fix-sync-push-retries`                | `0808cb954509ad7147d3c1f0334ef022814e68d0` | `99c340202f1d2506fa4b25089e2e587ce9228540` | NO        | `0808cb9`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `c8dc037`; sync retry preservation is present and later hardened.                                                                                             | Delete remote.                             |
| `backup/predator/feat/design-dna-primitives`                 | `44b7b073986f4a421b7f28f0cdcd5b52e9c21dcd` | `034fe82684b5fe72f1219c7d6681aa8d7993adec` | NO        | `44b7b07`                                                                | SUPERSEDED         | Overview primitives/empty state are present in current `core/ui` and overview through main `90f79cb`, `85faf8b`, and later refinements.                                                | Delete remote.                             |
| `backup/predator/feat/design-dna-secondary-screens`          | `75b345b55b5ae3b62222321b78335a328e1e6b5c` | `034fe82684b5fe72f1219c7d6681aa8d7993adec` | NO        | `75b345b`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `894395f`; secondary-screen DNA is already represented.                                                                                                       | Delete remote.                             |
| `backup/predator/feat/linked-actions-policy-wip`             | `eb7d6d586a5c3e19ece882d807dc41b4a3e1dc4b` | `bcfba253ca4bc20f6a666ebca4812b27ed13c9e9` | NO        | `eb7d6d5`                                                                | SUPERSEDED         | Policy groundwork is in main `352d8f7`, `80d18fe`, and the typed policy split; main intentionally defers workout/pomodoro source dispatch.                                             | Delete remote.                             |
| `backup/predator/feat/todo-linked-action-first-path`         | `65ec2663d48374dc14834c8aae231d25eb052e18` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO        | `65ec266`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `c982854`; current todo linked-action flow is later and more complete.                                                                                        | Delete remote.                             |
| `backup/predator/fix/date-boundary-consistency`              | `d352d787e1393b5032df4989e0a2705033b9d7c6` | `69333fb59b604e16aa1685ce724204fde5541224` | NO        | `d352d78`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `19ff31c`; local-date behavior remains covered by current tests.                                                                                              | Delete remote.                             |
| `backup/predator/fix/design-dna-post-merge-consolidation`    | `301b08e538818547b96dd7b058421277a3d73ffa` | `894395fd46c8c4fbbfdd50d00f0e5ab8fa8e5f07` | NO        | `301b08e`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `ee91a38`; selector/layout fixes are present in current tests and UI.                                                                                         | Delete remote.                             |
| `backup/predator/fix/linked-actions-contract-alignment-safe` | `c49c03b4d062ea3eefc0f7f43f6440f33480b5ba` | `c8dc037aafe0ddcdc074a7c8419342cfaadae077` | NO        | `c49c03b`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `51279d1`; unsupported legacy rules are handled by current typed rows/guards.                                                                                 | Delete remote.                             |
| `backup/predator/fix/linked-actions-rule-lifecycle`          | `c756ae64c09d81582113e5e687cc6bf64d4a4b5a` | `19ff31c565dc791e4dd0867fdd89f50367fd4400` | NO        | `c756ae6`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `fb48a7d`; lifecycle/data cleanup is already merged and evolved.                                                                                              | Delete remote.                             |
| `backup/predator/fix/sync-fail-closed`                       | `6a8d10bc0b0013f79b2557233729571d436bb3e0` | `0b7a8818fa6ea4cb0119a051d3db74277b1b68fd` | NO        | `6a8d10b`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `69333fb`; current adapter preserves failed queue records.                                                                                                    | Delete remote.                             |
| `backup/predator/fix/web-delete-flows`                       | `21881467bac680f425334c3abdc83c141acdcf83` | `51279d1b9d22d5cd43129ec8e68af55004eee0b7` | NO        | `2188146`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `0b7a881`; current web delete confirmations and E2E coverage are present.                                                                                     | Delete remote.                             |
| `backup/predator/reflog/codex-worktree-stash`                | `b8d251ce05134c0b4653ce4e09b0139d744e38ff` | `0f475dc31c8a72636b0afdd90db54d5e2690f10c` | NO        | `b72ca76, 2d63bda, b8d251c`                                              | RECOVERY_ONLY      | Stash/index snapshot with old calories/sync tests and agent-doc edits; current main has later tests/docs, but the snapshot is useful for recovery.                                     | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/dark-mode-documentation`             | `a74517a6de45c63e21b1e1ea6e313d3bd35e5c15` | `68d48f83bb2fb7854e4ae7a8d7427d33b6c281d1` | NO        | `a74517a`                                                                | SECURITY_SENSITIVE | Old theme implementation is superseded by current `core/theme`; ref also contains `.vercel/project.json` with deployment IDs. No secret value was found, but metadata is not retained. | Do not archive; delete remote.             |
| `backup/predator/reflog/e2e-selector-fix`                    | `e825fad529bdf6d6e918a40f14ab2f4f2816d80d` | `c9828541424218140e506ff2096d4b878fd550cb` | NO        | `5bd6265, e825fad`                                                       | SUPERSEDED         | Todo self-target/editor and selector work is in current engine/editor/tests through main `c982854`, `996046d`, and later hardening.                                                    | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-calorie-duplicate`    | `7036b62a0f5beefddfadae19f6472e0dd741997d` | `daa2aff527f75bdf6e92b14f7dc77378b84c936f` | NO        | `7036b62`                                                                | SUPERSEDED         | Habit-day calorie dedupe is in main `7a2557e` and the current engine adds stable-source dedupe.                                                                                        | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-habit-merge`          | `553e2c740ecedfee2b5c455d85777c759c09ca8d` | `4a4ce5a3230511f19946f1facd7db16c3e44551b` | NO        | `0db0148, 553e2c7`                                                       | SUPERSEDED         | Habit completion dispatch is in main `43a9e41`, `dcab83a`, and current typed engine/data tests; the merge snapshot is obsolete.                                                        | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-merge`                | `2c5c30dd9de6af592a5dd1ea46fea32ad4b19e1c` | `dcab83a179adf943536e208e67033cd0f6b0f6cf` | NO        | `7036b62, 2c5c30d`                                                       | SUPERSEDED         | Duplicate calorie-log merge snapshot; current engine/data history contains the intended dedupe and later safeguards.                                                                   | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-policy`               | `9d71458882726c51359c7219b8d26dac8f5bc554` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO        | `e7c9b6a, 9d71458`                                                       | SUPERSEDED         | Same policy WIP as `eb7d6d5` plus a test; current policy/path truth and authoring contract are later and stricter.                                                                     | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-tests`                | `d34f38bb9ee83fec4f99f0191b73a8ebfd7ef679` | `3e8a9eed112fd6b41b749aed0880f004a0440911` | NO        | `259fbe8, ebaf184, 036b5b3, 3608cf7, d34f38b`                            | SUPERSEDED         | UI rhythm, todo-to-habit behavior, handler tests, authoring tests, and selectors all have current-main successors.                                                                     | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/linked-actions-todo`                 | `6613bb2869bcfa0b74c34d504d1a2c0687ebc91b` | `85faf8bbf50324d97af9af77d38adc5320a4491a` | NO        | `6613bb2`                                                                | SUPERSEDED         | Earlier todo linked-action implementation is replaced by main `c982854`, policy/path guards, self-target handling, and current data tests.                                             | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/pomodoro-date-helpers`               | `ca14c679194a14ced109c9243148e96fc0897e20` | `db2acc92a4f7b550f3ec72093bf78446c981e27f` | NO        | `ca14c67`                                                                | SUPERSEDED         | Date helpers and the zero-session Pomodoro guard are present in current `lib/time`, domains, and tests; the old refactor is not needed.                                                | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/quick-command`                       | `b54dd9dab013569f94c93c0f65c7235e405c041e` | `589fc172617cf8ae1298159156a270589e324015` | NO        | `b54dd9d`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `c9aa0ff`; current command center is the later overlay architecture.                                                                                          | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/remote-backup-restore`               | `3655adc03eca94dd73f81a0dfc1546cf90c6f2c8` | `716f2687bef997648c0bdcac7648b571ec329a4e` | NO        | `3655adc`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `589fc17`; current restore v1 coordinator/prompt/tests are present.                                                                                           | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/todo-due-dates`                      | `8bbd8bd1101b332578ade4da33ac814d521c3014` | `7de3b52a6f5c8e467bd0f648402dd922b3f8a164` | NO        | `8bbd8bd`                                                                | CONTENT_EQUIVALENT | Patch-equivalent to main `af676ac`; current todo due-date data/domain/UI behavior remains present.                                                                                     | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/wip-habits`                          | `1200532d9a3f15b3d73b8a43c6cda0ec9999a22f` | `dc3be2edfb86452955a47f04ab1888677f26fe12` | NO        | `9bd0abf, 1200532`                                                       | OBSOLETE_WIP       | Only unique WIP changes an obsolete `app/(tabs)` layout; current app is single-page and no product behavior is absent.                                                                 | Delete remote; no archive.                 |
| `backup/predator/reflog/wip-main-change-specs`               | `5f8a12e3af2e8ebae00924bbda7bd54621cc81f1` | `03389c960f733bb694bae3a0cb34876c06ce5df2` | NO        | `b0479e1, 5f8a12e`                                                       | RECOVERY_ONLY      | Large main WIP snapshot; its splits/tooling are in current main via `ee2af96`/`7f6d4bf`, but the historical state is retained locally for recovery.                                    | Preserve local archive ref; delete remote. |
| `backup/predator/reflog/wip-main-package-directory`          | `6742368f573843a417c06c3c9557de6830f914c7` | `289fbf8db2860a1a824a77f51128d46e94395840` | NO        | `1412a41, 6742368`                                                       | OBSOLETE_WIP       | Old package-directory/route WIP; index is equivalent to main history and remaining edits target removed architecture.                                                                  | Delete remote; no archive.                 |
| `backup/predator/stash-pre-recovery-local-changes`           | `c35e281d740df1e367c1be0f38383237ca080239` | `68d48f83bb2fb7854e4ae7a8d7427d33b6c281d1` | NO        | `b7e7ffb, 2b419cf, fb932d7, daf9a35, f242787, b187abd, 3aad40b, c35e281` | SECURITY_SENSITIVE | Pre-recovery stash contains old superseded UI/theme/demo WIP and `.vercel/project.json`; no secret value found, but deployment metadata is not copied.                                 | Do not archive; delete remote.             |
| `backup/predator/worktree-c074-linked-actions`               | `37a4f2a0201e675a58fdcec78d69a36af661ab61` | `c8dc037aafe0ddcdc074a7c8419342cfaadae077` | NO        | `37a4f2a`                                                                | RECOVERY_ONLY      | Explicit c074 worktree-preservation snapshot that removes an old unsupported Pomodoro path; current main has newer typed legacy-rule handling.                                         | Preserve local archive ref; delete remote. |

## Surprises & Discoveries

- Every non-main tip is a historical non-ancestor, but the branch-only patches
  fall into exact patch-equivalent or semantically superseded work; no missing
  product behavior has been identified that should be integrated into current
  `main`.
- The design-DNA audit commit `09cd033` is patch-equivalent to current-main
  commit `85faf8b`; the same relationship holds for the maintenance, sync,
  linked-actions lifecycle/contract, date-boundary, web-delete, quick-command,
  remote-restore, and todo-due-date branch commits documented in the audit.
- The old linked-actions policy WIP is materially represented by the current
  `core/linked-actions/linkedActions.policy.ts` and later typed/policy split.
  Current `main` intentionally defers workout/pomodoro source dispatch, so the
  historical attempt to enable those paths is not an unmerged requirement.
- Current `main` contains the old date-helper/Pomodoro zero-session behavior,
  linked-action calorie dedupe, todo self-target handling, restore flow,
  split feature modules, and current theme system through later commits and
  tests. These are superseded implementations, not missing work.
- The historical security scan found no private keys, access tokens, service
  credentials, database passwords, or real environment values. Two refs carry
  `.vercel/project.json` with non-secret Vercel project/team IDs; those refs
  will not be locally archived or copied.
- Stash/reflog/worktree refs contain recoverable snapshots and partial WIP;
  reviewed recovery refs will be retained under local-only `refs/archive/*`
  before remote deletion. No archive ref is pushed.
- Integration commits, if any, will be recorded here with the behavior they
  recover, validation evidence, and the source branch deleted only afterward.

## Decision Log

- 2026-08-13 — Use the existing main worktree for the authoritative plan and
  any main commit; leave the task worktree and all pre-existing local
  worktrees/branches untouched.
- 2026-08-13 — Treat every non-ancestor branch as requiring content review;
  ancestry alone is insufficient because the refs point into older history.
- 2026-08-13 — Do not create remote archive replacements; use local-only refs
  only when historical material is worth retaining after deletion.
- 2026-08-13 — Do not integrate any historical branch: current `main` already
  contains the intended product behavior or has an explicit later superseding
  design, and no unique product work absent from `main` was found.
- 2026-08-13 — Preserve reviewed recovery/stash/worktree tips locally under
  `refs/archive/remote-branch-cleanup/...`; exclude refs carrying `.vercel`
  deployment metadata from local preservation.

## Local Archive Preservation

- Existing local branches and worktrees remain untouched. The following
  local-only refs were created before remote deletion; none is under
  `refs/remotes/origin` and none will be pushed:

  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/codex-worktree-stash` → `b8d251ce05134c0b4653ce4e09b0139d744e38ff`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/e2e-selector-fix` → `e825fad529bdf6d6e918a40f14ab2f4f2816d80d`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-calorie-duplicate` → `7036b62a0f5beefddfadae19f6472e0dd741997d`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-habit-merge` → `553e2c740ecedfee2b5c455d85777c759c09ca8d`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-merge` → `2c5c30dd9de6af592a5dd1ea46fea32ad4b19e1c`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-policy` → `9d71458882726c51359c7219b8d26dac8f5bc554`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-tests` → `d34f38bb9ee83fec4f99f0191b73a8ebfd7ef679`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/linked-actions-todo` → `6613bb2869bcfa0b74c34d504d1a2c0687ebc91b`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/pomodoro-date-helpers` → `ca14c679194a14ced109c9243148e96fc0897e20`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/quick-command` → `b54dd9dab013569f94c93c0f65c7235e405c041e`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/remote-backup-restore` → `3655adc03eca94dd73f81a0dfc1546cf90c6f2c8`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/todo-due-dates` → `8bbd8bd1101b332578ade4da33ac814d521c3014`
  - `refs/archive/remote-branch-cleanup/backup/predator/reflog/wip-main-change-specs` → `5f8a12e3af2e8ebae00924bbda7bd54621cc81f1`
  - `refs/archive/remote-branch-cleanup/backup/predator/worktree-c074-linked-actions` → `37a4f2a0201e675a58fdcec78d69a36af661ab61`

  The dark-mode and pre-recovery stash refs were not archived because their
  snapshots include `.vercel/project.json` deployment metadata. Obsolete WIP
  refs were also not archived because their unique content targets removed
  architecture and has no recovery value beyond the preserved main history.

## Remote Deletion Ledger

- Batch 1 — 2026-08-13 — deleted and verified eight audited refs:
  `backup/predator/chore/design-dna-polish-audit` (`09cd033`),
  `backup/predator/chore/extensive-codebase-maintenance` (`0b10f29`),
  `backup/predator/codex/fix-linkedactions-testss` (`96af1e1`),
  `backup/predator/codex/fix-sync-push-retries` (`0808cb9`),
  `backup/predator/feat/design-dna-primitives` (`44b7b07`),
  `backup/predator/feat/design-dna-secondary-screens` (`75b345b`),
  `backup/predator/feat/linked-actions-policy-wip` (`eb7d6d5`), and
  `backup/predator/feat/todo-linked-action-first-path` (`65ec266`).
  `git fetch --prune origin` and `git ls-remote --heads origin` then showed
  `main` plus 24 remaining non-main heads; no `main` ref was targeted.
- Batch 2 — 2026-08-13 — deleted and verified nine audited refs:
  `backup/predator/fix/date-boundary-consistency`,
  `backup/predator/fix/design-dna-post-merge-consolidation`,
  `backup/predator/fix/linked-actions-contract-alignment-safe`,
  `backup/predator/fix/linked-actions-rule-lifecycle`,
  `backup/predator/fix/sync-fail-closed`,
  `backup/predator/fix/web-delete-flows`,
  `backup/predator/reflog/dark-mode-documentation`,
  `backup/predator/reflog/wip-habits`, and
  `backup/predator/reflog/wip-main-package-directory`.
  `git fetch --prune origin` and `git ls-remote --heads origin` then showed
  `main` plus 15 remaining non-main heads; no `main` ref was targeted.

## Security Review

- Historical refs will be searched for credential/token/private-key patterns
  before preservation or integration. No historical content has been copied or
  re-pushed during the initial inventory.

## Validation Ledger

- 2026-08-13 — `git fetch --all --prune` — PASS; remote-tracking state refreshed.
- 2026-08-13 — startup Git inventory commands — PASS; clean worktree,
  local `main == origin/main`, 33 total heads (32 non-main).
- 2026-08-13 — ancestry/merge-base/unique-commit scan — PASS; all 32
  non-main refs are non-ancestors and have recorded merge-bases.
- 2026-08-13 — `git cherry origin/main <branch>` scan — PASS; patch-equivalence
  evidence collected for every non-main ref and reconciled in the final audit.
- 2026-08-13 — unique-commit/file review and current-main comparison — PASS;
  all 32 branches have explicit classifications in the audit table; no
  `UNIQUE_PRODUCT_WORK` or `AMBIGUOUS` branch remains.
- 2026-08-13 — historical security path/content scan — PASS; no real secrets
  found; `.vercel/project.json` deployment metadata was identified in two refs
  and excluded from local preservation.
- 2026-08-13 — local archive preservation — PASS; 14 local-only
  `refs/archive/remote-branch-cleanup/*` refs created and verified at the
  reviewed source tips; none was pushed.
- 2026-08-13 — `npm run qa:affected` — PASS; documentation rule selected
  `qa:fast` and `tests/agent-execplan.test.ts`.
- 2026-08-13 — `npm run qa:fast` — PASS; typecheck and lint passed (19 existing
  warnings, 0 errors) and 672 unit tests passed.
- 2026-08-13 — `npm test` — PASS; 741 tests passed across 70 unit/integration
  files.
- 2026-08-13 — `npm run openspec:validate -- --strict` — PASS; 21/21 items.
- 2026-08-13 — `npm run qa:impact:validate` — PASS; 12 rules valid.
- 2026-08-13 — `git diff --check` and plan validator — PASS.
- 2026-08-13 — `git fetch origin`, `git push origin main`, `git fetch origin`,
  and SHA comparison — PASS; pushed the validated audit checkpoint as
  `057970d63549d7c37862db4c7d669bf7d45c2700` and local `main == origin/main`
  before batch 2.
- 2026-08-13 — deletion batch 1 — PASS; eight explicit audited refs deleted,
  fetch/prune completed, and live remote inventory showed 24 non-main heads
  plus `main`.
- 2026-08-13 — deletion batch 2 — PASS; nine explicit audited refs deleted,
  fetch/prune completed, and live remote inventory showed 15 non-main heads
  plus `main`.

## Changed Files / Areas

- `.agent/execplans/remote-branch-cleanup.md` — durable audit, decision,
  validation, and final-state record required by the user and repository plan
  protocol.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. From `C:/Users/Michael Roy/Documents/super-habits`, run `git status --short`,
   `git diff --stat`, `git diff --name-only`, `git worktree list`, and fetch the
   remote before trusting tracking refs.
3. Use the main worktree at
   `C:/Users/Michael Roy/Documents/super-habits-consolidation` for edits and
   commits to `main`; do not checkout `main` in a worktree where it is already
   checked out.
4. Continue from `Exact next action`, update this checkpoint before each large
   audit/validation phase, and keep every remote deletion evidence-backed.

## Outcomes & Retrospective

- Status: Active; cleanup not yet performed.
- Summary: Initial live inventory and ancestry evidence are recorded above.
- Follow-up: Complete the final branch audit, execute only justified actions,
  validate the synchronized main-only remote state, then mark this plan
  `COMPLETED` and run the plan validator.
