import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { Button } from "@/core/ui/Button";
import { FeatureStatCard } from "@/core/ui/FeatureStatCard";
import { PillChip } from "@/core/ui/PillChip";
import { POMODORO_SECTION_KEY, SECTION_COLORS } from "@/constants/sectionColors";
import {
  listPomodoroSessionsForDateRange,
  logPomodoroSession,
  getPomodoroSettings,
  savePomodoroSettings,
} from "@/features/pomodoro/pomodoro.data";
import { toDateKey } from "@/lib/time";
import { useForegroundRefresh } from "@/lib/useForegroundRefresh";
import type { PomodoroSession } from "./types";
import {
  cancelScheduledNotification,
  scheduleTimerEndNotification,
} from "@/lib/notifications";
import {
  buildPomodoroHeatmapDays,
  calculateGrowthProgress,
  computePomodoroStreakFromHeatmapDays,
  DEFAULT_SETTINGS,
  getModeColor,
  getModeDuration,
  getModeLabel,
  getNextMode,
  getPlantStage,
  type PomodoroMode,
  type PomodoroSettings,
} from "./pomodoro.domain";
import type { HeatmapDay } from "@/features/shared/activityTypes";
import { GitHubHeatmap } from "@/features/shared/GitHubHeatmap";
import { FocusSprout } from "./FocusSprout";
import { GardenGrid } from "./GardenGrid";
import { BackgroundWarning } from "./BackgroundWarning";
import { PomodoroSettingsInline } from "./PomodoroSettingsInline";
import { SECTION_TEXT_COLORS } from "@/constants/sectionColors";

const COLOR = SECTION_COLORS[POMODORO_SECTION_KEY];
const TEXT_COLOR = SECTION_TEXT_COLORS[POMODORO_SECTION_KEY];

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
  const [pomodoroHeatmapDays, setPomodoroHeatmapDays] = useState<HeatmapDay[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const notificationIdRef = useRef<string | null>(null);
  const lastTickTime = useRef<number | null>(null);

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
    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const startKey = toDateKey(start364);
    const endKey = toDateKey(new Date());
    listPomodoroSessionsForDateRange(startKey, endKey).then((s) => {
      setSessions(s);
      setPomodoroHeatmapDays(buildPomodoroHeatmapDays(s, 364));
    });
  }, [historyVersion]);

  const refreshHistoryOnForeground = useCallback(() => {
    setHistoryVersion((v) => v + 1);
  }, []);
  useForegroundRefresh(refreshHistoryOnForeground);

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
        if (lastTickTime.current == null) return prev;
        const now = Date.now();
        const deltaSeconds = Math.round((now - lastTickTime.current) / 1000);
        if (deltaSeconds < 1) return prev;
        lastTickTime.current = now;

        const nextRemaining = prev - deltaSeconds;
        if (nextRemaining <= 0) {
          clearInterval(timer);
          lastTickTime.current = null;
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
        return nextRemaining;
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
    lastTickTime.current = null;
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
    lastTickTime.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    setShowSettings(false);
  };

  const pause = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    lastTickTime.current = null;
    setIsRunning(false);
    setIsPaused(true);
  };

  const resume = async () => {
    const { title, body } = notifyCopy(currentMode);
    const id = await scheduleTimerEndNotification(remaining, title, body);
    notificationIdRef.current = id;
    lastTickTime.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
  };

  const reset = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    lastTickTime.current = null;
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

  const pomodoroStreak = computePomodoroStreakFromHeatmapDays(pomodoroHeatmapDays);

  return (
    <Screen scroll>
      <SectionTitle
        title="Pomodoro"
        subtitle="Classic sequence: focus → short breaks → long break — durations saved on device."
      />

      <BackgroundWarning visible={showWarning} onDismiss={() => setShowWarning(false)} />

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <FeatureStatCard
            accentColor={COLOR}
            textColor={TEXT_COLOR}
            icon="timer"
            title="Focus sessions"
            value={sessions.length}
            subtitle="This year"
            note={sessions.length > 0 ? "Completed focus sessions" : "No sessions logged yet"}
          />
        </View>
        <View className="flex-1">
          <FeatureStatCard
            accentColor={COLOR}
            textColor={TEXT_COLOR}
            icon="local-fire-department"
            title="Current streak"
            value={pomodoroStreak}
            subtitle="Consecutive focus days"
            note={pomodoroStreak > 0 ? "Keep the streak alive" : "Your next session starts the streak"}
          />
        </View>
      </View>

      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Timer"
        headerSubtitle="Classic focus and break sequence with live progress."
        className="mb-4"
      >
        <View className="mb-4 flex-row flex-wrap justify-center">
          {(["focus", "short_break", "long_break"] as PomodoroMode[]).map((mode) => (
            <PillChip
              key={mode}
              label={getModeLabel(mode)}
              active={currentMode === mode}
              color={COLOR}
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
            />
          ))}
        </View>

        <View className="w-full items-center justify-center py-2">
          {showSprout ? (
            <FocusSprout progress={growthProgress} stage={plantStage} size={160} accentColor={COLOR} />
          ) : null}
          <Pressable
            className={showSprout ? "mt-2 w-full items-center" : "w-full items-center"}
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
        </View>

        <View className="my-3 flex-row justify-center gap-1.5">
          {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
            <View
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < completedFocus % settings.sessionsBeforeLongBreak ? "bg-focus" : "bg-slate-200"
              }`}
            />
          ))}
        </View>

        <View className="mt-4 gap-3">
          {!isRunning && !isPaused && remaining === totalSeconds ? (
            <Button label={startLabel} onPress={start} color={COLOR} />
          ) : null}

          {isRunning ? (
            <View className="flex-row gap-3">
              <Button label="Pause" variant="ghost" onPress={pause} />
              <Button label="Reset" variant="ghost" onPress={reset} />
            </View>
          ) : null}

          {isPaused && !isRunning ? (
            <View className="flex-row gap-3">
              <Button label="Resume" onPress={resume} color={COLOR} />
              <Button label="Reset" variant="ghost" onPress={reset} />
            </View>
          ) : null}

          {remaining === 0 && !isRunning && !isPaused ? (
            <Button label={startLabel} onPress={start} color={COLOR} />
          ) : null}
        </View>

        {!isRunning && !isPaused && remaining === getModeDuration(currentMode, settings) ? (
          <Text className="mt-3 text-center text-xs text-slate-400">
            Up next: {getModeLabel(upNextMode)} ({upNextMinutes} min)
          </Text>
        ) : null}
      </Card>

      {showSettings ? (
        <PomodoroSettingsInline
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      ) : null}

      <Card
        variant="header"
        accentColor={COLOR}
        headerTitle="Focus history"
        headerSubtitle="Garden view plus the last 52 weeks of activity."
        className="mt-4"
      >
        <GardenGrid sessions={sessions} />
        <View className="mt-6 w-full min-w-0 items-center justify-center">
          <GitHubHeatmap days={pomodoroHeatmapDays} color={COLOR} weeks={52} />
        </View>
      </Card>
    </Screen>
  );
}
