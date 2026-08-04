/**
 * The bounded injector set (`add-user-simulation-platform` task 2.3, design D4).
 *
 * Injectors are *decisions*, not UI automation: each one inspects a step and the
 * persona's behavior rates, samples the seeded rng, and records — into the
 * typed step log the engine appends to — whether a realistic imperfection
 * (double-tap, typo + correction, mid-form abandonment, offline toggle, tab-hide
 * during a running timer) should be applied to that step. The runner (task 3)
 * translates a logged injection into user-reachable actions; this module never
 * touches the UI, Playwright, or any runtime dependency.
 *
 * Who fires where is bounded by construction: each injector only applies to the
 * step kinds that make sense for its imperfection (e.g. `tab-hide` only on
 * `startPomodoro`; `typo-correction` only on typing forms). The engine applies
 * the overall `mistakeRate` gate per step, then each eligible injector decides
 * on its own rate; see `engine.ts` for the exact interaction.
 */

import type { BehaviorParams, InjectionKind, SemanticStep, SemanticStepName } from '../model/types';
import type { SeededRng } from './rng';

/** One recorded injection, appended to the engine's step log. */
export interface StepLogEntry {
  /** Index of the step the injection applies to (into the resolved sequence). */
  stepIndex: number;
  /** Which bounded imperfection fired. */
  kind: InjectionKind;
  /** Human-readable description for the run report / repro narrative. */
  description: string;
}

/** What an injector sees when deciding: the step, its index, and the persona. */
export interface InjectorContext {
  /** The step this decision is about. */
  step: SemanticStep;
  /** Index of the step in the resolved action sequence. */
  stepIndex: number;
  /** The persona's behavior parameters (rates, think time, ...). */
  behavior: BehaviorParams;
}

/** A single type/decision function in the bounded injector set. */
export interface Injector {
  /** The injection kind this injector decides. */
  readonly kind: InjectionKind;
  /** Whether this injector may fire on the given step kind. */
  appliesTo(step: SemanticStep): boolean;
  /** The persona rate this injector samples (its own `*Rate` field). */
  rate(behavior: BehaviorParams): number;
  /**
   * Decide whether to inject. Draws from the caller-provided rng and returns a
   * `StepLogEntry` when injecting, `null` otherwise. Pure — logging is the only
   * side effect of an accepted injection.
   */
  decide(context: InjectorContext, rng: SeededRng): StepLogEntry | null;
}

/* ------------------------------------------------------------------ */
/* Step-kind eligibility                                              */
/* ------------------------------------------------------------------ */

/** Kinds a double-tap can distort (submit controls / single-control actions). */
const DOUBLE_TAP_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>([
  'createTodo',
  'createHabit',
  'logCalories',
  'buildRoutine',
  'startPomodoro',
  'toggleTodo',
  'tickHabit',
]);

/** Kinds with a textual form a typo + correction can occur in. */
const TYPO_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>([
  'createTodo',
  'createHabit',
  'logCalories',
  'buildRoutine',
]);

/** Kinds with a multi-field form that can be abandoned mid-way. */
const ABANDONMENT_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>([
  'createTodo',
  'createHabit',
  'logCalories',
  'buildRoutine',
]);

/** Kinds where a connectivity toggle around the action is observable. */
const OFFLINE_TOGGLE_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>([
  'createTodo',
  'toggleTodo',
  'createHabit',
  'tickHabit',
  'logCalories',
  'buildRoutine',
  'startPomodoro',
]);

/** Kinds that run a timer worth hiding the tab during. */
const TAB_HIDE_STEPS: ReadonlySet<SemanticStepName> = new Set<SemanticStepName>(['startPomodoro']);

const inKind = (set: ReadonlySet<SemanticStepName>) => (step: SemanticStep) => set.has(step.kind);

/* ------------------------------------------------------------------ */
/* The bounded set                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build the canonical injector set, in decision order. The engine walks this
 * order per step and applies at most the first eligible injector that fires
 * (one mistake per action).
 */
export function createInjectors(): readonly Injector[] {
  const injectors: Injector[] = [
    {
      kind: 'double-tap',
      appliesTo: inKind(DOUBLE_TAP_STEPS),
      rate: (b) => b.doubleTapRate,
      decide(context, rng) {
        if (!this.appliesTo(context.step)) return null;
        if (!rng.chance(this.rate(context.behavior))) return null;
        return {
          stepIndex: context.stepIndex,
          kind: this.kind,
          description: `double-tapped the submit control of a ${context.step.kind} step`,
        };
      },
    },
    {
      kind: 'typo-correction',
      appliesTo: inKind(TYPO_STEPS),
      rate: (b) => b.typoRate,
      decide(context, rng) {
        if (!this.appliesTo(context.step)) return null;
        if (!rng.chance(this.rate(context.behavior))) return null;
        return {
          stepIndex: context.stepIndex,
          kind: this.kind,
          description: `typed a typo, corrected it, then submitted a ${context.step.kind} form`,
        };
      },
    },
    {
      kind: 'abandonment',
      appliesTo: inKind(ABANDONMENT_STEPS),
      rate: (b) => b.abandonmentRate,
      decide(context, rng) {
        if (!this.appliesTo(context.step)) return null;
        if (!rng.chance(this.rate(context.behavior))) return null;
        return {
          stepIndex: context.stepIndex,
          kind: this.kind,
          description: `abandoned the ${context.step.kind} form mid-way (no row written)`,
        };
      },
    },
    {
      kind: 'offline-toggle',
      appliesTo: inKind(OFFLINE_TOGGLE_STEPS),
      rate: (b) => b.offlineToggleRate,
      decide(context, rng) {
        if (!this.appliesTo(context.step)) return null;
        if (!rng.chance(this.rate(context.behavior))) return null;
        return {
          stepIndex: context.stepIndex,
          kind: this.kind,
          description: `toggled connectivity off/on around a ${context.step.kind} step`,
        };
      },
    },
    {
      kind: 'tab-hide',
      appliesTo: inKind(TAB_HIDE_STEPS),
      rate: (b) => b.tabHideRate,
      decide(context, rng) {
        if (!this.appliesTo(context.step)) return null;
        if (!rng.chance(this.rate(context.behavior))) return null;
        return {
          stepIndex: context.stepIndex,
          kind: this.kind,
          description: `hid the tab while the ${context.step.kind} timer runs`,
        };
      },
    },
  ];
  return injectors;
}
