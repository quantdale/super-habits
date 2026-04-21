import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { LinkedActionTargetPickerModal } from "@/core/linked-actions/LinkedActionTargetPickerModal";
import {
  applyLinkedActionTargetFeature,
  countLinkedActionEditorRowErrors,
  createEmptyLinkedActionEditorRow,
  getLinkedActionEffectDescription,
  getLinkedActionEffectLabel,
  getLinkedActionEffectOptionsForSource,
  getLinkedActionFeatureLabel,
  getLinkedActionTriggerLabel,
  getLinkedActionTriggerOptions,
  validateLinkedActionEditorRow,
} from "@/core/linked-actions/linkedActionsEditor.model";
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from "@/core/linked-actions/linkedActionsEditor.types";
import type {
  LinkedActionFeature,
  LinkedActionTriggerType,
} from "@/core/linked-actions/linkedActions.types";
import {
  LINKED_ACTION_SUPPORTED_TARGET_FEATURES,
} from "@/core/linked-actions/linkedActions.types";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { PillChip } from "@/core/ui/PillChip";
import { ValidationError } from "@/core/ui/ValidationError";
import {
  POMODORO_SECTION_KEY,
  SECTION_COLORS,
  SECTION_COLORS_LIGHT,
  SECTION_TEXT_COLORS,
} from "@/constants/sectionColors";

type Props = {
  sourceOptions: LinkedActionEditorSourceOption[];
  selectedSourceKey: string;
  rows: LinkedActionEditorRowDraft[];
  onRowsChange: (rows: LinkedActionEditorRowDraft[]) => void;
  onSourceKeyChange?: (key: string) => void;
  allowSourceSelection?: boolean;
  allowedTargetFeatures?: LinkedActionFeature[];
  allowedTriggerTypes?: LinkedActionTriggerType[];
  allowCreateNewTarget?: boolean;
  introTitle?: string;
  introDescription?: string;
};

type TargetPickerState = {
  rowId: string;
  initialFeature: LinkedActionFeature;
} | null;

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

