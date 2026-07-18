import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Modal } from '@/core/ui/Modal';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { SECTION_COLORS, SECTION_TEXT_COLORS } from '@/constants/sectionColors';
import { filterSavedMeals } from './calories.domain';
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
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<SavedMeal[]>(meals);

  useEffect(() => {
    setFiltered(filterSavedMeals(meals, query));
  }, [query, meals]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

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

        {filtered.length === 0 ? (
          <EmptyStateCard
            accentColor={SECTION_COLORS.calories}
            className="mb-0"
            title={query ? 'No meals match your search' : 'No saved meals yet'}
            description={
              query ? 'Try a shorter search term.' : 'Meals you reuse will show up here.'
            }
            icon={<Text style={{ fontSize: 22, color: SECTION_TEXT_COLORS.calories }}>⌕</Text>}
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
                  <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                    {meal.food_name}
                  </Text>
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
