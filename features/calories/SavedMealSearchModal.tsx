import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
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
  const colorText = sectionAccents.calories.text;
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
            className="rounded-xl border px-3 py-2.5 text-sm"
            style={{
              backgroundColor: tokens.surfaceElevated,
              borderColor: tokens.border,
              color: tokens.text,
            }}
            autoFocus
            clearButtonMode="while-editing"
            placeholderTextColor={tokens.textMuted}
          />
        </View>

        {categories.length > 0 ? (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {[null, ...categories].map((category) => {
              const active = activeCategory === category;
              return (
                <Pressable
                  key={category ?? '__all__'}
                  onPress={() => setActiveCategory(category)}
                  accessibilityRole="button"
                  accessibilityLabel={category ? `Filter by ${category}` : 'Show all categories'}
                  accessibilityState={{ selected: active }}
                  className="rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: active ? sectionAccents.calories.text : tokens.border,
                    backgroundColor: active ? sectionAccents.calories.tint : tokens.surfaceElevated,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: active ? colorText : tokens.textMuted }}
                  >
                    {category ?? 'All'}
                  </Text>
                </Pressable>
              );
            })}
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
            icon={<Text style={{ fontSize: 22, color: sectionAccents.calories.text }}>⌕</Text>}
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
                className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
                style={{
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceElevated,
                }}
              >
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                      {parseMealCategory(meal.food_name).name}
                    </Text>
                    {parseMealCategory(meal.food_name).category ? (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: sectionAccents.calories.tint }}
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
