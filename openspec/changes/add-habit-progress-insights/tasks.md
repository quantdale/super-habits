## 1. Domain contract

- [x] 1.1 Add the pure insight types/calculator and shared window/trend helpers
      using the existing Habit Engine V2 rule and streak functions.
- [x] 1.2 Add deterministic Vitest coverage for schedules, historical targets,
      creation/deletion boundaries, current-day grace, long streaks, rates,
      trend evidence, off-day rows, and local date boundaries.

## 2. Query-efficient data loading

- [x] 2.1 Add one ordered all-habit completion read for the active Habits list
      and refactor today counts/current streak derivation to use in-memory
      indexes without changing results.
- [x] 2.2 Add real-SQLite coverage for the history query and batched list result,
      including target >1 and soft-deleted habit exclusion.

## 3. Accessible product surface

- [ ] 3.1 Add the per-habit Progress entry point and modal/detail component with
      loading, empty, error, metric, trend, and target-vs-actual states.
- [ ] 3.2 Add semantic labels/selected state to habit icon and color selectors
      and ensure all insight visualizations have textual equivalents.
- [ ] 3.3 Add focused Playwright coverage for opening exact-habit progress and
      reading the accessible metrics/history.

## 4. Validation and documentation

- [ ] 4.1 Run focused typecheck/lint/unit/integration and `qa:affected`; fix
      root causes without weakening assertions.
- [ ] 4.2 Run OpenSpec validation, web build/E2E, and serialized native
      targeted validation where the UI change is supported.
- [ ] 4.3 Update the campaign ExecPlan with evidence, mark these tasks
      complete, and create a coherent checkpoint commit.
