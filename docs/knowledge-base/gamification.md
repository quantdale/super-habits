# Gamification (XP, streaks, quests, badges)

The reward engine reads activity from the feature tables and records XP,
spent freezes, completed quests, and unlocked badges in four SQLite tables.
Awards and freeze changes mark the next backup snapshot dirty. Individual
reward rows stay out of the sync outbox.

## Backup and restore

Portable format 3 and immutable cloud scope 10 capture the same four reward
tables alongside activity and settings. Each reward entity participates in the
snapshot's integrity checks. Cloud generations use the verified account owner
and existing publication protocol. The mutable cloud manifest and outbox stay
on scope 9.

Portable formats 1 and 2, cloud scopes 7–9, and earlier cloud backups remain
restorable. The normal empty-device rule applies, including on devices that
contain only reward history. A successful older restore starts with an empty
reward ledger, 0 XP, level 1, and no earned or spent freezes. It does not merge
reward histories or award XP from activity imported by the restore. New local
activity can earn rewards normally.

Current backups write restored receipts and reward history inside the same
SQLite transaction as the feature data. The reward engine derives XP, levels,
and streaks from those preserved rows without replaying the original actions.

## Tables (migration 25)

| Table                         | Role                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `gamification_events`         | The ledger. One row per real action, `UNIQUE(event_kind, source_key)`. `xp` carries the award; `freeze_grant` rows carry 0. |
| `gamification_streak_freezes` | One row per day a banked freeze saved.                                                                                      |
| `gamification_quests`         | Completed daily quests (`date_key`, `quest_id`).                                                                            |
| `gamification_badges`         | Unlocked badge tiers.                                                                                                       |

Streaks, levels, quest progress, and badge state are all functions of these
rows plus the feature tables — none of them is stored as a mutable counter, so
nothing can drift.

## Engine (`gamification.domain.ts`)

Pure, no DB and no clock reads. Each function takes the state it needs, which is
what makes the reward math unit-testable (`tests/gamification.domain.test.ts`).

- **XP**: `XP_AWARDS` gives base XP per action; `streakMultiplier` scales it
  (`×1.0 → ×1.5` at 60+ days). Milestones 3/7/14/30/60/100/180/365 pay a capped
  bonus and, at 7/30/100/365, bank a streak freeze (max 3 banked).
- **Levels**: `levelFromXp` walks `round(50 × level^1.4)` cumulative thresholds.
  A level never regresses because XP is only ever awarded.
- **Streaks**: `computeStreakSummary` counts consecutive _active_ days.
  A day is active when it has a non-grant ledger row. Grace: an open today never
  breaks a live streak (`atRisk` flags it). A frozen day bridges a run without
  adding to it.
- **Freezes**: `planAutoFreeze` bridges the trailing gap one missed day at a
  time, walking back from yesterday, and stops at the first day the ledger
  already counts as active or frozen. The spend is bounded by both the bank and
  `MAX_BANKED_FREEZES`, so a multi-day absence up to the bank size is covered
  while an unbounded gap simply ends the run instead of retroactively
  resurrecting history. A missed day has no ledger row at all, so an absent row
  _is_ the gap.
- **Quests**: `selectDailyQuestTemplates` is a seeded shuffle of the pool keyed
  by the date, one quest per metric, so the same day always yields the same
  three quests on every device without coordination.
- **Badges**: nine families × four tiers (Bronze/Silver/Gold/Platinum).
  `evaluateBadges` returns newly crossed tiers; unlocked ids come from the table.

## Persistence (`gamification.data.ts`)

- `readGamificationSnapshot()` — the single read model every surface renders
  from (level, streak, week strip, quests, badges, today's facts).
- `awardGamificationAction({ kind, entityId? })` — idempotent award. Callers pass
  the entity id of the action just completed. Entity-keyed kinds (`todo`,
  `focus`, `workout`, `plan`, `review`) REQUIRE the id on the fast path: an
  id-less call returns `null` (a miss, healed by reconcile backfill with the
  correct id) instead of awarding the oldest unrewarded row, which would
  mis-attribute XP when several are unrewarded. Only `habit` and day-keyed
  `nutrition` keep the oldest-unrewarded fallback. Returns `null` when the
  action was already paid.
- `reconcileGamificationActivity()` — backfills today's unrewarded actions.
  This is why a screen's direct call is a latency optimization rather than the
  source of truth: habit reminder quick-actions and command-center writes earn
  XP even though they never touch a gamification-aware screen. Silent by design
  (no celebration for something done minutes ago elsewhere).
- `ensureStreakFreeze()` — spends banked freezes on the trailing missed days.

## Feedback (`lib/rewardFeedback.ts`)

Three intensities: `light` (check-off: haptic only), `success` (quest: haptic +
two-note chime), `milestone` (level, badge, complete day, streak: haptic +
arpeggio). Tones are generated by `scripts/generate-reward-sounds.mjs` into
`assets/sounds/` — deterministic 16-bit PCM, no licensing surface. Both haptics
and sound are user preferences (Settings → Accessibility → Reward feedback) and
every native call is best-effort.

## Surfaces

- **Today dashboard card** (`progress` card id) — level ring, XP bar, streak +
  freeze chips, week strip, three quests. Tapping opens the overlay.
- **Level & Achievements** overlay (`openAchievements`) — hero, stats, week,
  quests, badge grid, streak-protection explainer.
- **Celebration banner** — mounted once at the app root. Deliberately _not_ a
  modal: a top-anchored, `pointerEvents="box-none"` card with confetti, so every
  control the user was reaching for stays clickable and a suspended timer cannot
  trap them behind an overlay. Auto-dismisses after 2.8s and is also dismissible
  through its Continue button. Only `day`, `badge`, `level`, and `streak` tiers
  reach it: a quest completion resolves on the quest row plus a chime, and a
  routine check-off resolves on the XP bar plus a haptic. The provider queues at
  most two celebrations behind the visible one.

## Action hooks

`useGamification().recordAction(kind, entityId?)` fires after the feature write
succeeds, in: `HabitsScreen` (check-in), `TodosScreen` (completion), the
Pomodoro completion path (confirmed insert only), `WorkoutScreen` quick-complete,
`WorkoutSessionScreen` save, and both calorie entry paths. `DailyPlanView` and
`WeeklyReviewScreen` are covered by reconciliation; hook them the same way if
their completion ever needs instant feedback.
