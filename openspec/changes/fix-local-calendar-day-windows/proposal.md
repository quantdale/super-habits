## Why

Four read paths compute the start of an inclusive "last N days" window by subtracting a fixed 86,400,000 ms (or the equivalent literal) from the current instant and converting to a local date key. In a timezone that observes daylight saving, that arithmetic is wrong for part of one day each year: on the morning after a spring-forward transition the local day is 23 hours long, so `now − (N−1)·86 400 000` lands one calendar day earlier than intended, and because every consumer uses an inclusive lower bound the window silently spans N+1 local days. The repository already forbids this exact pattern in its own archived design note and already states the rule in `openspec/specs/productivity-expansion-hardening`, but that requirement is scoped to Progress periods, so these four sites violate a written invariant with no regression coverage at the boundary.

## What Changes

- Replace the fixed-24-hour window arithmetic with local-calendar arithmetic in `features/goals/goals.data.ts`, `features/daily-plan/dailyPlan.data.ts`, and the two sites in `features/projects/projects.data.ts`, using the same `setDate`-based helper the repository already sanctions in `lib/time.ts`, `dailyPlan.domain.ts`, and the workout screen.
- Add regression coverage that pins each affected rollup and window at a spring-forward and a fall-back boundary in a DST-observing timezone, so the inclusive window spans exactly N local days.
- Remove the direct `Date.now()` calls from these read paths so a seeded corpus evaluates against the seeded day rather than the wall clock, matching the deterministic-fixture convention the integration seeders already use.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `productivity-expansion-hardening`: Extend the calendar-dates requirement so that every inclusive "last N local days" window — not only Progress periods — is computed by local-calendar arithmetic and is covered at a DST boundary.

## Impact

Touches three data-layer files and their tests. No schema change, no migration, no user-visible behavior change outside a DST boundary, and no change to any existing date-key format or ordering. Applying it removes one incorrect day of history from goal, daily-plan, and project rollups once a year, and makes those rollups deterministic under the existing seeded fixtures.
