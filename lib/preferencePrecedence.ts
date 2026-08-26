/**
 * User-choice precedence guard for AsyncStorage-backed preferences.
 *
 * Invariant (F-05 / regression matrix 5 & 6): a persisted preference
 * hydration that resolves AFTER the user has explicitly chosen a value must
 * not overwrite the newer user choice. Until the user interacts, valid
 * persisted hydration still applies normally.
 *
 * This generalizes the Calories `viewChoiceMadeRef` pattern into a reusable,
 * framework-free primitive so the contract is deterministically testable and
 * harder to misuse.
 */
export type PreferencePrecedenceGuard = {
  markChoiceMade: () => void;
  hasChoiceBeenMade: () => boolean;
  shouldApplyPersisted: () => boolean;
};

export function createPreferencePrecedenceGuard(): PreferencePrecedenceGuard {
  let choiceMade = false;
  return {
    markChoiceMade: () => {
      choiceMade = true;
    },
    hasChoiceBeenMade: () => choiceMade,
    shouldApplyPersisted: () => !choiceMade,
  };
}
