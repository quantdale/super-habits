import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
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

export function SavedMealSearchSheet({
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-5 pb-3 border-b border-slate-100">
          <Text className="text-base font-semibold text-slate-800">Saved meals</Text>
          <Pressable onPress={onClose}>
            <Text className="text-calories text-sm">Done</Text>
          </Pressable>
        </View>

        <View className="px-4 py-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search meals..."
            className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-800 border border-slate-200"
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView className="flex-1 px-4">
          {filtered.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-slate-400 text-sm">
                {query ? "No meals match your search" : "No saved meals yet"}
              </Text>
            </View>
          ) : (
            <View className="gap-2 pb-6">
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
        </ScrollView>

        <View className="px-4 pb-6">
          <Text className="text-xs text-slate-300 text-center">Long press a meal to remove it</Text>
        </View>
      </View>
    </Modal>
  );
}
