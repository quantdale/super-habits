# Proposal — Add Weekly Review Cadence Loop

## Summary

Add the missing adoption loop for Weekly Review: a user-configured weekly reminder (weekday + time), a native notification that opens the review directly, an honest web-degradation path, and backup/restore persistence of the preference.

## Why

Every other ritual in SuperHabits nudges the user — todo due-date reminders, schedule-aware habit reminders, and a daily-plan nudge all exist. Weekly Review, the anchor habit that reschedules stale todos and rolls up progress, never prompts anyone. The feature's executor, summary, and history surfaces are complete; only the cadence loop is missing. This is the highest-leverage, lowest-risk daily-use improvement identified in the post-RC gap audit.

## Goals

1. DST-safe local-calendar weekly occurrence math (pure, unit-tested).
2. Single-identifier replace-not-duplicate scheduler bridge.
3. Tap-through entry into Weekly Review on native; honest native-only copy on web.
4. Preference rides the append-only settings V3 snapshot through Restore V2 and Portable import.

## Non-goals

- No changes to review execution semantics; no two-way sync; no new iOS delivery claims.

## Completion rule

All tasks validated with focused gates selected via `qa:affected`, settings/restore coverage green, and exact-SHA CI quality+e2e pass on the final push.
