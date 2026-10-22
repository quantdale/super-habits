import { describe, expect, it, vi } from 'vitest';
import { createSubmitGuard, type SubmitGuard } from '@/lib/submitGuard';
import { submitInlineQuickAdd } from '@/features/todos/todoQuickCapture.submit';

/**
 * The inline quick-add input's same-tick re-entrancy contract ("one row or
 * zero, never two"), asserted against the real orchestration the component
 * runs. Both entry paths — the circular add button's onPress and the
 * TextInput's onSubmitEditing — call this same function, so a double
 * activation from either path (or from both at once) must produce exactly one
 * write.
 *
 * The regression this pins: `canSubmit` is derived from React state, so two
 * activations inside one tick both read it as `true` before either
 * `setIsSubmitting` commits. Only the synchronous guard rejects the second.
 */
describe('submitInlineQuickAdd', () => {
  function harness() {
    const guard: SubmitGuard = createSubmitGuard();
    const persist = vi.fn().mockResolvedValue(undefined);
    const onSubmittingChange = vi.fn();
    const onPersisted = vi.fn();
    const call = (title = 'Buy milk', canSubmit = true) =>
      submitInlineQuickAdd({
        guard,
        canSubmit,
        title,
        persist,
        onSubmittingChange,
        onPersisted,
      });
    return { guard, persist, onSubmittingChange, onPersisted, call };
  }

  it('persists exactly one row when the Enter-key path submits twice in one tick', async () => {
    const { persist, call } = harness();

    // Two onSubmitEditing activations in the same tick, before either await
    // settles — the fastest a user can double-press Enter.
    await Promise.all([call('Buy milk'), call('Buy milk')]);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('Buy milk');
  });

  it('persists exactly one row when the press path submits twice in one tick', async () => {
    const { persist, call } = harness();

    await Promise.all([call(), call()]);

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('persists exactly one row when both entry paths fire in one tick', async () => {
    const { persist, call } = harness();

    await Promise.all([call(), call('Buy milk')]);

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('allows a later submission once the first has settled', async () => {
    const { persist, onSubmittingChange, call } = harness();

    await call();
    await call();

    expect(persist).toHaveBeenCalledTimes(2);
    // Loading presentation toggles on and off for each accepted submit.
    expect(onSubmittingChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  it('writes nothing while the input is empty (validation-before-write preserved)', async () => {
    const { persist, onSubmittingChange, call } = harness();

    await expect(call('  ', false)).resolves.toBe('skipped');

    expect(persist).not.toHaveBeenCalled();
    expect(onSubmittingChange).not.toHaveBeenCalled();
  });

  it('clears the input and reports persisted after a successful write', async () => {
    const { onPersisted, call } = harness();

    await expect(call()).resolves.toBe('persisted');
    expect(onPersisted).toHaveBeenCalledTimes(1);
  });

  it('releases the guard when persistence fails and reports the failure without clearing input', async () => {
    const { guard, persist, onSubmittingChange, onPersisted, call } = harness();
    const failure = new Error('disk full');
    persist.mockRejectedValueOnce(failure);

    // The failure contract is total and observable: no throw (so `void
    // handleSubmit()` can never become an unhandled rejection) and the typed
    // input is preserved because onPersisted never runs.
    await expect(call()).resolves.toBe('failed');
    expect(onPersisted).not.toHaveBeenCalled();
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);

    // A retry after the failure is accepted, and the guard is released again
    // once that attempt settles.
    await call();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(guard.tryStart()).toBe(true);
    guard.finish();
  });

  it('delivers the rejection to onPersistFailed when the write fails', async () => {
    const guard: SubmitGuard = createSubmitGuard();
    const failure = new Error('quota exceeded');
    const onPersistFailed = vi.fn();
    const onPersisted = vi.fn();

    const result = await submitInlineQuickAdd({
      guard,
      canSubmit: true,
      title: 'Buy milk',
      persist: vi.fn().mockRejectedValue(failure),
      onSubmittingChange: vi.fn(),
      onPersisted,
      onPersistFailed,
    });

    expect(result).toBe('failed');
    expect(onPersistFailed).toHaveBeenCalledTimes(1);
    expect(onPersistFailed).toHaveBeenCalledWith(failure);
    expect(onPersisted).not.toHaveBeenCalled();
    // Retry is possible immediately.
    expect(guard.tryStart()).toBe(true);
    guard.finish();
  });
});
