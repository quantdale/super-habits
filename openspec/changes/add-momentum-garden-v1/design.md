## Context

Super Habits already stores the facts needed for a living-progress artifact: todo completion timestamps, habit completion rows plus schedule/lifecycle rule history, completed Pomodoro sessions, completed workout logs, calorie-entry dates, completed Daily Plans and Weekly Reviews, and completed Goal/Project timestamps. Activity Timeline and Progress Insights provide related bounded read patterns, but neither is a unified visual model. The app has one local SQLite source of truth, six primary sections, existing theme/motion tokens, and an existing SVG Focus sprout that must remain behaviorally stable.

The implementation must therefore stay inside a feature boundary, keep domain calculations pure, use one bounded read model for cross-domain facts, and integrate with Overview and the existing Planning Hub Progress view without adding navigation, persistence, or sync entities.

## Goals / Non-Goals

**Goals:**

- Add a deterministic `features/momentum/` boundary with pure mapping logic, a read-only SQLite collector, accessible visual primitives, a compact Overview card, and a bounded Progress detail view.
- Preserve canonical local-date, habit schedule, lifecycle, and completion semantics by reusing existing utilities/domain functions.
- Make six contribution areas independently legible: Tasks, Habits, Focus, Workout, Nutrition, and Planning; expose Weekly Review and factual Goal/Project completion as planning/review or milestone explanations.
- Keep Today fast and the detail view bounded to seven days by default with an optional 28-day history.
- Prove the model with pure tests, real-SQLite read-model tests, and a targeted web journey.

**Non-Goals:**

- A momentum score, streak currency, XP/levels, login rewards, social/competitive features, random rewards, or a new achievement economy.
- A `momentum_events` table, write interception, new migration, Supabase table, backup entity, portable-export field, or sync queue record.
- Replacing Activity Timeline or Progress Insights, redesigning the six primary sections, or refactoring FocusSprout’s timer behavior.
- Full production-readiness/performance certification across every browser, simulation, and native permutation; those remain hardening follow-up work after the focused campaign gates.

## Decisions

### 1. Use a derived, bounded read model rather than an event ledger

`features/momentum/momentum.data.ts` will open the singleton database once and issue bulk, date-bounded SELECTs for the source facts needed by Today or the recent window. Timestamp columns will be filtered with `getUtcIsoRangeForLocalDateKeys`; local date columns will use inclusive date-key bounds. Results will be converted into a serializable domain input and passed to `momentum.domain.ts`.

The read model will use explicit row limits for high-volume timestamp sources. The domain caps daily visual levels, so rows beyond a cap cannot change the visual result; details will report capped quantities honestly where needed. The read path will never call a mutation helper or enqueue sync.

**Alternative considered:** recording a momentum event on every feature write. Rejected because it duplicates authoritative data, expands backup/account ownership surfaces, creates restore ordering problems, and can drift from existing completion semantics.

### 2. Reuse the canonical habit completion engine

The pure builder will group bulk habit completions by habit and call `buildDayCompletions` for each active habit over the requested date window. A habit contributes one completed occurrence per eligible scheduled day, regardless of how far its quantitative count exceeds its target. Off-days and paused/archived lifecycle-masked days are neutral, not misses.

**Alternative considered:** counting every `habit_completions.count` increment or using a new streak formula. Rejected because it rewards farming and would diverge from the existing rule-history/lifecycle semantics.

### 3. Map domains to bounded independent growth levels

The domain exports documented caps in `MOMENTUM_LIMITS`. The shipped mapping is intentionally factual and small:

| Area       | Canonical fact                                                         | Daily mapping                                                  |
| ---------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Tasks      | active completed todos by local completion day                         | level 1 per task, capped at 3                                  |
| Habits     | eligible scheduled habit-day completions                               | level 1 per completed habit occurrence, capped at 3            |
| Focus      | completed focus sessions with positive duration                        | level 1 per session, capped at 2; minutes are explanatory only |
| Workout    | completed workout logs                                                 | level 1 per completed session, capped at 1                     |
| Nutrition  | at least one active calorie entry on a local day                       | level 1 per tracked day                                        |
| Planning   | completed Daily Plan, or completed Weekly Review on its completion day | each source is separately named; each caps at 1                |
| Milestones | active Goal/Project with completed status and timestamp                | factual dated milestone list; no growth currency               |

Each day stores source contribution counts, a per-area level, and a short explanation. There is no cross-area sum exposed to users. A small aggregate “growth areas today” label may derive from the number of active source areas, but it is not a score and is not used to determine any visual state.

**Alternative considered:** one weighted daily score. Rejected because unlike behaviors would become mathematically opaque and users could not tell why the artwork changed.

### 4. Keep temporal presentation in one model

