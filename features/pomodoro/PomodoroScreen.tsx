import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { FeatureStatCard } from '@/core/ui/FeatureStatCard';
import { PageHeader } from '@/core/ui/PageHeader';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { typography } from '@/core/theme/designTokens';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useCommandLauncherSuppressed } from '@/features/command/commandCenterContext';
import { useGamification } from '@/features/gamification/gamificationContext';
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
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import type { PomodoroSession } from './types';
import { cancelScheduledNotification, scheduleTimerEndNotification } from '@/lib/notifications';
import {
  buildPomodoroHeatmapDays,
  applySettingsToTimerState,
  computeFocusStats,
  computePomodoroStreakFromHeatmapDays,
  describeCyclePosition,
  DEFAULT_SETTINGS,
  BUILT_IN_PRESETS,
  findPresetById,
  getModeColor,
  getModeDuration,
  getModeLabel,
  getNextMode,
  matchPresetBySettings,
  planActiveTimerReconcile,
  planSessionCompletion,
  resolveActivePreset,
  type CompletedFocusLogPlan,
  type PomodoroMode,
  type PomodoroPreset,
  type PomodoroSettings,
} from './pomodoro.domain';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { GardenGrid } from './GardenGrid';
import { BackgroundWarning } from './BackgroundWarning';
import { PomodoroSettingsInline } from './PomodoroSettingsInline';
import { PomodoroPresetSelector } from './PomodoroPresetSelector';
import { TodoAssociationPicker } from './TodoAssociationPicker';
import { SessionNotePrompt } from './SessionNotePrompt';
import { RecentSessionsList } from './RecentSessionsList';
import { PomodoroPresetManagerModal } from './PomodoroPresetManager';
import { SessionMetaEditModal } from './SessionMetaEditModal';
import {
  usePomodoroCommandBridge,
  type PomodoroCommandStartResult,
} from './pomodoroCommandBridgeContext';

const COLOR = SECTION_COLORS[POMODORO_SECTION_KEY];

/** Accessible name of the timer region; stable across all six timer states. */
const TIMER_REGION_LABEL = 'Focus timer';

