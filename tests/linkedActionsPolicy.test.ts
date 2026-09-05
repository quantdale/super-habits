import { describe, expect, it } from 'vitest';
import {
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
  LINKED_ACTION_FEATURES,
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
} from '@/core/linked-actions/linkedActions.enums';
import {
  isLinkedActionEffectAuthoringSupported,
  isLinkedActionEffectEngineSupported,
  isLinkedActionTargetEntityAuthoringSupported,
  isLinkedActionTargetFeatureAuthoringSupported,
  isLinkedActionTargetFeatureEngineSupported,
  isLinkedActionTriggerAuthoringSupported,
  isLinkedActionTriggerEngineSupported,
} from '@/core/linked-actions/linkedActions.policy';
import { LINKED_ACTION_SUPPORTED_RULE_PATHS } from '@/core/linked-actions/linkedActions.supportedPaths';

/**
 * E5 closure (Functional Completion V1, design D6): the policy labels and the
 * supported rule-path whitelist are two views of one truth. Execution gating
 * is the path table; these contracts fail loudly if a future change flips one
 * side without the other, which is exactly how the old contradiction survived.
 */

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

const ALL_TRIGGERS = uniqueValues(
  Object.values(LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY).flatMap((types) => [...types]),
);
const ALL_TARGET_FEATURES = [...LINKED_ACTION_FEATURES];
const ALL_TARGET_ENTITIES = uniqueValues(
  Object.values(LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE).flatMap((types) => [...types]),
);
const ALL_EFFECTS = uniqueValues(
  Object.values(LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY).flatMap((types) => [...types]),
);

describe('linked actions policy ↔ path parity', () => {
  it('never labels a component visible without implemented engine support (and vice versa)', () => {
    for (const triggerType of ALL_TRIGGERS) {
      expect(isLinkedActionTriggerAuthoringSupported(triggerType)).toBe(
        isLinkedActionTriggerEngineSupported(triggerType),
      );
    }
    for (const feature of ALL_TARGET_FEATURES) {
      expect(isLinkedActionTargetFeatureAuthoringSupported(feature)).toBe(
        isLinkedActionTargetFeatureEngineSupported(feature),
      );
    }
    for (const effectType of ALL_EFFECTS) {
      expect(isLinkedActionEffectAuthoringSupported(effectType)).toBe(
        isLinkedActionEffectEngineSupported(effectType),
      );
    }
  });

  it('keeps visible components exactly on the supported rule-path whitelist', () => {
    const pathTriggers = uniqueValues(LINKED_ACTION_SUPPORTED_RULE_PATHS.map((p) => p.triggerType));
    const pathFeatures = uniqueValues(
      LINKED_ACTION_SUPPORTED_RULE_PATHS.map((p) => p.targetFeature),
    );
    const pathEntities = uniqueValues(
      LINKED_ACTION_SUPPORTED_RULE_PATHS.map((p) => p.targetEntityType),
    );
    const pathEffects = uniqueValues(LINKED_ACTION_SUPPORTED_RULE_PATHS.map((p) => p.effectType));

    expect(ALL_TRIGGERS.filter((t) => isLinkedActionTriggerAuthoringSupported(t)).sort()).toEqual(
      pathTriggers.sort(),
    );
    expect(
      ALL_TARGET_FEATURES.filter((f) => isLinkedActionTargetFeatureAuthoringSupported(f)).sort(),
    ).toEqual(pathFeatures.sort());
    expect(
      ALL_TARGET_ENTITIES.filter((e) => isLinkedActionTargetEntityAuthoringSupported(e)).sort(),
    ).toEqual(pathEntities.sort());
    expect(ALL_EFFECTS.filter((e) => isLinkedActionEffectAuthoringSupported(e)).sort()).toEqual(
      pathEffects.sort(),
    );
  });

  it('keeps triggers with no data-layer emission honestly hidden', () => {
    // Wave 6 audit: only todo.completed and habit.completed_for_day dispatch
    // processSourceAction today. Enabling these requires shipping emission.
    for (const triggerType of [
      'calorie.entry_logged',
      'workout.completed',
      'pomodoro.focus_completed',
      'habit.progress_incremented',
    ] as const) {
      expect(isLinkedActionTriggerAuthoringSupported(triggerType)).toBe(false);
      expect(isLinkedActionTriggerEngineSupported(triggerType)).toBe(false);
      expect(
        LINKED_ACTION_SUPPORTED_RULE_PATHS.map((path) => path.triggerType as string),
      ).not.toContain(triggerType);
    }
  });

  it('exposes the exactly-once-proven log targets on every emitted trigger', () => {
    for (const [effectType, feature, entity] of [
      ['calorie.log', 'calories', 'calorie_log'],
      ['pomodoro.log', 'pomodoro', 'pomodoro_session'],
    ] as const) {
      expect(isLinkedActionEffectAuthoringSupported(effectType)).toBe(true);
      expect(isLinkedActionTargetFeatureAuthoringSupported(feature)).toBe(true);
      expect(isLinkedActionTargetEntityAuthoringSupported(entity)).toBe(true);
      for (const triggerType of ['todo.completed', 'habit.completed_for_day']) {
        expect(
          LINKED_ACTION_SUPPORTED_RULE_PATHS.some(
            (path) =>
              path.triggerType === triggerType &&
              path.targetFeature === feature &&
              path.effectType === effectType,
          ),
        ).toBe(true);
      }
    }
  });
});
