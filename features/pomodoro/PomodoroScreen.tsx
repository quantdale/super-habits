import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import { listPomodoroSessions, logPomodoroSession } from "@/features/pomodoro/pomodoro.data";
import { PomodoroSession } from "@/core/db/types";
import { scheduleTimerEndNotification } from "@/lib/notifications";

const FOCUS_SECONDS = 25 * 60;

export function PomodoroScreen() {
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);

  useEffect(() => {
    listPomodoroSessions(8).then(setSessions);
  }, [historyVersion]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          const endedAt = new Date();
          if (startedAt) {
            logPomodoroSession(startedAt.toISOString(), endedAt.toISOString(), FOCUS_SECONDS, "focus");
            setHistoryVersion((v) => v + 1);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, startedAt]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  const start = async () => {
    const now = new Date();
    setStartedAt(now);
    setRemaining(FOCUS_SECONDS);
    setIsRunning(true);
    await scheduleTimerEndNotification(FOCUS_SECONDS, "Focus complete", "Great work. Time for a short break.");
  };

  return (
    <Screen scroll>
      <SectionTitle title="Pomodoro" subtitle="25-minute focus block with local session logs." />
      <Card>
        <Text className="text-center text-6xl font-bold text-slate-900">
          {minutes}:{seconds}
        </Text>
        <View className="mt-4 gap-2">
          <Button label={isRunning ? "Running..." : "Start focus"} onPress={start} />
          <Button
            label="Reset"
            variant="ghost"
            onPress={() => {
              setIsRunning(false);
              setRemaining(FOCUS_SECONDS);
            }}
          />
        </View>
      </Card>

      <SectionTitle title="Recent sessions" />
      {sessions.map((session) => (
        <Card key={session.id}>
          <Text className="text-sm text-slate-700">
            {new Date(session.started_at).toLocaleString()} - {Math.round(session.duration_seconds / 60)} min
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
