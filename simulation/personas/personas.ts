/**
 * The six parent personas (`add-user-simulation-platform` task 6.1).
 *
 * These are the typed personas of the parent change
 * `add-real-world-user-simulation-testing` (design § User Personas): Maya the
 * Daily Driver (P1), Tom the Weekend Returner (P2), Priya the Power User (P3),
 * Sam the Error-Prone User (P4), Alex the Commuter (P5), and Jordan the New
 * Device Migrator (P6).
 *
 * Each persona maps its parent-described risks/rates onto `BehaviorParams`
 * (design D4): the error-prone persona carries high mistake/double-tap/typo/
 * abandonment rates; the commuter carries a high `offlineToggleRate` +
 * `tabHideRate`; the daily driver gets short sessions and near-zero failure
 * rates; the power user gets long sessions and pomodoro/workout/command
 * affinity. `deterministic` run mode forces every rate to 0 regardless.
 *
 * Every persona is exported individually (the runner's library loader collects
 * entity-shaped exports) AND via the `PERSONAS` record (task 6.1 requirement).
 */

import { definePersona } from '../model/builders';
import type { Persona } from '../model/types';

/** P1 — Maya: opens the app 5–10x/day for short mobile-web pops; leaves the tab open. */
export const dailyDriver = definePersona({
  id: 'daily-driver',
  name: 'Maya, the Daily Driver',
  description:
    'Opens the app 5–10 times a day, mostly mobile web, 30-second pops. Ticks habits, adds a todo, logs a meal. Leaves the tab open all day. Careful and fast; rarely makes mistakes.',
  goals: [
    'tick the habit rings every morning',
    'capture todos as they come to mind',
    'log meals without friction',
    'keep the tab open across the whole day',
  ],
  behavior: {
    thinkTime: { mu: 6.2, sigma: 0.4, minMs: 150, maxMs: 3000 },
    mistakeRate: 0.05,
    doubleTapRate: 0.02,
    typoRate: 0.03,
    abandonmentRate: 0.02,
    offlineToggleRate: 0,
    tabHideRate: 0,
    sessionLength: { minMinutes: 2, maxMinutes: 15 },
    featureAffinity: { habits: 3, todos: 3, calories: 2, overview: 2, pomodoro: 2 },
  },
  traits: ['frequent', 'mobile-web', 'tab-open-all-day'],
});

/** P2 — Tom: bursts of use separated by long gaps; returns to months of data. */
export const weekendReturner = definePersona({
  id: 'weekend-returner',
  name: 'Tom, the Weekend Returner',
  description:
    'Uses the app in bursts, disappears for two to three weeks, comes back to months of accumulated data. Reads aggregates and streaks more than he writes.',
  goals: [
    'check how the month went across every feature',
    'understand streak recomputation after gaps',
    'browse the calorie diary and saved meals',
  ],
  behavior: {
    thinkTime: { mu: 6.6, sigma: 0.5, minMs: 200, maxMs: 5000 },
    mistakeRate: 0.04,
    doubleTapRate: 0.01,
    typoRate: 0.03,
    abandonmentRate: 0.03,
    offlineToggleRate: 0.01,
    tabHideRate: 0,
    sessionLength: { minMinutes: 10, maxMinutes: 45 },
    featureAffinity: { overview: 3, habits: 3, calories: 3, todos: 2 },
  },
  traits: ['bursty', 'data-heavy', 'reader'],
});

/** P3 — Priya: runs Pomodoros while planning workouts and wiring linked actions. */
export const powerUser = definePersona({
  id: 'power-user',
  name: 'Priya, the Power User',
  description:
    'Runs a Pomodoro while planning workouts, wires linked actions between features, uses recurring tasks and the command center. Long, block-focused sessions.',
  goals: [
    'chain features with linked actions',
    'schedule focus sessions around workouts',
    'tune settings and defaults',
  ],
  behavior: {
    thinkTime: { mu: 6.4, sigma: 0.5, minMs: 150, maxMs: 4500 },
    mistakeRate: 0.06,
    doubleTapRate: 0.02,
    typoRate: 0.02,
    abandonmentRate: 0.02,
    offlineToggleRate: 0.01,
    tabHideRate: 0.06,
    sessionLength: { minMinutes: 15, maxMinutes: 60 },
    featureAffinity: { pomodoro: 3, workout: 3, todos: 3, command: 2, calories: 2 },
  },
  traits: ['power', 'linked-actions', 'command-center'],
});

