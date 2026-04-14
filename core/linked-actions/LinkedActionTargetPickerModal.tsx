import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import { Modal } from "@/core/ui/Modal";
import { PillChip } from "@/core/ui/PillChip";
import {
  getLinkedActionTargetPickerProvider,
  getLinkedActionTargetPickerProviders,
} from "@/core/linked-actions/linkedActionsTargetProviders";
import {
  createLinkedActionTargetCreateNewSelection,
  createLinkedActionTargetExistingSelection,
  type LinkedActionTargetPickerCandidate,
  type LinkedActionTargetPickerSelection,
} from "@/core/linked-actions/linkedActionsTargetPicker.types";
import type { LinkedActionFeature } from "@/core/linked-actions/linkedActions.types";
import {
  POMODORO_SECTION_KEY,
  SECTION_COLORS,
  SECTION_COLORS_LIGHT,
  SECTION_TEXT_COLORS,
} from "@/constants/sectionColors";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type CandidateState = {
  status: "idle" | "loading" | "ready" | "error";
  items: LinkedActionTargetPickerCandidate[];
  error: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: LinkedActionTargetPickerSelection) => void;
  initialFeature?: LinkedActionFeature;
};

const MODULES = getLinkedActionTargetPickerProviders();

function getFeatureAccentColor(feature: LinkedActionFeature) {
  return feature === "pomodoro"
    ? SECTION_COLORS[POMODORO_SECTION_KEY]
    : SECTION_COLORS[feature];
}

function getFeatureLightColor(feature: LinkedActionFeature) {
  return feature === "pomodoro"
    ? SECTION_COLORS_LIGHT[POMODORO_SECTION_KEY]
    : SECTION_COLORS_LIGHT[feature];
}

function getFeatureTextColor(feature: LinkedActionFeature) {
  return feature === "pomodoro"
    ? SECTION_TEXT_COLORS[POMODORO_SECTION_KEY]
    : SECTION_TEXT_COLORS[feature];
}

export function LinkedActionTargetPickerModal({
  visible,
  onClose,
  onSelect,
  initialFeature = "todos",
}: Props) {
  const { tokens } = useAppTheme();
  const [selectedFeature, setSelectedFeature] = useState<LinkedActionFeature>(initialFeature);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [candidateState, setCandidateState] = useState<CandidateState>({
    status: "idle",
    items: [],
    error: null,
  });

  useEffect(() => {
    if (!visible) return;
    setSelectedFeature(initialFeature);
    setSelectedExistingId(null);
  }, [initialFeature, visible]);

  useEffect(() => {
    if (!visible) return;

    const provider = getLinkedActionTargetPickerProvider(selectedFeature);
    setSelectedExistingId(null);

    if (!provider.existing.supported) {
      setCandidateState({
        status: "ready",
        items: [],
        error: null,
      });
      return;
    }

    let cancelled = false;
    setCandidateState({
      status: "loading",
      items: [],
      error: null,
    });

    void provider.existing
      .loadCandidates()
      .then((items) => {
        if (cancelled) return;
        setCandidateState({
          status: "ready",
          items,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Could not load target candidates.";
        setCandidateState({
          status: "error",
          items: [],
          error: message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFeature, visible]);

  const provider = useMemo(
    () => getLinkedActionTargetPickerProvider(selectedFeature),
    [selectedFeature],
  );
  const accentColor = getFeatureAccentColor(selectedFeature);
  const lightColor = getFeatureLightColor(selectedFeature);
  const textColor = getFeatureTextColor(selectedFeature);
  const createNewHandoff = useMemo(
    () => provider.createNew.buildHandoff(),
    [provider],
  );
  const selectedCandidate = candidateState.items.find(
    (candidate) => candidate.id === selectedExistingId,
  );

  const handleUseExisting = () => {
    if (!selectedCandidate) return;
    onSelect(createLinkedActionTargetExistingSelection(provider, selectedCandidate));
    onClose();
  };

  const handleCreateNew = () => {
    onSelect(createLinkedActionTargetCreateNewSelection(createNewHandoff));
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Linked Actions target picker" scroll>
      <Card variant="header" accentColor={accentColor} headerTitle="Version 1 scaffold">
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          Choose a target module first, then either select an existing item or take an explicit
          create-new handoff. This foundation keeps the branch clear without pretending the full
          module-specific create flows are already wired.
        </Text>
      </Card>

      <Card accentColor={accentColor}>
        <Text className="mb-2 text-sm font-medium" style={{ color: tokens.text }}>
          Target module
        </Text>
        <View className="flex-row flex-wrap">
          {MODULES.map((module) => (
            <PillChip
              key={module.feature}
              label={module.moduleLabel}
              active={selectedFeature === module.feature}
              color={getFeatureAccentColor(module.feature)}
              onPress={() => setSelectedFeature(module.feature)}
            />
          ))}
        </View>
      </Card>

      <Card
        variant="header"
        accentColor={accentColor}
        headerTitle={provider.existing.title}
        headerSubtitle={`Use an existing ${provider.targetLabel} when the module already has one.`}
      >
        {provider.existing.supported ? (
          <>
            {candidateState.status === "loading" ? (
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                Loading existing {provider.targetLabel} options...
              </Text>
            ) : null}

            {candidateState.status === "error" ? (
              <View
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: tokens.dangerBorder, backgroundColor: tokens.dangerBackground }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.dangerText }}>
                  Could not load candidates
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.dangerText }}>
                  {candidateState.error}
                </Text>
              </View>
            ) : null}

            {candidateState.status === "ready" && candidateState.items.length === 0 ? (
              <View
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  {provider.existing.emptyTitle}
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  {provider.existing.emptyDescription}
                </Text>
              </View>
            ) : null}

            {candidateState.items.length > 0 ? (
              <View className="gap-2">
                {candidateState.items.map((candidate) => {
                  const selected = candidate.id === selectedExistingId;
                  return (
                    <Pressable
                      key={candidate.id}
                      onPress={() => setSelectedExistingId(candidate.id)}
                      className="rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: selected ? accentColor : tokens.border,
                        backgroundColor: selected ? lightColor : tokens.surface,
                      }}
                    >
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: selected ? textColor : tokens.text }}
                      >
                        {candidate.title}
                      </Text>
                      {candidate.subtitle ? (
                        <Text
                          className="mt-1 text-sm"
                          style={{ color: selected ? textColor : tokens.textMuted }}
                        >
                          {candidate.subtitle}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                <Button
                  label={`Use existing ${provider.targetLabel}`}
                  onPress={handleUseExisting}
                  disabled={!selectedCandidate}
                  color={accentColor}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View
            className="rounded-2xl border px-4 py-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              {provider.existing.emptyTitle}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {provider.existing.emptyDescription}
            </Text>
          </View>
        )}
      </Card>

      <Card
        variant="header"
        accentColor={accentColor}
        headerTitle={provider.createNew.title}
        headerSubtitle="Explicit handoff only in Version 1"
      >
        <View
          className="rounded-2xl border px-4 py-3"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            {createNewHandoff.title}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {provider.createNew.description}
          </Text>
          <Text className="mt-2 text-xs uppercase" style={{ color: textColor }}>
            Next step lives in {provider.moduleLabel}
          </Text>
        </View>

        <View className="mt-3">
          <Button label="Use create-new handoff" onPress={handleCreateNew} color={accentColor} />
        </View>
      </Card>
    </Modal>
  );
}
