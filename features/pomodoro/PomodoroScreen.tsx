import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import { listPomodoroSessions, logPomodoroSession } from "@/features/pomodoro/pomodoro.data";
import type { PomodoroSession } from "./types";
import {
  cancelScheduledNotification,
  scheduleTimerEndNotification,
} from "@/lib/notifications";

const FOCUS_SECONDS = 25 * 60;

const NOTIFY_TITLE = "Focus complete";
const NOTIFY_BODY = "Great work. Time for a short break.";

export function PomodoroScreen() {
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const notificationIdRef = useRef<string | null>(null);

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
          void cancelScheduledNotification(notificationIdRef.current);
          notificationIdRef.current = null;
          const endedAt = new Date();
          if (startedAt) {
            void logPomodoroSession(
              startedAt.toISOString(),
              endedAt.toISOString(),
              FOCUS_SECONDS,
              "focus",
            ).catch((err) => {
              console.error("[PomodoroScreen] logPomodoroSession failed", err);
            });
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

  const canStartFresh =
    !isRunning && (remaining === FOCUS_SECONDS || remaining === 0);
  const canResume = !isRunning && remaining > 0 && remaining < FOCUS_SECONDS;

  const startFresh = async () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    const now = new Date();
    setStartedAt(now);
    setRemaining(FOCUS_SECONDS);
    const id = await scheduleTimerEndNotification(FOCUS_SECONDS, NOTIFY_TITLE, NOTIFY_BODY);
    notificationIdRef.current = id;
    setIsRunning(true);
  };

  const pause = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    setIsRunning(false);
  };

  const resume = async () => {
    const id = await scheduleTimerEndNotification(remaining, NOTIFY_TITLE, NOTIFY_BODY);
    notificationIdRef.current = id;
    setIsRunning(true);
  };

  const reset = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    setIsRunning(false);
    setRemaining(FOCUS_SECONDS);
    setStartedAt(null);
  };

  return (
    <Screen scroll>
      <SectionTitle title="Pomodoro" subtitle="25-minute focus block with local session logs." />
      <Card>
        <Text className="text-center text-6xl font-bold text-slate-900">
          {minutes}:{seconds}
        </Text>
        <View className="mt-4 gap-2">
          {canStartFresh ? (
            <Button label="Start focus" onPress={startFresh} />
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Pause" variant="ghost" disabled={!isRunning} onPress={pause} />
            </View>
            <View className="flex-1">
              <Button label="Resume" variant="ghost" disabled={!canResume} onPress={resume} />
            </View>
          </View>
          <Button label="Reset" variant="ghost" onPress={reset} />
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
