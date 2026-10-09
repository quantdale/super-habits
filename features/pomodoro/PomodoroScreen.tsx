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
  timerEndNotificationCopy,
  type CompletedFocusLogPlan,
  type PomodoroMode,
  type PomodoroPreset,
  type PomodoroSettings,
} from './pomodoro.domain';
import {
  isSessionActive,
  mayMutateConfiguration,
  mayOfferConfiguration,
  planTimerStartup,
  resolvePhaseAnnouncement,
  resolvePhaseHeadline,
  resolveTimerStatus,
  runTimerStartup,
  type RenderedTimerState,
  type TimerStartupOutcome,
} from './pomodoro.startup';
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
  /**
   * Rendered mirror of `startInFlightRef`: a start has been accepted and its
   * end-notification scheduling is still pending. Starting is a real session,
   * so configuration is withdrawn and a second start conflicts from the very
   * first render after the press — not from the await onward.
   */
  const [isStarting, setIsStarting] = useState(false);
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
  /** Startup was rejected: the timer never started and nothing was recorded. */
  const [startFailedNotice, setStartFailedNotice] = useState(false);
  /** Secondary disclosure for history, garden, heatmap, and detailed stats. */
  const [showHistory, setShowHistory] = useState(false);
  /** Polite status line: updated on phase changes only, never per second. */
  const [phaseAnnouncement, setPhaseAnnouncement] = useState<string | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const lastTickTime = useRef<number | null>(null);
  /**
   * Synchronous "a start is in flight" claim. `start()` sets it before its
   * first await so every callback racing the startup reads an active session.
   */
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
  /**
   * Live in-flight flag for async callbacks: a closure `isRunning` goes stale
   * across an await, and a preset or settings write resolved mid-start must
   * never rewrite the clock of the session that just began. It is the union
   * authority (`starting || running || paused`) written wherever the phase
   * changes; every configuration guard reads it through
   * `mayMutateConfiguration` so the invariant has exactly one definition.
   */
  const sessionActiveRef = useRef(false);
  const startRef = useRef<((minutes?: number) => Promise<PomodoroCommandStartResult>) | null>(null);

  /**
   * Synchronous claims read by every guard. Both are refs, so a stale render,
   * a queued press, or a keyboard event cannot observe an idle timer while a
   * session is actually claimed.
   */
  const sessionClaims = useCallback(
    () => ({ starting: startInFlightRef.current, active: sessionActiveRef.current }),
    [],
  );
  /** Rendered phase booleans used for copy; always fresh in the render closure. */
  const renderedPhase: RenderedTimerState = { isStarting, isRunning, isPaused };

  useEffect(() => {
    currentModeRef.current = currentMode;
    completedFocusRef.current = completedFocus;
    settingsRef.current = settings;
    totalSecondsRef.current = totalSeconds;
    startedAtRef.current = startedAt;
    pendingAssociationRef.current = pendingAssociation;
    // Repair the union authority from the rendered phase. The synchronous
    // write sites (start claim, natural completion, confirmed End) already own
    // the truth; this only keeps a session that outlived a state update from
    // being read back as idle.
    if (!startInFlightRef.current && (isRunning || isPaused)) sessionActiveRef.current = true;
  });
  useCommandLauncherSuppressed('pomodoro-active-session', isStarting || isRunning || isPaused);

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
    // Re-read the live claims AFTER the durable write: a session accepted while
    // this save was in flight must keep its clock, and the pre-await closure
    // would have missed it. Duration editing is unreachable while a session is
    // in flight; even if reached here, saved defaults never move or abandon
    // that session — they apply to the next idle timer.
    if (isSessionActive(sessionClaims())) return;
    const duration = getModeDuration(currentMode, newSettings);
    setTotalSeconds(duration);
    totalSecondsRef.current = duration;
    applyRemaining(duration);
    lastTickTime.current = null;
    setShowSettings(false);
  };

  const start = useCallback(
    async (requestedDurationMinutes?: number): Promise<PomodoroCommandStartResult> => {
      // Read the live session claims, never the render closure: a queued second
      // press, a command request, or an automated action arriving while a start
      // is in flight must conflict instead of claiming a second session.
      if (!mayMutateConfiguration(sessionClaims())) {
        return {
          outcome: 'conflict',
          message: 'A focus session is already running or paused.',
        };
      }

      // Claim the clock before the first await. This claim is the authority for
      // the whole startup: every configuration callback, the command bridge,
      // and a repeated press read it, and `isStarting` withdraws the
      // configuration surfaces on the very next render.
      startInFlightRef.current = true;
      sessionActiveRef.current = true;
      setIsStarting(true);
      clearAutoStartTimer();
      // Duration editing is an idle surface: close the inline editor
      // synchronously so it can neither stay visible nor save mid-startup.
      setShowSettings(false);
      try {
        // Read the live configuration through refs: a preset or settings write
        // that resolved while this press was in flight must still be the
        // configuration the new session starts from.
        const plan = planTimerStartup(
          { requestedDurationMinutes },
          {
            mode: currentModeRef.current,
            settings: settingsRef.current,
            completedFocus: completedFocusRef.current,
          },
          new Date(),
        );
        // Commit the clock from the plan, not from state, so the displayed
        // duration, the notification, and the durable snapshot agree from the
        // first startup render onward.
        setCurrentMode(plan.mode);
        currentModeRef.current = plan.mode;
        setStartedAt(plan.startedAt);
        startedAtRef.current = plan.startedAt;
        applyRemaining(plan.durationSeconds);
        setTotalSeconds(plan.durationSeconds);
        totalSecondsRef.current = plan.durationSeconds;
        setCompletionSummary(null);
        setInterruptedNotice(null);
        setRecoveredNotice(null);
        setNotificationScheduleFailed(false);
        setShowHistory(false);
        setPhaseAnnouncement(
          resolvePhaseAnnouncement(
            { isStarting: true, isRunning: false, isPaused: false },
            plan.mode,
            plan.durationSeconds,
          ),
        );

        const outcome: TimerStartupOutcome = await runTimerStartup(
          plan,
          {
            scheduleTimerEndNotification,
            platform: Platform.OS === 'web' ? 'web' : 'native',
            cancelScheduledNotification,
          },
          {
            cancelPreviousNotification: () => {
              void cancelScheduledNotification(notificationIdRef.current);
              notificationIdRef.current = null;
            },
            commit: ({ notificationId }) => {
              notificationIdRef.current = notificationId;
              // The tick baseline starts here, never at claim time: no tick may
              // elapse while scheduling is still pending.
              lastTickTime.current = Date.now();
              completionDoneRef.current = false;
              setIsRunning(true);
              setIsPaused(false);
              sessionActiveRef.current = true;
              setPhaseAnnouncement(plan.announcement);
              // Durable intent: a crash/reload mid-session is reconciled on the
              // next launch instead of vanishing behind an orphan notification.
              void savePomodoroActiveTimer({ ...plan.intent, notificationId }).catch(
                () => undefined,
              );
            },
            reportScheduleWarning: () => setNotificationScheduleFailed(true),
            recover: () => {
              // A rejected startup leaves no session, no durable intent, no
              // orphan notification, and an idle, startable clock.
              setStartFailedNotice(true);
              setPhaseAnnouncement('Timer did not start');
              notificationIdRef.current = null;
              lastTickTime.current = null;
              completionDoneRef.current = false;
              setIsRunning(false);
              setIsPaused(false);
              setStartedAt(null);
              startedAtRef.current = null;
              const idle = getModeDuration(currentModeRef.current, settingsRef.current);
              applyRemaining(idle);
              setTotalSeconds(idle);
              totalSecondsRef.current = idle;
              void clearPomodoroActiveTimer().catch(() => undefined);
              setPhaseAnnouncement(null);
            },
          },
        );
        // A failed startup surfaces as a screen state change (idle again) plus
        // a truthful command result; it never throws into a press handler.
        return outcome.outcome === 'failed'
          ? { outcome: 'failed', message: outcome.message }
          : { outcome: 'started' };
      } finally {
        // The claim ends here whether the startup became a session or was
        // recovered; `isStarting` is its rendered mirror.
        startInFlightRef.current = false;
        setIsStarting(false);
      }
    },
    [applyRemaining, clearAutoStartTimer, sessionClaims],
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
      // The live claims decide, never the render-time closure. Choosing a
      // preset while a session is accepted — including a startup still
      // awaiting its end notification — is a selection for the NEXT timer: the
      // clock of the running session is untouched, and so is the preset that
      // governs its auto-start, which is frozen with it at claim time.
      const sessionActive = isSessionActive(sessionClaims());
      if (!sessionActive) {
        // Apply to the timer synchronously: the selection is a local
        // interaction, so the next Start must read the new durations even
        // while the durable write is still in flight.
        activePresetRef.current = preset;
      }
      setStoredActivePresetIdState(preset.id);
      setCompletionSummary(null);
      void setActivePresetId(preset.id).catch(() => undefined);
      const nextSettings = {
        focusMinutes: preset.focusMinutes,
        shortBreakMinutes: preset.shortBreakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      };
      if (sessionActive) return;
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
    [applyRemaining, loadSettings, sessionClaims],
  );

  useEffect(
    () =>
      registerCommandTimer({
        startFocusSession,
        isRunning,
        isPaused,
        // A startup still awaiting its notification is a session: a command
        // start must conflict with it, not queue a second timer.
        isStarting,
      }),
    [isPaused, isRunning, isStarting, registerCommandTimer, startFocusSession],
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
    const { title, body } = timerEndNotificationCopy(currentMode);
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
    // The governing preset of an accepted session is frozen with it: a selection
    // landing mid-session governs the NEXT timer, and the effect that would
    // otherwise re-sync it must not reach back into the running session.
    // Re-syncing on the transition out of a session keeps the idle timer
    // following the stored selection again.
    if (sessionActiveRef.current) return;
    activePresetRef.current = activePreset;
  }, [activePreset, isStarting, isPaused, isRunning]);

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
  // `isStarting` is part of the active-session class: a session accepted for
  // start withdraws configuration from the first render after the press.
  const activeSession = isStarting || isRunning || isPaused;
  const summaryVisible = completionSummary !== null && !activeSession;
  const showConfiguration = mayOfferConfiguration(
    { starting: isStarting, active: isRunning || isPaused },
    summaryVisible,
  );
  const idleUntouched = showConfiguration && remaining === totalSeconds;

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

  /**
   * On-request timer status: phase plus remaining time, never per-second. The
   * completion wording wins only when no session of any kind is in flight.
   */
  const phaseActive = isStarting || isRunning || isPaused;
  const completedVisible = summaryVisible && completionSummary !== null && !phaseActive;
  const timerStatus = completedVisible
    ? `Completed, ${completionSummary?.minutes} minutes focused`
    : resolveTimerStatus(renderedPhase, getModeLabel(currentMode), `${minutes}:${seconds}`);

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader title="Focus" />
      </ScreenSection>

      <BackgroundWarning visible={showWarning} onDismiss={() => setShowWarning(false)} />

      {interruptedNotice ||
      recoveredNotice ||
      logSaveFailed ||
      notificationScheduleFailed ||
      startFailedNotice ? (
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
          {startFailedNotice ? (
            <View
              className="mt-3 rounded-2xl border px-3 py-2"
              style={{
                borderColor: tokens.warningBorder,
                backgroundColor: tokens.warningBackground,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.warningText }}>
                The timer did not start
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.warningText }}>
                The countdown could not be scheduled, so nothing was recorded. Try starting the
                timer again.
              </Text>
              <View className="mt-2 self-start">
                <Button
                  label="Dismiss"
                  variant="ghost"
                  onPress={() => setStartFailedNotice(false)}
                />
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
                : resolvePhaseHeadline(renderedPhase, getModeLabel(currentMode))}
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

            {/* Exactly one startup action: the press is accepted and its
                end-notification scheduling is pending, so Start is shown once,
                disabled, and labelled. No second Start button exists in this
                phase, and the clock above is the selected duration, not a
                countdown that already started. */}
            {isStarting ? (
              <Button
                label="Starting…"
                accessibilityLabel={`${startLabel} — starting`}
                variant="ghost"
                disabled
                onPress={() => {}}
                fullWidth
              />
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
                  // The guard is synchronous and reads the live claims, so it
                  // holds for a stale render, a queued press, a keyboard arrow,
                  // and a callback captured before Start. A mode switch resets
                  // timer references, so it may never run against a session
                  // that is already claimed — including one whose notification
                  // is still being scheduled.
                  if (!mayMutateConfiguration(sessionClaims())) return;
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
