import { useState } from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { Button } from '@/core/ui/Button';
import { Text } from '@/core/ui/Text';
import { DiaryQuickAddSearch, CalorieQuickLogCard } from './CalorieQuickLogCard';
import { CopyDayModal, DiaryDayNavigator } from './DiaryDayNavigator';
import { MealGroupedDayLog } from './MealGroupedDayLog';
import type { MealGroup } from './MealGroupedDayLog';
import type { FrequentFood } from './calories.domain';
import type { CalorieEntry, DailySummary, MealType, SavedMeal } from './types';

type Props = {
  accentColor: string;
  recentMeals: SavedMeal[];
  frequentFoods: FrequentFood[];
  allSavedMeals: SavedMeal[];
  groups: MealGroup[];
  collapsedMeals: Partial<Record<MealType, boolean>>;
  /** Diary day selection owned by CaloriesScreen; entries follow it. */
  selectedDateKey: string;
  /** Daily summaries (ASC by dateKey) feeding the navigator's logged dots. */
  summaries: DailySummary[];
  /** Last copy-day outcome, surfaced as inline status text. */
  copyStatus: string | null;
  onSelectSavedMeal: (meal: SavedMeal) => void;
  onSelectFrequentFood: (food: FrequentFood) => void;
  onQuickAddKcal: (kcal: number) => Promise<void>;
  onBrowseSavedMeals: () => void;
  onManualAdd: (query: string) => void;
  onToggleGroup: (mealType: MealType) => void;
  onSelectDate: (dateKey: string) => void;
  onCopyFromDay: (sourceDateKey: string) => void;
  onEditEntry: (entry: CalorieEntry) => void;
  onDeleteEntry: (entry: CalorieEntry) => void;
};

/**
 * Diary mode (V3 W10): the day-oriented view. Quick add (recent/frequent
 * chips, kcal quick add, search-first add) sits above the day navigator, and
 * the meal-grouped day log follows with copy-day beside the navigator. The
 * daily summary and macro summary are owned by the screen so both modes share
 * them.
 */
export function CaloriesDiaryView({
  accentColor,
  recentMeals,
  frequentFoods,
  allSavedMeals,
  groups,
  collapsedMeals,
  selectedDateKey,
  summaries,
  copyStatus,
  onSelectSavedMeal,
  onSelectFrequentFood,
  onQuickAddKcal,
  onBrowseSavedMeals,
  onManualAdd,
  onToggleGroup,
  onSelectDate,
  onCopyFromDay,
  onEditEntry,
  onDeleteEntry,
}: Props) {
  const { tokens } = useAppTheme();
  const [copyModalVisible, setCopyModalVisible] = useState(false);

  return (
    <>
      <CalorieQuickLogCard
        accentColor={accentColor}
        recentMeals={recentMeals}
        frequentFoods={frequentFoods}
        savedMealCount={allSavedMeals.length}
        onSelectSavedMeal={onSelectSavedMeal}
        onSelectFrequentFood={onSelectFrequentFood}
        onQuickAddKcal={onQuickAddKcal}
        onBrowseSavedMeals={onBrowseSavedMeals}
      >
        <DiaryQuickAddSearch
          accentColor={accentColor}
          allSavedMeals={allSavedMeals}
          onSelectSavedMeal={onSelectSavedMeal}
          onBrowseSavedMeals={onBrowseSavedMeals}
          onManualAdd={onManualAdd}
        />
      </CalorieQuickLogCard>

      <ScreenSection accessibilityLabel="Daily log">
        <View className="mb-3">
          <DiaryDayNavigator
            selectedDateKey={selectedDateKey}
            summaries={summaries}
            onSelectDate={onSelectDate}
            onCopyDay={() => setCopyModalVisible(true)}
          />
          {copyStatus ? (
            <Text
              className="mt-2 px-1 text-xs"
              style={{ color: tokens.textMuted }}
              accessibilityLabel="Copy day status"
            >
              {copyStatus}
            </Text>
          ) : null}
        </View>
        <MealGroupedDayLog
          groups={groups}
          collapsedMeals={collapsedMeals}
          accentColor={accentColor}
          emptyAction={
            <Button
              label="Add entry"
              icon="add"
              color={accentColor}
              onPress={() => onManualAdd('')}
            />
          }
          onToggleGroup={onToggleGroup}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
        />
      </ScreenSection>

      <CopyDayModal
        visible={copyModalVisible}
        summaries={summaries}
        targetDateKey={selectedDateKey}
        onCopy={onCopyFromDay}
        onClose={() => setCopyModalVisible(false)}
      />
    </>
  );
}
