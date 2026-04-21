import type {
  RestoreExecutionResult,
  RestorePreview,
} from "@/core/sync/restore.types";

const DEFAULT_BLOCKED_MESSAGE = "Restore is currently blocked on this device.";

type ResolveRestorePromptOutcomeInput = {
  result: RestoreExecutionResult;
  nextPreview: RestorePreview;
};

export type RestorePromptOutcome = {
  dismissPrompt: boolean;
  errorMessage: string | null;
};

function nonEmptyMessage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRestorePromptOutcome(
  input: ResolveRestorePromptOutcomeInput,
): RestorePromptOutcome {
  if (input.result.status === "restored") {
    return {
      dismissPrompt: true,
      errorMessage: null,
    };
  }

  const directBlockedMessage = nonEmptyMessage(
    input.result.preview.eligibility.message,
  );
  const refreshedBlockedMessage =
    input.nextPreview.eligibility.kind === "blocked"
      ? nonEmptyMessage(input.nextPreview.eligibility.message)
      : null;

  return {
    dismissPrompt: false,
    errorMessage:
      directBlockedMessage ?? refreshedBlockedMessage ?? DEFAULT_BLOCKED_MESSAGE,
  };
}
