import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, Modal, Platform, Text, View } from 'react-native';
import { initializeDatabase } from '@/core/db/client';
import { accountCoordinator } from '@/core/auth/accountCoordinator';
import type { AccountActionResult, AccountState } from '@/core/auth/account.types';
import { registerServiceWorker } from '@/core/pwa/registerServiceWorker';
import { syncEngine } from '@/core/sync/sync.engine';
import {
  dismissCurrentRestorePrompt,
  getRestorePreview,
  restoreFromRemoteBackup,
} from '@/core/sync/restore.coordinator';
import { runBackupMaintenance } from '@/core/backup/backupCheckpoint';
import { applyPendingThemeApplication } from '@/core/backup/backupSettings';
import { getDbBootstrapErrorMessage } from '@/core/providers/bootstrapErrorMessage';
import { withRemoteTimeout } from '@/core/providers/remotePhase';
import {
  createPreviewAdoptionGuard,
  type PreviewAdoptionGuard,
} from '@/core/providers/previewAdoption';
import { resolveRestorePromptOutcome } from '@/core/providers/restorePromptFlow';
import type { RestorePreview } from '@/core/sync/restore.types';
import { InAppNoticeProvider } from '@/core/providers/InAppNoticeProvider';
import { DayRolloverProvider } from '@/core/providers/DayRolloverProvider';
import {
  isRemoteEnabled,
  startSupabaseAutoRefresh,
  stopSupabaseAutoRefresh,
  supabase,
} from '@/lib/supabase';
import { ThemeProvider } from '@/core/providers/ThemeProvider';
import { useAppTheme } from '@/core/providers/themeContext';
import { AppBootstrapStateContext } from '@/core/providers/appBootstrapContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { HabitReminderHost } from '@/core/notifications/HabitReminderHost';
import { WorkoutReminderHost } from '@/core/notifications/WorkoutReminderHost';
import { PomodoroCommandBridgeProvider } from '@/features/pomodoro/pomodoroCommandBridge';

