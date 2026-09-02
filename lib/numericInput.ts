/**
 * Shared numeric-input model for every numeric entry field.
 *
 * Two pure functions, no React, no DB:
 *
 * - `sanitizeNumericInput` — onChange filter: strips invalid characters,
 *   preserves valid partial states (`""`, `"."`, `"12."`), never reformats
 *   what the user typed (prevents cursor jumps mid-typing).
 * - `parseNumericInput` — submit-time canonicalization: blank or invalid
 *   input parses to `null` (blank is distinct from zero), otherwise a
 *   finite number.
 *
 * Decimal support is opt-in per field (`allowDecimal`). Integer-only is the
 * default so calorie macros and rep counts keep their prior strictness;
 * weight/distance/pace fields pass `{ allowDecimal: true }`.
 *
 * Locale note: the app is en-US; the decimal point is the only accepted
 * decimal separator. No separator localization in this model.
 */

const DECIMAL_ALLOWED_PATTERN = /[^0-9.]/g;
const INTEGER_PATTERN = /[^0-9]/g;

export type NumericInputOptions = {
  /** Allow a single decimal point (weight, distance, pace). Default: false. */
  allowDecimal?: boolean;
};

/**
 * Coerce a raw typed string into a partial-state-preserving display string.
 *
 * - Integer mode keeps digits only.
 * - Decimal mode keeps digits and at most one `.`.
 * - Valid partial states (`""`, `"."`, `"12."`) are preserved as-is.
 * - Never converts a partial state to a number (that happens at submit).
 */
export function sanitizeNumericInput(raw: string, options: NumericInputOptions = {}): string {
  const { allowDecimal = false } = options;
  const pattern = allowDecimal ? DECIMAL_ALLOWED_PATTERN : INTEGER_PATTERN;
  let next = raw.replace(pattern, '');
  if (allowDecimal) {
    const firstDot = next.indexOf('.');
    if (firstDot !== -1) {
      next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '');
    }
  }
  return next;
}

/**
 * Canonical submit-time parse.
 *
 * - Trimmed; empty/blank input → `null` (unset — distinct from zero).
 * - Non-numeric text (`"abc"`, `"Infinity"`) → `null`.
 * - Unambiguous trailing-dot partials parse leniently (`"12."` → 12,
 *   `".5"` → 0.5) — that is what the user meant by submit time.
 * - Otherwise the finite number value.
 *
 * Call sites decide what `null` means (unset, keep previous, validation
 * error) and what `0` means (explicit zero).
 */
export function parseNumericInput(raw: string, options: NumericInputOptions = {}): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  const { allowDecimal = false } = options;
  if (!allowDecimal && !Number.isInteger(value)) return null;
  return value;
}
