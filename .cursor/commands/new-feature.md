# new-feature

Scaffold a new SuperHabits feature module end-to-end: DB table, migration, data layer, domain logic, screen, and route.

---

Apply db-and-sync-invariants, feature-module-pattern, and rn-expo-conventions skills.

New feature request: {{feature}}

Phase 1 — Intake (answer before planning):
- What data needs to persist? List every field with type.
- What is the entity name and ID prefix? (e.g. "todo", "habit", "cal")
- Does it need a new DB table? If yes, what columns?
- Should writes sync? (most entity tables do — exceptions: pomodoro_sessions, workout_logs, habit_completions)
- What pure domain logic is needed? (calculations, validations, state machines)
- Does it need notifications?
- Does it touch any existing feature's data?

Phase 2 — Plan (list every file to create or modify):
- New migration: core/db/client.ts runMigrations (current stored version: 8, next: 9)
- New type: core/db/types.ts
- New data file: features/{name}/{name}.data.ts
- New domain file: features/{name}/{name}.domain.ts
- New screen: features/{name}/{name}Screen.tsx
- New route: app/(tabs)/{name}.tsx
- Tab entry: app/(tabs)/_layout.tsx
- New tests: tests/{name}.domain.test.ts

Phase 3 — Wait for plan approval.

Phase 4 — Implement (data-agent for DB/data, feature-agent for UI/domain).
- Data layer first (schema + data functions)
- Domain logic second (pure, tested)
- Screen last (uses data + domain)

Phase 5 — Report:
- Files created/modified
- Migration number used
- Test count
- Any known limitations or deferred work
