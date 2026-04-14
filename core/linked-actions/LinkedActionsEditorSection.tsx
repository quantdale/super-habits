import { useEffect, useMemo, useState } from "react";
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
  getLinkedActionEffectOptions,
  getLinkedActionFeatureLabel,
  getLinkedActionTriggerLabel,
  getLinkedActionTriggerOptions,
} from "@/core/linked-actions/linkedActionsEditor.model";
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from "@/core/linked-actions/linkedActionsEditor.types";
import type { LinkedActionFeature } from "@/core/linked-actions/linkedActions.types";
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
  onSourceKeyChange: (key: string) => void;
  initialRows: LinkedActionEditorRowDraft[];
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
}: {
  row: LinkedActionEditorRowDraft;
  onChange: (next: LinkedActionEditorRowDraft) => void;
  onOpenTargetPicker: (rowId: string, feature: LinkedActionFeature) => void;
  onRemove: (rowId: string) => void;
}) {
  const { tokens } = useAppTheme();
  const router = useRouter();
  const triggerOptions = getLinkedActionTriggerOptions(row.sourceFeature);
  const targetFeatures = ["todos", "habits", "calories", "workout", "pomodoro"] as const;
  const selectedTargetFeature = row.targetFeature;
  const effectOptions = selectedTargetFeature
    ? getLinkedActionEffectOptions(selectedTargetFeature)
    : [];
  const selectedEffectDescription = row.effectType
    ? getLinkedActionEffectDescription(row.effectType)
    : null;
  const validationErrors = Object.values(
    row.mode === "existing" && countLinkedActionEditorRowErrors(row) === 0
      ? {}
      : {
          triggerType: row.triggerType ? null : "Select a trigger.",
          targetFeature: row.targetFeature ? null : "Select a target feature.",
          targetSelection: row.targetSelection
            ? null
            : "Choose an existing target item or a create-new handoff.",
          effectType: row.effectType ? null : "Select an effect.",
        },
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

  return (
    <Card
      variant="header"
      accentColor={getFeatureAccentColor(row.sourceFeature)}
      headerTitle={row.mode === "existing" ? "Existing linked rule" : "New linked rule"}
      headerSubtitle={
        row.triggerType
          ? `When ${getLinkedActionTriggerLabel(row.triggerType).toLowerCase()}, apply one explicit effect.`
          : "Build one manual rule at a time."
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
            {targetFeatures.map((feature) => (
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
            {targetSelectionSummary?.description ??
              "Pick an existing target item or take the explicit Version 1 create-new handoff."}
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
              label={row.targetSelection ? "Change target item" : "Choose target item"}
              onPress={() => onOpenTargetPicker(row.id, row.targetFeature ?? "todos")}
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
  onSourceKeyChange,
  initialRows,
}: Props) {
  const { tokens } = useAppTheme();
  const [rows, setRows] = useState<LinkedActionEditorRowDraft[]>(initialRows);
  const [targetPickerState, setTargetPickerState] = useState<TargetPickerState>(null);

  const selectedSource = useMemo(
    () => sourceOptions.find((option) => option.key === selectedSourceKey) ?? sourceOptions[0],
    [selectedSourceKey, sourceOptions],
  );

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows, selectedSourceKey]);

  if (!selectedSource) {
    return null;
  }

  const handleUpdateRow = (rowId: string, next: LinkedActionEditorRowDraft) => {
    setRows((current) => current.map((row) => (row.id === rowId ? next : row)));
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const handleAddRow = () => {
    setRows((current) => [...current, createEmptyLinkedActionEditorRow(selectedSource)]);
  };

  const handleTargetSelected = (
    rowId: string,
    feature: LinkedActionFeature,
    targetSelection: NonNullable<LinkedActionEditorRowDraft["targetSelection"]>,
  ) => {
    setRows((current) =>
      current.map((row) =>
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

  return (
    <View className="gap-3">
      <LinkedActionTargetPickerModal
        visible={targetPickerState !== null}
        onClose={() => setTargetPickerState(null)}
        initialFeature={targetPickerState?.initialFeature ?? "todos"}
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
          Version 1 editor scaffold
        </Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
          Explicit, manual, and rule-based. This preview keeps linked actions local to the editor
          and intentionally defers the full effect-detail flows.
        </Text>
      </View>

      <Card
        variant="header"
        accentColor={getFeatureAccentColor(selectedSource.feature)}
        headerTitle="Source item"
        headerSubtitle="Switch the source feature to inspect a different manual rule context."
      >
        <View className="gap-3">
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

      {rows.length === 0 ? (
        <Card accentColor={getFeatureAccentColor(selectedSource.feature)}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            No linked rules yet
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            Add the first explicit rule for this source item.
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
          {readyRuleCount} of {rows.length} rules currently have the minimum required fields:
          trigger, target feature, target item, and effect.
        </Text>
      </Card>
    </View>
  );
}
