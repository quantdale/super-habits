import { isRemoteEnabled, supabase } from '@/lib/supabase';

export class RestoreAuthChangedError extends Error {
  constructor() {
    super('The authenticated owner changed during restore; restore aborted.');
    this.name = 'RestoreAuthChangedError';
  }
}

/**
 * A verified restore can wait for SQLite's writer after its last network
 * check. Observe session changes through the import without making auth
 * requests inside the transaction. A token refresh for the same owner is safe.
 */
export function watchRestoreSession(ownerUserId: string) {
  let changed = false;
  const subscription = supabase?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user.id !== ownerUserId) changed = true;
  }).data.subscription;

  return {
    assertCurrent: () => {
      if (changed || !isRemoteEnabled()) throw new RestoreAuthChangedError();
    },
    close() {
      subscription?.unsubscribe();
    },
  };
}