/** P4 — Sam: double-taps, submits empty forms, deletes the wrong item, reloads mid-save. */
export const errorProneUser = definePersona({
  id: 'error-prone-user',
  name: 'Sam, the Error-Prone User',
  description:
    'Double-taps, submits empty forms, deletes the wrong item, edits a stale card, reloads mid-save, retries after an error. Produces duplicate-write detection, validation recovery, destructive-operation confirmation/cancel paths, and mid-flight interruption.',
  goals: [
    'get the app to accept exactly one of everything',
    'recover from empty/over-length submissions',
    'cancel destructive actions before it is too late',
  ],
  behavior: {
    thinkTime: { mu: 5.8, sigma: 0.6, minMs: 120, maxMs: 4000 },
    mistakeRate: 0.35,
    doubleTapRate: 0.3,
    typoRate: 0.25,
    abandonmentRate: 0.2,
    offlineToggleRate: 0.05,
    tabHideRate: 0.05,
    sessionLength: { minMinutes: 5, maxMinutes: 20 },
    featureAffinity: { todos: 3, habits: 3, calories: 2, workout: 2 },
  },
  traits: ['error-prone', 'double-taps', 'destructive'],
});

/** P5 — Alex: uses the app on the train with no connectivity; reconnects at the office. */
export const commuter = definePersona({
  id: 'commuter',
  name: 'Alex, the Commuter',
  description:
    'Uses the app on the train with no connectivity and reconnects at the office. Kills the browser tab regularly. Produces outbox accumulation and durability across restart, backoff behaviour, reconnect flush, and integrity checks.',
  goals: [
    'capture todos, habits and meals while offline',
    'never lose a write across the tunnel gap',
    'sync everything once back on the network',
  ],
  behavior: {
    thinkTime: { mu: 6.5, sigma: 0.5, minMs: 200, maxMs: 5000 },
    mistakeRate: 0.08,
    doubleTapRate: 0.03,
    typoRate: 0.04,
    abandonmentRate: 0.04,
    offlineToggleRate: 0.5,
    tabHideRate: 0.1,
    sessionLength: { minMinutes: 3, maxMinutes: 15 },
    featureAffinity: { todos: 3, habits: 3, calories: 2, overview: 2 },
  },
  traits: ['offline', 'train', 'tab-killer'],
});

/** P6 — Jordan: installs the PWA fresh with a backup available; hits the restore prompt. */
export const newDeviceMigrator = definePersona({
  id: 'new-device-migrator',
  name: 'Jordan, the New Device Migrator',
  description:
    'Has a backup from an old device; installs the PWA fresh; hits the restore prompt. Sometimes dismisses it and adds a todo first. Produces restore eligibility lifecycle, the local-only-data disclosure gap, soft-deleted-rows-look-empty behaviour, and dismissal-signature persistence.',
  goals: [
    'get the old data back onto the new device',
    'understand the restore disclosures',
    'decide whether to restore now or later',
  ],
  behavior: {
    thinkTime: { mu: 6.5, sigma: 0.5, minMs: 200, maxMs: 5000 },
    mistakeRate: 0.05,
    doubleTapRate: 0.02,
    typoRate: 0.03,
    abandonmentRate: 0.02,
    offlineToggleRate: 0.02,
    tabHideRate: 0,
    sessionLength: { minMinutes: 5, maxMinutes: 20 },
    featureAffinity: { settings: 3, overview: 3, todos: 2, habits: 2 },
  },
  traits: ['restore', 'first-run', 'settings'],
});

/** The library's canonical `PERSONAS` record (task 6.1), keyed by persona id. */
export const PERSONAS: Record<string, Persona> = {
  'daily-driver': dailyDriver,
  'weekend-returner': weekendReturner,
  'power-user': powerUser,
  'error-prone-user': errorProneUser,
  commuter,
  'new-device-migrator': newDeviceMigrator,
};
