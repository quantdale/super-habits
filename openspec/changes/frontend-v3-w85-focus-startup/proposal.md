---
schema: spec-driven
created: 2026-10-09
---

## Why

W8 rebuilt the Focus surface so a running or paused session withdraws configuration, but the guard is render-derived: `showConfiguration` followed `isRunning || isPaused`, and `isRunning` only becomes true **after** `start()` awaits `scheduleTimerEndNotification()`. On native, that await spans the OS permission prompt, so for a real, user-visible window the surface still offers the mode selector while a session has already been claimed. Worse, the mode selector's `onChange` had no synchronous guard and wrote `startedAtRef.current = null`, and `handleSelectPreset` wrote the governing preset **before** checking whether a session was active.

Measured consequences of a queued press landing in that window: the accepted focus session runs on the long-break clock it never selected, its start timestamp is reset so `planSessionCompletion()` logs **nothing** (a finished focus silently produces no history row), the End confirmation becomes a no-op because it is gated on a live start timestamp, and the durable intent still claims the 25-minute focus that never ran — so a reload reconciles against a clock the UI never displayed. A second Start was already blocked by `startInFlightRef`, but the command bridge, the launcher suppression, and the visible configuration did not know about it.

This is a bounded safety pass on the session-claim boundary, not a redesign.

## What Changes

- Add an explicit lifecycle authority in `features/pomodoro/pomodoro.startup.ts`: `IDLE → STARTING → RUNNING → PAUSED`. Starting is a real session for every purpose — configuration is withdrawn, mode/preset/duration callbacks are no-ops, a second Start conflicts, the command bridge conflicts, and the command launcher stays suppressed.
- Guard every configuration mutation path synchronously against the live claims, so a stale render, a queued press, a keyboard event, or a callback captured before Start cannot rewrite a claimed session. Hiding the selector stays; the callback is now also safe.
- Freeze the preset that governs auto-start with the accepted session. A preset chosen while a session (including an in-flight startup) is active governs the **next** timer only.
- Classify the end-notification result honestly: a null id on web is unsupported by design, a null id on native is permission denied (start succeeds with an accurate warning), and a rejected scheduling call recovers to idle with no session, no durable intent, no orphan notification, and a startable timer.
- Close the inline duration editor synchronously when a start is accepted, so it can neither stay visible nor save mid-startup.
- Surface a failed startup with concise, accurate copy instead of an unhandled rejection, and return a truthful `failed` outcome to the command layer.

## Capabilities

### New Capabilities

- `focus-timer-startup-safety`: the explicit starting phase, the synchronous configuration guard, the frozen governing preset, the tri-state notification classification, and the failed-startup recovery path.

### Modified Capabilities

- `focus-session-safety`: extend "Active configuration cannot discard a session" to cover the starting phase, and state that a rejected startup leaves no session, intent, or orphan.