export function AppProviders({ children }: PropsWithChildren) {
  const [dbError, setDbError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);
  const [syncHydrated, setSyncHydrated] = useState(false);
  const [accountState, setAccountState] = useState<AccountState>({
    status: 'remote_unavailable',
    email: null,
    isAnonymous: null,
    hasOwnerBinding: false,
    hasUserData: false,
    pendingOutboxCount: 0,
    canProtect: false,
    canRecoverExisting: false,
    canRecoverOwner: false,
    canRecoverImportedOwner: false,
    message: 'Account status is loading.',
    resendAvailableAt: null,
  });
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorePromptBusy, setRestorePromptBusy] = useState(false);
  const [restorePromptError, setRestorePromptError] = useState<string | null>(null);

  /**
   * Monotonic token for account-state tasks. Any newer task (refresh,
   * protection/recovery action, bootstrap retry) invalidates older tasks'
   * settlements so a hung remote phase that finally settles can never
   * overwrite fresher account state (stale-async overwrite class).
   */
  const accountTaskSeqRef = useRef(0);
  const beginAccountTask = useCallback(() => ++accountTaskSeqRef.current, []);
  const applyAccountStateIfCurrent = useCallback((taskId: number, state: AccountState) => {
    if (taskId === accountTaskSeqRef.current) setAccountState(state);
  }, []);
  const awaitAccountTask = useCallback(
    async (
      taskId: number,
      task: Promise<AccountState>,
      label: string,
    ): Promise<AccountState | null> => {
      try {
        const state = await task;
        return taskId === accountTaskSeqRef.current ? state : null;
      } catch (e) {
        console.error(`[auth] ${label} settled with an error`, e);
        return null;
      }
    },
    [],
  );

  /**
   * Monotonic adoption authority for restore-preview state (F-03). A preview
   * read may outlive its bounded await; backup maintenance and post-flush
   * cycles may obtain a newer preview. Only the newest preview task may adopt,
   * so a slow older preview can never overwrite newer restore-prompt state.
   */
  const previewGuard = useMemo<PreviewAdoptionGuard>(() => createPreviewAdoptionGuard(), []);
  const beginPreviewTask = useCallback(() => previewGuard.begin(), [previewGuard]);
  const isCurrentPreview = useCallback((id: number) => previewGuard.isCurrent(id), [previewGuard]);

  useEffect(() => {
    registerServiceWorker();
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await initializeDatabase();
        // Web only: expose a boot-readiness marker so test harnesses (and
        // future boot-gated code) can observe that the schema is fully
        // migrated. The shell renders before initializeDatabase() completes,
        // so a fixed-sleep wait races migrations under load.
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          document.documentElement.dataset.dbReady = 'true';
        }
      } catch (e) {
        console.error('[db] initializeDatabase failed', e);
        if (!cancelled) {
          setDbError(
            getDbBootstrapErrorMessage({
              platformOs: Platform.OS,
              hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
            }),
          );
        }
        return;
      }

      // Durable sync hydration must precede any revision allocation or flush:
      // `syncEngine.hydrate()` restores the persisted max revision so a new
      // local write cannot allocate a low revision that loses to the durable
      // guard (`excluded.revision > sync_outbox.revision`). This is local I/O
      // and never waits on the network, so it does not wedge startup.
      await syncEngine.hydrate().catch((e) => {
        console.error('[sync] hydrate failed', e);
      });
      if (!cancelled) setSyncHydrated(true);

      try {
        // A hung network must never wedge the startup gate: bound each
        // remote wait so local use stays available. The settled result is
        // adopted only while its task is still the newest account task, so
        // a late settlement can never overwrite newer state.
        const taskId = beginAccountTask();
        const coordinatorTask = accountCoordinator.bootstrap();
        void awaitAccountTask(taskId, coordinatorTask, 'account bootstrap').then((state) => {
          if (!cancelled && state) applyAccountStateIfCurrent(taskId, state);
        });
        const nextAccountState = await withRemoteTimeout(coordinatorTask, 'account bootstrap');
        if (!cancelled) applyAccountStateIfCurrent(taskId, nextAccountState);
      } catch (e) {
        console.error('[auth] account bootstrap failed', e);
        if (!cancelled) {
          setAccountState((current) => ({
            ...current,
            status: 'error',
            message: 'Account status is temporarily unavailable. Local use remains available.',
          }));
        }
      }
      if (!cancelled) {
        setAuthBootstrapReady(true);
      }

      try {
        const taskId = beginAccountTask();
        const coordinatorTask = accountCoordinator.refresh();
        void awaitAccountTask(taskId, coordinatorTask, 'account refresh after sync hydrate').then(
          (state) => {
            if (!cancelled && state) applyAccountStateIfCurrent(taskId, state);
          },
        );
        const nextAccountState = await withRemoteTimeout(coordinatorTask, 'account refresh');
        if (!cancelled) applyAccountStateIfCurrent(taskId, nextAccountState);
      } catch (e) {
        console.error('[auth] account refresh failed after sync hydrate', e);
      }

      try {
        const previewTaskId = beginPreviewTask();
        const previewTask = getRestorePreview();
        void previewTask
          .then((preview) => {
            if (cancelled || !isCurrentPreview(previewTaskId)) return;
            setRestorePreview(preview);
            setShowRestorePrompt(preview.startupPromptEligible);
          })
          .catch(() => undefined);
        const preview = await withRemoteTimeout(previewTask, 'restore preview');
        if (cancelled || !isCurrentPreview(previewTaskId)) return;
        setRestorePreview(preview);
        setShowRestorePrompt(preview.startupPromptEligible);
      } catch (e) {
        console.error('[restore] getRestorePreview failed during bootstrap', e);
      }

      // Backup Completeness V2: backfill existing local state and publish a
      // completeness checkpoint once the owner is established and the queue
      // drains. Best-effort; never blocks bootstrap. The restore preview is
      // only re-read when this cycle actually captured a manifest (the common
      // no-op cycle leaves remote state and pending counts untouched, so a
      // second full preview would just repeat ~dozens of local scans and
      // remote meta requests for identical data).
      try {
        const maintenance = await runBackupMaintenance({ skipFlush: true });
        if (!cancelled && maintenance.capturedManifest) {
          const refreshedPreviewId = beginPreviewTask();
          const refreshedPreview = await getRestorePreview();
          if (!cancelled && isCurrentPreview(refreshedPreviewId)) {
            setRestorePreview(refreshedPreview);
          }
        }
      } catch (e) {
        console.error('[backup] maintenance failed during bootstrap', e);
      }

      // Durable cross-store settings recovery: a restore may have committed
      // the domain import but been interrupted before its theme settings were
      // applied to AsyncStorage. Retry the staged application until it
      // succeeds; the marker is cleared only on success.
      try {
        await applyPendingThemeApplication();
      } catch (e) {
        console.error('[backup] pending theme application failed during bootstrap', e);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    applyAccountStateIfCurrent,
    awaitAccountTask,
    beginAccountTask,
    beginPreviewTask,
    isCurrentPreview,
    bootstrapAttempt,
  ]);

  const retryBootstrap = useCallback(() => {
    setDbError(null);
    setSyncHydrated(false);
    setAuthBootstrapReady(false);
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void startSupabaseAutoRefresh().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void startSupabaseAutoRefresh().catch(() => undefined);
      } else {
        void stopSupabaseAutoRefresh().catch(() => undefined);
      }
    });
    return () => {
      subscription.remove();
      void stopSupabaseAutoRefresh().catch(() => undefined);
    };
  }, []);

  const refreshAccountState = useCallback(async () => {
    const taskId = beginAccountTask();
    const nextAccountState = await withRemoteTimeout(
      accountCoordinator.refresh(),
      'account refresh',
    );
    if (nextAccountState) applyAccountStateIfCurrent(taskId, nextAccountState);
  }, [applyAccountStateIfCurrent, beginAccountTask]);

  const runAccountAction = useCallback(
    async (action: () => Promise<AccountActionResult>): Promise<AccountActionResult> => {
      try {
        const result = await action();
        await refreshAccountState();
        return result;
      } catch {
        await refreshAccountState().catch(() => undefined);
        return {
          ok: false,
          status: 'error',
          message: 'We could not complete that account action. Your local data was not changed.',
        };
      }
    },
    [refreshAccountState],
  );

  const protectAccount = useCallback(
    (email: string) => runAccountAction(() => accountCoordinator.protect(email)),
    [runAccountAction],
  );
  const verifyAccountProtection = useCallback(
    (token: string) => runAccountAction(() => accountCoordinator.verifyProtection(token)),
    [runAccountAction],
  );
  const resendAccountProtection = useCallback(
    () => runAccountAction(() => accountCoordinator.resendProtection()),
    [runAccountAction],
  );
  const requestAccountRecovery = useCallback(
    (email: string) => runAccountAction(() => accountCoordinator.requestRecovery(email)),
    [runAccountAction],
  );
  const verifyAccountRecovery = useCallback(
    (token: string) => runAccountAction(() => accountCoordinator.verifyRecovery(token)),
    [runAccountAction],
  );
  const resendAccountRecovery = useCallback(
    () => runAccountAction(() => accountCoordinator.resendRecovery()),
    [runAccountAction],
  );

  useEffect(() => {
    if (!authBootstrapReady || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Supabase documents that auth callbacks should not perform additional
      // auth calls synchronously; reconcile on the next task instead.
      setTimeout(() => {
        void refreshAccountState().catch(() => undefined);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [authBootstrapReady, refreshAccountState]);

  // Readiness is tracked by ref so account transitions don't tear down and
  // rebuild the flush subscriptions below (each rebuild fired one
  // backoff-bypassing flush via NetInfo's immediate emit). A transition into
  // full readiness kicks exactly one flush instead.
  const remoteFlushReadyRef = useRef(false);
  // Core readiness gates every event-driven flush: the durable outbox must be
  // hydrated before any push. Account STATUS deliberately does not gate the
  // reconnect/visibility path — degraded statuses pause pushes inside the
  // adapter's ownership preflight (which re-verifies per push and keeps the
  // queue intact), so a transiently degraded status can never silently pin
  // pending work while the network is actually usable.
  const flushCoreReadyRef = useRef(false);
  const flushTriggerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    flushCoreReadyRef.current = authBootstrapReady && syncHydrated;
    const statusReady = ['anonymous_ready', 'protected', 'protection_pending'].includes(
      accountState.status,
    );
    const wasReady = remoteFlushReadyRef.current;
    remoteFlushReadyRef.current = flushCoreReadyRef.current && statusReady;
    if (remoteFlushReadyRef.current && !wasReady) flushTriggerRef.current?.();
  }, [accountState.status, authBootstrapReady, syncHydrated]);

  useEffect(() => {
    if (!isRemoteEnabled()) return;

    const flush = () => {
      if (!flushCoreReadyRef.current) return;
      void (async () => {
        try {
          await syncEngine.flush();
        } catch (e) {
          console.error('[sync] flush failed', e);
          return;
        }
        // After a successful push, run the backup maintenance cycle: it
        // checks whether a new completeness checkpoint is due and publishes
        // it only after the queue fully drains. Best-effort. The flush just
        // happened, so the cycle must not flush again (that would double
        // the sync-failure accounting while the backend is down). The
        // restore preview is re-read only when that cycle captured a
        // manifest — a no-op cycle leaves remote state and pending counts
        // untouched, so a second full preview would just repeat local scans
        // and remote meta requests for identical data.
        try {
          const maintenance = await runBackupMaintenance({ skipFlush: true });
          if (!maintenance.capturedManifest) return;
          const postFlushPreviewId = beginPreviewTask();
          const refreshedPreview = await getRestorePreview();
          if (isCurrentPreview(postFlushPreviewId)) {
            setRestorePreview(refreshedPreview);
          }
        } catch (e) {
          console.error('[backup] post-flush maintenance failed', e);
        }
      })();
    };
    flushTriggerRef.current = flush;

    // The fixed interval respects backoff — no point hammering a backend
    // that just failed. Visibility/reconnect are rarer, event-driven signals
    // where an opportunistic retry (bypassing backoff) is worth it.
    const intervalId = setInterval(() => {
      if (syncEngine.shouldAttemptFlush()) flush();
    }, 30_000);

    let removeVisibilityListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') flush();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) flush();
    });
    return () => {
      clearInterval(intervalId);
      removeVisibilityListener?.();
      unsubscribeNetInfo();
      flushTriggerRef.current = null;
    };
  }, [beginPreviewTask, isCurrentPreview]);

  const handleDismissRestorePrompt = async () => {
    try {
      await dismissCurrentRestorePrompt(restorePreview?.freshnessSignature ?? null);
      setRestorePreview((current) =>
        current
          ? {
              ...current,
              dismissedForCurrentBackup: true,
              startupPromptEligible: false,
            }
          : current,
      );
      setShowRestorePrompt(false);
      setRestorePromptError(null);
    } catch (e) {
      console.error('[restore] dismissCurrentRestorePrompt failed', e);
      setRestorePromptError('Unable to save this dismissal right now.');
    }
  };

  const handleRestoreFromPrompt = async () => {
    setRestorePromptBusy(true);
    setRestorePromptError(null);
    try {
      const result = await restoreFromRemoteBackup();
      const nextPreview = await getRestorePreview();
      setRestorePreview(nextPreview);
      const outcome = resolveRestorePromptOutcome({
        result,
        nextPreview,
      });
      setShowRestorePrompt(!outcome.dismissPrompt);
      setRestorePromptError(outcome.errorMessage);
    } catch (e) {
      console.error('[restore] restoreFromRemoteBackup failed', e);
      setShowRestorePrompt(true);
      setRestorePromptError('Restore failed. Your local data was left unchanged.');
    } finally {
      setRestorePromptBusy(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PomodoroCommandBridgeProvider>
          <InAppNoticeProvider>
            <DayRolloverProvider>
              <AppBootstrapStateContext.Provider
                value={{
                  authBootstrapReady,
                  accountState,
                  refreshAccountState,
                  protectAccount,
                  verifyAccountProtection,
                  resendAccountProtection,
                  requestAccountRecovery,
                  verifyAccountRecovery,
                  resendAccountRecovery,
                }}
              >
                <BootstrapGate
                  dbError={dbError}
                  syncHydrated={syncHydrated}
                  authBootstrapReady={authBootstrapReady}
                  onRetryDbBootstrap={retryBootstrap}
                >
                  {children}
                  <HabitReminderHost />
                  <WorkoutReminderHost />
                  <RestorePrompt
                    preview={restorePreview}
                    visible={showRestorePrompt}
                    busy={restorePromptBusy}
                    errorMessage={restorePromptError}
                    onDismiss={handleDismissRestorePrompt}
                    onRestore={handleRestoreFromPrompt}
                  />
                </BootstrapGate>
              </AppBootstrapStateContext.Provider>
            </DayRolloverProvider>
          </InAppNoticeProvider>
        </PomodoroCommandBridgeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function BootstrapGate({
  dbError,
  syncHydrated,
  authBootstrapReady,
  onRetryDbBootstrap,
  children,
}: PropsWithChildren<{
  dbError: string | null;
  syncHydrated: boolean;
  authBootstrapReady: boolean;
  onRetryDbBootstrap: () => void;
}>) {
  const { tokens } = useAppTheme();

  // Gate on remote bootstrap (bounded by withRemoteTimeout) rather than
  // pure local syncHydrated: the original 7b3724f/93c651b baseline that
  // passed e2e used authBootstrapReady, and local-first is already
  // ensured via hydrate-before-remote ordering plus withRemoteTimeout.
  if (!dbError && authBootstrapReady) return children;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.background,
        padding: 32,
      }}
    >
      <Text
        style={{
          marginBottom: 8,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: '600',
          color: tokens.text,
        }}
      >
        {dbError ? 'Unable to start' : 'Preparing local workspace'}
      </Text>
      <Text style={{ textAlign: 'center', fontSize: 14, color: tokens.textMuted }}>
        {dbError ?? 'Checking local backup ownership before remote backup is enabled.'}
      </Text>
      {dbError ? (
        <View style={{ marginTop: 16 }}>
          <Button label="Try again" onPress={onRetryDbBootstrap} />
        </View>
      ) : null}
    </View>
  );
}

