import type { SubmitGuard } from '@/lib/submitGuard';

/**
 * One activation of the inline quick-add input.
 *
 * Extracted from `TodoQuickCapture.tsx` so the same-tick re-entrancy contract is
 * executable without a React renderer: both entry paths (the circular add
 * button's `onPress` and the `TextInput`'s `onSubmitEditing`) funnel through
 * this function, and it is the ONLY place the guard is entered.
 *
 * Why the shared guard rather than the `isSubmitting` state: the state flag is
 * React state, so a second activation inside the same tick still reads the
 * pre-`setIsSubmitting` render closure — `canSubmit` is `true` and the write
 * runs twice. `createSubmitGuard()` is a synchronous process-memory latch
 * (`lib/submitGuard.ts`), so the second activation is rejected before any
 * `await`, and the presentation flag stays what it was always meant to be: the
 * button's loading display.
 *
 * Validation order is unchanged: `canSubmit` (non-empty trimmed title) is
 * checked before the guard, and the caller's persist path still validates
 * before it writes.
 *
 * Failure contract (CORR-A-02): a rejected write is NEVER swallowed into a
 * silent no-op and NEVER escapes as an unhandled rejection. The typed input is
 * preserved (`onPersisted` does not run), the guard is released so retry is
 * possible, and the error is delivered to `onPersistFailed` so the caller can
 * surface it. The function is total: it resolves with `'failed'` instead of
 * throwing, so `void handleSubmit()` cannot produce an unhandled rejection.
 */
export async function submitInlineQuickAdd(input: {
  /** Shared synchronous re-entry guard for this input instance. */
  guard: SubmitGuard;
  /** Whether the input is currently submittable — read at call time. */
  canSubmit: boolean;
  /** The trimmed title to persist. */
  title: string;
  /** Persists the row; resolves after the write commits. */
  persist: (title: string) => Promise<void>;
  /** Called once the submit is accepted, before the write (loading presentation). */
  onSubmittingChange: (submitting: boolean) => void;
  /** Called after a successful write (clears the input). */
  onPersisted: () => void;
  /** Called with the rejection when the write fails (surfaces the failure). */
  onPersistFailed?: (error: unknown) => void;
}): Promise<'skipped' | 'persisted' | 'failed'> {
  const { guard, canSubmit, title, persist, onSubmittingChange, onPersisted, onPersistFailed } =
    input;

  // Empty input: no submit, no write, no loading presentation.
  if (!canSubmit) return 'skipped';
  // Same-tick re-entry: the second of two activations starts no write.
  if (!guard.tryStart()) return 'skipped';

  onSubmittingChange(true);
  try {
    await persist(title);
    onPersisted();
    return 'persisted';
  } catch (error) {
    // The typed input is NOT cleared (onPersisted does not run) and the error
    // is reported instead of discarded or left unhandled.
    onPersistFailed?.(error);
    return 'failed';
  } finally {
    // Release on every exit — success, validation error, or persistence
    // failure — so one failed attempt cannot lock the input.
    guard.finish();
    onSubmittingChange(false);
  }
}
