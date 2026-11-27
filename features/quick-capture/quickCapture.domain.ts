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

/**
 * Abbreviations that are also ordinary English words (`sun cream`, `sat nav`).
 * Matching these bare rewrote the title and invented a due date, so they only
 * count in the qualified `on sat` form. Every other abbreviation (`mon`, `tue`,
 * `thu`, `fri`) stays unambiguous and keeps matching bare.
 */
const AMBIGUOUS_WEEKDAY_ABBREVIATIONS = new Set(['sun', 'wed', 'sat']);

/**
 * One qualifier word of a weekday date phrase, e.g. `on `, `next `,
 * `the coming `, `this coming `.
 *
 * English stacks these ("the coming friday", "this coming tuesday"), and the
 * date phrase is the whole stack: consuming only the last word stranded "the"
 * or "this" at the front of the captured title ("the call mom"). The article
 * only counts as part of a qualifier phrase — never bare — so "the friday" and
 * "the next cake" stay title text.
 */
const WEEKDAY_QUALIFIER_PHRASE = `(?:the\\s+)?(?:on|next|this|coming)\\s+`;

/**
 * Clause boundary around a recognized token.
 *
 * The old boundary was `(\s|$)`, which is not what punctuation does in real
 * captures: `Buy milk tomorrow.` saved a todo titled "Buy milk tomorrow." with
 * NO due date, and `Fix leak !urgent.` saved a normal-priority todo titled
 * "Fix leak !urgent.". Punctuation is a clause boundary, not part of a date or
 * priority token, so a token may start after `,`/`;`/`:` and ends at a
 * punctuation mark, whitespace, or the end of the input.
 *
 * Both boundaries CONSUME their match, so the token replacement takes the
 * punctuation with it (`!urgent.` → gone, `today.` → gone) instead of leaving a
 * stranded '.' behind in the captured title.
 */
const LEAD = `(^|[\\s,;:]+)`;
const TAIL = `(?:[.,!?;:]|\\s|$)`;

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
 * - Due dates: "today", "tomorrow", weekday names ("friday", "on fri", and
 *   bare unambiguous abbreviations like "fri" and "mon"; `sun`/`wed`/`sat` are
 *   common English words, so those need the "on" qualifier), and explicit
 *   `YYYY-MM-DD`.
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

  // Leading project/goal mentions. Both markers are matched independently:
  // ownership of the leading-strip used to be order-dependent (a capture that
  // led with `@goal #project …` matched only the goal and saved
  // projectId = null with `#project` still in the title). Repeated markers of
  // the same kind keep their leftovers as title text.
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
  if (projectId === null && goalMatch) {
    // `@goal #project …`: the goal mention was leading, so the project mention
    // now sits at the front and has to be consumed too.
    const trailingProjectMatch = matchMention(text, '#', options.projects ?? []);
    if (trailingProjectMatch) {
      projectId = trailingProjectMatch.id;
      matchedProjectName = trailingProjectMatch.matchedName;
      text = trailingProjectMatch.rest.trim();
    }
  } else if (goalId === null && projectMatch) {
    const trailingGoalMatch = matchMention(text, '@', options.goals ?? []);
    if (trailingGoalMatch) {
      goalId = trailingGoalMatch.id;
      matchedGoalName = trailingGoalMatch.matchedName;
      text = trailingGoalMatch.rest.trim();
    }
  }

  // Priority tokens. Punctuation closing the token (`!urgent.`, `urgent,`) is
  // consumed with it, so the title never keeps a stranded '.' or '!'. A word
  // that merely CONTAINS the token (`Urgently`) cannot match: the tail
  // boundary requires punctuation, whitespace, or end of input.
  const urgentPattern = new RegExp(`${LEAD}!?urgent${TAIL}`, 'i');
  const urgentToken = urgentPattern.exec(text);
  if (urgentToken) {
    priority = 'urgent';
    text = text.replace(urgentToken[0], ' ');
  }
  const lowPattern = new RegExp(`${LEAD}!low${TAIL}`, 'i');
  const lowToken = lowPattern.exec(text);
  if (lowToken) {
    priority = 'low';
    text = text.replace(lowToken[0], ' ');
  }

  // Explicit date key.
  const dateToken = new RegExp(`${LEAD}(\\d{4}-\\d{2}-\\d{2})${TAIL}`).exec(text);
  if (dateToken && isValidDateKey(dateToken[2])) {
    dueDateKey = dateToken[2];
    text = text.replace(dateToken[0], ' ');
  }

  if (dueDateKey === null) {
    const todayPattern = new RegExp(`${LEAD}(today|tod)${TAIL}`, 'i');
    const tomorrowPattern = new RegExp(`${LEAD}(tomorrow|tmr|tmrw)${TAIL}`, 'i');
    if (todayPattern.test(text)) {
      dueDateKey = toDateKey(now);
      text = text.replace(todayPattern, ' ');
    } else if (tomorrowPattern.test(text)) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      t.setDate(t.getDate() + 1);
      dueDateKey = toDateKey(t);
      text = text.replace(tomorrowPattern, ' ');
    } else {
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const fullName = WEEKDAYS[i];
        const abbreviation = fullName.slice(0, 3);
        const patterns = [
          // Full names always count ("friday", "on friday"); a leading
          // "next/this/coming" qualifier is part of the date phrase and is
          // consumed with it, so the title never keeps a stranded "next".
          new RegExp(`${LEAD}(?:${WEEKDAY_QUALIFIER_PHRASE})*${fullName}${TAIL}`, 'i'),
          // Unambiguous abbreviations count bare ("fri"); ambiguous ones only
          // with a qualifier ("on sat", "next sat").
          AMBIGUOUS_WEEKDAY_ABBREVIATIONS.has(abbreviation)
            ? new RegExp(`${LEAD}(?:${WEEKDAY_QUALIFIER_PHRASE})+${abbreviation}${TAIL}`, 'i')
            : new RegExp(`${LEAD}(?:${WEEKDAY_QUALIFIER_PHRASE})*${abbreviation}${TAIL}`, 'i'),
        ];
        const pattern = patterns.find((candidate) => candidate.test(text));
        if (pattern) {
          dueDateKey = nextWeekdayKey(i, now);
          text = text.replace(pattern, ' ');
          break;
        }
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
