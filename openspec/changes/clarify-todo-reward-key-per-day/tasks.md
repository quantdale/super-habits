## 1. Settle the action identity

- [x] 1.1 Key `todo` awards per local day (`<dateKey>:<todoId>`) so a later-day re-completion is a new action
- [x] 1.2 Keep same-day 0→1→0→1 idempotency (the day is part of the key, so a toggle cannot farm XP)
- [x] 1.3 Leave `habit`, `nutrition`, and the single-use `focus`/`workout`/`plan`/`review` keys unchanged

## 2. Upgrade compatibility

- [x] 2.1 Add `legacyActionSourceKeys` naming the pre-per-day key form for `todo` only
- [x] 2.2 Check legacy keys against the row's own `date_key` inside the award transaction, so a legacy row suppresses only the day it already paid for
- [x] 2.3 Do not rewrite or migrate existing rows (read-only compatibility)

## 3. Regression coverage

- [x] 3.1 Domain: per-day key differs by day; legacy key form is named for `todo` and empty for every other kind
- [x] 3.2 Integration: an old bare-id row suppresses the same-day award via both the fast path and reconcile, and leaves the legacy row untouched
- [x] 3.3 Integration: a legacy row dated yesterday does not block today's genuine re-completion, and replays stay free
- [x] 3.4 Browser: seed the old-format ledger, reload, and assert no second row is minted and the day still reads active
- [x] 3.5 Browser: seed a legacy row dated yesterday, complete today through the UI, and assert exactly one new row plus reload stability

## 4. Validate

- [x] 4.1 `npm run typecheck` and `npm run lint` clean
- [x] 4.2 `npx vitest run` on the gamification domain and integration suites
- [x] 4.3 Targeted Playwright spec only (`e2e/reward-key-upgrade.spec.ts`), red-first against the guard removed
- [x] 4.4 `npm run build:web` for the shipped export
