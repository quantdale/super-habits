# commit

Create a clean, well-documented git commit for the current state
of the SuperHabits repository. Auto-detects what changed, runs
quality gates first, then commits with a meaningful message.

---

## Phase 1 — Quality gate (must pass before committing)

Run in order. Stop and report if anything fails — do not commit
broken code.

1. `npm run typecheck` → expect 0 errors
2. `npm test`          → capture exact passing count

If either fails: stop here, report the failure, do not proceed
to Phase 2.

---

## Phase 2 — Detect what changed

Run: `git status`
Run: `git diff --stat HEAD`

Identify:
- Which feature areas were touched (habits, calories, todos, etc.)
- Whether this is a feature addition, bug fix, config change,
  or docs update
- How many files changed
- New test count vs previous (from npm test output)

Categorize the commit type:
  feat     — new feature or capability added
  fix      — bug fixed
  chore    — config, tooling, docs, dependency updates
  test     — tests added or updated without feature change
  refactor — code restructured without behavior change

---

## Phase 3 — Generate commit message

Build the commit message following this format:

  {type}: {short description} ({test count} tests)

  {optional body — 2-3 lines max if the change needs explanation}

Examples:
  feat: phase 2 - habit streaks and 30-day heatmap (19 tests)
  fix: toDateKey() returns local date not UTC - migration 5 (19 tests)
  chore: update cursor docs and agents for e2e test suite
  feat: phase 3 - calorie macro charts and weekly trends (30 tests)

Rules for the message:
- Subject line max 72 characters
- Use present tense ("add" not "added")
- Reference the phase number if this is a roadmap phase completion
- Include the current passing test count in parentheses
- Body only if the change has a non-obvious reason or known caveat

Show the proposed commit message and wait for approval before
running git commit. User may edit the message before confirming.

---

## Phase 4 — Commit and tag

After approval, run:
  git add .
  git commit -m "{approved message}"

Then ask: "Do you want to tag this commit?"
  If yes: ask for tag name or suggest one:
    Suggested: phase{N}-complete (e.g. phase3-complete)
    Run: git tag {tag-name}

Then ask: "Do you want to push to remote?"
  If yes: git push && git push --tags
  If no: note that the commit is local only

---

## Phase 5 — Report

Confirm:
- Commit hash (short: git rev-parse --short HEAD)
- Commit message used
- Tag created (if any)
- Whether pushed to remote
- Current unit test count
- Files committed (count)

---

## Constraints

- Never commit if typecheck fails
- Never commit if unit tests fail
- Do not run E2E as part of this command — E2E is run
  separately in batches via /test or /pre-pr
- Never force push (git push --force)
- Never amend a commit that has already been pushed
- Do not modify any source files during this command —
  commit only, no fixes
