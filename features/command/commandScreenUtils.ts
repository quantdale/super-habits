import { toDateKey } from '@/lib/time';

export function getParserContext() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return { locale: 'en-US', timeZone: 'UTC' };
  }

  const options = Intl.DateTimeFormat().resolvedOptions();
  return {
    locale: options.locale ?? 'en-US',
    timeZone: options.timeZone ?? 'UTC',
  };
}

export function getTomorrowDateKey(base = new Date()): string {
  const nextDay = new Date(base);
  nextDay.setDate(nextDay.getDate() + 1);
  return toDateKey(nextDay);
}
