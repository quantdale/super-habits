export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
