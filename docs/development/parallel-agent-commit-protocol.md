# Parallel-Agent Commit Protocol (Serialization-Safe)

This repository runs `lint-staged` (via `simple-git-hooks`) as a pre-commit
hook. lint-staged implements its work by creating an **automatic backup stash**
and manipulating the index. Under concurrent agents sharing one working tree,
that stash dance races: workers can commit sibling files under another worker's
message, temporarily lose content, or leave orphan `lint-staged automatic
backup` stashes behind. The parallel completion wave V2 hit exactly this
(see `openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md`).

## Rules for any future parallel wave

1. **Never run lint-staged concurrently.** Every agent in a shared-tree wave
   MUST set the escape hatch before committing:

   ```sh
   SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "..."
   ```

2. **Format explicitly instead.** Because the hook is skipped, each agent must
   format and check its own changed files before committing:

   ```sh
   npx prettier --write <changed-files>
   npx eslint <changed-files> --max-warnings 25
   ```

3. **Stage only your own files.** Use explicit `git add <paths>`; never
   `git add -A` / `git add .` in a shared tree.

4. **One committer at a time per index.** Agents may edit disjoint files in
   parallel, but actual `git add` + `git commit` sequences must be serialized
   (orchestrator-mediated or via an exclusive lock). Interleaved index
   operations are what produced mixed-attribution commits.

5. **Shared hotspots are single-owner.** Files under `core/db/`, `core/backup/`,
   `core/portable/`, `core/sync/`, `core/auth/`, `supabase/migrations/`, and the
   campaign ExecPlan are mutated only by the primary/orchestrator agent.

6. **Post-wave residue sweep is mandatory.** Before closing a wave:
   - `git stash list` — inspect every `lint-staged automatic backup` stash
     against current HEAD; drop only stashes verified to contain no unique
     legitimate content, and record the decision in the campaign ExecPlan.
   - `git grep -nE '^(<<<<<<<|>>>>>>>)'` — no unresolved conflict markers.
   - Spot-check that each worker's files actually landed under the intended
     commit messages.

## Why not just remove lint-staged?

For single-agent work the hook is convenient and safe. The escape hatch above
keeps that convenience while making concurrent waves deterministic. If a future
wave still produces stash residue, prefer fixing agent discipline over
weakening the hook for everyone.