function RestorePrompt({
  preview,
  visible,
  busy,
  errorMessage,
  onDismiss,
  onRestore,
}: {
  preview: RestorePreview | null;
  visible: boolean;
  busy: boolean;
  errorMessage: string | null;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const { tokens } = useAppTheme();

  if (!visible || !preview) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
        }}
      >
        <Card
          accentColor="#475569"
          variant="header"
          headerTitle="Restore backup"
          headerSubtitle="A remote backup is available and this device is still empty for user data."
          className="mb-0"
        >
          <View className="gap-3">
            <Text style={{ color: tokens.text, fontSize: 14, lineHeight: 20 }}>
              Restoring now imports your backed-up todos, habits, calorie history, focus history,
              workouts, saved meals, linked-action rules, and settings.
            </Text>
            {preview.latestRestorableBackupAt ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
                Latest restorable backup:{' '}
                {new Date(preview.latestRestorableBackupAt).toLocaleString()}
              </Text>
            ) : null}
            {preview.disclosures.map((item) => (
              <Text key={item} style={{ color: tokens.textMuted, fontSize: 13, lineHeight: 18 }}>
                {item}
              </Text>
            ))}
            {errorMessage ? (
              <Text style={{ color: '#b91c1c', fontSize: 13, lineHeight: 18 }}>{errorMessage}</Text>
            ) : null}
            <View className="gap-2">
              <Button
                label={busy ? 'Restoring...' : 'Restore backup'}
                onPress={onRestore}
                disabled={busy}
                color="#475569"
              />
              <Button label="Not now" onPress={onDismiss} variant="ghost" disabled={busy} />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
