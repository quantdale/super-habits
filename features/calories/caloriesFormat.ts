/** Locale-formatted kcal/secondary metric for the Calories surfaces. */
export function formatKcal(kcal: number): string {
  if (!Number.isFinite(kcal)) return '0';
  return Math.round(kcal).toLocaleString('en-US');
}

/** "Today" / "Yesterday" / "Mon, Oct 5" for the hero's context line. */
export function formatDayContext(dateKey: string): string {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (dateKey === localKey(today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateKey === localKey(yesterday)) return 'Yesterday';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Long-form day label: "Monday, October 12". */
export function formatDayContextLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