`buildMomentumGarden` will return a chronological `days` array, a `today` day, a bounded milestone list, and derived accessibility summaries. The same model drives the Overview card and the detail view, ensuring reload determinism and preventing separate Today/history calculations from drifting. The builder accepts an injected `todayKey` for unit tests and timezone coverage; production defaults use `toDateKey()`.

The default recent window is seven local-calendar days. The detail view can request 28 days, but the query collector clamps requests to `MOMENTUM_MAX_DAYS` and does not scan beyond that window. Returning-user copy is derived from prior active days in the bounded model and remains neutral; no “last viewed” preference is persisted.

### 5. Create a small original SVG garden, preserving FocusSprout

`MomentumGardenArt.tsx` will render six compact rounded plant beds with simple stems/leaves and a shared soil line. Source accents come from the existing theme section colors; neutral surfaces, text, and borders come from `useAppTheme`. The component receives already-derived levels and never calculates product facts.

The existing `FocusSprout.tsx` stays unchanged in V1. This avoids destabilizing the timer surface while still giving the broader Garden an original visual language. A later hardening campaign can extract a primitive only if the duplication is proven worthwhile.

The art’s parent has the full textual accessibility label; decorative SVG children are hidden. A brief feedback opacity transition may run when levels change, using `MOTION_DURATION.feedback`; `useReducedMotion` disables it and all ambient motion. The Garden remains fully legible as static geometry.

### 6. Integrate through existing hierarchy and navigation

Overview will request a one-day compact model after its existing dashboard facts load and render `MomentumCard` directly below the pinned Today Progress strip and before customizable cards. The compact card includes the visual, factual contributing-area copy, a neutral empty state, and a keyboard/touch-accessible “View garden” button that calls `openPlanningHub('progress')`. The seven-day model is reserved for the deeper Progress view.

The Planning Hub’s existing `progress` view will render `MomentumDetailView` above the existing `ProgressInsightsView`. The detail view loads its 28-day model only when the Progress view is mounted, presents Today plus recent history and explanations, and does not add a primary tab or duplicate existing charts.

**Alternative considered:** adding a seventh top-level Garden tab. Rejected because the product’s navigation model is intentionally six-section and the Garden belongs to day orientation and reflection.

### 7. Test the pure boundary and the real persistence boundary separately

`tests/momentum.domain.test.ts` will cover the full semantic matrix with injected local dates and representative source facts, including DST-adjacent timestamp conversion through the sanctioned utilities. `tests/integration/momentumGarden.test.ts` will use the real SQLite integration harness and real feature writes/SQL fixtures to prove the collector matches authoritative rows, ignores soft-deleted data, stays bounded, and leaves the sync outbox unchanged. A Playwright spec will cover empty, seeded multi-domain, reload determinism, detail navigation, reduced-motion text parity, and read-only viewing using the existing DB harness and semantic selectors.

## Risks / Trade-offs

- [Risk] The read model adds cross-domain SELECT work to Overview. → Mitigation: one singleton connection, bulk queries, a seven-day window, explicit per-source limits, and no per-habit database loop; the detailed 28-day read is deferred until Progress opens.
- [Risk] A hard row limit could hide raw activity details. → Mitigation: the visual mapping caps before unlimited growth, limits are exported/documented, and explanatory copy uses “up to”/“capped” wording where a source exceeds its visual cap.
- [Risk] Habit rule history is more complex than other sources. → Mitigation: pass the real habit rows into the pure builder and reuse `buildDayCompletions`; unit tests cover off-days, lifecycle masking, and target counts.
- [Risk] SVG accessibility may become noisy on React Native Web. → Mitigation: one parent image label, decorative child exclusion, a separate text summary, semantic button labels, and E2E assertions against visible copy rather than SVG internals.
- [Risk] Mounted Overview and modal refreshes can show stale data after a completion. → Mitigation: use existing day-rollover/foreground refresh hooks; source actions remain authoritative and reloads reconstruct the same model. A later hardening pass can add a shared invalidation signal if profiling proves it necessary.
- [Risk] Native rendering differences may not be executable in this environment. → Mitigation: use React Native-compatible SVG/Pressable/View primitives, run type/unit/integration checks, attempt the repository native smoke lane, and classify missing emulator/toolchain evidence as ENVIRONMENT.

## Migration Plan

No database migration is required. Deploying the code immediately enables Garden reconstruction from existing rows; restoring or importing existing source data automatically recreates the same derived Garden. Removing the feature removes only read/UI code and leaves all authoritative source data untouched, so rollback is a normal code rollback with no data cleanup.

## Open Questions

None. The semantic caps, source set, temporal windows, navigation surface, and persistence boundary are fixed by this design and the delta spec.
