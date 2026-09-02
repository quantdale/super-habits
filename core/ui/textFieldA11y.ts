import { Platform } from 'react-native';

/**
 * Pure helper-text/error association model for TextField (unit-tested in
 * `tests/textFieldA11y.test.ts`). Web only: RN web exposes
 * `aria-describedby`; native readers announce the adjacent Text node.
 */
export function resolveTextFieldA11y(
  nativeID: string | undefined,
  error: string | null | undefined,
  helperText: string | undefined,
  platform: string = Platform.OS,
): { helperId?: string; errorId?: string; describedBy?: string; invalid: boolean } {
  const helperId = platform === 'web' && nativeID ? `${nativeID}-helper` : undefined;
  const errorId = platform === 'web' && nativeID ? `${nativeID}-error` : undefined;
  const describedBy =
    [error ? errorId : helperText ? helperId : undefined].filter(Boolean).join(' ') || undefined;
  return { helperId, errorId, describedBy, invalid: Boolean(error) };
}
