import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#355fe4",
        headerShown: false,
      }}
    >
      <Tabs.Screen name="todos" options={{ title: "Todos" }} />
      <Tabs.Screen name="habits" options={{ title: "Habits" }} />
      <Tabs.Screen name="pomodoro" options={{ title: "Focus" }} />
      <Tabs.Screen name="workout" options={{ title: "Workout" }} />
      <Tabs.Screen name="calories" options={{ title: "Calories" }} />
    </Tabs>
  );
}
