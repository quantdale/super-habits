/**
 * W11.5: user-facing copy for a rejected Planning write.
 *
 * A rejected write can fail for two very different reasons: a validation
 * error whose message is already written for users ("Goal title is
 * required…"), or a low-level storage failure whose engine message
 * ("Error finalizing statement") is meaningless in the UI. The failure
 * surfaces added in W11 (Daily Plan save/complete, Goal/Project delete,
 * Project lifecycle) must show a meaningful sentence in both cases, so
 * this helper maps engine noise to the caller's curated copy while
 * passing genuine validation messages through untouched.
 */

/** Engine/storage failure signatures that must never reach the screen raw. */
const LOW_LEVEL_PATTERNS: RegExp[] = [
  /finalizing statement/i,
  /database is locked/i,
  /disk (?:i\/o|image|full)|database or disk is full/i,
  /readonly database/i,
  /unable to open database file/i,
  /sqlite_(?:busy|corrupt|readonly|ioerr|full|cantopen)/i,
  /attempt to write a readonly database/i,
  /constraint failed/i,
  /not authorized/i,
];

/**
 * Describe a write failure for display. `fallback` is the caller's
 * curated sentence (e.g. "Could not save the plan. Please try again.");
 * validation-style messages that were written for users pass through.
 */
export function describePlanningWriteError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message?.trim();
    if (message) {
      if (LOW_LEVEL_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
      // Short, sentence-like messages are the data layer's own user copy
      // (validation rejections); anything long or stack-shaped is engine
      // noise that must not leak into the UI.
      if (message.length <= 120 && !/\bat \b|\n|undefined is not/.test(message)) return message;
      return fallback;
    }
  }
  return fallback;
}