function RuleRow({
  row,
  onChange,
  onOpenTargetPicker,
  onRemove,
  allowedTargetFeatures,
  allowedTriggerTypes,
  allowCreateNewTarget,
}: {
  row: LinkedActionEditorRowDraft;
  onChange: (next: LinkedActionEditorRowDraft) => void;
  onOpenTargetPicker: (rowId: string, feature: LinkedActionFeature) => void;
  onRemove: (rowId: string) => void;
  allowedTargetFeatures: LinkedActionFeature[];
  allowedTriggerTypes?: LinkedActionTriggerType[];
  allowCreateNewTarget: boolean;
}) {
  const { tokens } = useAppTheme();
  const router = useRouter();

  if (row.isUnsupported) {
    const unsupportedTargetSummary = row.unsupportedTarget
      ? `${row.unsupportedTarget.feature} / ${row.unsupportedTarget.entityType} / ${row.unsupportedTarget.effectType}`
      : "Stored target unavailable";

    return (
      <Card
        variant="header"
        accentColor={getFeatureAccentColor(row.sourceFeature)}
        headerTitle="Unsupported linked rule"
        headerSubtitle="Legacy rule kept for visibility only."
        headerRight={
          <Pressable onPress={() => onRemove(row.id)} hitSlop={8}>
            <Text className="text-xs font-semibold uppercase tracking-[1px]" style={{ color: "#ffffff" }}>
              Remove
            </Text>
          </Pressable>
        }
      >
        <View className="gap-4">
          <View
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: tokens.dangerBorder,
              backgroundColor: tokens.dangerBackground,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.dangerText }}>
              {row.unsupportedTarget?.message}
            </Text>
            <Text className="mt-2 text-sm" style={{ color: tokens.dangerText }}>
              Stored target: {unsupportedTargetSummary}
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium" style={{ color: tokens.text }}>
              Trigger
            </Text>
            <View
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                {row.triggerType ? getLinkedActionTriggerLabel(row.triggerType) : "Unknown trigger"}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                This row is disabled. Remove it, then add a new supported rule if needed.
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  }

  const triggerOptions = getLinkedActionTriggerOptions(row.sourceFeature).filter((option) =>
    allowedTriggerTypes ? allowedTriggerTypes.includes(option.value) : true,
  );
  const selectedTargetFeature = row.targetFeature;
  const effectOptions = selectedTargetFeature
    ? getLinkedActionEffectOptionsForSource({
        sourceFeature: row.sourceFeature,
        sourceEntityType: row.sourceEntityType,
        triggerType: row.triggerType,
        targetFeature: selectedTargetFeature,
      })
    : [];
  const selectedEffectDescription = row.effectType
    ? getLinkedActionEffectDescription(row.effectType)
    : null;
  const rowValidation =
    row.mode === "existing" && countLinkedActionEditorRowErrors(row) === 0
      ? {}
      : {
          ...validateLinkedActionEditorRow(row),
          targetSelection:
            !allowCreateNewTarget &&
            !row.isOrphaned &&
            !row.targetSelection &&
            validateLinkedActionEditorRow(row).targetSelection
              ? "Choose an existing target item."
              : validateLinkedActionEditorRow(row).targetSelection,
        };
  const validationErrors = Object.values(
    rowValidation,
  ).filter((value): value is string => Boolean(value));

  let targetSelectionSummary:
    | {
        title: string;
        description: string;
        actionLabel: string | null;
        actionPress: (() => void) | null;
      }
    | null = null;

  if (row.targetSelection?.kind === "existing") {
    targetSelectionSummary = {
      title: row.targetSelection.candidate.title,
      description:
        row.targetSelection.candidate.subtitle ??
        `Selected from ${getLinkedActionFeatureLabel(row.targetSelection.feature)}.`,
      actionLabel: null,
      actionPress: null,
    };
  } else if (row.targetSelection?.kind === "create_new") {
    const { handoff } = row.targetSelection;
    targetSelectionSummary = {
      title: handoff.title,
      description: handoff.description,
      actionLabel: handoff.ctaLabel,
      actionPress: () => router.push(handoff.destinationHref),
    };
  }
  const orphanedTargetSummary = row.orphanedTarget
    ? [
        row.orphanedTarget.feature,
        row.orphanedTarget.entityType,
        row.orphanedTarget.entityId ?? "unknown-target",
        row.orphanedTarget.effectType,
      ].join(" / ")
    : "Stored target unavailable";

  return (
    <Card
      variant="header"
      accentColor={getFeatureAccentColor(row.sourceFeature)}
      headerTitle={row.mode === "existing" ? "Linked rule" : "New linked rule"}
      headerSubtitle={
        row.triggerType
          ? `When ${getLinkedActionTriggerLabel(row.triggerType).toLowerCase()}, apply one explicit effect.`
          : "Build one explicit rule at a time."
      }
      headerRight={
        <Pressable onPress={() => onRemove(row.id)} hitSlop={8}>
          <Text className="text-xs font-semibold uppercase tracking-[1px]" style={{ color: "#ffffff" }}>
            Remove
          </Text>
        </Pressable>
      }
    >
      <View className="gap-4">
        {row.isOrphaned ? (
          <View
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: tokens.dangerBorder,
              backgroundColor: tokens.dangerBackground,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.dangerText }}>
              {row.orphanedTarget?.message}
            </Text>
            <Text className="mt-2 text-sm" style={{ color: tokens.dangerText }}>
              Stored target: {orphanedTargetSummary}
            </Text>
          </View>
        ) : null}

        <View>
          <Text className="mb-2 text-sm font-medium" style={{ color: tokens.text }}>
            Trigger
          </Text>
          <View className="flex-row flex-wrap">
            {triggerOptions.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                active={row.triggerType === option.value}
                color={getFeatureAccentColor(row.sourceFeature)}
                onPress={() => onChange({ ...row, triggerType: option.value })}
              />
            ))}
          </View>
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium" style={{ color: tokens.text }}>
            Target feature
          </Text>
          <View className="flex-row flex-wrap">
            {allowedTargetFeatures.map((feature) => (
              <PillChip
                key={feature}
                label={getLinkedActionFeatureLabel(feature)}
                active={row.targetFeature === feature}
                color={getFeatureAccentColor(feature)}
                onPress={() => onChange(applyLinkedActionTargetFeature(row, feature))}
              />
            ))}
          </View>
        </View>

        <View
          className="rounded-2xl border px-4 py-3"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Target item
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {row.isOrphaned
              ? row.orphanedTarget?.message
              : (targetSelectionSummary?.description ??
                  (allowCreateNewTarget
                    ? "Pick an existing target item or use the create-new handoff."
                    : "Pick an existing target item from the target feature."))}
          </Text>
          {targetSelectionSummary ? (
            <>
              <Text className="mt-3 text-sm font-semibold" style={{ color: tokens.text }}>
                {targetSelectionSummary.title}
              </Text>
              {targetSelectionSummary.actionLabel && targetSelectionSummary.actionPress ? (
                <View className="mt-3">
                  <Button
                    label={targetSelectionSummary.actionLabel}
                    onPress={targetSelectionSummary.actionPress}
                    variant="ghost"
                  />
                </View>
              ) : null}
            </>
          ) : null}
          <View className="mt-3">
            <Button
              label={
                row.isOrphaned
                  ? "Choose replacement target"
                  : row.targetSelection
                    ? "Change target item"
                    : "Choose target item"
              }
              onPress={() => onOpenTargetPicker(row.id, row.targetFeature ?? allowedTargetFeatures[0])}
              disabled={!row.targetFeature}
              color={row.targetFeature ? getFeatureAccentColor(row.targetFeature) : undefined}
            />
          </View>
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium" style={{ color: tokens.text }}>
            Effect
          </Text>
          {selectedTargetFeature ? (
            <>
              <View className="flex-row flex-wrap">
                {effectOptions.map((option) => (
                  <PillChip
                    key={option.value}
                    label={option.label}
                    active={row.effectType === option.value}
                    color={getFeatureAccentColor(selectedTargetFeature)}
                    onPress={() => onChange({ ...row, effectType: option.value })}
                  />
                ))}
              </View>
              {selectedEffectDescription ? (
                <View
                  className="mt-3 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: getFeatureAccentColor(selectedTargetFeature),
                    backgroundColor: getFeatureLightColor(selectedTargetFeature),
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: getFeatureTextColor(selectedTargetFeature) }}
                  >
                    {row.effectType ? getLinkedActionEffectLabel(row.effectType) : "Effect"}
                  </Text>
                  <Text
                    className="mt-1 text-sm"
                    style={{ color: getFeatureTextColor(selectedTargetFeature) }}
                  >
                    {selectedEffectDescription}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              Select a target feature first to see the allowed effects.
            </Text>
          )}
        </View>

        <ValidationError message={validationErrors[0] ?? null} />
      </View>
    </Card>
  );
}

