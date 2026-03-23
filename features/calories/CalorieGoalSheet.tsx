import React, { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView } from "react-native";
import { Button } from "@/core/ui/Button";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
import { ValidationError } from "@/core/ui/ValidationError";
import { validateCalorieGoal } from "@/lib/validation";
import type { CalorieGoal } from "./calories.data";

type Props = {
  visible: boolean;
  currentGoal: CalorieGoal;
  onSave: (goal: CalorieGoal) => void;
  onClose: () => void;
};

export function CalorieGoalSheet({ visible, currentGoal, onSave, onClose }: Props) {
  const [calories, setCalories] = useState(String(currentGoal.calories));
  const [protein, setProtein] = useState(String(currentGoal.protein));
  const [carbs, setCarbs] = useState(String(currentGoal.carbs));
  const [fats, setFats] = useState(String(currentGoal.fats));
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCalories(String(currentGoal.calories));
    setProtein(String(currentGoal.protein));
    setCarbs(String(currentGoal.carbs));
    setFats(String(currentGoal.fats));
    setGoalError(null);
  }, [visible, currentGoal]);

  const handleSave = () => {
    const err = validateCalorieGoal(calories, protein, carbs, fats);
    if (err) {
      setGoalError(err);
      return;
    }
    setGoalError(null);
    onSave({
      calories: Number(calories.trim()),
      protein: Number(protein.trim()),
      carbs: Number(carbs.trim()),
      fats: Number(fats.trim()),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView className="flex-1 bg-white p-6">
        <Text className="text-lg font-semibold text-slate-800 mb-1">Daily goals</Text>
        <Text className="text-sm text-slate-400 mb-6">Set your daily calorie and macro targets.</Text>
        <NumberStepperField
          label="Calories (kcal)"
          value={calories}
          onChange={(v) => {
            setGoalError(null);
            setCalories(v);
          }}
          min={500}
          max={6000}
        />
        <NumberStepperField
          label="Protein (g)"
          value={protein}
          onChange={(v) => {
            setGoalError(null);
            setProtein(v);
          }}
          min={0}
          max={999}
        />
        <NumberStepperField
          label="Carbs (g)"
          value={carbs}
          onChange={(v) => {
            setGoalError(null);
            setCarbs(v);
          }}
          min={0}
          max={999}
        />
        <NumberStepperField
          label="Fats (g)"
          value={fats}
          onChange={(v) => {
            setGoalError(null);
            setFats(v);
          }}
          min={0}
          max={999}
        />
        <ValidationError message={goalError} />
        <View className="gap-3 mt-6">
          <Button label="Save goals" onPress={handleSave} />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setGoalError(null);
              onClose();
            }}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}
