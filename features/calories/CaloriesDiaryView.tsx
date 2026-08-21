import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { SavedMealChips } from './SavedMealChips';
import { EntryMacroShareLine } from './EntryMacroShareLine';
import { filterSavedMeals } from './calories.domain';
import type { CalorieEntry, MealType, SavedMeal } from './types';

export type MealSection = {
  mealType: MealType;
  label: string;
  entries: CalorieEntry[];
  totalCalories: number;
};

function formatEntryTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMealCount(count: number) {
  return count === 1 ? '1 item' : `${count} items`;
}

function DiaryActionButton({
  icon,
  accessibilityLabel,
  color,
  backgroundColor,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  color: string;
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
      <MaterialIcons name={icon} size={18} color={color} />
    </Pressable>
  );
}

function DiaryMealGroupCard({
  section,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: MealSection;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (entry: CalorieEntry) => void;
  onDelete: (entry: CalorieEntry) => void;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  const colorText = sectionAccents.calories.text;

  return (
    <Card className="mb-3" innerClassName="p-0">
      <Pressable onPress={onToggle} className="px-4 py-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: sectionAccents.calories.tint }}
              >
                <Text className="text-xs font-semibold" style={{ color: colorText }}>
                  {section.label}
                </Text>
              </View>
              <Text className="text-xs font-medium" style={{ color: tokens.textMuted }}>
                {formatMealCount(section.entries.length)}
              </Text>
            </View>
            <Text className="mt-3 text-lg font-semibold" style={{ color: tokens.text }}>
              {section.totalCalories} kcal
            </Text>
          </View>
          <MaterialIcons
            name={collapsed ? 'expand-more' : 'expand-less'}
            size={22}
            color={tokens.iconMuted}
          />
        </View>
      </Pressable>

      {!collapsed ? (
        <View className="gap-3 border-t px-4 pb-4 pt-3" style={{ borderColor: tokens.border }}>
          {section.entries.map((entry) => (
            <View
              key={entry.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                      {entry.food_name}
                    </Text>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor: tokens.surface,
                        borderColor: tokens.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: colorText }}>
                        {entry.calories} kcal
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
                    P {entry.protein}g · C {entry.carbs}g · F {entry.fats}g · Fiber {entry.fiber}g
                  </Text>
                  <EntryMacroShareLine
                    protein={entry.protein}
                    carbs={entry.carbs}
                    fats={entry.fats}
                    fiber={entry.fiber}
                  />
                  <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                    Logged {formatEntryTimestamp(entry.created_at)}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <DiaryActionButton
                    icon="edit"
                    accessibilityLabel={`Edit ${entry.food_name}`}
                    color={colorText}
                    backgroundColor={tokens.surface}
                    onPress={() => onEdit(entry)}
                  />
                  <DiaryActionButton
                    icon="delete-outline"
                    accessibilityLabel={`Delete ${entry.food_name}`}
                    color={tokens.dangerText}
                    backgroundColor={tokens.dangerBackground}
                    onPress={() => onDelete(entry)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

type CaloriesDiaryViewProps = {
  accentColor: string;
  colorText: string;
  todayCard: ReactNode;
  recentMeals: SavedMeal[];
  allSavedMeals: SavedMeal[];
  groupedEntries: MealSection[];
  collapsedMeals: Partial<Record<MealType, boolean>>;
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onBrowseSavedMeals: () => void;
  onManualAdd: (query: string) => void;
  onToggleMealGroup: (mealType: MealType) => void;
  onEditEntry: (entry: CalorieEntry) => void;
  onDeleteEntry: (entry: CalorieEntry) => void;
};

const DiaryQuickAddSearch = memo(function DiaryQuickAddSearch({
  accentColor,
  allSavedMeals,
  onSelectSavedMeal,
  onBrowseSavedMeals,
  onManualAdd,
}: {
  accentColor: string;
  allSavedMeals: SavedMeal[];
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onBrowseSavedMeals: () => void;
  onManualAdd: (query: string) => void;
}) {
  const { tokens } = useAppTheme();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return filterSavedMeals(allSavedMeals, query).slice(0, 4);
  }, [allSavedMeals, query]);

  const handleSelect = (meal: SavedMeal) => {
    setQuery('');
    onSelectSavedMeal(meal);
  };

  return (
    <>
      <TextField
        label="Search saved meals / start with a food name"
        value={query}
        onChangeText={setQuery}
        placeholder="Chicken breast"
      />

      {query.trim() ? (
        matches.length > 0 ? (
          <View className="mb-3 gap-2">
            <Text className="text-xs font-semibold uppercase" style={{ color: tokens.textMuted }}>
              Matches
            </Text>
            {matches.map((meal) => (
              <Pressable
                key={meal.id}
                onPress={() => handleSelect(meal)}
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceElevated,
                }}
              >
                <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                  {meal.food_name}
                </Text>
                <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                  {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g
                  {meal.fiber > 0 ? ` · Fi ${meal.fiber}g` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View
            className="mb-3 rounded-2xl border px-4 py-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          >
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              No saved meal matches “{query.trim()}”. Use Manual add to log it as a new food.
            </Text>
          </View>
        )
      ) : null}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label="Browse saved"
            variant="ghost"
            disabled={allSavedMeals.length === 0}
            onPress={onBrowseSavedMeals}
          />
        </View>
        <View className="flex-1">
          <Button label="Manual add" onPress={() => onManualAdd(query)} color={accentColor} />
        </View>
      </View>
    </>
  );
});

const DiaryQuickAdd = memo(function DiaryQuickAdd({
  accentColor,
  allSavedMeals,
  recentMeals,
  onSelectSavedMeal,
  onBrowseSavedMeals,
  onManualAdd,
}: {
  accentColor: string;
  allSavedMeals: SavedMeal[];
  recentMeals: SavedMeal[];
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onBrowseSavedMeals: () => void;
  onManualAdd: (query: string) => void;
}) {
  const { tokens } = useAppTheme();

  return (
    <ScreenSection>
      <Card
        variant="header"
        accentColor={accentColor}
        headerTitle="Quick add"
        headerSubtitle="Recent foods, saved meals, search-first add, and manual entry."
        headerRight={<MaterialIcons name="playlist-add" size={22} color={tokens.textOnAccent} />}
        className="mb-0"
      >
        <SavedMealChips meals={recentMeals} onSelect={onSelectSavedMeal} />
        <DiaryQuickAddSearch
          accentColor={accentColor}
          allSavedMeals={allSavedMeals}
          onSelectSavedMeal={onSelectSavedMeal}
          onBrowseSavedMeals={onBrowseSavedMeals}
          onManualAdd={onManualAdd}
        />
      </Card>
    </ScreenSection>
  );
}, areDiaryQuickAddDataEqual);

function areDiaryQuickAddDataEqual(
  previous: Readonly<{
    accentColor: string;
    allSavedMeals: SavedMeal[];
    recentMeals: SavedMeal[];
    onSelectSavedMeal: (meal: SavedMeal) => void;
    onBrowseSavedMeals: () => void;
    onManualAdd: (query: string) => void;
  }>,
  next: Readonly<{
    accentColor: string;
    allSavedMeals: SavedMeal[];
    recentMeals: SavedMeal[];
    onSelectSavedMeal: (meal: SavedMeal) => void;
    onBrowseSavedMeals: () => void;
    onManualAdd: (query: string) => void;
  }>,
): boolean {
  return (
    previous.accentColor === next.accentColor &&
    previous.allSavedMeals === next.allSavedMeals &&
    previous.recentMeals === next.recentMeals
  );
}

export function CaloriesDiaryView({
  accentColor,
  colorText,
  todayCard,
  recentMeals,
  allSavedMeals,
  groupedEntries,
  collapsedMeals,
  onSelectSavedMeal,
  onBrowseSavedMeals,
  onManualAdd,
  onToggleMealGroup,
  onEditEntry,
  onDeleteEntry,
}: CaloriesDiaryViewProps) {
  const { tokens } = useAppTheme();

  return (
    <>
      <ScreenSection>{todayCard}</ScreenSection>

      <DiaryQuickAdd
        accentColor={accentColor}
        allSavedMeals={allSavedMeals}
        recentMeals={recentMeals}
        onSelectSavedMeal={onSelectSavedMeal}
        onBrowseSavedMeals={onBrowseSavedMeals}
        onManualAdd={onManualAdd}
      />

      <ScreenSection>
        {groupedEntries.length === 0 ? (
          <EmptyStateCard
            accentColor={accentColor}
            className="mb-0"
            icon={<MaterialIcons name="menu-book" size={22} color={colorText} />}
            title="No meals logged today"
            description="Use quick add or manual add to start your diary."
          />
        ) : (
          <>
            <View className="mb-4 px-1">
              <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                Daily log
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                Entries are grouped by stored meal type and default to expanded.
              </Text>
            </View>
            {groupedEntries.map((section) => (
              <DiaryMealGroupCard
                key={section.mealType}
                section={section}
                collapsed={collapsedMeals[section.mealType] ?? false}
                onToggle={() => onToggleMealGroup(section.mealType)}
                onEdit={onEditEntry}
                onDelete={onDeleteEntry}
              />
            ))}
          </>
        )}
      </ScreenSection>
    </>
  );
}
