# HARDENING HANDOFF — Complete Product Roadmap Parallel Wave V2

This file is the input contract for the NEXT dedicated hardening campaign.
Status markers: `ADDED`, `RISK`, `SCHEMA_REQUEST`, `INTEGRATION_NEED`,
`UNTESTED`, `DEFERRED`.

## Campaign summary

- Wave type: massively parallel implementation — 10 delegated packets plus 1
  follow-up packet (Overview completion), integrated by the orchestrator.
- Schema: frozen at v15 — no migrations this wave.
- Sync/backup/portable scope: unchanged by design. No new synced entities.
- Wave range: scaffold `6e0a262` … closure commit on top of `d49d4fe`;
  43+ commits, ~11.9k insertions across 124 files (see final report).

## Durable data classification

No new persistent entity tables or columns were introduced (schema freeze).
New device-local preference stores (AsyncStorage, intentionally not synced,
not backed up, lost on restore/reinstall):

| Store                            | Key(s)                                                                           | Owner feature          |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------------------- |
| Habit lifecycle                  | `superhabits.habits.pausedIds` / `.archivedIds`                                  | habits                 |
| Overview layout                  | `superhabits.overview.cardLayout`                                                | overview               |
| Pomodoro presets / active preset | `superhabits.pomodoro.presets` / `.activePresetId`                               | pomodoro               |
| Pomodoro session meta            | `superhabits.pomodoro.sessionAssociations` / `.sessionNotes`                     | pomodoro               |
| Workout rest default             | `superhabits.workout.restSeconds`                                                | workout                |
| Calorie targets                  | `superhabits.calories.targets`                                                   | calories               |
| Command history                  | `superhabits.command.history`                                                    | command                |
| Notification prefs               | `superhabits.notifications.todo-reminders-enabled` / `.daily-plan-reminder-time` | settings/notifications |

If cross-device persistence is ever wanted for any of these, they become
backup-scope candidates and must go through the backup/settings allowlist
process — not ad-hoc columns.

## SCHEMA_REQUESTs (for an approved future migration; next block would be v16)

1. **Workout (W8)** — PR detection and weighted volume are wired but
   data-starved:
   ```sql
   ALTER TABLE workout_session_exercises ADD COLUMN weight REAL NOT NULL DEFAULT 0;
   ALTER TABLE workout_session_exercises ADD COLUMN reps INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
   ```
   Defaults keep old rows valid; implies backup-scope manifest review.
2. **Habits (W1)** — pause/archive are device-local sets today:
   `ALTER TABLE habits ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`
   plus sync-entity coverage if cross-device lifecycle is wanted.
3. **Pomodoro (W7)** — only if cross-device session notes/associations are
   ever wanted: `note TEXT NULL`, `linked_todo_id TEXT NULL` on
   `pomodoro_sessions` (implies backup-scope changes; AsyncStorage chosen for
   now).

## INTEGRATION_NEEDs still open (non-blocking)

- **Supabase edge functions** (`supabase/functions/parse-ai-command`): allow
  the create-prompt to emit `create_project` / `update_goal_progress` /
  `add_todo_to_daily_plan` drafts matching `features/command/types.ts`; add
  ask-classify entries for `project_status`, `goal_progress`, `today_focus`.
  Local deterministic parsing already covers all of these; remote mode returns
  unsupported until the function is updated AND deployed (no deployment this
  wave).
- Todo reminder snooze action (`TODO_REMINDER_SNOOZE_ACTION`) is registered
  but has no dispatcher handler yet; mark-done action likewise needs wiring to
  todo mutations via `notificationResponseDispatcher`.

## RISKs to verify in hardening

- Interleaved worker commits on local main: several commits carry sibling
  files under another worker's message (shared-index races). Content verified
  present at HEAD by each worker and by orchestrator gates, but history
  attribution is mixed; bisectability of wave commits is approximate.
- Two planning domain test files briefly contained merge markers at HEAD
  (introduced by wave commits `50dbdf1`/`0775d7c` era stash conflicts);
  resolved in `ee283c7`/`d49d4fe`. Verify no other historical marker strings
  exist: `git grep -E '^(<<<<<<<|>>>>>>>)'`.
- lint-staged's stash-based pre-commit hook is unsafe under concurrent agents
  (caused the above). Recommendation: disable or serialize it during any
  future parallel wave. Ten `lint-staged automatic backup` stashes remain in
  the repo; inspect and drop them deliberately during hardening.
- Bulk todo operations are sequential without batch rollback/partial-failure
  reporting (W1).
- `sw.js` no longer auto-skips waiting workers (explicit update banner);
  users who never see the banner keep the old worker until the next visit.
- Paused/archived habits are excluded from the Habits list surface only;
  Overview/insights/command surfaces may still count them until they adopt
  the lifecycle sets.

## UNTESTED behavior (by wave policy)

- All new UI surfaces: component rendering, E2E journeys, simulation lanes.
- Native-only scheduler bridges (`syncTodoDueReminder`,
  `syncDailyPlanReminder`) need expo-notifications mocks or device lanes.
- Rollup SQL paths (projects/goals) are covered only as pure math; add
  real-SQLite integration tests.
- PWA update banner/connectivity indicator behavior in a real browser.
- Copy-day, day-navigation, targets modal, trend chart (calories) in browser.
- Auto-start-next pomodoro timing (setTimeout-based) untested.

## DEFERRED to hardening campaign

- Full Vitest suite, Playwright E2E, journeys, simulation lanes, timezone
  matrices.
- Native Android/iOS QA for reminders/PWA/shell changes.
- Any approved SCHEMA_REQUEST migration + backup-scope/manifest updates.
- Performance passes on new bounded queries if profiles regress.
- Stash cleanup and optional history hygiene discussion (no rewrites pushed).
