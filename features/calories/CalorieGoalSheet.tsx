import React, { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView } from "react-native";
import { Button } from "@/core/ui/Button";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
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

  useEffect(() => {
    if (!visible) return;
    setCalories(String(currentGoal.calories));
    setProtein(String(currentGoal.protein));
    setCarbs(String(currentGoal.carbs));
    setFats(String(currentGoal.fats));
  }, [visible, currentGoal]);

  const handleSave = () => {
    onSave({
      calories: Number(calories) || 2000,
      protein: Number(protein) || 150,
      carbs: Number(carbs) || 200,
      fats: Number(fats) || 65,
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
          onChange={setCalories}
          min={500}
          max={6000}
        />
        <NumberStepperField label="Protein (g)" value={protein} onChange={setProtein} min={0} max={500} />
        <NumberStepperField label="Carbs (g)" value={carbs} onChange={setCarbs} min={0} max={800} />
        <NumberStepperField label="Fats (g)" value={fats} onChange={setFats} min={0} max={400} />
        <View className="gap-3 mt-6">
          <Button label="Save goals" onPress={handleSave} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}
