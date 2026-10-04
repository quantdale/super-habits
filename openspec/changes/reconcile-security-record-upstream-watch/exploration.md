# Exploration — final security record and upstream-watch transition

Observed 2026-10-04 UTC, **before proposal creation**, unless stated otherwise.
This is exploration evidence, not a claim that the reconciliation was applied.

## Repository and preservation

After `git fetch --all --prune`, starting branch `main`, HEAD and origin/main
all equal `61b295a113478d463505e280f8195ebdbcb5ac41` in
`quantdale/super-habits`. Tracked/index diffs are empty. The worktree is not
wholly clean: seven pre-existing untracked OpenSpec roots, six untracked
review/correction ExecPlans and `.tmp-ios36423379932/` remain present.
Stash `pre-recovery-local-changes` is still object
`c35e281d740df1e367c1be0f38383237ca080239`. Initial inventory has one worktree.
Ignored `simulation-output/security-braces-triage/` evidence is present and
was read without overwriting it. This is current presence/identity evidence,
not a fresh byte-by-byte attestation of all older preservation claims.

Ambient preflight versions: Node 24.3.0/npm 11.4.2. For count reproduction,
PATH selected `/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64` and
verified Node 22.23.2/npm 10.9.8. `npm run openspec:validate` uses installed
`@fission-ai/openspec` 1.8.0. The standalone global planning CLI is 1.9.0;
it was **not** substituted into the paired count experiment.

## Finding A: historical local termination mislabels current publication

`../resolve-braces-security-blocker/final-report.md` §A says the ending SHA is
the local commit and “origin/main was not advanced (no publication; see §I).”
But §I records owner-ordered publication of initial triage commit
`16882523937ee39416034b2ab6619ee9fab3e9f2` and review-corrected publication
`868e19959b6335c2abba1af77dd09253844fdfc7`. Current fetched published record is
`61b295a113478d463505e280f8195ebdbcb5ac41`.

The correction must preserve all three temporal states. Suggested wording for
later apply:

> The campaign initially terminated locally at 1688252 without advancing
> origin/main from 8255546. On later explicit owner instruction, the triage
> record and review corrections were fast-forward published at 868e199.
> The published record observed at this reconciliation's preflight is
> 61b295a113478d463505e280f8195ebdbcb5ac41. This is the pre-correction baseline,
> not the SHA of the reconciliation commit that will subsequently publish it.

Task 7.5's “no push; remote main stays at 8255546” also needs an explicit
**initial historical phase** label if edited. Conditional remediation tasks
8.1/8.2 remain unearned; prior security findings/specs are not rewritten.

## Finding B: exact seven-item provenance

Paired validation, same commit/Node/npm/CLI, no dependency install:

| Environment at 61b295a                         |                  Specs |         Active changes | Total | Result              |
| ---------------------------------------------- | ---------------------: | ---------------------: | ----: | ------------------- |
| Preserved local workspace before this proposal |                     59 |                     12 |    71 | 71 passed, 0 failed |
| Clean tracked-only detached checkout           |                     59 |                      5 |    64 | 64 passed, 0 failed |
| Hosted CI 37176255652                          | Same tracked inventory | Same tracked inventory |    64 | 64 passed, 0 failed |

Both JSON inventories contain identical 59 spec identities. Shared change
identities are `external-blocker-closure`, `final-certification-closure`,
`resolve-braces-security-blocker`, `resolve-windows-dependency-security`, and
`windows-closure-reconciliation`. Archives are not active validation items.
The local-minus-clean set contains exactly these seven **change** entities;
the clean-minus-local set is empty:

| OpenSpec item (`change/…`)                 | Local workspace | Tracked Git checkout | Ownership at preflight                   |
| ------------------------------------------ | --------------- | -------------------- | ---------------------------------------- |
| fix-local-calendar-day-windows             | yes             | no                   | preserved pre-existing untracked/foreign |
| harden-agent-guidance-truth                | yes             | no                   | preserved pre-existing untracked/foreign |
| harden-ci-lane-integrity                   | yes             | no                   | preserved pre-existing untracked/foreign |
| harden-interaction-idempotency             | yes             | no                   | preserved pre-existing untracked/foreign |
| harden-native-evidence-and-release-posture | yes             | no                   | preserved pre-existing untracked/foreign |
| harden-silent-failure-certification        | yes             | no                   | preserved pre-existing untracked/foreign |
| reduce-section-activation-render-work      | yes             | no                   | preserved pre-existing untracked/foreign |

