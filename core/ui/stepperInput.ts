/**
 * Sanitize typed/pasted text for an integer-only stepper field. Text after the
 * first decimal separator ('.' or ',') is dropped instead of concatenated
 * ("10.5" -> "10", "1,5" -> "1"), other non-digits are stripped, and a typed
 * value above `max` clamps to `max` as you type. A thousands-grouped integer
 * ("1,500", "12,345") keeps its value with the group separators removed rather
 * than being truncated at the comma. Empty stays allowed (callers validate);
 * `min` is enforced only by the stepper buttons and callers.
 */
export function sanitizeStepperInput(text: string, max: number): string {
  const trimmed = text.trim();
  const grouped = /^\d{1,3}(,\d{3})+$/.test(trimmed);
  const whole = grouped ? trimmed.replace(/,/g, '') : trimmed.split(/[.,]/, 1)[0];
  const digits = whole.replace(/\D/g, '');
  if (digits === '') return '';
  const num = Number(digits);
  return num > max ? String(max) : digits;
}
