/**
 * Accessible name for the app's modal containers.
 *
 * RN-Web's `Modal` renders its container as an unnamed `role="dialog"`, so a
 * screen reader announces only "dialog". Naming that same container — rather
 * than nesting a second `role="dialog"` further down — keeps screen readers and
 * the web focus trap in `core/ui/useConfirmationDialog.tsx` (which queries
 * `[role="dialog"]`) on the one element that actually holds the sheet.
 *
 * The name is an `aria-label`: RN-Web's `aria-labelledby` would need a
 * generated id carried across the RN/native boundary, and the visible title is
 * already the string we want spoken.
 */
export function dialogA11yProps({
  accessibilityLabel,
  title,
}: {
  /** Explicit accessible name, when the caller supplies one. */
  accessibilityLabel?: string;
  /** Visible heading shown in the sheet's title row. */
  title?: string;
}): { 'aria-label': string } | undefined {
  // An explicit label wins over the heading, so a caller can name the dialog
  // more specifically than its visible title.
  const name = accessibilityLabel?.trim() || title?.trim();
  return name ? { 'aria-label': name } : undefined;
}