For every row, both `git ls-files -- openspec/changes/<item>` and
`git ls-tree -r --name-only HEAD -- openspec/changes/<item>` return **zero
files**. Thus `71 - 64 = 12 - 5 = 7` is a workspace-content difference, not
a tooling/configuration explanation or a reason to retract the reproduced 71.
The full 64-item hosted log inventory was also extracted and compared to the
clean checkout's JSON set: identical. The machine-readable summary is
`simulation-output/security-record-explore-2026-10-04/provenance-and-preservation.json`.
Retained `simulation-output/security-braces-triage/post-commit-checks.txt`
also records 71 at original triage commit 1688252; that historical receipt is
not overwritten or relabeled as this new experiment.

### Replay recipe

Use an absolute path to the existing locked CLI, borrowed read-only by the
clean checkout. This does not borrow any local OpenSpec documents.

```bash
export PATH="/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64:$PWD/node_modules/.bin:$PATH"
node --version
npm --version
node node_modules/@fission-ai/openspec/bin/openspec.js --version
npm run openspec:validate
node node_modules/@fission-ai/openspec/bin/openspec.js validate --all --json
# Before new proposal creation, these report 71. Current totals can differ.
git ls-files openspec
git ls-files openspec/changes
find openspec/changes -mindepth 1 -maxdepth 1 -type d -printf '%f\n'
git worktree add --detach <owned-temp-path> 61b295a113478d463505e280f8195ebdbcb5ac41
# In that checkout, verify HEAD and empty git status, then:
node <absolute-primary-repo>/node_modules/@fission-ai/openspec/bin/openspec.js validate --all --json
# npm run openspec:validate also reports 64 if PATH retains the primary .bin.
# Compare sets by item.type + '/' + item.id; compare tracked paths per delta.
# Remove only the owned clean worktree after confirming its status is empty.
```

Raw outputs: `local-validation.{log,json}`, `clean-validation.{log,json}`,
`clean-status.txt`, `tracked-openspec-files.txt`, preflight state inventories,
`ci-37176255652.{log,json}` under the new gitignored evidence root
`simulation-output/security-record-explore-2026-10-04/`. Initial capture at
`C:/Users/palac/AppData/Local/Temp/superhabits-security-record-explore.YKRdJb/`
also remains preserved; no previous evidence was overwritten.
The temporary clean worktree was removed normally after an empty status check.
No npm ci was required. The seven foreign roots were not moved or deleted.

**Proposal-count warning:** this new change adds one further local item.
Post-proposal local validation reproduced **72/72** on the pinned toolchain.
If this planning record is included in the one eventual documentation publication, the unchanged
tracked baseline gains one change and becomes 65 items. Neither number alters
the proven historical 71-versus-64 comparison. Measure actual final CI rather
than hard-code an expected count as acceptance.

## Starting hosted CI truth

`gh run view 37176255652 --repo quantdale/super-habits --json
 databaseId,headSha,status,conclusion,event,headBranch,jobs,url` and `--log`
verify completed push CI at full SHA 61b295a:

- quality: FAILURE exactly at `Audit runtime dependencies (gates on new high/critical)`.
- All preceding quality gates passed, including OpenSpec 64/64 and combined
  tests: 251 files passed/1 skipped, 2539 tests passed/3 skipped.
- Audit: exactly two undocumented highs, braces GHSA-vfj7-8cjw-p6xm and
  node-forge GHSA-86w9-cpqp-85rv; existing brace-expansion entries documented.
- e2e: SKIPPED because quality failed; nightly: SKIPPED for the push.
- URL: https://github.com/quantdale/super-habits/actions/runs/37176255652

This is the **starting published record's CI**, not a future correction run.
No new push or workflow dispatch was performed.

## Cheap upstream sanity and decision

`npm view braces version` returned 3.0.3; `npm view node-forge version`
returned 1.4.0. No latest-release event was detected. Advisory/parent/PR and
shipped-exposure conclusions remain retained prior evidence, not fresh checks.
No full audit, package mutation, native lane, Supabase access or production
operation was performed.

Proceed with a documentation-only proposal. Clarify existing chronology/count
provenance, retain truthful audit red and NOT CERTIFIED, publish once only on
later apply, report that exact final SHA's CI outside another repository commit,
and stop autonomous security campaigns until a material upstream event.