export function LinkedActionsEditorSection({
  sourceOptions,
  selectedSourceKey,
  rows,
  onRowsChange,
  onSourceKeyChange,
  allowSourceSelection = true,
  allowedTargetFeatures = [...LINKED_ACTION_SUPPORTED_TARGET_FEATURES],
  allowedTriggerTypes,
  allowCreateNewTarget = true,
  introTitle = "Linked Actions",
  introDescription = "Build explicit rules by choosing a trigger, target item, and effect.",
}: Props) {
  const { tokens } = useAppTheme();
  const [targetPickerState, setTargetPickerState] = useState<TargetPickerState>(null);

  const selectedSource = useMemo(
    () => sourceOptions.find((option) => option.key === selectedSourceKey) ?? sourceOptions[0],
    [selectedSourceKey, sourceOptions],
  );

  if (!selectedSource) {
    return null;
  }

  const handleUpdateRow = (rowId: string, next: LinkedActionEditorRowDraft) => {
    onRowsChange(rows.map((row) => (row.id === rowId ? next : row)));
  };

  const handleRemoveRow = (rowId: string) => {
    onRowsChange(rows.filter((row) => row.id !== rowId));
  };

  const handleAddRow = () => {
    onRowsChange([...rows, createEmptyLinkedActionEditorRow(selectedSource)]);
  };

  const handleTargetSelected = (
    rowId: string,
    feature: LinkedActionFeature,
    targetSelection: NonNullable<LinkedActionEditorRowDraft["targetSelection"]>,
  ) => {
    onRowsChange(
      rows.map((row) =>
        row.id === rowId
          ? {
              ...applyLinkedActionTargetFeature(row, feature),
              targetSelection,
            }
          : row,
      ),
    );
  };

  const readyRuleCount = rows.filter((row) => countLinkedActionEditorRowErrors(row) === 0).length;
  const showSourceCard = allowSourceSelection || sourceOptions.length > 1;

  return (
    <View className="gap-3">
      <LinkedActionTargetPickerModal
        visible={targetPickerState !== null}
        onClose={() => setTargetPickerState(null)}
        initialFeature={targetPickerState?.initialFeature ?? allowedTargetFeatures[0]}
        allowedFeatures={allowedTargetFeatures}
        allowCreateNew={allowCreateNewTarget}
        onSelect={(targetSelection) => {
          if (!targetPickerState) return;
          const feature =
            targetSelection.kind === "existing"
              ? targetSelection.feature
              : targetSelection.handoff.feature;
          handleTargetSelected(targetPickerState.rowId, feature, targetSelection);
          setTargetPickerState(null);
        }}
      />

      <View
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
      >
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          {introTitle}
        </Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
          {introDescription}
        </Text>
      </View>

      {showSourceCard ? (
        <Card
          variant="header"
          accentColor={getFeatureAccentColor(selectedSource.feature)}
          headerTitle="Source item"
          headerSubtitle="Rules below are scoped to this source item."
        >
          <View className="gap-3">
            {sourceOptions.length > 1 && allowSourceSelection && onSourceKeyChange ? (
              <View className="flex-row flex-wrap">
                {sourceOptions.map((option) => (
                  <PillChip
                    key={option.key}
                    label={getLinkedActionFeatureLabel(option.feature)}
                    active={selectedSource.key === option.key}
                    color={getFeatureAccentColor(option.feature)}
                    onPress={() => onSourceKeyChange(option.key)}
                  />
                ))}
              </View>
            ) : null}
            <View
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                {selectedSource.label}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                {selectedSource.description}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card accentColor={getFeatureAccentColor(selectedSource.feature)}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            No linked rules yet
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            Add the first linked rule for this source item.
          </Text>
        </Card>
      ) : null}

      {rows.map((row) => (
        <RuleRow
          key={row.id}
          row={row}
          onChange={(next) => handleUpdateRow(row.id, next)}
          onOpenTargetPicker={(rowId, feature) =>
            setTargetPickerState({ rowId, initialFeature: feature })
          }
          onRemove={handleRemoveRow}
          allowedTargetFeatures={allowedTargetFeatures}
          allowedTriggerTypes={allowedTriggerTypes}
          allowCreateNewTarget={allowCreateNewTarget}
        />
      ))}

      <Button
        label={rows.length === 0 ? "Add linked action" : "Add another linked action"}
        onPress={handleAddRow}
        color={getFeatureAccentColor(selectedSource.feature)}
      />

      <Card accentColor={getFeatureAccentColor(selectedSource.feature)}>
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Draft validation
        </Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
          {readyRuleCount} of {rows.length} rules currently have the required trigger, target
          feature, target item, and effect.
        </Text>
      </Card>
    </View>
  );
}
