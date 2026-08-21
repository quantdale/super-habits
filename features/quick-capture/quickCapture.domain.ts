import { isValidDateKey, toDateKey } from '@/lib/time';
import type { TodoPriority } from '@/core/db/types';

/** Minimal shapes the parser needs; callers pass their loaded lists in. */
export type QuickCaptureMatchTarget = { id: string; name: string };

export type QuickCaptureParseOptions = {
  projects?: QuickCaptureMatchTarget[];
  goals?: QuickCaptureMatchTarget[];
  /** Injectable "now" for deterministic tests. */
  now?: Date;
};

export type QuickCaptureParseResult = {
  /** Remaining text after stripping recognized tokens. */
  title: string;
  dueDateKey: string | null;
  priority: TodoPriority;
  projectId: string | null;
  goalId: string | null;
  matchedProjectName: string | null;
  matchedGoalName: string | null;
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function nextWeekdayKey(targetDow: number, today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let addDays = (targetDow - d.getDay() + 7) % 7;
  if (addDays === 0) addDays = 7; // "on monday" said on a Monday means next week.
  d.setDate(d.getDate() + addDays);
  return toDateKey(d);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Match a leading `#name` / `@name` mention against the provided list.
 * Comparison is case- and whitespace-insensitive and allows the mention to
 * cover multiple words (e.g. `#Home Reno` matches project "Home Renovation"
 * only by prefix of the normalized name — here we require the mention to be a
 * prefix of the target name or an exact match).
 */
function matchMention(
  text: string,
  marker: '#' | '@',
  targets: QuickCaptureMatchTarget[],
): { id: string; matchedName: string; rest: string } | null {
  if (text[0] !== marker) return null;
  const body = text.slice(1);
  const normalizedBody = normalize(body);
  if (!normalizedBody) return null;

  let best: { target: QuickCaptureMatchTarget; consumedChars: number } | null = null;
  for (const target of targets) {
    const normalizedTarget = normalize(target.name);
    if (!normalizedTarget) continue;
    // Try progressively shorter word-boundary prefixes of the name:
    // "#home renovation x" (full) and "#home x" (prefix) both match
    // "Home Renovation"; "#homework" never matches.
    const words = normalizedTarget.split(' ');
    for (let k = words.length; k >= 1; k--) {
      const candidate = words.slice(0, k).join(' ');
      if (normalizedBody === candidate || normalizedBody.startsWith(`${candidate} `)) {
        if (!best || candidate.length > best.consumedChars) {
          best = { target, consumedChars: candidate.length };
        }
        break;
      }
    }
  }
  if (!best) return null;

  // Strip the marker plus the characters that correspond to the matched
  // normalized length from the raw text (raw and normalized can differ in
  // whitespace runs; walk the raw string to find the cut point).
  let seen = 0;
  let cut = 1; // skip the marker itself
  while (cut < body.length && seen < best.consumedChars) {
    // Skip whitespace runs count as single chars in normalized space.
    if (/\s/.test(body[cut])) {
      const alreadyCollapsed = /\s/.test(body[cut - 1] ?? '');
      if (!alreadyCollapsed) seen += 1;
    } else {
      seen += 1;
    }
    cut += 1;
  }
  return { id: best.target.id, matchedName: best.target.name, rest: body.slice(cut) };
}

/**
 * Lightweight natural-language parsing for quick capture. Pure function: all
 * matching against projects/goals uses the lists passed in by the caller.
 *
 * Recognized tokens:
 * - Due dates: "today", "tomorrow", weekday names ("friday", "on fri"),
 *   and explicit `YYYY-MM-DD`.
 * - Priority: trailing/leading `!urgent` / `!low`, or the bare word "urgent".
 * - Leading mentions: `#project name` and `@goal name`.
 */
export function parseQuickCapture(
  rawInput: string,
  options: QuickCaptureParseOptions = {},
): QuickCaptureParseResult {
  const now = options.now ?? new Date();
  let text = rawInput.trim();
  let dueDateKey: string | null = null;
  let priority: TodoPriority = 'normal';
  let projectId: string | null = null;
  let goalId: string | null = null;
  let matchedProjectName: string | null = null;
  let matchedGoalName: string | null = null;

  // Leading project/goal mentions.
  const projectMatch = matchMention(text, '#', options.projects ?? []);
  if (projectMatch) {
    projectId = projectMatch.id;
    matchedProjectName = projectMatch.matchedName;
    text = projectMatch.rest.trim();
  }
  const goalMatch = matchMention(text, '@', options.goals ?? []);
  if (goalMatch) {
    goalId = goalMatch.id;
    matchedGoalName = goalMatch.matchedName;
    text = goalMatch.rest.trim();
  }

  // Priority tokens.
  const urgentToken = /(^|\s)!?urgent(?=\s|$)/i.exec(text);
  if (urgentToken) {
    priority = 'urgent';
    text = text.replace(urgentToken[0], ' ');
  }
  const lowToken = /(^|\s)!low(?=\s|$)/i.exec(text);
  if (lowToken) {
    priority = 'low';
    text = text.replace(lowToken[0], ' ');
  }

  // Explicit date key.
  const dateToken = /(^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/.exec(text);
  if (dateToken && isValidDateKey(dateToken[2])) {
    dueDateKey = dateToken[2];
    text = text.replace(dateToken[0], ' ');
  }

  if (dueDateKey === null) {
    const lower = normalize(text);
    if (/(^|\s)(today|tod)(?=\s|$)/.test(lower)) {
      dueDateKey = toDateKey(now);
      text = text.replace(/(^|\s)(today|tod)(?=\s|$)/i, ' ');
    } else if (/(^|\s)(tomorrow|tmr|tmrw)(?=\s|$)/.test(lower)) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      t.setDate(t.getDate() + 1);
      dueDateKey = toDateKey(t);
      text = text.replace(/(^|\s)(tomorrow|tmr|tmrw)(?=\s|$)/i, ' ');
    } else {
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const names = [WEEKDAYS[i], WEEKDAYS[i].slice(0, 3)];
        for (const name of names) {
          const re = new RegExp(`(^|\\s)(on\\s+)?${name}(?=\\s|$)`, 'i');
          if (re.test(text)) {
            dueDateKey = nextWeekdayKey(i, now);
            text = text.replace(re, ' ');
            break;
          }
        }
        if (dueDateKey) break;
      }
    }
  }

  return {
    title: text.replace(/\s+/g, ' ').trim(),
    dueDateKey,
    priority,
    projectId,
    goalId,
    matchedProjectName,
    matchedGoalName,
  };
}
