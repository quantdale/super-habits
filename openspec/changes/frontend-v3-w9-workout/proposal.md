---
schema: spec-driven
created: 2026-10-10
---

## Why

W8/W8.5 closed Focus, and W9 owns Workout. The rendered Workout landing is
still plan-first: a documentation subtitle, a full "Today" hero card, a full
"Week" card with seven rows of repetitive `+`/Rest controls, a second
Start/Resume card, two stat cards, the add-routine form, the routine library,
and only then history/analytics. SYS-20 is the visible consequence — a rest-day
message can be the hero while every training action sits below the fold — and
SUR-06 is the planning consequence — week rows show controls without readable
routine assignments.

The live session (`WorkoutSessionScreen.tsx`) has the mirror problem: it is a
phase-timer first and a logger second. A giant centered countdown, a progress
track, ACTIVE/REST badge, and rest-adjust controls push the set inputs down the
screen, and the only "previous" context is one line. Train Fitness and Dropset
(w9 research, `docs/ui-ux/14-v3-reference-ledger.md` R12) show the alternative:
a compact persistent timer, an exercise header with set-count progress, a
flat set table (set / previous / inputs / done), and a rest dock that never
blocks entry.

The domain is mature and must survive untouched: `buildTimerSequence()`
(active/rest phases, zero-rest omission, superset back-to-back), the
completed/skipped disposition rules, the draft serialization, per-set rest
prescriptions, the sync/outbox writes, PR math, and XP-after-durable-commit.

## What Changes

- **Landing hierarchy (W9.1):** a compact training-state header (today · scheduled
  routine or rest context, no doc subtitle), then quick-start routine rows
  (name, exercises, sets, last performed, one Start), then a collapsed weekly
  strip with readable assignments and today highlighted, then routine
  management (open/edit/complete/delete + add), then one History & insights
  disclosure holding recent sessions, totals, PRs/progress, body weight,
  weekly volume and the heatmap. The streak/days stat cards move into that
  disclosure. Heavy history derivations run only when the disclosure is open.
- **One resume authority (W9.1):** a valid draft shows exactly one dominant
  Resume action naming the routine and explaining saved progress; discard
  stays secondary and confirmed; a stale/missing/deleted routine draft is
  re-validated on resume exactly as today. Starting an unscheduled routine
  never rewrites the weekly plan.
- **Weekly planning (W9.1):** a compact seven-day strip (SUR-06) with the
  assigned routine name readable, explicit Rest distinct from unplanned, and
  today marked. Tapping a day opens a focused assignment sheet; for today it
  distinguishes "just today" (one-day override) from "every {weekday}"
  (recurring template). "Edit plan" keeps the full week editor. Rescheduling
  and reminder scheduling are preserved.
- **Live session reconstruction (W9.2):** set-logging-first anatomy — routine
  name and "completed / prescribed sets" progress, current exercise header
  (name, set N of M, modality + target), a flat per-exercise set table with
  previous-performance context and modality-correct inputs (weight/reps,
  bodyweight + additional load, duration, distance/pace, reps per side,
  effort scale when enabled, legacy free-text), an obvious done control per
  set, and an "Add set" affordance that really works. The giant countdown is
  replaced by a compact contextual timer; rest becomes a docked panel with
  remaining time, skip, and adjust that never covers set inputs.
- **Session-local Add set (W9.2):** appends a prescribed-consistent set to the
  current exercise inside the session (draft-persisted, resume-coherent,
  correctly numbered, correct rest rule), without editing the recurring
  routine. Implemented as a narrow, fully tested sequence extension; no
  random-access set editing, no other engine change.
- **Finish, PR and cancel truth (W9.3):** finish stays exactly-once with XP
  only after a durable commit, and a failed save now surfaces a truthful
  error with retry instead of a silent no-op. The PR celebration is refined
  to a brief, exercise-linked, nonblocking, reduced-motion-aware notice with
  unchanged `findNewPersonalRecords` semantics. Cancel copy tells the truth:
  leaving keeps the resumable draft; discarding is the confirmed destructive
  path.
- **Progress labels (W9.3):** completed vs prescribed vs skipped sets are
  distinct, accurate labels; elapsed active time and rest remaining are never
  conflated.

## Capabilities

### New Capabilities

- `workout-landing-experience`: the quick-start-first landing, compact
  training state, single resume authority, collapsed readable weekly strip
  with explicit template-vs-override assignment, and subordinate history.
- `workout-live-session`: the set-logging-first session anatomy, modality-aware
  set rows, nonblocking rest dock, session-local add set, truthful finish/PR/
  cancel behavior, and accurate progress labels.

### Modified Capabilities

- `ui-ux-interaction-density-a11y`: extend the screen-reader order and
  large-text scenarios to the Workout landing and live session.
- `ui-ux-visual-coherence`: Workout adopts the quiet group headers and flat-row
  grammar (SYS-02/SYS-07/SYS-20/SUR-06 dispositions).
