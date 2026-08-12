# check

Run all quality gates for SuperHabits and report results.

---

Run the full local quality gate for SuperHabits.

From the project root:

1. npm run typecheck (tsc --noEmit)
2. npm test (vitest run)

Report for each:

- Pass / Fail
- If fail: exact error output and file + line

Expected baselines:

- typecheck: 0 errors
- npm test: all tests listed by `npx vitest list` passing (0 failing is the gate)

Final summary: overall Pass / Fail.
If anything fails, identify root cause and suggest fix.
