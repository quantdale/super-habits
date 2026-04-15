import {
  createLinkedActionEditorRowFromRule,
} from "@/core/linked-actions/linkedActionsEditor.model";
import {
  getLinkedActionTargetPickerProvider,
} from "@/core/linked-actions/linkedActionsTargetProviders";
import {
  createLinkedActionTargetExistingSelection,
  type LinkedActionTargetPickerCandidate,
} from "@/core/linked-actions/linkedActionsTargetPicker.types";
import type {
  LinkedActionEditorRowDraft,
} from "@/core/linked-actions/linkedActionsEditor.types";
import type {
  LinkedActionFeature,
  LinkedActionRuleDefinition,
} from "@/core/linked-actions/linkedActions.types";

export async function buildLinkedActionEditorRowsFromRules(
  rules: LinkedActionRuleDefinition[],
): Promise<LinkedActionEditorRowDraft[]> {
  const candidatesByFeature = new Map<
    LinkedActionFeature,
    Promise<LinkedActionTargetPickerCandidate[]>
  >();

  return Promise.all(
    rules.map(async (rule) => {
      let targetSelection = null;

      if (!rule.isUnsupported && rule.target.entityId) {
        const provider = getLinkedActionTargetPickerProvider(rule.target.feature);
        if (provider.existing.supported) {
          let candidatesPromise = candidatesByFeature.get(rule.target.feature);
          if (!candidatesPromise) {
            candidatesPromise = provider.existing.loadCandidates();
            candidatesByFeature.set(rule.target.feature, candidatesPromise);
          }
          const candidates = await candidatesPromise;
          const candidate = candidates.find((item) => item.id === rule.target.entityId) ?? null;
          targetSelection = candidate
            ? createLinkedActionTargetExistingSelection(provider, candidate)
            : null;
        }
      }

      return createLinkedActionEditorRowFromRule({
        rule,
        targetSelection,
      });
    }),
  );
}
