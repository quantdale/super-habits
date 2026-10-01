/**
 * The command center's rendered surface, as a pure function of the Ask/Auto
 * rollout flag (OpenSpec change `harden-native-evidence-and-release-posture`,
 * task 4.1; spec requirement "Ask and Auto are default-off").
 *
 * WHY A MODULE: this repository has no component-render test library, and
 * `CLAUDE.md` restricts adding one. The spec is explicit that asserting the
 * CONSTANT is not enough — "the flag constant is preserved but the render
 * boundary regresses" must fail the coverage. So the decisions the render
 * boundary makes (which mode chips exist, which views can render, what a
 * restored mode resolves to) live here, are asserted directly, and are
 * CONSUMED by `ModeToggle.tsx` and `CommandScreen.tsx`. A refactor that renders
 * the selector unconditionally while leaving the constant alone now has to
 * bypass this module to do it, which is visible in the diff.
 *
 * Ask and Auto are hidden by default because they reach a paid model provider
 * through `askParser` / `callAskFunction`; Create is the ordinary path.
 */
import type { CommandMode } from './commandModePreference';

export type CommandModeOption = { value: CommandMode; label: string };

/** The mode an ordinary build starts and stays in. */
export const CREATE_ONLY_MODE: CommandMode = 'create';

/**
 * Every mode with its user-visible label. Ask and Auto are rollout-gated
 * because both issue paid provider requests; Create never does.
 */
const ALL_MODE_OPTIONS: readonly CommandModeOption[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'create', label: 'Create' },
  { value: 'auto', label: 'Auto' },
];

/** Modes whose views may only render behind the rollout flag. */
const ROLLOUT_ONLY_MODES: readonly CommandMode[] = ['ask', 'auto'];

/**
 * The mode chips the selector offers.
 *
 * @param askRolloutEnabled value of `AI_ASK_EXPERIMENT_ENABLED`
 */
export function commandModeOptions(askRolloutEnabled: boolean): CommandModeOption[] {
  return ALL_MODE_OPTIONS.filter(
    (option) => askRolloutEnabled || !ROLLOUT_ONLY_MODES.includes(option.value),
  ).map((option) => ({ ...option }));
}

/**
 * Whether a mode's view may render. Ask and Auto are unreachable in an
 * ordinary build, so no Ask or Auto view can be mounted at all.
 *
 * @param askRolloutEnabled value of `AI_ASK_EXPERIMENT_ENABLED`
 * @param mode
 */
export function canRenderCommandMode(askRolloutEnabled: boolean, mode: CommandMode): boolean {
  return askRolloutEnabled || !ROLLOUT_ONLY_MODES.includes(mode);
}

/**
 * Resolve the mode to render for, given a persisted "last used mode".
 *
 * A stored `ask`/`auto` from a rollout build must NOT restore the command
 * center into a hidden mode in an ordinary build: the selector would be absent
 * while the screen rendered a view nothing can leave. The stored value is
 * therefore collapsed to Create.
 *
 * @param askRolloutEnabled value of `AI_ASK_EXPERIMENT_ENABLED`
 * @param storedMode persisted last-used mode, if any
 */
export function resolveRenderedMode(
  askRolloutEnabled: boolean,
  storedMode: CommandMode | null | undefined,
): CommandMode {
  if (storedMode && canRenderCommandMode(askRolloutEnabled, storedMode)) return storedMode;
  return CREATE_ONLY_MODE;
}

/**
 * The full surface description, for assertions and for the render boundary.
 *
 * @param askRolloutEnabled value of `AI_ASK_EXPERIMENT_ENABLED`
 */
export function commandSurface(askRolloutEnabled: boolean): {
  askReachable: boolean;
  modeOptions: CommandModeOption[];
  renderableViews: CommandMode[];
  initialMode: CommandMode;
  /** True when a paid provider request is reachable from this surface. */
  paidProviderReachable: boolean;
} {
  const modeOptions = commandModeOptions(askRolloutEnabled);
  return {
    askReachable: askRolloutEnabled,
    modeOptions,
    renderableViews: modeOptions.map((option) => option.value),
    initialMode: CREATE_ONLY_MODE,
    // Ask and Auto are the only paths that call the model provider.
    paidProviderReachable: askRolloutEnabled,
  };
}
