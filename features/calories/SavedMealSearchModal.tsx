import { Text } from '@/core/ui/Text';
import { useMemo, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { PillChip } from '@/core/ui/PillChip';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { SECTION_COLORS } from '@/constants/sectionColors';
import {
  filterSavedMeals,
  listSavedMealCategories,
  parseMealCategory,
  sortSavedMealsForSearch,
} from './calories.domain';
import { deleteSavedMeal } from './calories.data';
import type { SavedMeal } from './types';

type Props = {
  visible: boolean;
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
  onClose: () => void;
  onDeleted: () => void;
};

export function SavedMealSearchModal({ visible, meals, onSelect, onClose, onDeleted }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = useMemo(() => listSavedMealCategories(meals), [meals]);
  const filtered = useMemo(() => {
    const matchingQuery = filterSavedMeals(meals, query);
    const byCategory = activeCategory
      ? matchingQuery.filter(
          (meal) => parseMealCategory(meal.food_name).category === activeCategory,
        )
      : matchingQuery;
    return sortSavedMealsForSearch(byCategory, query);
  }, [meals, query, activeCategory]);

  // Clear the search when the modal closes, without an effect:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setQuery('');
      setActiveCategory(null);
    }
  }

  const handleDelete = (meal: SavedMeal) => {
    void (async () => {
      const confirmed = await confirm({
        title: 'Remove saved meal',
        message: `Remove "${meal.food_name}" from your saved meals?`,
        confirmLabel: 'Remove',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      await deleteSavedMeal(meal.id);
      onDeleted();
    })();
  };

  return (
    <>
      <Modal title="Saved meals" visible={visible} onClose={onClose} scroll>
        <View className="mb-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search meals..."
            className="rounded-2xl border px-4 py-3 text-base"
            style={{
              minHeight: 48,
              backgroundColor: tokens.surfaceSunken,
              borderColor: tokens.border,
              color: tokens.text,
            }}
            autoFocus
            clearButtonMode="while-editing"
            placeholderTextColor={tokens.textMuted}
          />
        </View>

        {categories.length > 0 ? (
          <View className="mb-3 flex-row flex-wrap">
            {[null, ...categories].map((category) => (
              <PillChip
                key={category ?? '__all__'}
                label={category ?? 'All'}
                accessibilityLabel={category ? `Filter by ${category}` : 'Show all categories'}
                active={activeCategory === category}
                color={sectionAccents.calories.fill}
                onPress={() => setActiveCategory(category)}
              />
            ))}
          </View>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyStateCard
            accentColor={SECTION_COLORS.calories}
            className="mb-0"
            title={query ? 'No meals match your search' : 'No saved meals yet'}
            description={
              query ? 'Try a shorter search term.' : 'Meals you reuse will show up here.'
            }
          />
        ) : (
          <View className="gap-2 pb-2">
            {filtered.map((meal) => (
              <Pressable
                key={meal.id}
                onPress={() => {
                  onSelect(meal);
                  onClose();
                }}
                onLongPress={() => handleDelete(meal)}
                delayLongPress={500}
                className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: sectionAccents.calories.tint }}
              >
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                      {parseMealCategory(meal.food_name).name}
                    </Text>
                    {parseMealCategory(meal.food_name).category ? (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: tokens.surface }}
                      >
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: sectionAccents.calories.text }}
                        >
                          {parseMealCategory(meal.food_name).category}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                    {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g
                    {meal.fiber > 0 ? ` · Fi ${meal.fiber}g` : ''}
                  </Text>
                </View>
                <View
                  className="ml-3 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: tokens.surface }}
                >
                  <Text className="text-[11px] font-semibold" style={{ color: tokens.textMuted }}>
                    ×{meal.use_count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text className="mt-4 text-center text-xs" style={{ color: tokens.textMuted }}>
          Long press a meal to remove it
        </Text>
      </Modal>
      {confirmationDialog}
    </>
  );
}
