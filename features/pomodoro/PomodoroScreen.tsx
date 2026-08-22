import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { FeatureStatCard } from '@/core/ui/FeatureStatCard';
import { PageHeader } from '@/core/ui/PageHeader';
import { PillChip } from '@/core/ui/PillChip';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { typography } from '@/core/theme/designTokens';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useCommandLauncherSuppressed } from '@/features/command/commandCenterContext';
import {
  listPomodoroSessionsForDateRange,
  recordCompletedPomodoroSession,
  getPomodoroSettings,
  savePomodoroSettings,
  getPomodoroActiveTimer,
  savePomodoroActiveTimer,
  clearPomodoroActiveTimer,
  hasPomodoroSessionStartedAt,
  enqueuePendingPomodoroLog,
  retryPendingPomodoroLogs,
} from '@/features/pomodoro/pomodoro.data';
import { listTodos } from '@/features/todos/todos.data';
import type { Todo } from '@/core/db/types';
import {
  clearActivePresetId,
  getPomodoroPresetsState,
  setActivePresetId,
} from './pomodoro.presets.store';
import type { SessionAssociation } from './pomodoro.sessionMeta';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import type { PomodoroSession } from './types';
import { cancelScheduledNotification, scheduleTimerEndNotification } from '@/lib/notifications';
import {
  buildPomodoroHeatmapDays,
  applySettingsToTimerState,
  calculateGrowthProgress,
  computeFocusStats,
  computePomodoroStreakFromHeatmapDays,
  DEFAULT_SETTINGS,
  BUILT_IN_PRESETS,
  findPresetById,
  getAbandonNotice,
  getModeColor,
  getModeDuration,
  getModeLabel,
  getNextMode,
  getPlantStage,
  matchPresetBySettings,
  planActiveTimerReconcile,
  planSessionCompletion,
  resolveActivePreset,
  type AbandonNotice,
  type CompletedFocusLogPlan,
  type PomodoroMode,
  type PomodoroPreset,
  type PomodoroSettings,
} from './pomodoro.domain';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { FocusSprout } from './FocusSprout';
import { GardenGrid } from './GardenGrid';
import { BackgroundWarning } from './BackgroundWarning';
import { PomodoroSettingsInline } from './PomodoroSettingsInline';
import { PomodoroPresetSelector } from './PomodoroPresetSelector';
import { TodoAssociationPicker } from './TodoAssociationPicker';
import { SessionNotePrompt } from './SessionNotePrompt';
import { RecentSessionsList } from './RecentSessionsList';
import {
  usePomodoroCommandBridge,
  type PomodoroCommandStartResult,
} from './pomodoroCommandBridgeContext';

const COLOR = SECTION_COLORS[POMODORO_SECTION_KEY];

function notifyCopy(mode: PomodoroMode): { title: string; body: string } {
  switch (mode) {
    case 'focus':
      return { title: 'Focus complete', body: 'Great work. Time for a short break.' };
    case 'short_break':
      return { title: 'Break complete', body: 'Ready for another focus session.' };
    case 'long_break':
      return { title: 'Long break complete', body: 'Start a new focus round when you are ready.' };
  }
}

