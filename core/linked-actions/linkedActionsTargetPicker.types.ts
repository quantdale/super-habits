import type { Href } from "expo-router";
import type {
  LinkedActionFeature,
  LinkedActionTargetEntityType,
} from "@/core/linked-actions/linkedActions.types";

export type LinkedActionTargetPickerCandidate = {
  id: string;
  title: string;
  subtitle?: string;
};

export type LinkedActionTargetCreateNewHandoff = {
  kind: "module_handoff";
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  title: string;
  description: string;
  ctaLabel: string;
  destinationHref: Href;
};

export type LinkedActionTargetPickerExistingConfig = {
  supported: boolean;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  loadCandidates: () => Promise<LinkedActionTargetPickerCandidate[]>;
};

export type LinkedActionTargetPickerCreateNewConfig = {
  title: string;
  description: string;
  buildHandoff: () => LinkedActionTargetCreateNewHandoff;
};

export type LinkedActionTargetPickerProvider = {
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  moduleLabel: string;
  targetLabel: string;
  existing: LinkedActionTargetPickerExistingConfig;
  createNew: LinkedActionTargetPickerCreateNewConfig;
};

export type LinkedActionTargetPickerSelection =
  | {
      kind: "existing";
      feature: LinkedActionFeature;
      entityType: LinkedActionTargetEntityType;
      candidate: LinkedActionTargetPickerCandidate;
    }
  | {
      kind: "create_new";
      handoff: LinkedActionTargetCreateNewHandoff;
    };

export function createLinkedActionTargetExistingSelection(
  provider: Pick<LinkedActionTargetPickerProvider, "feature" | "entityType">,
  candidate: LinkedActionTargetPickerCandidate,
): LinkedActionTargetPickerSelection {
  return {
    kind: "existing",
    feature: provider.feature,
    entityType: provider.entityType,
    candidate,
  };
}

export function createLinkedActionTargetCreateNewSelection(
  handoff: LinkedActionTargetCreateNewHandoff,
): LinkedActionTargetPickerSelection {
  return {
    kind: "create_new",
    handoff,
  };
}