type TimerNotice = { title: string; body: string };

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
  const { recordAction } = useGamification();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const dayGeneration = useDayRolloverGeneration();
  const { begin: beginRefresh } = useGuardedAsyncRefresh();
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
  const [presetManagerVisible, setPresetManagerVisible] = useState(false);
  const [metaEditSession, setMetaEditSession] = useState<PomodoroSession | null>(null);
  const [interruptedNotice, setInterruptedNotice] = useState<TimerNotice | null>(null);
  /** A completed session recovered from a durable intent after a reload. */
  const [recoveredNotice, setRecoveredNotice] = useState<TimerNotice | null>(null);
  const [logSaveFailed, setLogSaveFailed] = useState(false);
  /** Native end-notification scheduling failed. Web null is not a failure. */
  const [notificationScheduleFailed, setNotificationScheduleFailed] = useState(false);
  /** Secondary disclosure for history, garden, heatmap, and detailed stats. */
  const [showHistory, setShowHistory] = useState(false);
  /** Polite status line: updated on phase changes only, never per second. */
  const [phaseAnnouncement, setPhaseAnnouncement] = useState<string | null>(null);
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
  /** Live in-flight flag for async callbacks: a closure `isRunning` goes stale
   *  across an await, and a preset or settings write resolved mid-start must
   *  never rewrite the clock of the session that just began. */
  const sessionActiveRef = useRef(false);
  const startRef = useRef<((minutes?: number) => Promise<PomodoroCommandStartResult>) | null>(null);

  useEffect(() => {
    currentModeRef.current = currentMode;
    completedFocusRef.current = completedFocus;
    settingsRef.current = settings;
    totalSecondsRef.current = totalSeconds;
    startedAtRef.current = startedAt;
    pendingAssociationRef.current = pendingAssociation;
    sessionActiveRef.current = startInFlightRef.current || isRunning || isPaused;
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

  const loadSettings = useCallback(
    async (isCurrent?: () => boolean) => {
      const current = isCurrent ?? beginRefresh();
      const nextSettings = await getPomodoroSettings();
      if (!current()) return;
      // Read the live timer state through refs: this loader is recreated
      // rarely, and a session started during the read must keep its clock.
      const sessionActive = sessionActiveRef.current;
      const nextTimer = applySettingsToTimerState(nextSettings, {
        currentMode: currentModeRef.current,
        isRunning: sessionActive,
        isPaused: sessionActive,
        totalSeconds: totalSecondsRef.current,
        remaining: remainingRef.current,
      });
      setSettings(nextTimer.settings);
      if (!sessionActive) {
        setTotalSeconds(nextTimer.totalSeconds);
        applyRemaining(nextTimer.remaining);
        totalSecondsRef.current = nextTimer.totalSeconds;
      }
    },
    [applyRemaining, beginRefresh],
  );

  const loadHistory = useCallback(
    async (isCurrent?: () => boolean) => {
      const current = isCurrent ?? beginRefresh();
      const start364 = new Date();
      start364.setDate(start364.getDate() - 363);
      const startKey = toDateKey(start364);
      const endKey = toDateKey(new Date());
      const rows = await listPomodoroSessionsForDateRange(startKey, endKey);
      if (!current()) return;
      // Break rows never reach the focus surfaces (count card, garden, heatmap).
      const focusOnly = rows.filter((row) => row.session_type === 'focus');
      setSessions(focusOnly);
    },
    [beginRefresh],
  );

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

  const retryPendingLogs = useCallback(
    async (isCurrent?: () => boolean) => {
      try {
        const result = await retryPendingPomodoroLogs();
        if (result.finalFailures.length > 0) {
          setLogSaveFailed(true);
        }
        if (result.succeeded > 0) {
          void loadHistory(isCurrent);
        }
      } catch {
        // Recovery is best-effort; the queue stays durable for the next retry.
      }
    },
    [loadHistory],
  );

  const refresh = useCallback(async () => {
    // One refresh generation owns every concurrent sub-read: per-loader
    // begin() calls would invalidate each other and discard this unit's
    // own in-flight results (the J1 step-8 focus-history regression).
    const isCurrent = beginRefresh();
    await Promise.all([
      loadHistory(isCurrent),
      loadSettings(isCurrent),
      loadPresets(),
      retryPendingLogs(isCurrent),
    ]);
  }, [beginRefresh, loadHistory, loadPresets, loadSettings, retryPendingLogs]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  /**
   * Crash/reload reconciliation (runs once per mount): decide what happened
   * to the durably-intended session, cancel the orphan OS notification, and
   * restore the cycle position. Never blocks the screen on failure.
   */
  useEffect(() => {
    void (async () => {
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
          setRecoveredNotice({
            title: 'Session recovered',
            body: 'Your focus session finished while the app was closed, so it has been logged for you.',
          });
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
    })();
  }, [loadHistory]);

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
          recordAction('focus', result.id);
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
    [loadHistory, recordAction],
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
      setPhaseAnnouncement('Focus session complete');
    } else {
      // Breaks are never logged; the acknowledgement names the break only.
      setPhaseAnnouncement('Break complete');
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
      // completion side effects live in the ref-guarded callback above.
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
      // Drop the in-flight claim before completion side effects. A confirm
      // opened against this session must not discard whatever starts next.
      sessionActiveRef.current = false;
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
    if (sessionActiveRef.current) {
      // Duration editing is unreachable while a session is in flight; even if
      // reached, saved defaults never move or abandon that session — they
      // apply to the next idle timer.
      return;
    }
    const duration = getModeDuration(currentMode, newSettings);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    applyRemaining(duration);
    lastTickTime.current = null;
    setShowSettings(false);
  };

  const start = useCallback(
    async (requestedDurationMinutes?: number): Promise<PomodoroCommandStartResult> => {
      if (startInFlightRef.current || sessionActiveRef.current) {
        return {
          outcome: 'conflict',
          message: 'A focus session is already running or paused.',
        };
      }

      startInFlightRef.current = true;
      // Claim the clock before the notification await so a preset or settings
      // write resolving mid-start cannot rewrite this session. The render
      // effect keeps the claim while startInFlightRef is set.
      sessionActiveRef.current = true;
      clearAutoStartTimer();
      let committed = false;

      try {
        // Read the live timer configuration through refs: a preset or
        // settings write that resolved while this press was in flight must
        // still be the configuration the new session starts from.
        const mode = requestedDurationMinutes === undefined ? currentModeRef.current : 'focus';
        const duration =
          requestedDurationMinutes === undefined
            ? getModeDuration(mode, settingsRef.current)
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
        if (Platform.OS !== 'web' && id == null) {
          setNotificationScheduleFailed(true);
        }
        lastTickTime.current = Date.now();
        completionDoneRef.current = false;
        setIsRunning(true);
        setIsPaused(false);
        sessionActiveRef.current = true;
        committed = true;
        setShowSettings(false);
        setCompletionSummary(null);
        setShowHistory(false);
        setInterruptedNotice(null);
        setRecoveredNotice(null);
        setPhaseAnnouncement(
          `${getModeLabel(mode)} started — ${Math.round(duration / 60)} minutes`,
        );
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
      } catch (err) {
        if (!committed) sessionActiveRef.current = false;
        throw err;
      } finally {
        startInFlightRef.current = false;
      }
    },
    [applyRemaining, clearAutoStartTimer],
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
      void setActivePresetId(preset.id).catch(() => undefined);
      const nextSettings = {
        focusMinutes: preset.focusMinutes,
        shortBreakMinutes: preset.shortBreakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      };
      // A session that began while the selection was persisting must keep its
      // clock: the preset applies to the next idle timer, never to an
      // in-flight one. The live ref — not the render-time closure — decides.
      if (sessionActiveRef.current) return;
      // Apply to the timer synchronously: the selection is a local
      // interaction, so the next Start must read the new durations even
      // while the durable write is still in flight.
      settingsRef.current = { ...settingsRef.current, ...nextSettings };
      setSettings((prev) => ({ ...prev, ...nextSettings }));
      const duration = getModeDuration(currentModeRef.current, nextSettings);
      setTotalSeconds(duration);
      totalSecondsRef.current = duration;
      applyRemaining(duration);
      lastTickTime.current = null;
      try {
        await savePomodoroSettings(nextSettings);
      } catch {
        // The durable write failed: reconcile the timer back to the stored
        // settings on the next load instead of showing an unsaved preset.
        void loadSettings();
      }
    },
    [applyRemaining, loadSettings],
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
    setPhaseAnnouncement(`Paused — ${formatClock(remaining)} left`);
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
    if (Platform.OS !== 'web' && id == null) {
      setNotificationScheduleFailed(true);
    }
    lastTickTime.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    setPhaseAnnouncement('Resumed');
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

  /** Discard an in-flight session. Only ever called after confirmation. */
  const discardActiveSession = useCallback(() => {
    sessionActiveRef.current = false;
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
    setCompletionSummary(null);
    completionDoneRef.current = false;
    // Abandoned sessions are never logged; drop the durable intent too.
    void clearPomodoroActiveTimer().catch(() => undefined);
    setPhaseAnnouncement('Session ended — nothing logged');
  }, [applyRemaining, clearAutoStartTimer, currentMode, settings]);

  /**
   * End an in-flight focus or break session. Ending is the only discard, so
   * it always confirms first; cancelling or dismissing keeps the clock, the
   * scheduled notification, and the durable intent exactly as they were.
   */
  const requestEndSession = useCallback(async () => {
    const targetStartedAtIso = startedAtRef.current?.toISOString() ?? null;
    if (!sessionActiveRef.current || targetStartedAtIso === null) return;
    const isBreak = currentModeRef.current !== 'focus';
    const confirmed = await confirm({
      title: isBreak ? 'End this break?' : 'End this focus session?',
      message: isBreak
        ? "This unfinished break won't be logged."
        : "This unfinished session won't be logged.",
      confirmLabel: isBreak ? 'End break' : 'End session',
      cancelLabel: isBreak ? 'Keep break' : 'Keep focusing',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    // The dialog can outlive the session it opened against. Natural
    // completion logs that session; auto-start may already have begun the
    // next one. Confirming then must not discard either outcome.
    const stillThatSession =
      sessionActiveRef.current && startedAtRef.current?.toISOString() === targetStartedAtIso;
    if (!stillThatSession) return;
    discardActiveSession();
  }, [confirm, discardActiveSession]);

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

  const cycleSentence = describeCyclePosition({
    mode: currentMode,
    completedFocus,
    settings,
  });

  // Reduced-chrome active sessions and the completion-summary overlay.
  const activeSession = isRunning || isPaused;
  const summaryVisible = completionSummary !== null && !activeSession;
  const showConfiguration = !activeSession && !summaryVisible;
  const idleUntouched = !activeSession && !summaryVisible && remaining === totalSeconds;

  // Historical models are derived only when the History disclosure is open;
  // the one-second tick must never recompute or mount them.
  const todayKey = toDateKey(new Date());
  const focusStats = useMemo(
    () => (showHistory ? computeFocusStats(sessions, new Date()) : null),
    [showHistory, sessions],
  );
  const pomodoroHeatmapDays = useMemo(
    () => (showHistory ? buildPomodoroHeatmapDays(sessions, 364) : []),
    [showHistory, sessions],
  );
  const pomodoroStreak = useMemo(
    () => (showHistory ? computePomodoroStreakFromHeatmapDays(pomodoroHeatmapDays) : 0),
    [showHistory, pomodoroHeatmapDays],
  );
  // Today's total including the just-finished session even before the history
  // reload lands (exact started_at match against the loaded rows).
  const summaryTodayMinutes = useMemo(() => {
    if (completionSummary === null) return 0;
    let todayMinutes = 0;
    for (const session of sessions) {
      if (
        session.session_type === 'focus' &&
        toDateKey(new Date(session.started_at)) === todayKey
      ) {
        todayMinutes += Math.max(0, Math.round(session.duration_seconds / 60));
      }
    }
    const alreadyCounted = sessions.some(
      (session) => session.started_at === completionSummary.startedAtIso,
    );
    return todayMinutes + (alreadyCounted ? 0 : completionSummary.minutes);
  }, [completionSummary, sessions, todayKey]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  const modeColors = getModeColor(currentMode);
  const startLabel =
    currentMode === 'focus' ? 'Start focus' : `Start ${getModeLabel(currentMode).toLowerCase()}`;

  /** On-request timer status: phase plus remaining time, never per-second. */
  const timerStatus = isRunning
    ? `${getModeLabel(currentMode)} running, ${minutes}:${seconds} remaining`
    : isPaused
      ? `Paused, ${minutes}:${seconds} remaining`
      : summaryVisible && completionSummary
        ? `Completed, ${completionSummary.minutes} minutes focused`
        : `Ready, ${minutes}:${seconds} selected`;

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader title="Focus" />
      </ScreenSection>

      <BackgroundWarning visible={showWarning} onDismiss={() => setShowWarning(false)} />

      {interruptedNotice || recoveredNotice || logSaveFailed || notificationScheduleFailed ? (
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
          {recoveredNotice ? (
            <View
              className="mb-3 rounded-2xl border px-3 py-2"
              style={{
                borderColor: tokens.successBorder,
                backgroundColor: tokens.successBackground,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.successText }}>
                {recoveredNotice.title}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.successText }}>
                {recoveredNotice.body}
              </Text>
              <View className="mt-2 self-start">
                <Button label="Dismiss" variant="ghost" onPress={() => setRecoveredNotice(null)} />
              </View>
            </View>
          ) : null}
          {notificationScheduleFailed ? (
            <View
              className="mb-3 rounded-2xl border px-3 py-2"
              style={{
                borderColor: tokens.warningBorder,
                backgroundColor: tokens.warningBackground,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.warningText }}>
                End notification was not scheduled
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.warningText }}>
                The countdown is still running. Notification permission or scheduling failed, so you
                may not be alerted when it ends.
              </Text>
              <View className="mt-2 self-start">
                <Button
                  label="Dismiss"
                  variant="ghost"
                  onPress={() => setNotificationScheduleFailed(false)}
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

      <ScreenSection>
        <Card variant="standard" accentColor={COLOR} className="mb-0">
          <View
            accessibilityRole="timer"
            accessibilityLabel={TIMER_REGION_LABEL}
            className="w-full items-center"
          >
            <Text
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: tokens.textMuted }}
            >
              {summaryVisible
                ? 'Session complete'
                : isPaused
                  ? `Paused · ${getModeLabel(currentMode)}`
                  : getModeLabel(currentMode)}
            </Text>

            {summaryVisible && completionSummary ? (
              <>
                <Text
                  className="mt-2 text-center"
                  style={{
                    fontSize: typography.metric.fontSize,
                    fontWeight: typography.metric.fontWeight,
                    color: tokens.text,
                  }}
                  accessibilityLabel={timerStatus}
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
              </>
            ) : (
              <Text
                className={`mt-2 text-center text-5xl font-semibold ${modeColors.text}`}
                accessibilityLabel={timerStatus}
              >
                {minutes}:{seconds}
              </Text>
            )}

            {cycleSentence ? (
              <Text
                className="mt-2 text-center text-xs"
                style={{ color: tokens.textMuted }}
                accessibilityRole="text"
              >
                {cycleSentence}
              </Text>
            ) : null}

            {activeSession && pendingAssociation ? (
              <Text
                className="mt-2 text-center text-xs"
                style={{ color: tokens.textMuted }}
                numberOfLines={1}
              >
                Focusing on “{pendingAssociation.todoTitle}”
              </Text>
            ) : null}

            {phaseAnnouncement ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-1 text-center text-xs"
                style={{ color: tokens.textMuted }}
              >
                {phaseAnnouncement}
              </Text>
            ) : null}
          </View>

          <View className="mt-4 gap-3">
            {summaryVisible && completionSummary ? (
              <>
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
                <View className="flex-row flex-wrap gap-3">
                  <View className="min-w-[8rem] flex-1">
                    <Button
                      label={startLabel}
                      onPress={startBreakFromSummary}
                      color={COLOR}
                      fullWidth
                    />
                  </View>
                  <View className="min-w-[8rem] flex-1">
                    <Button
                      label="Done"
                      variant="ghost"
                      onPress={dismissCompletionSummary}
                      fullWidth
                    />
                  </View>
                </View>
              </>
            ) : null}

            {idleUntouched ? (
              <Button label={startLabel} onPress={() => void start()} color={COLOR} fullWidth />
            ) : null}

            {isRunning ? (
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[6rem] flex-1">
                  <Button label="Pause" variant="ghost" onPress={pause} fullWidth />
                </View>
                <View className="min-w-[6rem] flex-1">
                  <Button
                    label="End"
                    variant="ghost"
                    onPress={() => void requestEndSession()}
                    fullWidth
                  />
                </View>
              </View>
            ) : null}

            {isPaused ? (
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[6rem] flex-1">
                  <Button label="Resume" onPress={() => void resume()} color={COLOR} fullWidth />
                </View>
                <View className="min-w-[6rem] flex-1">
                  <Button
                    label="End"
                    variant="ghost"
                    onPress={() => void requestEndSession()}
                    fullWidth
                  />
                </View>
              </View>
            ) : null}

            {showConfiguration ? (
              <Text className="text-center text-xs" style={{ color: tokens.textMuted }}>
                Up next: {getModeLabel(upNextMode)} ({upNextMinutes} min)
              </Text>
            ) : null}
          </View>
        </Card>
      </ScreenSection>

      {notePromptSessionId && showConfiguration ? (
        <ScreenSection>
          <Card variant="standard" accentColor={COLOR} className="mb-0">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Session complete
            </Text>
            <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
              Add an optional note to remember what this session was for.
            </Text>
            <View className="mt-3">
              <SessionNotePrompt
                sessionId={notePromptSessionId}
                onSaved={() => {
                  setNotePromptSessionId(null);
                  void loadHistory();
                }}
                onDismiss={() => setNotePromptSessionId(null)}
              />
            </View>
          </Card>
        </ScreenSection>
      ) : null}

      {showConfiguration ? (
        <ScreenSection>
          <Card variant="standard" accentColor={COLOR} className="mb-0">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Session length
            </Text>
            <View className="mt-3">
              <SegmentedControl
                options={(['focus', 'short_break', 'long_break'] as PomodoroMode[]).map((mode) => ({
                  value: mode,
                  label: getModeLabel(mode),
                }))}
                value={currentMode}
                onChange={(mode) => {
                  clearAutoStartTimer();
                  // Idle-only control: configuration never discards a session,
                  // so switching here just selects the next timer to run.
                  setCompletionSummary(null);
                  setCurrentMode(mode);
                  currentModeRef.current = mode;
                  const d = getModeDuration(mode, settings);
                  setTotalSeconds(d);
                  totalSecondsRef.current = d;
                  applyRemaining(d);
                  lastTickTime.current = null;
                  setStartedAt(null);
                  startedAtRef.current = null;
                }}
                accentColor={COLOR}
                accessibilityLabel="Focus timer mode"
              />
            </View>
            <View className="mt-4">
              <PomodoroPresetSelector
                presets={presets}
                activePresetId={highlightedPresetId}
                onSelect={(p) => void handleSelectPreset(p)}
              />
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Button
                label="Edit durations"
                variant="ghost"
                onPress={() => setShowSettings((v) => !v)}
              />
              <Button
                label="Manage presets"
                accessibilityLabel="Manage presets"
                variant="ghost"
                onPress={() => setPresetManagerVisible(true)}
              />
            </View>
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

      {showConfiguration && currentMode === 'focus' ? (
        <ScreenSection>
          <Card variant="standard" accentColor={COLOR} className="mb-0">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Link a todo
            </Text>
            <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
              {pendingAssociation
                ? `Next focus will be linked to “${pendingAssociation.todoTitle}”.`
                : 'Optionally attach an open todo to your next focus session.'}
            </Text>
            {showLinkTodo ? (
              <View className="mt-3 gap-3">
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
              <View className="mt-3 self-start">
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

      {showConfiguration ? (
        <ScreenSection>
          <View className="self-start">
            <Button
              label={showHistory ? 'Hide history' : 'History'}
              variant="ghost"
              onPress={() => setShowHistory((v) => !v)}
            />
          </View>
        </ScreenSection>
      ) : null}

      {showConfiguration && showHistory ? (
        <ScreenSection className="mb-0">
          <Card variant="standard" accentColor={COLOR} className="mb-0">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Focus history
            </Text>
            <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
              Recent sessions, garden, and the last 52 weeks of activity.
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-3">
              <View className="min-w-[200px] flex-1">
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
              <View className="min-w-[200px] flex-1">
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
            {focusStats ? (
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
                    note={
                      focusStats.bestDay ? `Best on ${focusStats.bestDay.dateKey}` : 'No data yet'
                    }
                  />
                </View>
              </View>
            ) : null}
            <View className="mt-4">
              <RecentSessionsList
                sessions={sessions}
                onEdit={(session) => {
                  setMetaEditSession(session);
                  if (todos.length === 0) void loadTodos();
                }}
              />
            </View>
            <View className="mt-4">
              <GardenGrid sessions={sessions} />
            </View>
            <View className="mt-6 w-full min-w-0 items-center justify-center">
              <GitHubHeatmap days={pomodoroHeatmapDays} color={COLOR} weeks={52} />
            </View>
          </Card>
        </ScreenSection>
      ) : null}

      <PomodoroPresetManagerModal
        visible={presetManagerVisible}
        presets={presets}
        onClose={() => setPresetManagerVisible(false)}
        onChanged={() => void refresh()}
      />
      <SessionMetaEditModal
        visible={metaEditSession !== null}
        session={metaEditSession}
        todos={todos}
        todosLoading={todosLoading}
        onClose={() => setMetaEditSession(null)}
        onRetryLoadTodos={() => void loadTodos()}
        onSaved={() => {
          setMetaEditSession(null);
          void refresh();
        }}
      />
      {confirmationDialog}
    </Screen>
  );
}

/** MM:SS for a remaining-seconds value, used in status announcements. */
function formatClock(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
