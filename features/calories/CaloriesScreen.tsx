import { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { CalorieEntry } from "@/core/db/types";
import {
  addCalorieEntry,
  deleteCalorieEntry,
  listCalorieEntries,
} from "@/features/calories/calories.data";
import { caloriesTotal } from "@/features/calories/calories.domain";

export function CaloriesScreen() {
  const [food, setFood] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [fiber, setFiber] = useState("");
  const [entries, setEntries] = useState<CalorieEntry[]>([]);

  const refresh = useCallback(() => {
    listCalorieEntries().then(setEntries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const total = useMemo(() => caloriesTotal(entries), [entries]);

  const onAdd = async () => {
    if (!food.trim()) {
      Alert.alert("Missing food", "Enter a food name.");
      return;
    }
    const calorieValue = Number(calories);
    if (!Number.isFinite(calorieValue) || calorieValue <= 0) {
      Alert.alert("Invalid calories", "Calories must be a positive number.");
      return;
    }

    await addCalorieEntry({
      foodName: food.trim(),
      calories: calorieValue,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      fiber: Number(fiber) || 0,
      mealType: "snack",
    });
    setFood("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
    setFiber("");
    refresh();
  };

  return (
    <Screen scroll>
      <SectionTitle title="Calories" subtitle="Manual nutrition entry for MVP." />
      <Card>
        <TextField label="Food" value={food} onChangeText={setFood} placeholder="Greek yogurt" />
        <TextField
          label="Calories"
          value={calories}
          onChangeText={setCalories}
          unsignedInteger
          placeholder="150"
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextField label="Protein (g)" value={protein} onChangeText={setProtein} unsignedInteger />
          </View>
          <View className="flex-1">
            <TextField label="Carbs (g)" value={carbs} onChangeText={setCarbs} unsignedInteger />
          </View>
          <View className="flex-1">
            <TextField label="Fats (g)" value={fats} onChangeText={setFats} unsignedInteger />
          </View>
        </View>
        <TextField label="Fiber (g)" value={fiber} onChangeText={setFiber} unsignedInteger placeholder="0" />
        <Button label="Add entry" onPress={onAdd} />
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-slate-900">Today total: {total} kcal</Text>
      </Card>

      {entries.map((entry) => (
        <Card key={entry.id}>
          <Text className="text-base font-semibold text-slate-900">
            {entry.food_name} - {entry.calories} kcal
          </Text>
          <Text className="mt-1 text-sm text-slate-600">
            P {entry.protein}g / C {entry.carbs}g / F {entry.fats}g / Fiber {entry.fiber}g
          </Text>
          <View className="mt-3">
            <Button
              label="Delete"
              variant="danger"
              onPress={async () => {
                await deleteCalorieEntry(entry.id);
                refresh();
              }}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
