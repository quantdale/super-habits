import { useEffect, useRef, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import {
  listPomodoroSessions,
  logPomodoroSession,
  getPomodoroSettings,
  savePomodoroSettings,
} from "@/features/pomodoro/pomodoro.data";
import type { PomodoroSession } from "./types";
import {
  cancelScheduledNotification,
  scheduleTimerEndNotification,
} from "@/lib/notifications";
import {
  buildPomodoroActivityDays,
  calculateGrowthProgress,
  DEFAULT_SETTINGS,
  getModeColor,
  getModeDuration,
  getModeLabel,
  getNextMode,
  getPlantStage,
  type PomodoroMode,
  type PomodoroSettings,
} from "./pomodoro.domain";
import { ActivityPreviewStrip, type ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { FocusSprout } from "./FocusSprout";
import { GardenGrid } from "./GardenGrid";
import { BackgroundWarning } from "./BackgroundWarning";
import { PomodoroSettingsInline } from "./PomodoroSettingsInline";

function notifyCopy(mode: PomodoroMode): { title: string; body: string } {
  switch (mode) {
    case "focus":
      return { title: "Focus complete", body: "Great work. Time for a short break." };
    case "short_break":
      return { title: "Break complete", body: "Ready for another focus session." };
    case "long_break":
      return { title: "Long break complete", body: "Start a new focus round when you are ready." };
  }
}

export function PomodoroScreen() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [currentMode, setCurrentMode] = useState<PomodoroMode>("focus");
  const [completedFocus, setCompletedFocus] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SETTINGS.focusMinutes * 60);
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [pomodoroActivityDays, setPomodoroActivityDays] = useState<ActivityDay[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const notificationIdRef = useRef<string | null>(null);

  const currentModeRef = useRef<PomodoroMode>("focus");
  const completedFocusRef = useRef(0);
  const settingsRef = useRef<PomodoroSettings>(DEFAULT_SETTINGS);
  const totalSecondsRef = useRef(DEFAULT_SETTINGS.focusMinutes * 60);
  const startedAtRef = useRef<Date | null>(null);

  currentModeRef.current = currentMode;
  completedFocusRef.current = completedFocus;
  settingsRef.current = settings;
  totalSecondsRef.current = totalSeconds;
  startedAtRef.current = startedAt;

  useEffect(() => {
    getPomodoroSettings().then((s) => {
      setSettings(s);
      const d = getModeDuration("focus", s);
      setTotalSeconds(d);
      setRemaining(d);
    });
  }, []);

  useEffect(() => {
    listPomodoroSessions(30).then((s) => {
      setSessions(s);
      setPomodoroActivityDays(buildPomodoroActivityDays(s, 30));
    });
  }, [historyVersion]);

  useEffect(() => {
    if (!isRunning) return;

    const handleVisibilityChange = () => {
      if (document.hidden && isRunning) {
        setShowWarning(true);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [isRunning]);

  useEffect(() => {
    if (remaining === 0 && !isRunning) {
      setShowWarning(false);
    }
  }, [remaining, isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          setIsPaused(false);
          void cancelScheduledNotification(notificationIdRef.current);
          notificationIdRef.current = null;

          const mode = currentModeRef.current;
          const settingsNow = settingsRef.current;
          const totalSec = totalSecondsRef.current;
          const started = startedAtRef.current;

          if (mode === "focus" && started) {
            const endedAt = new Date();
            void logPomodoroSession(
              started.toISOString(),
              endedAt.toISOString(),
              totalSec,
              "focus",
            ).catch((err) => {
              console.error("[PomodoroScreen] logPomodoroSession failed", err);
            });
            setHistoryVersion((v) => v + 1);
            const nextCompleted = completedFocusRef.current + 1;
            setCompletedFocus(nextCompleted);
            completedFocusRef.current = nextCompleted;
          }

          if (mode === "long_break") {
            setCompletedFocus(0);
            completedFocusRef.current = 0;
          }

          const nextMode = getNextMode(mode, completedFocusRef.current, settingsNow);
          const nextDuration = getModeDuration(nextMode, settingsNow);

          setCurrentMode(nextMode);
          currentModeRef.current = nextMode;
          setTotalSeconds(nextDuration);
          totalSecondsRef.current = nextDuration;
          setStartedAt(null);
          startedAtRef.current = null;
          setShowWarning(false);

          return nextDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const modeColors = getModeColor(currentMode);
  const growthProgress = calculateGrowthProgress(remaining, totalSeconds);
  const plantStage = getPlantStage(growthProgress);
  const showSprout =
    currentMode === "focus" && (isRunning || remaining < totalSeconds);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  const startLabel =
    currentMode === "focus" ? "Start focus" : `Start ${getModeLabel(currentMode).toLowerCase()}`;

  const handleSaveSettings = async (newSettings: PomodoroSettings) => {
    await savePomodoroSettings(newSettings);
    setSettings(newSettings);
    const duration = getModeDuration(currentMode, newSettings);
    setTotalSeconds(duration);
    setRemaining(duration);
    setIsRunning(false);
    setIsPaused(false);
    setShowSettings(false);
  };

  const start = async () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    const now = new Date();
    const duration = getModeDuration(currentMode, settings);
    setStartedAt(now);
    startedAtRef.current = now;
    setRemaining(duration);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    const { title, body } = notifyCopy(currentMode);
    const id = await scheduleTimerEndNotification(duration, title, body);
    notificationIdRef.current = id;
    setIsRunning(true);
    setIsPaused(false);
    setShowSettings(false);
  };

  const pause = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    setIsRunning(false);
    setIsPaused(true);
  };

  const resume = async () => {
    const { title, body } = notifyCopy(currentMode);
    const id = await scheduleTimerEndNotification(remaining, title, body);
    notificationIdRef.current = id;
    setIsRunning(true);
    setIsPaused(false);
  };

  const reset = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    const duration = getModeDuration(currentMode, settings);
    setRemaining(duration);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    setStartedAt(null);
    startedAtRef.current = null;
    setShowWarning(false);
  };

  const upNextMode = getNextMode(
    currentMode,
    currentMode === "focus" ? completedFocus + 1 : completedFocus,
    settings,
  );
  const upNextMinutes = Math.round(getModeDuration(upNextMode, settings) / 60);

  const pomodoroStripLabelVisible =
    sessions.length > 0 || pomodoroActivityDays.some((d) => d.active);

  return (
    <Screen scroll>
      <SectionTitle
        title="Pomodoro"
        subtitle="Classic sequence: focus → short breaks → long break — durations saved on device."
      />

      <BackgroundWarning visible={showWarning} onDismiss={() => setShowWarning(false)} />

      <Card>
        <View className="mb-4 flex-row justify-center gap-2">
          {(["focus", "short_break", "long_break"] as PomodoroMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                if (isRunning) return;
                setIsPaused(false);
                setCurrentMode(mode);
                currentModeRef.current = mode;
                const d = getModeDuration(mode, settings);
                setTotalSeconds(d);
                totalSecondsRef.current = d;
                setRemaining(d);
                setStartedAt(null);
                startedAtRef.current = null;
              }}
              className={`rounded-full border px-3 py-1.5 ${
                currentMode === mode ? "border-brand-500 bg-brand-500" : "border-slate-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  currentMode === mode ? "text-white" : "text-slate-500"
                }`}
              >
                {getModeLabel(mode)}
              </Text>
            </Pressable>
          ))}
        </View>

        {showSprout ? (
          <View className="my-4 items-center">
            <FocusSprout progress={growthProgress} stage={plantStage} size={160} />
          </View>
        ) : null}

        <Pressable
          onPress={() => !isRunning && setShowSettings((v) => !v)}
          disabled={isRunning}
        >
          <Text className={`text-center text-5xl font-semibold ${modeColors.text}`}>
            {minutes}:{seconds}
          </Text>
          {!isRunning ? (
            <Text className="mt-0.5 text-center text-xs text-slate-400">tap to edit</Text>
          ) : null}
        </Pressable>

        <View className="my-3 flex-row justify-center gap-1.5">
          {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
            <View
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < completedFocus % settings.sessionsBeforeLongBreak ? "bg-brand-500" : "bg-slate-200"
              }`}
            />
          ))}
        </View>

        {showSettings ? (
          <PomodoroSettingsInline
            settings={settings}
            onSave={handleSaveSettings}
            onCancel={() => setShowSettings(false)}
          />
        ) : null}

        <View className="mt-4 gap-3">
          {!isRunning && !isPaused && remaining === totalSeconds ? (
            <Button label={startLabel} onPress={start} />
          ) : null}

          {isRunning ? (
            <View className="flex-row gap-3">
              <Button label="Pause" variant="ghost" onPress={pause} />
              <Button label="Reset" variant="ghost" onPress={reset} />
            </View>
          ) : null}

          {isPaused && !isRunning ? (
            <View className="flex-row gap-3">
              <Button label="Resume" onPress={resume} />
              <Button label="Reset" variant="ghost" onPress={reset} />
            </View>
          ) : null}

          {remaining === 0 && !isRunning && !isPaused ? (
            <Button label={startLabel} onPress={start} />
          ) : null}
        </View>

        {!isRunning && !isPaused && remaining === getModeDuration(currentMode, settings) ? (
          <Text className="mt-3 text-center text-xs text-slate-400">
            Up next: {getModeLabel(upNextMode)} ({upNextMinutes} min)
          </Text>
        ) : null}
      </Card>

      <ActivityPreviewStrip
        days={pomodoroActivityDays}
        accentColor="#4f79ff"
        statLabel={`${sessions.length} session${sessions.length !== 1 ? "s" : ""} in last 30 days`}
        emptyLabel="Complete a session to start your garden"
        showLabel={pomodoroStripLabelVisible}
      />

      <View className="mt-6">
        <GardenGrid sessions={sessions} />
      </View>
    </Screen>
  );
}