export function PomodoroScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const { register: registerCommandTimer } = usePomodoroCommandBridge();
  const dayGeneration = useDayRolloverGeneration();
  const textColor = sectionAccents[POMODORO_SECTION_KEY].text;
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [currentMode, setCurrentMode] = useState<PomodoroMode>('focus');
  const [completedFocus, setCompletedFocus] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SETTINGS.focusMinutes * 60);
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [pomodoroHeatmapDays, setPomodoroHeatmapDays] = useState<HeatmapDay[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [presets, setPresets] = useState<PomodoroPreset[]>(BUILT_IN_PRESETS);
  const [storedActivePresetId, setStoredActivePresetIdState] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [pendingAssociation, setPendingAssociation] = useState<SessionAssociation | null>(null);
  const [notePromptSessionId, setNotePromptSessionId] = useState<string | null>(null);
  /** Presentational snapshot of the focus session that just completed naturally. */
  const [completionSummary, setCompletionSummary] = useState<{
    minutes: number;
    startedAtIso: string;
    linkedTodoTitle: string | null;
  } | null>(null);
  const [showLinkTodo, setShowLinkTodo] = useState(false);
  const [interruptedNotice, setInterruptedNotice] = useState<AbandonNotice | null>(null);
  const [logSaveFailed, setLogSaveFailed] = useState(false);
  const notificationIdRef = useRef<string | null>(null);
  const lastTickTime = useRef<number | null>(null);
  const startInFlightRef = useRef(false);
  /** Mirror of `remaining` so the interval does pure math outside setState. */
  const remainingRef = useRef(DEFAULT_SETTINGS.focusMinutes * 60);
  /** Exactly-once guard for the completion side effects. */
  const completionDoneRef = useRef(false);
  /** Cancellable handle for the preset-driven auto-start timeout. */
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconciledRef = useRef(false);

  const currentModeRef = useRef<PomodoroMode>('focus');
  const completedFocusRef = useRef(0);
  const settingsRef = useRef<PomodoroSettings>(DEFAULT_SETTINGS);
  const totalSecondsRef = useRef(DEFAULT_SETTINGS.focusMinutes * 60);
  const startedAtRef = useRef<Date | null>(null);
  const activePresetRef = useRef<PomodoroPreset>(BUILT_IN_PRESETS[0]);
  const pendingAssociationRef = useRef<SessionAssociation | null>(null);
  const startRef = useRef<((minutes?: number) => Promise<PomodoroCommandStartResult>) | null>(null);

  useEffect(() => {
    currentModeRef.current = currentMode;
    completedFocusRef.current = completedFocus;
    settingsRef.current = settings;
    totalSecondsRef.current = totalSeconds;
    startedAtRef.current = startedAt;
    pendingAssociationRef.current = pendingAssociation;
  });
  useCommandLauncherSuppressed('pomodoro-active-session', isRunning || isPaused);

  const clearAutoStartTimer = useCallback(() => {
    if (autoStartTimerRef.current !== null) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  }, []);

  const applyRemaining = useCallback((value: number) => {
    remainingRef.current = value;
    setRemaining(value);
  }, []);

  const loadSettings = useCallback(async () => {
    const nextSettings = await getPomodoroSettings();
    const nextTimer = applySettingsToTimerState(nextSettings, {
      currentMode,
      isRunning,
      isPaused,
      totalSeconds,
      remaining,
    });
    setSettings(nextTimer.settings);
    if (!isRunning && !isPaused) {
      setTotalSeconds(nextTimer.totalSeconds);
      applyRemaining(nextTimer.remaining);
      totalSecondsRef.current = nextTimer.totalSeconds;
    }
  }, [applyRemaining, currentMode, isPaused, isRunning, remaining, totalSeconds]);

  const loadHistory = useCallback(async () => {
    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const startKey = toDateKey(start364);
    const endKey = toDateKey(new Date());
    const rows = await listPomodoroSessionsForDateRange(startKey, endKey);
    // Break rows never reach the focus surfaces (count card, garden, heatmap).
    const focusOnly = rows.filter((row) => row.session_type === 'focus');
    setSessions(focusOnly);
    setPomodoroHeatmapDays(buildPomodoroHeatmapDays(focusOnly, 364));
  }, []);

  const loadPresets = useCallback(async () => {
    const state = await getPomodoroPresetsState();
    setPresets(state.presets);
    setStoredActivePresetIdState(state.activePresetId);
  }, []);

  const loadTodos = useCallback(async () => {
    setTodosLoading(true);
    try {
      setTodos(await listTodos());
    } catch {
      setTodos([]);
    } finally {
      setTodosLoading(false);
    }
  }, []);

  const retryPendingLogs = useCallback(async () => {
    try {
      const result = await retryPendingPomodoroLogs();
      if (result.finalFailures.length > 0) {
        setLogSaveFailed(true);
      }
      if (result.succeeded > 0) {
        void loadHistory();
      }
    } catch {
      // Recovery is best-effort; the queue stays durable for the next retry.
    }
  }, [loadHistory]);

  const refresh = useCallback(async () => {
    await Promise.all([loadHistory(), loadSettings(), loadPresets(), retryPendingLogs()]);
  }, [loadHistory, loadSettings, loadPresets, retryPendingLogs]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  /**
   * Crash/reload reconciliation (runs once per mount): decide what happened
   * to the durably-intended session, cancel the orphan OS notification, and
   * restore the cycle position. Never blocks the screen on failure.
   */
  const reconcileActiveTimer = useCallback(async () => {
    if (reconciledRef.current) return;
    reconciledRef.current = true;
    try {
      const intent = await getPomodoroActiveTimer();
      if (!intent) return;
      const hasRow = await hasPomodoroSessionStartedAt(intent.startedAtIso);
      const plan = planActiveTimerReconcile(intent, hasRow, Date.now());
      // The OS notification survives JS death on native; cancel it in every
      // outcome now that the session's fate is decided.
      await cancelScheduledNotification(plan.notificationId);

      if (plan.kind === 'already-logged') {
        completedFocusRef.current = intent.completedFocus;
        setCompletedFocus(intent.completedFocus);
      } else if (plan.kind === 'complete-unlogged') {
        // The countdown finished while the app was dead — honor the focus.
        const endedAtIso = new Date(
          new Date(intent.startedAtIso).getTime() + intent.totalSeconds * 1000,
        ).toISOString();
        try {
          const result = await recordCompletedPomodoroSession({
            startedAtIso: intent.startedAtIso,
            endedAtIso,
            durationSeconds: intent.totalSeconds,
            type: 'focus',
          });
          if (result.inserted) setNotePromptSessionId(result.id);
          void loadHistory();
        } catch {
          await enqueuePendingPomodoroLog({
            startedAtIso: intent.startedAtIso,
            endedAtIso,
            durationSeconds: intent.totalSeconds,
            type: 'focus',
          }).catch(() => undefined);
          setLogSaveFailed(true);
        }
        const nextCompleted = intent.completedFocus + 1;
        completedFocusRef.current = nextCompleted;
        setCompletedFocus(nextCompleted);
      } else {
        const label = getModeLabel(intent.mode).toLowerCase();
        setInterruptedNotice({
          title: 'Previous session interrupted',
          body: `Your ${label} didn't finish before the app closed. Interrupted sessions are never logged.`,
        });
        completedFocusRef.current = intent.completedFocus;
        setCompletedFocus(intent.completedFocus);
      }
      await clearPomodoroActiveTimer().catch(() => undefined);
    } catch {
      // Best-effort reconciliation; the intent stays durable for next mount.
    }
  }, [loadHistory]);

  useEffect(() => {
    void reconcileActiveTimer();
  }, [reconcileActiveTimer]);

  useEffect(() => {
    if (!isRunning) return;

    const handleVisibilityChange = () => {
      if (document.hidden && isRunning) {
        setShowWarning(true);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isRunning]);

  const applyCompletedFocusLog = useCallback(
    async (log: CompletedFocusLogPlan) => {
      const assoc = pendingAssociationRef.current;
      const meta = assoc
        ? { linkedTodoId: assoc.todoId, linkedTodoTitle: assoc.todoTitle }
        : undefined;
      try {
        const result = await recordCompletedPomodoroSession({
          startedAtIso: log.startedAtIso,
          endedAtIso: log.endedAtIso,
          durationSeconds: log.durationSeconds,
          type: 'focus',
          meta,
        });
        if (result.inserted) {
          // Confirmed success only: consume the armed association so it can
          // never mis-attach to a later session, then prompt for a note.
          setPendingAssociation(null);
          setNotePromptSessionId(result.id);
        }
      } catch (err) {
        console.error('[PomodoroScreen] logPomodoroSession failed', err);
        // Keep the completed focus durably; retried on next foreground/mount
        // and surfaced as a notice if every retry fails.
        await enqueuePendingPomodoroLog({
          startedAtIso: log.startedAtIso,
          endedAtIso: log.endedAtIso,
          durationSeconds: log.durationSeconds,
          type: 'focus',
          meta: meta ?? null,
        }).catch(() => undefined);
        setLogSaveFailed(true);
      }
      void loadHistory();
    },
    [loadHistory],
  );

  const runCompletionEffects = useCallback(() => {
    // Ref-guarded exactly-once: a replayed interval callback can never
    // double-log a session or double-schedule the auto-start.
    if (completionDoneRef.current) return;
    completionDoneRef.current = true;
    clearAutoStartTimer();

    const plan = planSessionCompletion({
      mode: currentModeRef.current,
      startedAtIso: startedAtRef.current ? startedAtRef.current.toISOString() : null,
      totalSeconds: totalSecondsRef.current,
      completedFocus: completedFocusRef.current,
      settings: settingsRef.current,
      preset: activePresetRef.current,
    });

    void clearPomodoroActiveTimer().catch(() => undefined);

    setCompletedFocus(plan.nextCompletedFocus);
    completedFocusRef.current = plan.nextCompletedFocus;

    setCurrentMode(plan.nextMode);
    currentModeRef.current = plan.nextMode;
    setTotalSeconds(plan.nextDurationSeconds);
    totalSecondsRef.current = plan.nextDurationSeconds;
    applyRemaining(plan.nextDurationSeconds);
    setStartedAt(null);
    startedAtRef.current = null;
    setShowWarning(false);

    if (plan.log) {
      void applyCompletedFocusLog(plan.log);
      // Presentational only: the log above already recorded the session
      // exactly once; this snapshot just feeds the completion summary UI.
      setCompletionSummary({
        minutes: Math.round(plan.log.durationSeconds / 60),
        startedAtIso: plan.log.startedAtIso,
        linkedTodoTitle: pendingAssociationRef.current?.todoTitle ?? null,
      });
    }

    // Preset-driven auto-start: begin the suggested next mode after a short
    // beat so the completion state is briefly visible. Held in a cancellable
    // ref cleared by start/reset/pill presses/unmount.
    if (plan.autoStartNext) {
      autoStartTimerRef.current = setTimeout(() => {
        autoStartTimerRef.current = null;
        void startRef.current?.();
      }, 800);
    }
  }, [applyCompletedFocusLog, applyRemaining, clearAutoStartTimer]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      if (lastTickTime.current == null) return;
      const now = Date.now();
      const deltaSeconds = Math.round((now - lastTickTime.current) / 1000);
      if (deltaSeconds < 1) return;
      lastTickTime.current = now;

      // Pure remaining-math only. React may replay state updaters, so all
      // completion side effects live in the ref-guarded callback below.
      const nextRemaining = remainingRef.current - deltaSeconds;
      if (nextRemaining > 0) {
        remainingRef.current = nextRemaining;
        setRemaining(nextRemaining);
        return;
      }

      clearInterval(timer);
      lastTickTime.current = null;
      remainingRef.current = 0;
      setRemaining(0);
      setIsRunning(false);
      setIsPaused(false);
      void cancelScheduledNotification(notificationIdRef.current);
      notificationIdRef.current = null;
      runCompletionEffects();
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, runCompletionEffects]);

  // A pending auto-start must not fire after the screen goes away.
  useEffect(() => () => clearAutoStartTimer(), [clearAutoStartTimer]);

  const handleSaveSettings = async (newSettings: PomodoroSettings) => {
    await savePomodoroSettings(newSettings);
    setSettings(newSettings);
    setCompletionSummary(null);
    // Manual edits detach the stored preset selection so the chip highlight
    // follows the actual durations instead of a stale selection.
    setStoredActivePresetIdState(null);
    void clearActivePresetId().catch(() => undefined);
    // Saving durations mid-session abandons that session (running or paused):
    // it is never logged, so cancel its OS notification and durable intent
    // before resetting the timer, otherwise a reload would reconcile a ghost.
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    void clearPomodoroActiveTimer().catch(() => undefined);
    setStartedAt(null);
    startedAtRef.current = null;
    const duration = getModeDuration(currentMode, newSettings);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    applyRemaining(duration);
    lastTickTime.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setShowSettings(false);
  };

  const start = useCallback(
    async (requestedDurationMinutes?: number): Promise<PomodoroCommandStartResult> => {
      if (startInFlightRef.current || isRunning || isPaused) {
        return {
          outcome: 'conflict',
          message: 'A focus session is already running or paused.',
        };
      }

      startInFlightRef.current = true;
      clearAutoStartTimer();

      try {
        const mode = requestedDurationMinutes === undefined ? currentMode : 'focus';
        const duration =
          requestedDurationMinutes === undefined
            ? getModeDuration(currentMode, settings)
            : requestedDurationMinutes * 60;
        if (requestedDurationMinutes !== undefined) {
          setCurrentMode('focus');
          currentModeRef.current = 'focus';
        }

        void cancelScheduledNotification(notificationIdRef.current);
        notificationIdRef.current = null;
        const now = new Date();
        setStartedAt(now);
        startedAtRef.current = now;
        applyRemaining(duration);
        setTotalSeconds(duration);
        totalSecondsRef.current = duration;
        const { title, body } = notifyCopy(mode);
        const id = await scheduleTimerEndNotification(duration, title, body);
        notificationIdRef.current = id;
        lastTickTime.current = Date.now();
        completionDoneRef.current = false;
        setIsRunning(true);
        setIsPaused(false);
        setShowSettings(false);
        setCompletionSummary(null);
        // Durable intent: a crash/reload mid-session is reconciled on the
        // next launch instead of vanishing behind an orphan notification.
        void savePomodoroActiveTimer({
          startedAtIso: now.toISOString(),
          mode,
          totalSeconds: duration,
          completedFocus: completedFocusRef.current,
          notificationId: id,
        }).catch(() => undefined);
        return { outcome: 'started' };
      } finally {
        startInFlightRef.current = false;
      }
    },
    [applyRemaining, clearAutoStartTimer, currentMode, isPaused, isRunning, settings],
  );

  const startFocusSession = useCallback(
    (durationMinutes: number) => start(durationMinutes),
    [start],
  );

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  const handleSelectPreset = useCallback(
    async (preset: PomodoroPreset) => {
      activePresetRef.current = preset;
      setStoredActivePresetIdState(preset.id);
      setCompletionSummary(null);
      await setActivePresetId(preset.id).catch(() => undefined);
      // Applying a preset rewrites the timer settings; a running or paused
      // session keeps its current duration and the preset applies next round.
      if (isRunning || isPaused) return;
      await savePomodoroSettings({
        focusMinutes: preset.focusMinutes,
        shortBreakMinutes: preset.shortBreakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      });
      setSettings((prev) => ({
        ...prev,
        focusMinutes: preset.focusMinutes,
        shortBreakMinutes: preset.shortBreakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      }));
      const duration = getModeDuration(currentModeRef.current, {
        focusMinutes: preset.focusMinutes,
        shortBreakMinutes: preset.shortBreakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      });
      setTotalSeconds(duration);
      totalSecondsRef.current = duration;
      applyRemaining(duration);
      lastTickTime.current = null;
    },
    [applyRemaining, isPaused, isRunning],
  );

  useEffect(
    () =>
      registerCommandTimer({
        startFocusSession,
        isRunning,
        isPaused,
      }),
    [isPaused, isRunning, registerCommandTimer, startFocusSession],
  );

  const pause = () => {
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    lastTickTime.current = null;
    setIsRunning(false);
    setIsPaused(true);
    setShowWarning(false);
    // Persist the frozen countdown into the durable intent so a crash while
    // paused reconciles as interrupted instead of phantom-logging a session
    // whose clock never ran past its nominal deadline.
    if (startedAtRef.current) {
      void savePomodoroActiveTimer({
        startedAtIso: startedAtRef.current.toISOString(),
        mode: currentMode,
        totalSeconds,
        completedFocus: completedFocusRef.current,
        notificationId: null,
        pausedRemainingSeconds: remaining,
      }).catch(() => undefined);
    }
  };

  const resume = async () => {
    const { title, body } = notifyCopy(currentMode);
    const id = await scheduleTimerEndNotification(remaining, title, body);
    notificationIdRef.current = id;
    lastTickTime.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    if (startedAtRef.current) {
      // Keep the durable intent's notification id current across pauses and
      // clear the paused marker so reconciliation trusts the deadline again.
      void savePomodoroActiveTimer({
        startedAtIso: startedAtRef.current.toISOString(),
        mode: currentMode,
        totalSeconds,
        completedFocus: completedFocusRef.current,
        notificationId: id,
        pausedRemainingSeconds: null,
      }).catch(() => undefined);
    }
  };

  const reset = () => {
    clearAutoStartTimer();
    void cancelScheduledNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    lastTickTime.current = null;
    setIsRunning(false);
    setIsPaused(false);
    const duration = getModeDuration(currentMode, settings);
    applyRemaining(duration);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    setStartedAt(null);
    startedAtRef.current = null;
    setShowWarning(false);
    completionDoneRef.current = false;
    // Abandoned sessions are never logged; drop the durable intent too.
    void clearPomodoroActiveTimer().catch(() => undefined);
  };

  const dismissCompletionSummary = () => setCompletionSummary(null);

  const startBreakFromSummary = () => {
    setCompletionSummary(null);
    // Existing flow: `start()` launches the already-advanced next mode.
    void start();
  };

  // Behavior source for auto-start flags: stored selection, else the preset
  // matching current durations, else Classic (never a silent default).
  const activePreset = resolveActivePreset(presets, storedActivePresetId, settings);
  useEffect(() => {
    activePresetRef.current = activePreset;
  }, [activePreset]);

  // Chip highlight: the stored selection while valid, else whichever preset
  // the current durations actually equal — manual edits move/clear it.
  const highlightedPresetId =
    findPresetById(presets, storedActivePresetId)?.id ??
    matchPresetBySettings(presets, settings)?.id ??
    null;

  const upNextMode = getNextMode(
    currentMode,
    currentMode === 'focus' ? completedFocus + 1 : completedFocus,
    settings,
  );
  const upNextMinutes = Math.round(getModeDuration(upNextMode, settings) / 60);

  const pomodoroStreak = computePomodoroStreakFromHeatmapDays(pomodoroHeatmapDays);
  const focusStats = computeFocusStats(sessions, new Date());
  const elapsedSeconds = totalSeconds - remaining;
  const abandonNotice = getAbandonNotice({
    mode: currentMode,
    phase: isRunning ? 'running' : isPaused ? 'paused' : 'idle',
    remaining,
    totalSeconds,
  });
  const abandonLabel = currentMode === 'focus' && elapsedSeconds >= 60 ? 'Abandon' : 'Reset';

  const modeColors = getModeColor(currentMode);
  const growthProgress = calculateGrowthProgress(remaining, totalSeconds);
  const plantStage = getPlantStage(growthProgress);
  const showSprout = currentMode === 'focus' && (isRunning || remaining < totalSeconds);

  // Reduced-chrome active sessions and the completion-summary overlay.
  const activeSession = isRunning || isPaused;
  const summaryVisible = completionSummary !== null && !activeSession;
  // Today's total including the just-finished session even before the history
  // reload lands (exact started_at match against the loaded rows).
  const summarySessionLogged =
    completionSummary !== null &&
    sessions.some((session) => session.started_at === completionSummary.startedAtIso);
  const summaryTodayMinutes =
    completionSummary !== null
      ? focusStats.todayMinutes + (summarySessionLogged ? 0 : completionSummary.minutes)
      : 0;

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  const startLabel =
    currentMode === 'focus' ? 'Start focus' : `Start ${getModeLabel(currentMode).toLowerCase()}`;

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Pomodoro"
          subtitle="Classic sequence: focus → short breaks → long break — durations saved on device."
        />
      </ScreenSection>

      <BackgroundWarning visible={showWarning} onDismiss={() => setShowWarning(false)} />

      {interruptedNotice || logSaveFailed ? (
        <ScreenSection>
          {interruptedNotice ? (
            <View
              className="mb-3 rounded-2xl border px-3 py-2"
              style={{ borderColor: tokens.border }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                {interruptedNotice.title}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                {interruptedNotice.body}
              </Text>
              <View className="mt-2 self-start">
                <Button
                  label="Dismiss"
                  variant="ghost"
                  onPress={() => setInterruptedNotice(null)}
                />
              </View>
            </View>
          ) : null}
          {logSaveFailed ? (
            <View className="rounded-2xl border px-3 py-2" style={{ borderColor: tokens.border }}>
              <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                A completed focus could not be saved
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                Storage kept failing after several retries, so that session is missing from your
                history.
              </Text>
              <View className="mt-2 self-start">
                <Button label="Dismiss" variant="ghost" onPress={() => setLogSaveFailed(false)} />
              </View>
            </View>
          ) : null}
        </ScreenSection>
      ) : null}

      {!activeSession ? (
        <ScreenSection>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[160px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={textColor}
                icon="timer"
                title="Focus sessions"
                value={sessions.length}
                subtitle="Last 52 weeks"
                note={sessions.length > 0 ? 'Completed focus sessions' : 'No sessions logged yet'}
              />
            </View>
            <View className="min-w-[160px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={textColor}
                icon="local-fire-department"
                title="Current streak"
                value={pomodoroStreak}
                subtitle="Consecutive focus days"
                note={
                  pomodoroStreak > 0
                    ? 'Keep the streak alive'
                    : 'Your next session starts the streak'
                }
              />
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-3">
            <View className="min-w-[110px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={textColor}
                icon="today"
                title="Today"
                value={`${focusStats.todayMinutes}m`}
                subtitle={`${focusStats.todaySessions} session${focusStats.todaySessions === 1 ? '' : 's'}`}
                note={focusStats.todayMinutes > 0 ? 'Focused today' : 'No focus yet today'}
              />
            </View>
            <View className="min-w-[110px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={textColor}
                icon="date-range"
                title="This week"
                value={`${focusStats.weekMinutes}m`}
                subtitle={`${focusStats.weekSessions} session${focusStats.weekSessions === 1 ? '' : 's'}`}
                note="Last 7 days"
              />
            </View>
            <View className="min-w-[110px] flex-1">
              <FeatureStatCard
                accentColor={COLOR}
                textColor={textColor}
                icon="insights"
                title="30 days"
                value={`${focusStats.thirtyDayMinutes}m`}
                subtitle={
                  focusStats.bestDay
                    ? `Best day ${focusStats.bestDay.minutes}m`
                    : `${focusStats.thirtyDaySessions} sessions`
                }
                note={focusStats.bestDay ? `Best on ${focusStats.bestDay.dateKey}` : 'No data yet'}
              />
            </View>
          </View>
        </ScreenSection>
      ) : null}

      <ScreenSection>
        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Timer"
          headerSubtitle="Classic focus and break sequence with live progress."
          className="mb-0"
        >
          <View className="mb-4 flex-row flex-wrap justify-center">
            {(['focus', 'short_break', 'long_break'] as PomodoroMode[]).map((mode) => (
              <PillChip
                key={mode}
                label={getModeLabel(mode)}
                active={currentMode === mode}
                color={COLOR}
                onPress={() => {
                  if (isRunning) return;
                  clearAutoStartTimer();
                  // Switching modes abandons any paused session: per contract
                  // it is never logged, so drop its durable intent and cancel
                  // any surviving OS notification with it.
                  void cancelScheduledNotification(notificationIdRef.current);
                  notificationIdRef.current = null;
                  void clearPomodoroActiveTimer().catch(() => undefined);
                  setCompletionSummary(null);
                  setIsPaused(false);
                  setCurrentMode(mode);
                  currentModeRef.current = mode;
                  const d = getModeDuration(mode, settings);
                  setTotalSeconds(d);
                  totalSecondsRef.current = d;
                  applyRemaining(d);
                  setStartedAt(null);
                  startedAtRef.current = null;
                }}
              />
            ))}
          </View>

          <View className="w-full items-center justify-center py-2">
            {showSprout ? (
              <FocusSprout
                progress={growthProgress}
                stage={plantStage}
                size={160}
                accentColor={COLOR}
              />
            ) : null}
            <Pressable
              className={showSprout ? 'mt-2 w-full items-center' : 'w-full items-center'}
              onPress={() => !isRunning && setShowSettings((v) => !v)}
              disabled={isRunning}
              accessibilityRole="button"
              accessibilityLabel={isRunning ? 'Timer running' : 'Edit timer duration'}
            >
              <Text className={`text-center text-5xl font-semibold ${modeColors.text}`}>
                {minutes}:{seconds}
              </Text>
              {!isRunning ? (
                <Text className="mt-0.5 text-center text-xs" style={{ color: tokens.textMuted }}>
                  tap to edit
                </Text>
              ) : null}
            </Pressable>
          </View>

          <View className="my-3 flex-row justify-center gap-1.5">
            {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
              <View
                key={i}
                className={`h-2 w-2 rounded-full ${i < completedFocus % settings.sessionsBeforeLongBreak ? 'bg-focus' : ''}`}
                style={
                  i < completedFocus % settings.sessionsBeforeLongBreak
                    ? undefined
                    : { backgroundColor: tokens.border }
                }
              />
            ))}
          </View>

          {activeSession && pendingAssociation ? (
            <Text
              className="mt-3 text-center text-xs"
              style={{ color: tokens.textMuted }}
              numberOfLines={1}
            >
              Focusing on “{pendingAssociation.todoTitle}”
            </Text>
          ) : null}

          <View className="mt-4 gap-3">
            {abandonNotice ? (
              <Text className="text-center text-xs" style={{ color: tokens.textMuted }}>
                {abandonNotice.title} {abandonNotice.body}
              </Text>
            ) : null}

            {summaryVisible && completionSummary ? (
              <View className="gap-3">
                <View className="items-center">
                  <Text
                    className="text-center"
                    style={{
                      fontSize: typography.metric.fontSize,
                      fontWeight: typography.metric.fontWeight,
                      color: tokens.text,
                    }}
                  >
                    Focused {completionSummary.minutes} min
                  </Text>
                  {completionSummary.linkedTodoTitle ? (
                    <Text
                      className="mt-1 text-center text-sm"
                      style={{ color: tokens.textMuted }}
                      numberOfLines={1}
                    >
                      {completionSummary.linkedTodoTitle}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-center text-xs" style={{ color: tokens.textMuted }}>
                    {summaryTodayMinutes} min focused today
                  </Text>
                </View>
                {notePromptSessionId ? (
                  <SessionNotePrompt
                    sessionId={notePromptSessionId}
                    onSaved={() => {
                      setNotePromptSessionId(null);
                      void loadHistory();
                    }}
                    onDismiss={() => setNotePromptSessionId(null)}
                  />
                ) : null}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      label={`Start ${getModeLabel(currentMode).toLowerCase()}`}
                      onPress={startBreakFromSummary}
                      color={COLOR}
                    />
                  </View>
                  <View className="flex-1">
                    <Button label="Done" variant="ghost" onPress={dismissCompletionSummary} />
                  </View>
                </View>
              </View>
            ) : (
              <>
                {!isRunning && !isPaused && remaining === totalSeconds ? (
                  <Button label={startLabel} onPress={() => void start()} color={COLOR} />
                ) : null}

                {isRunning ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button label="Pause" variant="ghost" onPress={pause} />
                    </View>
                    <View className="flex-1">
                      <Button
                        label={`${abandonLabel} (not logged)`}
                        variant="ghost"
                        onPress={reset}
                      />
                    </View>
                  </View>
                ) : null}

                {isPaused && !isRunning ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button label="Resume" onPress={resume} color={COLOR} />
                    </View>
                    <View className="flex-1">
                      <Button
                        label={`${abandonLabel} (not logged)`}
                        variant="ghost"
                        onPress={reset}
                      />
                    </View>
                  </View>
                ) : null}

                {remaining === 0 && !isRunning && !isPaused ? (
                  <Button label={startLabel} onPress={() => void start()} color={COLOR} />
                ) : null}
              </>
            )}
          </View>

          {!summaryVisible &&
          !isRunning &&
          !isPaused &&
          remaining === getModeDuration(currentMode, settings) ? (
            <Text className="mt-3 text-center text-xs" style={{ color: tokens.textMuted }}>
              Up next: {getModeLabel(upNextMode)} ({upNextMinutes} min)
            </Text>
          ) : null}
        </Card>
      </ScreenSection>

      {notePromptSessionId && !activeSession && !summaryVisible ? (
        <ScreenSection>
          <Card
            variant="header"
            accentColor={COLOR}
            headerTitle="Session complete"
            headerSubtitle="Add an optional note to remember what this session was for."
            className="mb-0"
          >
            <SessionNotePrompt
              sessionId={notePromptSessionId}
              onSaved={() => {
                setNotePromptSessionId(null);
                void loadHistory();
              }}
              onDismiss={() => setNotePromptSessionId(null)}
            />
          </Card>
        </ScreenSection>
      ) : null}

      {!activeSession && currentMode === 'focus' ? (
        <ScreenSection>
          <Card
            variant="header"
            accentColor={COLOR}
            headerTitle="Link a todo"
            headerSubtitle={
              pendingAssociation
                ? `Next focus will be linked to “${pendingAssociation.todoTitle}”.`
                : 'Optionally attach an open todo to your next focus session.'
            }
            className="mb-0"
          >
            {showLinkTodo ? (
              <View className="gap-3">
                <TodoAssociationPicker
                  todos={todos}
                  selected={pendingAssociation}
                  onSelect={setPendingAssociation}
                  onRetryLoad={() => void loadTodos()}
                  loading={todosLoading}
                />
                <View className="self-start">
                  <Button label="Done" variant="ghost" onPress={() => setShowLinkTodo(false)} />
                </View>
              </View>
            ) : (
              <View className="self-start">
                <Button
                  label={pendingAssociation ? 'Change linked todo' : 'Choose a todo'}
                  variant="ghost"
                  onPress={() => {
                    setShowLinkTodo(true);
                    if (todos.length === 0) void loadTodos();
                  }}
                />
              </View>
            )}
          </Card>
        </ScreenSection>
      ) : null}

      {!activeSession ? (
        <ScreenSection>
          <Card
            variant="header"
            accentColor={COLOR}
            headerTitle="Presets"
            headerSubtitle="Switch the rhythm; tap the timer to edit exact durations."
            className="mb-0"
          >
            <PomodoroPresetSelector
              presets={presets}
              activePresetId={highlightedPresetId}
              onSelect={(p) => void handleSelectPreset(p)}
              disabled={isRunning || isPaused}
            />
          </Card>
        </ScreenSection>
      ) : null}

      {showSettings ? (
        <ScreenSection>
          <PomodoroSettingsInline
            settings={settings}
            onSave={handleSaveSettings}
            onCancel={() => setShowSettings(false)}
          />
        </ScreenSection>
      ) : null}

      {!activeSession ? (
        <ScreenSection className="mb-0">
          <Card
            variant="header"
            accentColor={COLOR}
            headerTitle="Focus history"
            headerSubtitle="Recent sessions, garden view, and the last 52 weeks of activity."
            className="mb-0"
          >
            <RecentSessionsList sessions={sessions} />
            <View className="mt-4">
              <GardenGrid sessions={sessions} />
            </View>
            <View className="mt-6 w-full min-w-0 items-center justify-center">
              <GitHubHeatmap days={pomodoroHeatmapDays} color={COLOR} weeks={52} />
            </View>
          </Card>
        </ScreenSection>
      ) : null}
    </Screen>
  );
}
