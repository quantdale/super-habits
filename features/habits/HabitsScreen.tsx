import { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { Habit } from "@/core/db/types";
import {
  addHabit,
  deleteHabit,
  getHabitCountByDate,
  incrementHabit,
  listHabits,
} from "@/features/habits/habits.data";

export function HabitsScreen() {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("1");
  const [habits, setHabits] = useState<Habit[]>([]);

  const refresh = useCallback(() => setHabits(listHabits()), []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const completionMap = useMemo(() => {
    return Object.fromEntries(habits.map((habit) => [habit.id, getHabitCountByDate(habit.id)]));
  }, [habits]);

  const onAdd = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Enter a habit name.");
      return;
    }
    addHabit(name.trim(), Math.max(1, Number(target) || 1));
    setName("");
    setTarget("1");
    refresh();
  };

  return (
    <Screen scroll>
      <SectionTitle title="Habits" subtitle="Track daily consistency and streak inputs." />
      <Card>
        <TextField label="Habit name" value={name} onChangeText={setName} placeholder="Read 20 minutes" />
        <TextField
          label="Target per day"
          value={target}
          onChangeText={setTarget}
          keyboardType="numeric"
          placeholder="1"
        />
        <Button label="Create habit" onPress={onAdd} />
      </Card>

      {habits.map((habit) => {
        const todayCount = completionMap[habit.id] ?? 0;
        return (
          <Card key={habit.id}>
            <Text className="text-base font-semibold text-slate-900">{habit.name}</Text>
            <Text className="mt-1 text-sm text-slate-600">
              Today: {todayCount}/{habit.target_per_day}
            </Text>
            <View className="mt-3 gap-2">
              <Button
                label="Mark completion"
                onPress={() => {
                  incrementHabit(habit.id);
                  refresh();
                }}
              />
              <Button
                label="Delete habit"
                variant="danger"
                onPress={() => {
                  deleteHabit(habit.id);
                  refresh();
                }}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
