## Context

W8 left one render-derived safety property in place. `PomodoroScreen.start()`
claimed its session synchronously but only became "active" for the rendered
surface after its end-notification await, and two configuration callbacks were
either unguarded (mode selector) or wrote their authority before checking it
(`handleSelectPreset`). The fix is to make the claim an explicit phase that
every reader consults, rather than something the render reconstructs.

## Goals / Non-Goals

- Goals: one session authority; every configuration path guarded against it
  synchronously; the governing preset frozen with the session; honest
  classification of a missing notification id; a defined recovery for a
  rejected startup; deterministic regression coverage.
- Non-Goals: any change to timer arithmetic, the durable-intent schema, the
  session engine, preset storage, or the Focus visual design.

## Decisions

### One authority, mirrored into refs and state

`resolveTimerPhase(claims)` derives the phase from two boolean claims the screen
owns in refs: `starting` (`startInFlightRef`) and `active` (`sessionActiveRef`).
`isStarting` is the rendered mirror of `starting`, exactly as `isRunning`/
`isPaused` already mirror the active clock. The screen already keeps seven such
ref/state mirrors, so this adds no new pattern and no second authority.

Claims are read rather than `isRunning`/`isPaused` state because the guarded
callbacks live in `useCallback`s (`start`, `handleSelectPreset`) whose closures
predate the session. A ref is live; a closure is not.

Render-time copy (headline, announcement, status) uses the rendered booleans,
which are always fresh in the render closure.

### The sequence is injectable, not hard-wired

`runTimerStartup(plan, env, effects)` performs the only asynchronous step and
takes the scheduler, the platform, the canceller, and the screen's own setters
as injected dependencies. That is what makes the deferred-scheduling race
exactly reproducible in a Node test with no production test switch: a test holds
the scheduling promise open and drives a mid-start mode change at it.

`planTimerStartup(request, config, now)` is pure and produces the single
snapshot — mode, duration, start timestamp, notification copy, and the durable
intent shape — that the clock, the notification, and the persisted intent all
read. Nothing downstream recomputes any of them.

### A missing notification id is not a failure

`classifyTimerEndSchedule(id, platform)` returns `scheduled`,
`unsupported` (web, where `scheduleTimerEndNotification` short-circuits), or
`permission-denied` (native with a null id). Only a rejected promise fails the
start. This replaces the previous `Platform.OS !== 'web' && id == null` heuristic
with an explicit tri-state, so a web start never warns and a native permission
refusal always does.

### Rejected startup recovers

A rejected scheduling call cancels anything it may have partially scheduled,
writes no durable intent, restores the idle clock, and shows one concise notice.
The alternative — starting the countdown without an end alert — would also leave
an incoherent durable intent, so recovering is the smaller and more honest
failure.

### The governing preset is frozen

`activePresetRef.current` is assigned in exactly two places (the direct write in
`handleSelectPreset` and the sync effect) and both are now gated on the live
claims. A preset chosen while a session — including an in-flight startup — is
active therefore governs the next timer, and the accepted session keeps the
preset it started with.

## Risks / Trade-offs

- The STARTING state is only user-visible on native (web resolves in a
  microtask). It is therefore rendered-inspectable only through assertions on
  its exact copy and its withdrawn configuration, not through a web screenshot;
  the W8.5 audit README records this explicitly rather than implying a capture
  exists.
- `FocusStartResult` gains a `failed` outcome, which widens a shared command
  contract by one variant. The alternative (reporting a rejected start as
  `started`) would hide a real failure from the command layer.

## Migration Plan

None. No schema change, no data migration, no new app_meta key.
