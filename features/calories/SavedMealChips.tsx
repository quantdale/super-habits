import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import type { SavedMeal } from "./types";

type Props = {
  meals: SavedMeal[];
  onSelect: (meal: SavedMeal) => void;
};

export function SavedMealChips({ meals, onSelect }: Props) {
  if (meals.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="text-xs text-slate-400 mb-1.5">Recent</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row gap-2">
          {meals.map((meal) => (
            <Pressable
              key={meal.id}
              onPress={() => onSelect(meal)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white flex-row items-center gap-1"
            >
              <Text className="text-sm text-slate-700">{meal.food_name}</Text>
              <Text className="text-xs text-slate-400">{meal.calories} cal</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
