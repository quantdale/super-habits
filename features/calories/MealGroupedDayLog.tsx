import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { Text } from '@/core/ui/Text';
import type { CalorieEntry, MealType } from './types';

export type MealGroup = {
  mealType: MealType;
  label: string;
  entries: CalorieEntry[];
  totalCalories: number;
};

/** Material glyph per meal group: emoji-free, icon-led section headers. */
const MEAL_ICONS: Record<MealType, keyof typeof MaterialIcons.glyphMap> = {
  breakfast: 'free-breakfast',
  lunch: 'lunch-dining',
  dinner: 'dinner-dining',
  snack: 'cookie',
};

function EntryActionButton({
  icon,
  accessibilityLabel,
  iconColor,
  backgroundColor,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  iconColor: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-11 items-center justify-center rounded-2xl border"
      style={{ borderColor: tokens.border, backgroundColor }}
    >
      <MaterialIcons name={icon} size={18} color={iconColor} />
    </Pressable>
  );
}

function formatMealCount(count: number) {
  return count === 1 ? '1 item' : `${count} items`;
}

const CalorieEntryRow = memo(
  function CalorieEntryRow({
    entry,
    onEdit,
    onDelete,
  }: {
    entry: CalorieEntry;
    onEdit: (entry: CalorieEntry) => void;
    onDelete: (entry: CalorieEntry) => void;
  }) {
    const { tokens, sectionAccents } = useAppTheme();

    return (
      <View className="flex-row items-center gap-3 px-4 py-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
            <Text variant="bodyMd" className="min-w-0 flex-1" numberOfLines={2}>
              {entry.food_name}
            </Text>
            <Text variant="label" style={{ color: sectionAccents.calories.text }}>
              {entry.calories} kcal
            </Text>
          </View>
          <Text variant="caption" tone="muted" className="mt-0.5">
            P {entry.protein}g · C {entry.carbs}g · F {entry.fats}g · Fiber {entry.fiber}g
          </Text>
        </View>
        <View className="flex-row gap-2">
          <EntryActionButton
            icon="edit"
            accessibilityLabel={`Edit ${entry.food_name}`}
            iconColor={sectionAccents.calories.text}
            backgroundColor={tokens.surface}
            onPress={() => onEdit(entry)}
          />
          <EntryActionButton
            icon="delete-outline"
            accessibilityLabel={`Delete ${entry.food_name}`}
            iconColor={tokens.dangerText}
            backgroundColor={tokens.dangerBackground}
            onPress={() => onDelete(entry)}
          />
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.entry.id === next.entry.id &&
    prev.entry.food_name === next.entry.food_name &&
    prev.entry.calories === next.entry.calories &&
    prev.entry.protein === next.entry.protein &&
    prev.entry.carbs === next.entry.carbs &&
    prev.entry.fats === next.entry.fats &&
    prev.entry.fiber === next.entry.fiber &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete,
);

function MealGroupCard({
  section,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: MealGroup;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (entry: CalorieEntry) => void;
  onDelete: (entry: CalorieEntry) => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();

  return (
    <Card className="mb-3" innerClassName="p-0">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${section.label} meals`}
        accessibilityState={{ expanded: !collapsed }}
        className="flex-row items-center gap-3 px-4 py-3"
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: sectionAccents.calories.tint }}
        >
          <MaterialIcons
            name={MEAL_ICONS[section.mealType]}
            size={22}
            color={sectionAccents.calories.text}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="titleMd">{section.label}</Text>
          <Text variant="caption" tone="muted">
            {formatMealCount(section.entries.length)}
          </Text>
        </View>
        <Text variant="label" style={{ color: sectionAccents.calories.text }}>
          {section.totalCalories} kcal
        </Text>
        <MaterialIcons
          name={collapsed ? 'expand-more' : 'expand-less'}
          size={22}
          color={tokens.iconMuted}
        />
      </Pressable>

      {!collapsed ? (
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.border }}>
          {section.entries.map((entry, index) => (
            <View
              key={entry.id}
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: tokens.border } : undefined}
            >
              <CalorieEntryRow entry={entry} onEdit={onEdit} onDelete={onDelete} />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

type Props = {
  groups: MealGroup[];
  collapsedMeals: Partial<Record<MealType, boolean>>;
  accentColor: string;
  /** Optional single action for the empty state (diary mode offers manual add). */
  emptyAction?: ReactNode;
  onToggleGroup: (mealType: MealType) => void;
  onEditEntry: (entry: CalorieEntry) => void;
  onDeleteEntry: (entry: CalorieEntry) => void;
};

/**
 * The day's entries grouped by meal (V3 W10). One shared anatomy for both
 * Form and Diary modes: meal header with item count and kcal total, compact
 * entry rows with immediately accessible Edit/Delete actions (no swipe
 * gesture required), and a quiet empty state. The caller owns the enclosing
 * screen section (and its `Daily log` accessibility label).
 */
export function MealGroupedDayLog({
  groups,
  collapsedMeals,
  accentColor,
  emptyAction,
  onToggleGroup,
  onEditEntry,
  onDeleteEntry,
}: Props) {
  return (
    <>
      {groups.length === 0 ? (
        <EmptyStateCard
          accentColor={accentColor}
          className="mb-0"
          title="No meals logged on this day"
          description="Log food above, or copy a previous day to start this one."
        >
          {emptyAction}
        </EmptyStateCard>
      ) : (
        groups.map((section) => (
          <MealGroupCard
            key={section.mealType}
            section={section}
            collapsed={collapsedMeals[section.mealType] ?? false}
            onToggle={() => onToggleGroup(section.mealType)}
            onEdit={onEditEntry}
            onDelete={onDeleteEntry}
          />
        ))
      )}
    </>
  );
}
