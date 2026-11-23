const listeners = new Set<() => void>();

export function subscribeToRewardRestore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRewardRestore(): void {
  for (const listener of listeners) listener();
}
