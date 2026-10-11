---
schema: spec-driven
created: 2026-10-11
---

## Why

W9 reconstructed Workout and merged successfully, but two independently
verified source-level defects remain at the W9 baseline
(`8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4`):

1. **False-success save (P1).** `WorkoutSessionScreen.handleFinish()`
   treats a `logWorkoutSession()` result of `status: 'skipped'` as success:
   `clearDraft()` runs unconditionally and `setSavedOutcome({ newRecords })`
   runs unconditionally, so the UI enters the saved-workout state and shows
   "Workout saved" even though no workout row was inserted. `logWorkoutSession`
   can return `skipped` without throwing — for example when its transaction
   rejects a workout whose routine is no longer active (soft-deleted). The XP
   guard is already correct; the success-state and draft-cleanup guards are not.
2. **Nested scrolling (P2).** `WorkoutScreen.tsx` renders one scroll-enabled
   `Screen` inside another, duplicating the SafeAreaView, ScrollView, scroll
   content shell, gutter/padding calculation, bottom-inset padding, and
   keyboard-dismiss behavior.

W9.5 is a bounded correction, not a redesign: the W9 landing and session
anatomy, the workout engine, persistence, sync, and backup contracts are
preserved.

## What Changes

- **Save integrity (P1).** A finish is successful only when
  `logWorkoutSession()` returns `status: 'applied'` **and** a non-empty
  `logId`. A `skipped` result (or an inconsistent result without a log id)
  shows an accurate, actionable failure explained from the data layer's
  reported reason, keeps entered sets, added sets, and the current
  exercise/phase in memory, does not clear the draft, and does not award XP.
  The workout log is never reported as saved unless it was committed.
- **Post-commit separation (P1).** The durable commit is decided first.
  Secondary post-commit bookkeeping (draft cleanup, reward attribution) is
  isolated so its failure cannot rewrite a committed workout into a false
  "not saved" and cannot invite a duplicate insert. A durable save stays a
  durable save; only the bookkeeping note is honest about its own failure.
- **Draft retention (P1).** The skipped/error path schedules no
  draft-clearing operation; a durable draft written earlier is not erased;
  the ordering race between a pending debounced draft write and later draft
  cleanup is closed so a late write cannot resurrect a cleared draft.
- **Single scroll authority (P2).** The Workout landing keeps exactly one
  page-level scroll-enabled `Screen`; the accidental nested `Screen scroll`
  is removed. Section order, responsive gutters, safe-area and bottom
  navigation clearance, History/Insights disclosure, Quick Start, week
  planning, routine editor controls, modal ownership, and keyboard
  interactions are preserved.
- **Records (P3).** The W9 slice ExecPlan and the parent campaign ExecPlan
  are reconciled with actual Git history (PR #66, final W9 main `8cdee8e`,
  exact-head CI `38083748134`), malformed control-character references are
  repaired, and obsolete remaining-work prose is corrected. W9.5 gets its own
  bounded plan; W10 remains next and unimplemented.

## Capabilities

### New Capabilities

- `workout-save-integrity`: the durable-success contract for finishing a
  workout, truthful skipped/failed handling, post-commit bookkeeping
  separation, and draft retention on the error path.
- `workout-scroll-authority`: exactly one page-level scroll-enabled Screen
  for the Workout landing with preserved layout, safe-area, and keyboard
  behavior.
