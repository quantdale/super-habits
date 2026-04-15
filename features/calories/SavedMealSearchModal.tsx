import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { Modal } from "@/core/ui/Modal";
import { filterSavedMeals } from "./calories.domain";
import { deleteSavedMeal } from "./calories.data";
import type { SavedMeal } from "./types";

type Props = {
  visible: boolean;
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
  onClose: () => void;
  onDeleted: () => void;
};

export function SavedMealSearchModal({
  visible,
  meals,
  onSelect,
  onClose,
  onDeleted,
}: Props) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<SavedMeal[]>(meals);

  useEffect(() => {
    setFiltered(filterSavedMeals(meals, query));
  }, [query, meals]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const handleDelete = (meal: SavedMeal) => {
    Alert.alert("Remove saved meal", `Remove "${meal.food_name}" from your saved meals?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteSavedMeal(meal.id);
          onDeleted();
        },
      },
    ]);
  };

  return (
    <Modal title="Saved meals" visible={visible} onClose={onClose} scroll>
      <View className="mb-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search meals..."
          className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-800 border border-slate-200"
          autoFocus
          clearButtonMode="while-editing"
        />
      </View>

      {filtered.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-base font-semibold text-slate-900">
            {query ? "No meals match your search" : "No saved meals yet"}
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            {query ? "Try a shorter search term." : "Meals you reuse will show up here."}
          </Text>
        </View>
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
              className="flex-row items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-800">{meal.food_name}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g
                  {meal.fiber > 0 ? ` · Fi ${meal.fiber}g` : ""}
                </Text>
              </View>
              <Text className="text-xs text-slate-300 ml-2">×{meal.use_count}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text className="mt-4 text-center text-xs text-slate-400">Long press a meal to remove it</Text>
    </Modal>
  );
}
